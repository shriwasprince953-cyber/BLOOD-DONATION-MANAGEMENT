import test from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "../src/api/client.js";
import { ensureProfile } from "../src/lib/account.js";

const session = async () => ({ data: { session: { access_token: "test-token" } } });
function client(fetcher, getSession = session) {
  return createApiClient({ baseURL: "http://localhost:8000/api/v1/", getSession, fetcher });
}

test("authenticated calls include current token and normalize URL", async () => {
  const api = client(async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/v1/auth/me");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.ok(options.signal);
    return Response.json({ role: "DONOR" });
  });
  assert.equal((await api.get("/auth/me")).data.role, "DONOR");
});

test("failed saves preserve server message and status", async () => {
  const api = client(async () => Response.json({ detail: "Profile is already registered." }, { status: 409 }));
  await assert.rejects(api.post("/auth/register", {}), { status: 409, message: "Profile is already registered." });
});

test("validation errors identify the rejected input", async () => {
  const api = client(async () => Response.json({ detail: [{ loc: ["body", "full_name"], msg: "Too short" }] }, { status: 422 }));
  await assert.rejects(api.patch("/auth/me", {}), { status: 422, message: "full_name: Too short" });
});

test("network errors never become successful writes", async () => {
  const api = client(async () => { throw new TypeError("fetch failed"); });
  await assert.rejects(api.post("/responses", {}), /Unable to reach the server/);
});

test("empty successful responses are supported", async () => {
  const api = client(async () => new Response(null, { status: 204 }));
  assert.equal((await api.patch("/auth/me", {})).data, null);
});

test("combined profile save uses PUT and returns canonical saved data", async () => {
  const payload = { full_name: "Saved User", donor: { blood_group: "O+", is_available: true } };
  const api = client(async (url, options) => {
    assert.equal(url, "http://localhost:8000/api/v1/auth/me");
    assert.equal(options.method, "PUT");
    assert.deepEqual(JSON.parse(options.body), payload);
    return Response.json({ ...payload, role: "DONOR" });
  });
  assert.equal((await api.put("/auth/me", payload)).data.donor.blood_group, "O+");
});

test("directory errors preserve failure status instead of yielding an empty list", async () => {
  const api = client(async () => Response.json({ detail: "Account data could not be loaded." }, { status: 503 }));
  await assert.rejects(api.get("/admin/users"), { status: 503, message: "Account data could not be loaded." });
});

test("session errors stop requests", async () => {
  const api = client(() => assert.fail("request must not run"), async () => ({ data: { session: null }, error: new Error("Session expired") }));
  await assert.rejects(api.get("/auth/me"), /Session expired/);
});

test("confirmed signup provisions missing application profile", async () => {
  const api = {
    get: async () => { throw Object.assign(new Error(), { status: 403 }); },
    post: async (url, body) => {
      assert.equal(url, "/auth/register");
      assert.deepEqual(body, { full_name: "Test Donor", email: "donor@example.com" });
      return { data: { role: "DONOR" } };
    },
  };
  assert.equal((await ensureProfile(api, { email: "donor@example.com", user_metadata: { full_name: "Test Donor" } })).data.role, "DONOR");
});

test("simultaneous registration recovers from conflict", async () => {
  let calls = 0;
  const api = {
    get: async () => { if (++calls === 1) throw Object.assign(new Error(), { status: 403 }); return { data: { role: "DONOR" } }; },
    post: async () => { throw Object.assign(new Error(), { status: 409 }); },
  };
  assert.equal((await ensureProfile(api, { email: "donor@example.com" })).data.role, "DONOR");
  assert.equal(calls, 2);
});

for (const status of [401, 500, 503]) {
  test(`authentication/server error ${status} does not register a new account`, async () => {
    const api = {
      get: async () => { throw Object.assign(new Error(), { status }); },
      post: () => assert.fail("must not register"),
    };
    await assert.rejects(ensureProfile(api, { email: "donor@example.com" }), { status });
  });
}
