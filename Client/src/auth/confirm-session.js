// A successful credentials response is not proof the browser retained the cookie.
// Verify it before mounting pages that would otherwise send the user back to login.
export async function confirmSession(api, expectedUser) {
  const response = await api.get('/auth/me');
  const user = response.data?.data;
  if (response.data?.success !== true || !expectedUser?.authId ||
      String(user?.authId || '') !== String(expectedUser.authId)) {
    throw new Error('Your sign-in session could not be saved. Please reload the page and try again.');
  }
  return user;
}
