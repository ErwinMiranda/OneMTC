// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCpHhUL8x4rs-fom1xyaNdWm5prSGf57U",
  authDomain: "onemtc-2222c.firebaseapp.com",
  projectId: "onemtc-2222c",
  storageBucket: "onemtc-2222c.firebasestorage.app",
  messagingSenderId: "447271556426",
  appId: "1:447271556426:web:562ba4d72e40b754599db3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ Require login + email verification
export function requireLogin() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.warn("🚫 No user signed in — redirecting to login.");
      window.location.href = "index";
      return;
    }

    if (!user.emailVerified) {
      alert("⚠️ Please verify your email before accessing this page.");
      signOut(auth);
      window.location.href = "index";
      return;
    }

    console.log("✅ Logged in & verified as:", user.email);
    localStorage.setItem("username", user.email);
  });
}

// ✅ Logout function
export async function logout() {
  await signOut(auth);
  localStorage.clear();
  window.location.href = "index";
}
