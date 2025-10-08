// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ✅ Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCpHhUL8x4rs-fom1xyaNdWm5prSGf57U",
  authDomain: "onemtc-2222c.firebaseapp.com",
  projectId: "onemtc-2222c",
  storageBucket: "onemtc-2222c.firebasestorage.app",
  messagingSenderId: "447271556426",
  appId: "1:447271556426:web:562ba4d72e40b754599db3",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ Session key from your system
const SESSION_KEY = "demo_session";

// 🔒 Function: Require login before accessing this page
export function requireLogin() {
  onAuthStateChanged(auth, (user) => {
    const savedSession = JSON.parse(
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    );

    if (!user || !savedSession) {
      console.warn("🚫 No user or session found. Redirecting to login...");
      location.href = "index"; // redirect to login
      return;
    }

    const currentPage = location.pathname.split("/").pop();
    if (savedSession.page !== currentPage) {
      console.warn("⚠️ Wrong user for this page. Redirecting...");
      location.href = "index";
      return;
    }

    console.log(`✅ Authenticated as: ${user.email}`);
  });
}
export function logout() {
  const auth = getAuth();
  signOut(auth)
    .then(() => {
      console.log("🚪 User signed out.");
      localStorage.removeItem("demo_session");
      sessionStorage.removeItem("demo_session");
      location.href = "index.html";
    })
    .catch((error) => {
      console.error("❌ Logout error:", error);
    });
}
