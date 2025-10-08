// auth.js
const SESSION_KEY = "demo_session";

function requireLogin() {
  const sessionData =
    JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));

  if (!sessionData || !sessionData.username || !sessionData.page) {
    // Not logged in → back to login page
    location.href = "/";
    return;
  }

  // Extra: only allow correct user for this page
  const currentPage = location.pathname.split("/").pop();
  if (sessionData.page !== currentPage) {
    location.href = "/";
  }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  location.href = "/";
}
