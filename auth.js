// ===============================
// auth.js — Firebase Login Guard
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 🔹 Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCpHhUL8x4rs-fom1xyaNdWm5prSGf57U",
  authDomain: "onemtc-2222c.firebaseapp.com",
  projectId: "onemtc-2222c",
  storageBucket: "onemtc-2222c.firebasestorage.app",
  messagingSenderId: "447271556426",
  appId: "1:447271556426:web:562ba4d72e40b754599db3",
};

// 🔹 Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🔹 Session key used in your local login logic
const SESSION_KEY = "demo_session";

/**
 * Require Login
 * - Ensures a Firebase user and session are active
 * - Redirects to index.html (login) if not
 */
export function requireLogin() {
  onAuthStateChanged(auth, (user) => {
    const savedSession = JSON.parse(
      localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)
    );

    // No Firebase user or local session → redirect
    if (!user || !savedSession) {
      console.warn("🚫 No user/session found. Redirecting to login...");
      location.href = "index";
      return;
    }

    // Check that the correct user/page combination is loaded
    const currentPage = location.pathname.split("/").pop();
    if (savedSession.page !== currentPage) {
      console.warn("⚠️ Wrong user for this page. Redirecting...");
      location.href = "index";
      return;
    }

    console.log(`✅ Logged in as ${user.email} | Access granted to ${currentPage}`);
  });
}

/**
 * Logout
 * - Signs the user out of Firebase
 * - Clears local and session storage
 * - Redirects to login page
 */
export function logout() {
  signOut(auth)
    .then(() => {
      console.log("🚪 User signed out successfully.");
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      location.href = "index";
    })
    .catch((error) => {
      console.error("❌ Logout error:", error);
    });
}
