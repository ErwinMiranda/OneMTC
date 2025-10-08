import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const SESSION_KEY = "demo_session";

// 🔹 Initialize Firebase Auth (assuming app already initialized)
const auth = getAuth();

// 🔹 Wait for Firebase Auth state
onAuthStateChanged(auth, (user) => {
  const savedSession = JSON.parse(
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
  );

  // ✅ If no Firebase user or no local session → go back to login
  if (!user || !savedSession) {
    console.warn("🚫 No active Firebase account or session found. Redirecting...");
    location.href = "index.html";
    return;
  }

  // ✅ Role-based access control (same as before)
  const currentPage = location.pathname.split("/").pop();
  if (savedSession.page !== currentPage) {
    console.warn("⚠️ Wrong user for this page. Redirecting...");
    location.href = "index.html";
    return;
  }

  console.log(`✅ Logged in as ${user.email}, session OK.`);
});
