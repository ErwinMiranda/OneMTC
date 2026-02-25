import { logout } from "./auth.js";

window.logout = logout; // 👈 exposes it globally
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCpHhUL8x4rs-fom1xyaNdWm5prSGf57U",
  authDomain: "onemtc-2222c.firebaseapp.com",
  projectId: "onemtc-2222c",
  storageBucket: "onemtc-2222c.appspot.com",
  messagingSenderId: "447271556426",
  appId: "1:447271556426:web:562ba4d72e40b754599db3",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.log("⚠️ No user signed in. Redirecting to login...");
    window.location.href = "index";
  } else {
    console.log(`✅ Logged in as: ${user.email || "Anonymous"}`);
    // Optionally show email in UI
    const userDisplay = document.getElementById("userDisplay");
    if (userDisplay) userDisplay.textContent = user.email || "Anonymous";
    // ✅ Attach your Firestore realtime listener here
    attachRealtimeListener();

    // ✅ Update UI
    setStatus("✅ Connected to One MTC , loading data...");
  }
});
const authBtn = document.getElementById("authBtn");
const loginModal = document.getElementById("loginModal");
const loginSubmit = document.getElementById("loginSubmit");
const cancelLogin = document.getElementById("cancelLogin");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusSpan = document.getElementById("status");
let unsubscribeListener = null;

function setStatus(msg, isError = false) {
  statusSpan.textContent = msg;
  statusSpan.style.color = isError ? "#ef4444" : "#94a3b8";
}
function showLoading(message = "Uploading, please wait...") {
  const overlay = document.getElementById("loadingOverlay");
  const msg = document.getElementById("loadingMessage");
  if (msg) msg.textContent = message;
  overlay.style.display = "flex";
}

function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}

async function uploadExcelDataToFirestore(excelData, db) {
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email || user?.displayName || "Unknown User";

  for (const rawRow of excelData) {
    const mapped = mapRow(rawRow);
    if (!mapped.id) continue;

    // 🔁 Save or overwrite the document with new user info
    await setDoc(
      doc(db, "tasks", mapped.id), // 👈 uses WO+TaskCard as the Firestore doc ID
      {
        ...mapped,
        uploadedBy: userEmail, // 👈 who last uploaded
        uploadedAt: new Date().toISOString(), // 👈 when
      },
      { merge: true }, // 👈 keep existing fields, just update the new info
    );
  }

  console.log("✅ Upload complete. Firestore updated with last uploader info.");
}

const fileInput = document.getElementById("file");
const uploadBtn = document.getElementById("uploadBtn");
const tasksBody = document.getElementById("tasksBody");
const headerRow = document.getElementById("headerRow");
const useRemote = document.getElementById("useRemote");
const ADMIN_EMAILS = ["admin@lht-philippines.com", "anotheradmin@company.com"];

const TASKS_COLLECTION = "work_orders";
const BATCH_LIMIT = 500;

function normalizeDate(value) {
  if (value == null) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (isNaN(value)) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const dt = new Date(excelEpoch.getTime() + value * 86400000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(dt.getDate()).padStart(2, "0")}`;
  }
  const maybe = new Date(value);
  if (!isNaN(maybe)) {
    return `${maybe.getFullYear()}-${String(maybe.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(maybe.getDate()).padStart(2, "0")}`;
  }
  return String(value);
}
function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila", // ensure PH time
  });
}

async function parseFileToRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

function mapRow(raw) {
  const mapKey = (names) => {
    const keys = Object.keys(raw);
    for (const n of names) {
      const found = keys.find(
        (k) => k.trim().toLowerCase() === n.toLowerCase(),
      );
      if (found) return found;
    }
    return null;
  };

  const woRaw = raw[mapKey(["wo", "workorder"])] ?? null;
  const wo = woRaw != null ? String(woRaw) : null;
  const task_card = raw[mapKey(["task_card", "taskcard"])] ?? null;

  return {
    id: wo && task_card ? `${wo}_${task_card}` : null,
    wo,
    sub_wo: raw[mapKey(["sub_wo", "sub wo"])] ?? null,
    wo_description: raw[mapKey(["wo_description", "wo description"])] ?? null,
    phase: raw[mapKey(["phase"])] ?? null,
    sched_start_date: normalizeDate(
      raw[mapKey(["sched_start_date", "scheduled start date"])] ?? null,
    ),
    sched_end_date: normalizeDate(
      raw[mapKey(["sched_end_date", "scheduled end date"])] ?? null,
    ),
    ac: raw[mapKey(["ac", "aircraft"])] ?? null,
    task_card,
    task_card_description:
      raw[mapKey(["task_card_description", "task card description"])] ?? null,
    skill: raw[mapKey(["skill"])] ?? null,
    chapter: raw[mapKey(["chapter"])] ?? null,
    team: raw[mapKey(["team"])] ?? null,
    area: raw[mapKey(["area"])] ?? null,
    status: raw[mapKey(["status"])] ?? null,
    completed_on: normalizeDate(
      raw[mapKey(["completed_on", "completed on"])] ?? null,
    ),
    reference_task_card:
      raw[mapKey(["reference_task_card", "reference task card"])] ?? null,
    interval: raw[mapKey(["interval"])] ?? null,
    est_mh: raw[mapKey(["est_mh", "estimated mh"])] ?? null,
    seq: raw[mapKey(["seq", "sequence"])] ?? null,
    ec: raw[mapKey(["ec"])] ?? null,
    act_mh: raw[mapKey(["act_mh", "actual mh"])] ?? null,
    comment: raw[mapKey(["comment", "comments"])] ?? null, // 🔥 ADDED
  };
}

function sanitizeId(value) {
  return value.replace(/[\/.#$\[\]]/g, "_");
}

function renderTable(rows) {
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email || "Unknown";
  const isAdmin = ADMIN_EMAILS.includes(userEmail);

  // Headers
  const headers = ["wo", "ac", "total", "uploadedBy", "uploadedAt"];
  if (isAdmin) headers.push("delete");

  const headerLabels = {
    wo: "Work Order",
    ac: "Aircraft",
    total: "Total Taskcards",
    uploadedBy: "Uploaded By",
    uploadedAt: "Uploaded At",
    delete: "Delete",
  };

  // Render table header
  headerRow.innerHTML = "";
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = headerLabels[h];
    headerRow.appendChild(th);
  });

  // Render body
  tasksBody.innerHTML = "";

  if (rows.length === 0) {
    tasksBody.innerHTML = `
      <tr>
        <td colspan="${headers.length}" class="small">
          No summary data found.
        </td>
      </tr>`;
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");

    headers.forEach((h) => {
      const td = document.createElement("td");

      if (h === "delete" && isAdmin) {
        const btn = document.createElement("button");
        btn.textContent = "🗑 Delete";
        btn.className =
          "delete-btn bg-red-500 text-white rounded px-2 py-1 text-sm hover:bg-red-600";
        btn.addEventListener("click", () => handleDeleteWO(row.wo));
        td.appendChild(btn);
      } else if (h === "uploadedAt") {
        td.textContent = formatDate(row.uploadedAt);
      } else if (h === "total") {
        td.textContent = row.total || 0; // ✅ USE REAL FIRESTORE VALUE
      } else {
        td.textContent = row[h] ?? "";
      }

      tr.appendChild(td);
    });

    tasksBody.appendChild(tr);
  }
}

async function handleDeleteWO(wo) {
  if (!confirm(`Delete all taskcards for WO: ${wo}?`)) return;

  try {
    showLoading(`Deleting ${wo}…`);

    const woRef = doc(db, TASKS_COLLECTION, wo);
    const taskcardsRef = collection(woRef, "taskcards");
    const snapshot = await getDocs(taskcardsRef);

    const batch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    batch.delete(woRef);

    await batch.commit();

    hideLoading();
    alert(`✅ Deleted WO: ${wo}`);
  } catch (err) {
    hideLoading();
    alert("❌ Delete failed: " + err.message);
  }
}

async function uploadRowsToFirestore(mappedRows) {
  const db = getFirestore();
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email || "Unknown User";

  if (!mappedRows.length) {
    setStatus("No rows to upload.", true);
    return;
  }

  const grouped = {};
  const BATCH_LIMIT = 400;

  // 🔹 Group rows by WO
  for (const row of mappedRows) {
    if (!row.wo || !row.task_card) continue;

    if (!grouped[row.wo]) grouped[row.wo] = [];
    grouped[row.wo].push(row);
  }

  let totalOperations = 0;
  let processedOperations = 0;

  // Count total operations for progress %
  for (const wo of Object.keys(grouped)) {
    totalOperations += grouped[wo].length;
  }

  for (const wo of Object.keys(grouped)) {

    const woRef = doc(db, TASKS_COLLECTION, wo);
    const rows = grouped[wo];

    // 🔥 STEP 1: Read all existing once
    const existingSnapshot = await getDocs(collection(woRef, "taskcards"));

    const existingMap = {};
    existingSnapshot.forEach(docSnap => {
      existingMap[docSnap.id] = docSnap.data();
    });

    let batch = writeBatch(db);
    let operationCount = 0;

    for (const row of rows) {

      const combinedId = `${row.seq}_${row.task_card}`;
      const safeTaskCardId = sanitizeId(combinedId);
      const taskRef = doc(collection(woRef, "taskcards"), safeTaskCardId);

      const existingData = existingMap[safeTaskCardId];

      // 🚫 Skip CLOSED
      if (existingData?.status?.toUpperCase() === "CLOSED") {
        processedOperations++;
        continue;
      }

      // ✅ Preserve comment
      const finalComment =
        row.comment && row.comment.trim() !== ""
          ? row.comment
          : existingData?.comment || "";

      batch.set(taskRef, {
        wo: row.wo,
        phase: row.phase,
        sched_start_date: row.sched_start_date,
        sched_end_date: row.sched_end_date,
        ac: row.ac,
        task_card: row.task_card,
        task_card_description: row.task_card_description,
        skill: row.skill,
        status: row.status,
        reference_task_card: row.reference_task_card,
        seq: row.seq,
        comment: finalComment,
        uploadedBy: userEmail,
        uploadedAt: new Date().toISOString(),
        createdAt: existingData?.createdAt || serverTimestamp(),
      });

      operationCount++;
      processedOperations++;

      // 🔥 If batch reaches 400 → commit
      if (operationCount === BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }

      // 🔥 Update Progress %
      const percent = Math.round((processedOperations / totalOperations) * 100);
      setStatus(`Uploading... ${percent}%`);
    }

    // 🔥 Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    // 🔥 Update WO metadata
    const snapshot = await getDocs(collection(woRef, "taskcards"));
    const realCount = snapshot.size;

    await setDoc(
      woRef,
      {
        wo: wo,
        ac: rows[0].ac || "N/A",
        uploadedBy: userEmail,
        uploadedAt: new Date().toISOString(),
        totalTaskcards: realCount,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  setStatus("🎉 Upload complete!");
}

function attachRealtimeListener() {
  const q = query(
    collection(db, TASKS_COLLECTION),
    orderBy("uploadedAt", "desc"),
  );

  unsubscribeListener = onSnapshot(
    q,
    async (snapshot) => {
      const rows = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        rows.push({
          wo: data.wo,
          ac: data.ac,
          total: data.totalTaskcards,
          uploadedBy: data.uploadedBy,
          uploadedAt: data.uploadedAt,
        });
      });

      renderTable(rows);
      setStatus(`Realtime: ${rows.length} Work Orders`);
    },
    (err) => setStatus("Listener error: " + err.message, true),
  );
}

uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) return setStatus("Select file", true);

  try {
    showLoading("Uploading to Firestore...");
   let rows;

if (file.name.endsWith(".json")) {
  const text = await file.text();
  const jsonData = JSON.parse(text);
  rows = jsonData.map((r) => mapRow(r));
} else {
  rows = (await parseFileToRows(file)).map((r) => mapRow(r));
}
    await uploadRowsToFirestore(rows);

    // ✅ Clear chosen file after successful upload
    fileInput.value = "";

    setStatus("✅ Upload complete!");
  } catch (err) {
    setStatus("❌ Upload failed: " + err.message, true);
  } finally {
    hideLoading();
  }
});
