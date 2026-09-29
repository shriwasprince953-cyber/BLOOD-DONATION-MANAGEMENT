// Recover signup when email confirmation delayed application-profile creation.
export async function ensureProfile(api, user) {
  try {
    return await api.get("/auth/me");
  } catch (error) {
    if (error.status !== 403 || !user?.email) throw error;
  }
  try {
    return await api.post("/auth/register", {
      full_name: user.user_metadata?.full_name?.trim() || user.email,
      email: user.email,
    });
  } catch (error) {
    // Another tab or a repeated confirmation may have finished registration.
    if (error.status !== 409) throw error;
    return api.get("/auth/me");
  }
}
