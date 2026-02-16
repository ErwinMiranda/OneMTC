import { initializeApp } 
from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import { 
  getAuth, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
const db = getFirestore(app);

const table = document.getElementById("cardTable");
const woHeader = document.getElementById("woHeader");

let unsubscribe = null;
let currentUserEmail = null;

// 🔎 Get WO from URL
function getWOFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("wo");
}

// 🔐 Auth Protection
onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUserEmail = user.email;

  const wo = getWOFromURL();

  if (!wo) {
    woHeader.textContent = "No Work Order provided.";
    return;
  }

  woHeader.textContent = `Monitoring Work Order: ${wo}`;

  loadDiscrepancies(wo);
});

// 🔄 Load Discrepancies
function loadDiscrepancies(wo) {

  if (unsubscribe) unsubscribe();

  const discRef = collection(db, "discrepancies", String(wo), "items");

  unsubscribe = onSnapshot(discRef, (snapshot) => {

    table.innerHTML = "";

    if (snapshot.empty) {
      table.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:20px;">
            No discrepancies logged for this WO.
          </td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {

      const data = docSnap.data();
      const id = docSnap.id;

      const row = document.createElement("tr");

      const isOpen = (data.status || "").toUpperCase() === "OPEN";

      if (isOpen) {
        row.style.background = "#ffe5e5";
      }

      row.innerHTML = `
        <td>${data.seq || ""}</td>
        <td>${data.task_card || ""}</td>
        <td>${data.skill || ""}</td>
        <td>${data.phase || ""}</td>
        <td>${data.discrepancy_type || ""}</td>
        <td>${data.remarks || ""}</td>
        <td>${data.status || ""}</td>
        <td>
          ${
  isOpen
    ? `<button 
         data-id="${id}" 
         data-wo="${wo}" 
         class="resolveBtn"
         style="background:#05164d; color:white; border:none; padding:6px 10px; cursor:pointer;"
       >
         Mark Corrected
       </button>`
    : `
       <div style="font-size:13px;">
         <div style="color:green; font-weight:600;">✔ Resolved</div>
         <div style="margin-top:4px;">
           ${data.resolved_by || "Unknown"}
         </div>
         <div style="font-size:12px; color:#666;">
           ${
             data.resolved_at
               ? new Date(data.resolved_at.seconds * 1000)
                   .toLocaleString()
               : ""
           }
         </div>
       </div>
      `
}

        </td>
      `;

      table.appendChild(row);
    });

  });
}

// 🔧 Resolve Discrepancy
document.addEventListener("click", async (e) => {

  if (!e.target.classList.contains("resolveBtn")) return;

  const id = e.target.dataset.id;
  const wo = e.target.dataset.wo;

  const docRef = doc(db, "discrepancies", String(wo), "items", id);

  await updateDoc(docRef, {
    status: "CLOSED",
    resolved_by: currentUserEmail,
    resolved_at: serverTimestamp()
  });

});
