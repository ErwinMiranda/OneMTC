import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ================================
   FIREBASE CONFIG
================================ */
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

/* ================================
   DOM ELEMENTS
================================ */
const table = document.getElementById("cardTable");
const woHeader = document.getElementById("woHeader");
const showAllBtn = document.getElementById("showAllBtn");
const showOpenBtn = document.getElementById("showOpenBtn");
const skillToggleBtn = document.getElementById("skillToggleBtn");
const skillDropdown = document.getElementById("skillDropdown");
const addNRBtn = document.getElementById("addNRBtn");
const nrModal = document.getElementById("nrModal");
const cancelNRBtn = document.getElementById("cancelNRBtn");
const saveNRBtn = document.getElementById("saveNRBtn");

/* ================================
   GLOBAL STATE
================================ */
let unsubscribe = null;
let currentUserEmail = null;
let showOpenOnly = false;
let currentSnapshotDocs = [];
let selectedSkills = new Set(); // multi-select
/* ================================
   GET WO FROM URL
================================ */
function getWOFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("wo");
}

/* ================================
   AUTH PROTECTION
================================ */
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

  setupFilterButtons();
  loadDiscrepancies(wo);
});

/* ================================
   FILTER BUTTON LOGIC
================================ */
function setupFilterButtons() {
  showAllBtn.addEventListener("click", () => {
    showOpenOnly = false;
    showAllBtn.classList.add("active");
    showOpenBtn.classList.remove("active");
    renderTable(currentSnapshotDocs);
  });

  showOpenBtn.addEventListener("click", () => {
    showOpenOnly = true;
    showOpenBtn.classList.add("active");
    showAllBtn.classList.remove("active");
    renderTable(currentSnapshotDocs);
  });

  skillToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    skillDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    skillDropdown.classList.add("hidden");
  });
}

/* ================================
   LOAD DISCREPANCIES (REALTIME)
================================ */
function loadDiscrepancies(wo) {
  if (unsubscribe) unsubscribe();

  const discRef = collection(db, "discrepancies", String(wo), "items");

  unsubscribe = onSnapshot(discRef, (snapshot) => {
    currentSnapshotDocs = snapshot.docs;
    populateSkillFilter(currentSnapshotDocs);
    renderTable(currentSnapshotDocs);
  });
}

/* ================================
   RENDER TABLE WITH AGING + FILTER
================================ */
function renderTable(docs) {
  table.innerHTML = "";

  if (!docs.length) {
    table.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:20px;">
          No discrepancies logged for this WO.
        </td>
      </tr>
    `;
    return;
  }

  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const isOpen = (data.status || "").toUpperCase() === "OPEN";

    // 🔹 FILTER LOGIC
    if (showOpenOnly && !isOpen) return;
    if (selectedSkills.size > 0 && !selectedSkills.has(data.skill)) return;

    const row = document.createElement("tr");

    if (isOpen) {
      row.style.background = "#ffe5e5";
    }

    /* ================================
       AGING CALCULATION
    ================================= */
    const now = new Date();
    let agingText = "-";
    let agingClass = "";

    if (isOpen && data.created_at) {
      const created = new Date(data.created_at.seconds * 1000);
      const diffMs = now - created;

      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays >= 1) {
        agingText = diffDays + " day(s)";
      } else {
        agingText = diffHours + " hr(s)";
      }

      // Escalation rules
      if (diffDays >= 5) {
        agingClass = "aging-red";
      } else if (diffDays >= 2) {
        agingClass = "aging-orange";
      }
    }

    row.innerHTML = `
      <td>${data.seq || ""}</td>
      <td>${data.task_card || ""}</td>
      <td>${data.skill || ""}</td>
      <td>${data.phase || ""}</td>
      <td>${data.discrepancy_type || ""}</td>
      <td>${data.remarks || ""}</td>
      <td class="${agingClass}">${agingText}</td>
      <td>${data.status || ""}</td>
      <td>
        ${
          isOpen
            ? `<button 
                 data-id="${id}" 
                 data-wo="${getWOFromURL()}" 
                 class="resolveBtn"
                 style="background:#05164d; color:white; border:none; padding:6px 10px; cursor:pointer; border-radius: 8px;"
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
                       ? new Date(
                           data.resolved_at.seconds * 1000,
                         ).toLocaleDateString() +
                         " • " +
                         new Date(
                           data.resolved_at.seconds * 1000,
                         ).toLocaleTimeString([], {
                           hour: "2-digit",
                           minute: "2-digit",
                         })
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
}
function populateSkillFilter(docs) {
  const skills = new Set();
  docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.skill) {
      skills.add(data.skill);
    }
  });
  skillDropdown.innerHTML = "";
  skills.forEach((skill) => {
    const isChecked = selectedSkills.has(skill);
    skillDropdown.innerHTML += `
      <label>
        <input type="checkbox" value="${skill}" ${isChecked ? "checked" : ""}>
        ${skill}
      </label>
    `;
  });
  // Attach listeners
  skillDropdown.querySelectorAll("input").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) {
        selectedSkills.add(cb.value);
      } else {
        selectedSkills.delete(cb.value);
      }
      renderTable(currentSnapshotDocs);
    });
  });
}

/* ================================
   RESOLVE DISCREPANCY
================================ */
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("resolveBtn")) return;

  const id = e.target.dataset.id;
  const wo = e.target.dataset.wo;

  const docRef = doc(db, "discrepancies", String(wo), "items", id);

  await updateDoc(docRef, {
    status: "CLOSED",
    resolved_by: currentUserEmail,
    resolved_at: serverTimestamp(),
  });
});
addNRBtn.addEventListener("click", () => {
  nrModal.classList.remove("hidden");
});

cancelNRBtn.addEventListener("click", () => {
  nrModal.classList.add("hidden");
});
saveNRBtn.addEventListener("click", async () => {
  const wo = getWOFromURL();
  if (!wo) return;

  const seq = document.getElementById("nrSeq").value;
  const task = document.getElementById("nrSeq").value;
  const skill = document.getElementById("nrSkill").value;
  const type = document.getElementById("nrType").value;
  const remarks = document.getElementById("nrRemarks").value;

  if (!task || !skill) {
    alert("Task Card and Skill required.");
    return;
  }

  const discRef = collection(db, "discrepancies", String(wo), "items");

  await addDoc(discRef, {
    seq: seq || "-",
    task_card: task,
    skill: skill,
    discrepancy_type: type || "NR Discrepancy",
    remarks: remarks || "",
    status: "OPEN",
    created_at: serverTimestamp(),
    created_by: currentUserEmail,
    source: "NR",
  });

  nrModal.classList.add("hidden");
});
