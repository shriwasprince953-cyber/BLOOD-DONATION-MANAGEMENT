import { test, expect } from "@playwright/test";

const donor = { blood_group: "O+", is_available: true, city: "Test City", last_donation_date: null };
const profile = { id: "user-1", full_name: "Saved Name", email: "user@example.com", phone_number: null, role: "ADMIN", donor: null };
const requirement = { id: "request-1", patient_name: "Test Patient", blood_group: "O+", units_required: 1,
  hospital_name: "Test Hospital", location: "Another City", urgency_level: "HIGH", status: "OPEN", created_at: "2026-10-01T10:00:00Z" };

async function fixture(page, overrides = {}) {
  const state = { profile: { ...profile }, failUsers: false, failMatches: false, failRequests: false, failSave: false, saves: [], ...overrides };
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    // Tests must never contact deployed Auth/API services.
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname === "/src/lib/supabase.js") return route.fulfill({ contentType: "application/javascript", body: `
      export const supabase = { auth: {
        getSession: async () => ({ data: { session: { access_token: "test-token", user: { id: "user-1" } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ data: { user: { email: "user@example.com" } }, error: null }),
      }};` });
    if (!url.pathname.startsWith("/api/v1/")) return route.continue();
    const reply = (data, status = 200) => route.fulfill({ status, json: data });
    const path = url.pathname.slice("/api/v1".length);
    if (path === "/auth/me") {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON(); state.saves.push(body);
        if (state.failSave) return reply({ detail: "Save rejected" }, 409);
        state.profile = { ...state.profile, ...body };
      }
      return reply(state.profile);
    }
    if (path === "/admin/stats") return reply({ totalUsers: 21, totalDonors: 2, availableDonors: 1, totalRequests: 1, activeRequests: 1 });
    if (path === "/admin/users") {
      if (state.failUsers) return reply({ detail: "Directory unavailable" }, 503);
      const offset = Number(url.searchParams.get("offset"));
      const users = Array.from({ length: 21 }, (_, i) => ({ id: String(i), full_name: `Person ${i}`, email: `person${i}@example.com`,
        role: i === 0 ? null : "DONOR", account_status: i === 0 ? "EMAIL_PENDING" : "CONFIRMED",
        profile_status: i === 0 ? "SETUP_PENDING" : i === 1 ? "DONOR_REGISTERED" : "PROFILE_ONLY",
        blood_group: i === 1 ? "O+" : null, is_available: i === 1 ? false : null, city: null }));
      return reply({ items: users.slice(offset, offset + 20), total: 21 });
    }
    if (path === "/requirements" || path === "/donors/me/requirements/page") {
      if (state.failRequests) return reply({ detail: "Requests unavailable" }, 503);
      return reply({ items: [requirement], total: 1 });
    }
    if (path === "/matching/requirements/request-1/donors") {
      if (state.failMatches) return reply({ detail: "Matches unavailable" }, 503);
      return reply([{ ...donor, profile_id: "donor-1", full_name: "Matched Person", email: "match@example.com" }]);
    }
    return reply({ detail: `Unexpected test endpoint: ${path}` }, 500);
  });
  return state;
}

test("admin sees pending users, non-donors, accurate labels and the next page", async ({ page }) => {
  await fixture(page);
  await page.goto("/admin");
  await expect(page.getByText("Email verification pending", { exact: false })).toBeVisible();
  await expect(page.getByText("Profile setup pending", { exact: false })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(page.locator(".stat-card").filter({ hasText: "Total Users" }).locator("strong")).toHaveText("21");
  await expect(page.locator(".stat-card").filter({ hasText: "Registered Donors" }).locator("strong")).toHaveText("2");
  await expect(page.locator(".stat-card").filter({ hasText: "Available Donors" }).locator("strong")).toHaveText("1");
  await page.locator(".user-directory").getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Person 20", { exact: true })).toBeVisible();
  await expect(page.getByText("Person 0", { exact: true })).toHaveCount(0);
});

test("directory and matching failures never display empty-success messages and recover", async ({ page }) => {
  const state = await fixture(page, { failUsers: true, failMatches: true });
  await page.goto("/admin");
  await expect(page.getByText("Directory unavailable")).toBeVisible();
  await expect(page.getByText("No registered users found.")).toHaveCount(0);
  state.failUsers = false;
  await page.getByRole("button", { name: "Retry users" }).click();
  await expect(page.getByText("Person 0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Find Matches/ }).click();
  await expect(page.getByText("Matches unavailable")).toBeVisible();
  await expect(page.getByText(/No available donors registered/)).toHaveCount(0);
  state.failMatches = false;
  await page.getByRole("button", { name: "Retry matches" }).click();
  await expect(page.getByText("Matched Person", { exact: true })).toBeVisible();
});

test("non-donor can save basic details, then opt in and save donor details atomically", async ({ page }) => {
  const state = await fixture(page, { profile: { ...profile, role: "DONOR" } });
  await page.goto("/profile");
  await page.getByLabel("Full Name", { exact: true }).fill("Updated Name");
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page.getByText("Profile updated successfully!")).toBeVisible();
  expect(state.saves[0].donor).toBeNull();
  await page.getByLabel("Register as a blood donor").check();
  await page.getByLabel("Blood Group", { exact: true }).selectOption("O+");
  state.failSave = true;
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page.getByText(/Save rejected/)).toBeVisible();
  await expect(page.getByText("Profile updated successfully!")).toHaveCount(0);
  state.failSave = false;
  await page.getByRole("button", { name: "Save Profile", exact: true }).click();
  await expect(page.getByText("Profile updated successfully!")).toBeVisible();
  await expect(page.getByLabel("Blood Group", { exact: true })).toBeDisabled();
  expect(state.saves.at(-1).donor.blood_group).toBe("O+");
});

test("donor sees saved values, request errors and retry; incomplete profile gets setup prompt", async ({ page }) => {
  const state = await fixture(page, { profile: { ...profile, role: "DONOR", donor }, failRequests: true });
  await page.goto("/dashboard");
  await expect(page.getByText("Requests unavailable")).toBeVisible();
  await expect(page.getByText(/No active requests match/)).toHaveCount(0);
  state.failRequests = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".stat-card").filter({ hasText: "Blood Group" }).locator("strong")).toHaveText("O+");
  await expect(page.locator(".stat-card").filter({ hasText: "Available Requests" }).locator("strong")).toHaveText("1");
  state.profile = { ...profile, role: "DONOR" };
  await page.goto("/requirements");
  await expect(page.getByRole("heading", { name: "Complete your donor profile" })).toBeVisible();
  await expect(page.getByText("No matching requests", { exact: true })).toHaveCount(0);
});

test("mobile directory scrolls within the card without widening the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "All registered users" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
