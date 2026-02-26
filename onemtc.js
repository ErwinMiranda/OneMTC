import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  addDoc,
  setDoc,
  serverTimestamp,
  query,
  getDocs,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
/* =======================
  Firebase Init
======================== */
const firebaseConfig = {
  apiKey: "AIzaSyDCpHhUL8x4rs-fom1xyaNdWm5prSGf57U",
  authDomain: "onemtc-2222c.firebaseapp.com",
  projectId: "onemtc-2222c",
  storageBucket: "onemtc-2222c.firebasestorage.app",
  messagingSenderId: "447271556426",
  appId: "1:447271556426:web:562ba4d72e40b754599db3",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.logout = function () {
  signOut(auth)
    .then(() => {
      console.log("User signed out.");
      localStorage.removeItem("lastWorkorder");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Sign out error", error);
    });
};

let loginUser = "Unknown";
onAuthStateChanged(auth, (user) => {
  if (!user) {
    console.log("⚠️ No user signed in. Redirecting to login...");
    loginUser = "Unknown"; // Reset on logout
    window.location.href = "index.html";
  } else {
    // User is signed in
    console.log(`✅ Logged in as: ${user.email || "Anonymous"}`);

    // Set loginUser
    if (user.email) {
      loginUser = user.email.includes("@")
        ? user.email.split("@")[0]
        : user.email;
    } else {
      loginUser = "Anonymous";
    }

    // This element doesn't seem to exist, but logic is harmless
    const userDisplay = document.getElementById("userDisplay");
    if (userDisplay) userDisplay.textContent = user.email || "Anonymous";
  }
});

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
/* =======================
  UI refs
======================== */

const debouncedApplyFilters = debounce(applyFilters, 300);
const counterEl = document.getElementById("counter");
const woInput = document.getElementById("woInput");
const woSearchBtn = document.getElementById("woSearchBtn");
const overlay = document.getElementById("loadingOverlay");
const startScanBtn = document.getElementById("startScanBtn");
const stopScanBtn = document.getElementById("stopScanBtn");
const barcodeInput = document.getElementById("barcodeInput");
const scanModal = document.getElementById("scanModal");
const scannedList = document.getElementById("scannedList");
const submitScanBtn = document.getElementById("submitScanBtn");
const clearScanBtn = document.getElementById("clearScanBtn");
const closeScanBtn = document.getElementById("closeScanBtn");
const activeWOEl = document.getElementById("activeWO");
const scanCountEl = document.getElementById("scanCount");
const fixedPhases = ["PH", "P1", "P2", "P3", "P4", "P6", "P0"];
const lastUpdateEl = document.getElementById("lastUpdate");
const showClosedChk = document.getElementById("showClosedChk");
const historyListEl = document.getElementById("historyList");
const discrepancyModal = document.getElementById("discrepancyModal");
const discType = document.getElementById("discType");
const discRemarks = document.getElementById("discRemarks");
const saveDiscBtn = document.getElementById("saveDiscBtn");
const closeDiscBtn = document.getElementById("closeDiscBtn");
const dashboardBtn = document.getElementById("dashboardToggleBtn");
const manualSeqInput = document.getElementById("manualSeqInput");
const manualAddBtn = document.getElementById("manualAddBtn");
const scanResultsList = document.getElementById("scanResultsList");
const seqInput = document.querySelector('.filter[data-field="seq"]');

const state = {
  scannedTasks: [],
  selectedTaskData: null,
  unsubscribeDiscrepancies: null,
  unsubscribe: null,
  unsubscribeHistory: null,
  historyIdSet: new Set(),
  allDocs: [],
  allHistoryData: [],
  newHistoryItems: [],

  activeSkill: "CLEAR",
  activePhase: null,
  multiSkillActive: false,
  singleSkillActive: false,

  scannedSeqs: [],
  seqFilterValues: [],
  commentFlashDuration: 1200,
  currentWO: null,
  scanningActive: false,

  prevDocsMap: new Map(),
  commentPopup: document.getElementById("commentListPopup"),
  badgeCounts: JSON.parse(localStorage.getItem("badgeCounts")) || {},
  commentReadCounts:
    JSON.parse(localStorage.getItem("commentReadCounts")) || {},
};

if (!state.commentPopup) {
  state.commentPopup = document.createElement("div");
  state.commentPopup.id = "commentListPopup";
  state.commentPopup.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      backdrop-filter: blur(3px);
      background: rgba(0, 0, 0, 0.55);
      justify-content: flex-end;
      align-items: center;
      z-index: 99999;
    `;
  state.commentPopup.innerHTML = `
      <div class="popup-card" style="
        background: rgba(255,255,255,0.9);
        border: 1px solid rgba(255,255,255,0.5);
        border-radius: 18px 0 0 18px;
        padding: 24px;
        width: 420px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: -6px 0 30px rgba(0,0,0,0.25);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif;
        animation: slideInRight 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <h3 id="popupTitle" style="margin:0; font-size:20px; font-weight:600; color:var(--lufthansa-blue);">Comments</h3>
          <button id="popupClose" style="
            background:none;
            border:none;
            font-size:24px;
            color:#666;
            cursor:pointer;
            transition:0.25s;
          ">&times;</button>
        </div>
        <div id="popupComments" style="font-size:14px; color:#222; line-height:1.6; border-top:1px solid rgba(0,0,0,0.05); padding-top:10px;">
        </div>
      </div>
    `;
  document.body.appendChild(state.commentPopup);
  const style = document.createElement("style");
  style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      #popupClose:hover {
        color:#000;
        transform: scale(1.1);
      }
    `;
  document.head.appendChild(style);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest(".taskcard-click");
  if (!el) return;
  state.selectedTaskData = {
    id: el.dataset.id,
    wo: el.dataset.wo,
    seq: el.dataset.seq,
    task: el.dataset.task,
    skill: el.dataset.skill,
    phase: el.dataset.phase,
  };
  discRemarks.value = "";
  discType.value = "Missing Signature";
  discrepancyModal.style.display = "flex";
});

saveDiscBtn.addEventListener("click", async () => {
  if (!state.selectedTaskData) return;
  try {
    const woDocRef = doc(
      db,
      "discrepancies",
      String(state.selectedTaskData.wo),
    );
    const itemsCollectionRef = collection(woDocRef, "items");
    await setDoc(
      woDocRef,
      {
        last_updated: serverTimestamp(),
      },
      { merge: true },
    );
    await addDoc(itemsCollectionRef, {
      wo: state.selectedTaskData.wo,
      seq: state.selectedTaskData.seq,
      task_card: state.selectedTaskData.task,
      skill: state.selectedTaskData.skill,
      phase: state.selectedTaskData.phase,
      discrepancy_type: discType.value,
      remarks: discRemarks.value,
      reported_by: loginUser || "Unknown",
      created_at: serverTimestamp(),
      status: "OPEN",
    });
    showToast("Discrepancy logged under WO successfully", "success");
    discrepancyModal.style.display = "none";
  } catch (err) {
    console.error("Discrepancy Save Error:", err);
    showToast("Error saving discrepancy", "error");
  }
});

closeDiscBtn.addEventListener("click", () => {
  discrepancyModal.style.display = "none";
});

dashboardBtn.addEventListener("click", () => {
  if (!state.currentWO) {
    showToast("No Work Order loaded.", "error");
    return;
  }
  window.open(`discrepant.html?wo=${state.currentWO}`, "_blank");
});

document.getElementById("clearNotifBtn").addEventListener("click", () => {
  clearGlow();
  clearGlowState();
});

function handleWOSearch() {
  const wo = woInput.value.trim();

  if (!wo) {
    showToast("Please enter a Work Order", "error");
    return;
  }

  searchWorkorder(wo);
  listenToHistoryForWO(wo);
}

woSearchBtn.addEventListener("click", handleWOSearch);
woInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleWOSearch();
});

function listenToDiscrepancies(wo) {
  if (state.unsubscribeDiscrepancies) {
    state.unsubscribeDiscrepancies();
  }

  const discRef = collection(db, "discrepancies", String(wo), "items");

  state.unsubscribeDiscrepancies = onSnapshot(discRef, (snapshot) => {
    const skillDiscMap = {};
    let totalOpenCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.status === "OPEN") {
        totalOpenCount++;

        const skill = data.skill;
        skillDiscMap[skill] = (skillDiscMap[skill] || 0) + 1;
      }
    });

    updateSkillDiscrepancyIndicators(skillDiscMap);
    updateDashboardBadge(totalOpenCount);
  });
}
function updateDashboardBadge(count) {
  const badge = document.getElementById("discrepancyBadge");
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
    badge.textContent = "";
  }
}
function updateSkillDiscrepancyIndicators(skillDiscMap) {
  document.querySelectorAll(".skill-filters button").forEach((btn) => {
    const buttonSkill = btn.dataset.skill;
    if (buttonSkill === "CLEAR") return;
    let hasDisc = false;
    if (skillGroups[buttonSkill]) {
      const members = skillGroups[buttonSkill];
      hasDisc = members.some((memberSkill) => skillDiscMap[memberSkill] > 0);
    } else {
      hasDisc = skillDiscMap[buttonSkill] > 0;
    }
    if (hasDisc) {
      btn.classList.add("has-discrepancy");
    } else {
      btn.classList.remove("has-discrepancy");
    }
  });
}

/* =======================
  Clusterize Table
======================== */
const clusterize = new Clusterize({
  scrollId: "scrollArea",
  contentId: "contentArea",
  rows: [],
});

const historyClusterize = new Clusterize({
  scrollId: "historyScrollArea",
  contentId: "historyList",
  rows: [],
  no_data_text: "No history yet...",
  tag: "li",
});

function getClosedPercentage(docs) {
  if (!docs.length) return 0;
  const closedCount = docs.filter((d) => {
    const st = (d.status || "").toLowerCase();
    return st === "closed" || st === "cancel";
  }).length;
  return ((closedCount / docs.length) * 100).toFixed(1);
}

/* =======================
  History Realtime Listener
======================= */
window.addEventListener("load", () => {
  const lastWO = localStorage.getItem("lastWorkorder");
  if (lastWO) {
    document.getElementById("woInput").value = lastWO;
    searchWorkorder(lastWO);
    listenToHistoryForWO(lastWO);
  } else {
    console.log("No previous Work Order found");
    hideLoading();
  }
});

function listenToHistoryForWO(workorder) {
  if (state.unsubscribeHistory) {
    state.unsubscribeHistory();
    state.unsubscribeHistory = null;
  }

  const woId = String(workorder);

  const badgeData = JSON.parse(
    localStorage.getItem("historyBadgeData") || "{}",
  );

  if (badgeData.wo === woId) {
    state.newHistoryItems = badgeData.items || [];
  } else {
    state.newHistoryItems = [];
  }

  updateHistoryBadge();

  historyClusterize.update([
    `<li class='clusterize-no-data'>Loading history for ${woId}...</li>`,
  ]);

  const historyRef = collection(db, "wo_history", woId, "items");
  const qHistory = query(historyRef, orderBy("timestamp", "desc"));

  let initialLoad = true;

  state.unsubscribeHistory = onSnapshot(
    qHistory,
    (snapshot) => {
      if (snapshot.empty) {
        historyClusterize.update([
          "<li class='clusterize-no-data'>No history yet...</li>",
        ]);
        return;
      }

      // ==============================
      // INITIAL LOAD
      // ==============================
      if (initialLoad) {
        state.historyIdSet = new Set();

        state.allHistoryData = snapshot.docs.map((docSnap) => {
          state.historyIdSet.add(docSnap.id);
          return renderHistoryItem(docSnap.data(), docSnap.id);
        });

        historyClusterize.update(state.allHistoryData);

        restoreGlow();
        renderJCChart(state.currentWO || woId, state.allDocs);

        initialLoad = false;
        return;
      }

      // ==============================
      // LIVE UPDATES
      // ==============================
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const id = change.doc.id;

        // -------- ADDED --------
        if (change.type === "added") {
          if (!state.historyIdSet.has(id)) {
            const liString = renderHistoryItem(data, id);

            state.historyIdSet.add(id);
            state.allHistoryData.unshift(liString);

            historyClusterize.update(state.allHistoryData);

            state.newHistoryItems.push(id);
            updateHistoryBadge();
          }
        }

        // -------- REMOVED --------
        if (change.type === "removed") {
          state.historyIdSet.delete(id);

          state.allHistoryData = state.allHistoryData.filter(
            (rowString) => !rowString.includes(`data-id="${id}"`)
          );

          historyClusterize.update(state.allHistoryData);
        }

        // -------- MODIFIED --------
        if (change.type === "modified") {
          if (state.historyIdSet.has(id)) {
            state.allHistoryData = state.allHistoryData.map((rowString) =>
              rowString.includes(`data-id="${id}"`)
                ? renderHistoryItem(data, id)
                : rowString
            );

            historyClusterize.update(state.allHistoryData);
          }
        }
      });
    },
    (error) => {
      console.error("❌ History listener error:", error);
      historyClusterize.update([
        "<li class='clusterize-no-data'>Error loading history</li>",
      ]);
    }
  );

  const removeGlowOnUserAction = () => {
    clearGlow();
    document.removeEventListener("click", removeGlowOnUserAction);
    document.removeEventListener("keydown", removeGlowOnUserAction);
    document.removeEventListener("scroll", removeGlowOnUserAction);
  };

  document.addEventListener("click", removeGlowOnUserAction);
  document.addEventListener("keydown", removeGlowOnUserAction);
  document.addEventListener("scroll", removeGlowOnUserAction);
}

function clearGlow() {
  document
    .querySelectorAll(".pulse-glow-green, .pulse-glow-blue, .pulse-glow-amber")
    .forEach((el) => {
      el.classList.remove(
        "pulse-glow-green",
        "pulse-glow-blue",
        "pulse-glow-amber",
      );
    });
}

function saveGlowState(id, glowClass) {
  const glowData = JSON.parse(localStorage.getItem("glowState") || "{}");
  glowData[id] = glowClass;
  localStorage.setItem("glowState", JSON.stringify(glowData));
}

function loadGlowState() {
  return JSON.parse(localStorage.getItem("glowState") || "{}");
}

function clearGlowState() {
  localStorage.removeItem("glowState");
}

function restoreGlow() {
  const glowData = loadGlowState();
  for (const [id, glowClass] of Object.entries(glowData)) {
    const li = document.querySelector(`[data-id="${id}"]`);
    if (li) li.classList.add(glowClass);
  }
}

function renderHistoryItem(data, id) {
  const time = data.timestamp?.toDate
    ? data.timestamp.toDate().toLocaleString()
    : "No time";
  const seq = data.seq ?? "N/A";
  const skill = data.skill ?? "N/A";
  const phase = data.phase ?? "N/A";
  const task = data.task_card ?? "Unknown";
  const status = (data.status ?? "N/A").toUpperCase();
  let modifiedBy = data.modified_by ?? "Unknown";
  if (modifiedBy.includes("@")) {
    modifiedBy = modifiedBy.split("@")[0];
  }
  return `
   <li data-id="${id}"> 
  <span class="time">${time}</span><br>
  <strong>Seq ${seq}</strong> — ${task}<br>
  <span class="tag skill">Skill: ${skill}</span> • 
  <span class="tag phase">Phase: ${phase}</span><br>
  <span class="status ${status === "CLOSED" ? "closed" : "open"}">
    Item ${parseInt(task.split("-").pop(), 10)} ${
      status === "OPEN" ? "RE-OPEN" : status === "CLOSED" ? "COMPLETED" : status
    }
  </span> 
  <span class="time"><small>by ${modifiedBy}</small></span>
</li>

  `;
}

async function logHistoryEntry(task, newStatus) {
  try {
    const modifiedBy = loginUser || "Unknown";
    const woId = String(task.wo);
    const woHistoryRef = doc(db, "wo_history", woId);
    await setDoc(
      woHistoryRef,
      {
        wo: woId,
        last_updated: serverTimestamp(),
      },
      { merge: true },
    );
    await addDoc(collection(woHistoryRef, "items"), {
      wo: woId,
      seq: task.seq || "N/A",
      skill: task.skill || "N/A",
      phase: task.phase || "N/A",
      task_card: task.task_card || "N/A",
      status: newStatus,
      modified_by: modifiedBy,
      timestamp: serverTimestamp(),
    });
    
  } catch (err) {
    console.error("❌ Error logging history:", err);
  }
}

function updateHistoryBadge() {
  const badge = document.getElementById("historyBadge");
  if (!badge) return;
  const count = state.newHistoryItems.length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
    badge.textContent = "";
  }
  const badgeData = {
    wo: state.currentWO,
    items: state.newHistoryItems,
  };
  localStorage.setItem("historyBadgeData", JSON.stringify(badgeData));
}

function calculateDayProgress(woData, filterWo) {
  if (!woData) return "";
  const { wo, startdate, enddate } = woData;
  if (filterWo && String(wo) !== String(filterWo)) return "";
  if (!startdate || !enddate) return "";
  const parseDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === "function") {
      return value.toDate();
    }
    return new Date(value);
  };
  const start = parseDate(startdate);
  const end = parseDate(enddate);
  const today = new Date();
  if (!start || !end) return "";
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return "";
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays =
    Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
  if (totalDays <= 0) return "";
  if (today < start) {
    return `Starts on ${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  if (today > end) {
    return `Completed (${totalDays} days total)`;
  }
  const currentDay =
    Math.floor((today.getTime() - start.getTime()) / msPerDay) + 1;
  return `Day ${currentDay} of ${totalDays}`;
}

function showLoading() {
  overlay.classList.remove("hidden");
  overlay.style.display = "flex";
}

function hideLoading() {
  overlay.classList.add("hidden");
  setTimeout(() => {
    if (overlay.classList.contains("hidden")) {
      overlay.style.display = "none";
    }
  }, 500);
}

// PRINTING......
function printFullTable() {
  if (!state.allDocs || state.allDocs.length === 0) {
    showToast("No data to print ❗", "error");
    return;
  }
  let filteredDocs = [...state.allDocs];
  const seqSkillMap = {};
  state.allDocs.forEach((d) => {
    const seq = String(d.seq);
    if (!seqSkillMap[seq]) seqSkillMap[seq] = new Set();
    if (d.skill) seqSkillMap[seq].add(d.skill);
  });
  if (state.multiSkillActive) {
    filteredDocs = filteredDocs.filter((d) => {
      const sz = seqSkillMap[String(d.seq)]?.size || 0;
      return sz > 1;
    });
    filteredDocs = filteredDocs.map((d) => ({
      ...d,
      highlightTask: true,
    }));
  } else if (state.singleSkillActive) {
    filteredDocs = filteredDocs.filter((d) => {
      const sz = seqSkillMap[String(d.seq)]?.size || 0;
      return sz === 1;
    });
    filteredDocs = filteredDocs.map((d) => ({
      ...d,
      highlightTask: true,
    }));
  }
  if (state.activeSkill !== "CLEAR") {
    if (skillGroups[state.activeSkill]) {
      filteredDocs = filteredDocs.filter((d) =>
        skillGroups[state.activeSkill].includes(d.skill),
      );
    } else {
      filteredDocs = filteredDocs.filter((d) => d.skill === state.activeSkill);
    }
    filteredDocs = filteredDocs.map((d) => ({
      ...d,
      highlightTask: true,
    }));
  }
  if (state.seqFilterValues && state.seqFilterValues.length > 0) {
    filteredDocs = filteredDocs.filter((d) =>
      state.seqFilterValues.includes(String(d.seq)),
    );
  }
  if (state.activePhase) {
    filteredDocs = filteredDocs.filter((d) => d.phase === state.activePhase);
  }
  document.querySelectorAll(".filter").forEach((input) => {
    const field = input.dataset.field;
    const value = input.value.trim().toLowerCase();
    if (value) {
      filteredDocs = filteredDocs.filter((d) =>
        String(d[field] || "")
          .toLowerCase()
          .includes(value),
      );
    }
  });

  if (filteredDocs.length === 0) {
    showToast("No data to print ❗", "error");
    return;
  }
  filteredDocs.sort((a, b) => {
    const seqA = String(a.seq ?? "");
    const seqB = String(b.seq ?? "");
    const numA = Number(seqA);
    const numB = Number(seqB);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return seqA.localeCompare(seqB);
  });
  const grouped = {};
  filteredDocs.forEach((d) => {
    const seq = d.seq ?? "Unknown";
    if (!grouped[seq]) grouped[seq] = [];
    grouped[seq].push(d);
  });
  const rows = Object.entries(grouped)
    .map(([seq, tasks]) => {
      tasks.sort((a, b) => {
        const cardA = a.task_card ?? "";
        const cardB = b.task_card ?? "";
        return String(cardA).localeCompare(String(cardB), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
      const taskRows = tasks
        .map((d, index) => {
          const status = (d.status ?? "").toLowerCase();
          let bgColor = "background-color: #ffebee;";
          let displayStatus = d.status ?? "";

          if (status === "closed") {
            bgColor = "background-color: #e8f5e9;";
            displayStatus = "Closed";
          } else if (status === "cancel") {
            bgColor = "background-color: #e8f5e9;";
            displayStatus = "Cancelled";
          } else if (status === "open") {
            bgColor = "background-color: #ffebee;";
            displayStatus = "Open";
          }
          return `
            <tr class="${d.faded ? "faded" : ""}">
              ${
                index === 0
                  ? `<td rowspan="${tasks.length}">${
                      d.reference_task_card ?? ""
                    }</td>`
                  : ""
              }
              ${
                index === 0
                  ? `<td rowspan="${tasks.length}">${
                      d.task_card_description ?? ""
                    }</td>`
                  : ""
              }
              ${index === 0 ? `<td rowspan="${tasks.length}">${seq}</td>` : ""}
              <td class="taskcard-cell" style="${
                d.highlightTask ? "background-color: #f1f3f5;" : ""
              }">
                ${d.task_card ?? ""}
              </td>
              <td>${d.comment ?? ""}</td>
              <td>${d.status ?? ""}</td>
              <td style="${d.phase === "PH" ? bgColor : ""}">${
                d.phase === "PH" ? d.skill : ""
              }</td>
              <td style="${d.phase === "P1" ? bgColor : ""}">${
                d.phase === "P1" ? d.skill : ""
              }</td>
              <td style="${d.phase === "P2" ? bgColor : ""}">${
                d.phase === "P2" ? d.skill : ""
              }</td>
              <td style="${d.phase === "P3" ? bgColor : ""}">${
                d.phase === "P3" ? d.skill : ""
              }</td>
              <td style="${d.phase === "P4" ? bgColor : ""}">${
                d.phase === "P4" ? d.skill : ""
              }</td>
              <td style="${d.phase === "P6" ? bgColor : ""}">${
                d.phase === "P6" ? d.skill : ""
              }</td>
              <td style="${d.phase === "P0" ? bgColor : ""}">${
                d.phase === "P0" ? d.skill : ""
              }</td>
            </tr>
          `;
        })
        .join("");
      return `
      <tbody class="seq-group">
        ${taskRows}
      </tbody>
    `;
    })
    .join("");
  const dynamicHeader =
    document.getElementById("dynamicHeader")?.textContent || "";

  let selectedSkillText = "";
  if (state.activeSkill && state.activeSkill !== "CLEAR") {
    selectedSkillText = ` - Selected Skill: <b>${state.activeSkill}</b>`;
  }
  let headerFilters = "";
  if (state.activeSkill && state.activeSkill !== "CLEAR") {
    headerFilters += ` | Skill: ${state.activeSkill}`;
  }
  if (state.multiSkillActive) headerFilters += " | Multi-Skill MTC";
  if (state.singleSkillActive) headerFilters += " | Single-Skill MTC";
  if (state.activePhase) headerFilters += ` | Phase: ${state.activePhase}`;
  if (state.seqFilterValues && state.seqFilterValues.length > 0) {
    headerFilters += ` | Seq: ${state.seqFilterValues.join(", ")}`;
  }
  document.querySelectorAll(".filter").forEach((input) => {
    const field = input.dataset.field;
    const value = input.value.trim();
    if (value) {
      headerFilters += ` | ${field}: "${value}"`;
    }
  });
  const fullHeader = `${dynamicHeader}${headerFilters}`;
  const tableHTML = `
      <table>
        <thead>
          <tr>
            <th colspan="13" style="text-align:center; font-size:14px; font-weight:bold; background:white; border-bottom: 2px solid #000;">
              ${fullHeader}
            </th>
          </tr>
          <tr>
            <th>Reference</th>
            <th>Description</th>
            <th>Seq.No</th>
            <th>TaskCard Items</th>
            <th>Comments</th>
            <th>Status</th>
            <th>PH</th>
            <th>P1</th>
            <th>P2</th>
            <th>P3</th>
            <th>P4</th>
            <th>P6</th>
            <th>P0</th>
          </tr>
        </thead>
        ${rows}
      </table>
    `;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
      <html>
        <head>
          <title>Print Table</title>
          <style>
            @page { 
              size: landscape;
              margin: 15mm;
              @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10px;
                color: #555;
                font-family: Arial, sans-serif;
              }
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0;
              padding: 0;
              font-size: 10px; 
              counter-reset: page;
            }
            table { 
              border-collapse: collapse; 
              width: 100%;
              font-size: 10px;
            } 
            th, td { 
              border: 1px solid #000; 
              padding: 4px; 
              text-align: center; 
              vertical-align: middle;
              word-wrap: break-word;
            }
            td.taskcard-cell {
              white-space: nowrap; 
              text-overflow: ellipsis; 
              overflow: hidden; 
              max-width: 300px;
            }
            th { background: #f2f2f2; }
            thead {
              display: table-header-group;
            }
            .seq-group {
              page-break-inside: avoid;
            }
            tbody.seq-group:not(:first-of-type) tr:first-child td {
              border-top: 2px solid #000;
            }
          </style>
        </head>
        <body>
          ${tableHTML}
        </body>
      </html>
    `);
  printWindow.document.close();
}

window.printFullTable = printFullTable;

function updateBadgeDisplay() {
  document.querySelectorAll(".comment-badge").forEach((badge) => {
    const skill = badge.dataset.skill;
    const count = state.badgeCounts[skill] || 0;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  });
  localStorage.setItem("badgeCounts", JSON.stringify(state.badgeCounts));
}

function openPopup(title, htmlContent) {
  const popupCard = state.commentPopup.querySelector(".popup-card");
  const titleEl = state.commentPopup.querySelector("#popupTitle");
  const commentsEl = state.commentPopup.querySelector("#popupComments");
  titleEl.textContent = title;
  commentsEl.innerHTML = htmlContent || "No comments yet.";
  state.commentPopup.style.display = "flex";
  popupCard.style.animation = "slideInRight 0.4s ease";
}

function closePopup() {
  const popupCard = state.commentPopup.querySelector(".popup-card");
  popupCard.style.animation = "slideOutRight 0.3s ease forwards";
  setTimeout(() => {
    state.commentPopup.style.display = "none";
  }, 280);
}

state.commentPopup.querySelector("#popupClose").onclick = closePopup;

state.commentPopup.addEventListener("click", (e) => {
  if (e.target === state.commentPopup) closePopup();
});


document.addEventListener("click", (e) => {
  const badge = e.target.closest(".comment-badge");
  if (!badge) return;

  e.stopPropagation();
  e.preventDefault();

  const skill = badge.dataset.skill;

  const skillDocs = state.allDocs.filter((d) => {
    if (skill === "CLEAR") return true;
    if (skillGroups[skill]) return skillGroups[skill].includes(d.skill);
    return d.skill === skill;
  });

  // 🔥 Get ALL comments (not only unread)
  const tasksWithComments = skillDocs.filter(
    (d) => d.comment && d.comment.trim(),
  );

  // 🔥 Count total lines in Firestore
  let totalFirestoreLines = 0;
  tasksWithComments.forEach((d) => {
    const lines = d.comment.split("\n").filter((l) => l.trim());
    totalFirestoreLines += lines.length;
  });

  const storedCount =
    state.commentReadCounts[loginUser]?.[state.currentWO]?.[skill] || 0;

  const unreadCount = totalFirestoreLines - storedCount;

  // 🔥 Sort by latest comment
  tasksWithComments.sort((a, b) => {
    const getLastDate = (comment) => {
      const lines = comment.split("\n").filter((l) => l.trim());
      const lastLine = lines[lines.length - 1] || "";
      return new Date(lastLine.match(/\[(.*?)\]/)?.[1] || 0);
    };
    return getLastDate(b.comment) - getLastDate(a.comment);
  });

  const htmlContent =
    tasksWithComments.length === 0
      ? "No comments yet."
      : tasksWithComments
          .map((t) => {
            const lines = t.comment
              .split("\n")
              .filter((l) => l.trim())
              .reverse(); // newest first

            const highlightedLines = lines
              .map((line) => {
                return `
      <div style="padding:3px 0;">
        ${line}
      </div>
    `;
              })
              .join("");

            return `
              <div class="popup-comment"
                   data-id="${t.id}"
                   style="
                     margin-bottom:14px;
                     padding:10px;
                     border-radius:10px;
                     border:1px solid #eee;
                     cursor:pointer;
                   ">
                <strong>🔹 Seq ${t.seq}</strong> — ${t.task_card}
                <div style="
                  margin:6px 0 0 8px;
                  padding-left:8px;
                  border-left:3px solid var(--lufthansa-blue);
                  font-size:13px;
                ">
                  ${highlightedLines}
                </div>
              </div>
            `;
          })
          .join("");

  openPopup(`Comments – ${skill === "CLEAR" ? "ALL" : skill}`, htmlContent);

  // 🔥 Mark all as read AFTER opening
  if (!state.commentReadCounts[loginUser]) {
    state.commentReadCounts[loginUser] = {};
  }
  if (!state.commentReadCounts[loginUser][state.currentWO]) {
    state.commentReadCounts[loginUser][state.currentWO] = {};
  }

  state.commentReadCounts[loginUser][state.currentWO][skill] =
    totalFirestoreLines;

  localStorage.setItem(
    "commentReadCounts",
    JSON.stringify(state.commentReadCounts),
  );

  handleCommentBadgeUpdates({
    docs: state.allDocs.map((d) => ({ data: () => d })),
  });
});
//Comments popup********************************************************
document.addEventListener("mousedown", (e) => {
  const textarea = e.target.closest(".comment-input");
  if (!textarea) return;

  // prevent auto-trigger during reload
  if (document.readyState !== "complete") return;

  const taskId = textarea.dataset.id;
  commentInputModal.dataset.taskId = taskId;

  document.getElementById("newCommentInput").value = "";
  commentInputModal.style.display = "flex";

  setTimeout(() => {
    document.getElementById("newCommentInput").focus();
  }, 50);
});
// =======================
// Comment Input Modal
// =======================
const commentInputModal = document.createElement("div");
commentInputModal.id = "commentInputModal";

commentInputModal.innerHTML = `
  <div class="comment-modal-card">
    <div class="comment-modal-header">
      <h3>Add Comment</h3>
      <button id="cancelCommentBtn" class="comment-close">&times;</button>
    </div>

    <textarea 
      id="newCommentInput"
      class="comment-textarea"
      placeholder="Type your comment... (Press Enter to submit)">
    </textarea>
  </div>
`;

document.body.appendChild(commentInputModal);

document.getElementById("cancelCommentBtn").onclick = () => {
  commentInputModal.style.display = "none";
};

document
  .getElementById("newCommentInput")
  .addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;

    e.preventDefault();

    const text = e.target.value.trim();
    if (!text) return;

    const taskId = commentInputModal.dataset.taskId;
    const task = state.allDocs.find((d) => d.id === taskId);
    if (!task) return;

    const now = new Date().toLocaleString();
    const formatted = `[${now}] ${loginUser}: ${text}`;

    const taskRef = doc(
      db,
      "work_orders",
      String(task.wo),
      "taskcards",
      taskId,
    );

    const updatedComment =
      (task.comment ? task.comment + "\n" : "") + formatted;

    await updateDoc(taskRef, {
      comment: updatedComment,
    });

    commentInputModal.style.display = "none";
  });
//***************end comments pop*************************** */
function mapToGroupSkill(rawSkill) {
  for (const [group, members] of Object.entries(skillGroups)) {
    if (members.includes(rawSkill)) return group;
  }
  return rawSkill;
}

function handleCommentBadgeUpdates(snapshot) {
  const unreadCounts = {};
  if (!loginUser || !state.currentWO) return;
  if (!state.commentReadCounts[loginUser]) {
    state.commentReadCounts[loginUser] = {};
  }
  if (!state.commentReadCounts[loginUser][state.currentWO]) {
    state.commentReadCounts[loginUser][state.currentWO] = {};
  }
  const firestoreCounts = {};
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const rawSkill = data.skill || "CLEAR";
    const skill = mapToGroupSkill(rawSkill);
    const comment = data.comment || "";
    if (!comment.trim()) return;
    const lines = comment.split("\n").filter((line) => line.trim() !== "");
    firestoreCounts[skill] = (firestoreCounts[skill] || 0) + lines.length;
  });
  Object.keys(firestoreCounts).forEach((skill) => {
    const storedCount =
      state.commentReadCounts[loginUser][state.currentWO][skill] || 0;
    const unread = firestoreCounts[skill] - storedCount;
    if (unread > 0) {
      unreadCounts[skill] = unread;
    }
  });
  state.badgeCounts = unreadCounts;
  updateBadgeDisplay();
}

async function renderRows(docs) {
  let selectedSkills = [];

  if (state.activeSkill !== "CLEAR") {
    selectedSkills = skillGroups[state.activeSkill]
      ? skillGroups[state.activeSkill]
      : [state.activeSkill];
  }

  const newDocsMap = new Map(docs.map((d) => [d.id, d]));

  // 🔥 Lightweight comment-only update
  if (
    state.prevDocsMap.size > 0 &&
    newDocsMap.size === state.prevDocsMap.size
  ) {
    const changed = [];

    for (const [id, newDoc] of newDocsMap.entries()) {
      const oldDoc = state.prevDocsMap.get(id);
      if (!oldDoc) continue;

      if (oldDoc.comment !== newDoc.comment) {
        changed.push({ id, comment: newDoc.comment });
      }
    }

    if (changed.length > 0 && changed.length <= 5) {
      changed.forEach(({ id, comment }) => {
        const ta = document.querySelector(`.comment-input[data-id="${id}"]`);
        if (ta) {
          ta.value = comment || "";
          ta.style.height = "auto";
          ta.style.height = ta.scrollHeight + "px";
          ta.classList.add("comment-updated");

          setTimeout(
            () => ta.classList.remove("comment-updated"),
            state.commentFlashDuration,
          );
        }
      });

      state.prevDocsMap = newDocsMap;
      return;
    }
  }

  state.prevDocsMap = newDocsMap;

  // 🔥 Group by sequence
  const grouped = {};
  for (const d of docs) {
    const seq = d.seq ?? "Unknown";
    if (!grouped[seq]) grouped[seq] = [];
    grouped[seq].push(d);
  }

  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return String(a).localeCompare(String(b));
  });

  const rows = [];

  for (const [seq, tasks] of sortedGroups) {
    tasks.sort((a, b) =>
      String(a.task_card ?? "").localeCompare(
        String(b.task_card ?? ""),
        undefined,
        { numeric: true },
      ),
    );

    const hasCancelled = tasks.some(
      (t) => (t.status ?? "").toLowerCase() === "cancel",
    );

    const allClosed = tasks.every(
      (t) => (t.status ?? "").toLowerCase() === "closed",
    );

    let finalStatus = "Open";
    let statusColor = "var(--lufthansa-danger)";

    if (hasCancelled) {
      finalStatus = "Cancelled";
      statusColor = "var(--lufthansa-success)";
    } else if (allClosed) {
      finalStatus = "Closed";
      statusColor = "var(--lufthansa-success)";
    }

    tasks.forEach((t, index) => {
      const isDuplicate = index !== 0;

      const hasSelectedSkill = tasks.some(
        (x) => selectedSkills.length > 0 && selectedSkills.includes(x.skill),
      );

      const rowHasSelectedSkill = selectedSkills.includes(t.skill);

      let baseCellStyle = "";
      if (
        selectedSkills.length > 0 &&
        hasSelectedSkill &&
        !rowHasSelectedSkill
      ) {
        baseCellStyle = "color:#adb5bd; border-radius:3px; padding:2px 4px;";
      }

      const phaseCells = fixedPhases
        .map((phase) => {
          const skills = tasks
            .filter((x) => x.phase === phase && x.task_card === t.task_card)
            .map((x) => {
              const status = (x.status ?? "").toLowerCase();
              const color =
                status === "closed" || status === "cancel"
                  ? "var(--lufthansa-success)"
                  : "var(--lufthansa-danger)";

              let highlightStyle = "";

              if (
                selectedSkills.length > 0 &&
                selectedSkills.includes(x.skill)
              ) {
                highlightStyle = "font-weight:bold;";
              } else if (hasSelectedSkill && !rowHasSelectedSkill) {
                highlightStyle =
                  "opacity:0.5; border-radius:3px; padding:1px 3px;";
              }

              return `<div style="color:${color}; ${highlightStyle}">
                        ${x.skill ?? ""}
                      </div>`;
            })
            .join("<br>");

          return `<td class="phase-cell">${skills || ""}</td>`;
        })
        .join("");

      rows.push(`
<tr class="seq-row" data-seq="${seq}">

 <td class="seq-ref ${index !== 0 ? "seq-duplicate" : ""}">
  ${index === 0 ? (t.reference_task_card ?? "") : ""}
</td>

<td class="seq-desc ${isDuplicate ? "seq-duplicate" : ""}">
  ${t.task_card_description ?? ""}
</td>

<td class="seq-link ${index !== 0 ? "seq-duplicate" : ""}" style="text-align:center;">
  ${
    index === 0
      ? `
    <a href="https://ltpsystems.sharepoint.com/sites/BaseMaintenance/Shared%20Documents/Forms/AllItems.aspx?viewid=59208620%2Dd7d3%2D4b91%2D8262%2D732edcfe6e96&id=%2Fsites%2FBaseMaintenance%2FShared%20Documents%2FONEMTC%2F${state.currentWO}%2F${seq}%2Epdf&parent=%2Fsites%2FBaseMaintenance%2FShared%20Documents%2FONEMTC%2F${state.currentWO}" 
       target="_blank"
       style="color:var(--lufthansa-blue); text-decoration:underline; font-weight:500;">
      ${seq}
    </a>
  `
      : ""
  }
</td>

<td class="seq-status ${index !== 0 ? "seq-duplicate" : ""}"
    style="text-align:center; font-weight:bold; color:${statusColor};">
    ${index === 0 ? finalStatus : ""}
</td>

  <td style="text-align:center; ${baseCellStyle}">
    <span class="taskcard-click"
      data-id="${t.id}"
      data-wo="${t.wo}"
      data-seq="${t.seq}"
      data-task="${t.task_card}"
      data-skill="${t.skill}"
      data-phase="${t.phase}"
      style="color:var(--lufthansa-blue); cursor:pointer; font-weight:600; text-decoration:underline;">
      ${t.task_card ?? ""}
    </span>
  </td>

  <td class="comment-cell">
    <textarea class="comment-input" data-id="${t.id}" rows="1">
      ${t.comment || ""}
    </textarea>
  </td>

  ${phaseCells}

</tr>
`);
    });
  }

  const scrollContainer = document.querySelector("#scrollArea");
  const prevScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

  if (scrollContainer) scrollContainer.style.visibility = "hidden";

  requestAnimationFrame(() => {
    clusterize.clear();
    clusterize.update(
      rows.length
        ? rows
        : [
            `<tr class="clusterize-no-data">
               <td colspan="12">No data</td>
             </tr>`,
          ],
    );

    if (scrollContainer) {
      scrollContainer.scrollTop = prevScrollTop;
      scrollContainer.style.visibility = "visible";
    }

    requestAnimationFrame(() => {
      document.querySelectorAll(".comment-input").forEach((ta) => {
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      });
    });
  });
}

function renderPhaseTotals(docs) {
  const phaseTotals = {};
  const phaseOpen = {};
  const phaseClosed = {};
  const phaseCancelled = {};
  const phaseHold = {};
  docs.forEach((d) => {
    const phase = d.phase || "No Phase";
    if (!fixedPhases.includes(phase)) return;
    phaseTotals[phase] = (phaseTotals[phase] || 0) + 1;
    const st = (d.status || "").toLowerCase();
    if (st === "open") phaseOpen[phase] = (phaseOpen[phase] || 0) + 1;
    if (st === "closed" || st === "completed")
      phaseClosed[phase] = (phaseClosed[phase] || 0) + 1;
    if (st === "cancel")
      phaseCancelled[phase] = (phaseCancelled[phase] || 0) + 1;
    if (st === "hold") phaseHold[phase] = (phaseHold[phase] || 0) + 1;
  });
  const body = document.getElementById("phaseTotalsBody");
  body.innerHTML = "";

  fixedPhases.forEach((phase) => {
    const total = phaseTotals[phase] || 0;

    if (total === 0) {
      body.insertAdjacentHTML(
        "beforeend",
        `<tr>
            <td class="phase-cell" data-phase="${phase}" style="cursor:not-allowed; color:#adb5bd;">
              ${phase}
            </td>
            <td style="text-align:right; background:#f8f9fa; color:#adb5bd;">-</td>
            <td style="text-align:right; background:#f8f9fa; color:#adb5bd;">-</td>
            <td style="text-align:right; background:#f8f9fa; color:#adb5bd;">-</td>
            <td style="text-align:right; background:#f8f9fa; color:#adb5bd;">-</td>
            <td style="text-align:right; background:#f8f9fa; color:#adb5bd;">-</td>
          </tr>`,
      );
    } else {
      const open = phaseOpen[phase] || 0;
      const closed = phaseClosed[phase] || 0;
      const cancelledCount = phaseCancelled[phase] || 0;
      const hold = phaseHold[phase] || 0;
      const pct = (((closed + cancelledCount) / total) * 100).toFixed(1);

      body.insertAdjacentHTML(
        "beforeend",
        `<tr>
            <td class="phase-cell" data-phase="${phase}" style="cursor:pointer; color:var(--lufthansa-blue); text-decoration:underline; font-weight: 500;">
              ${phase}
            </td>
            <td style="text-align:right;">${open}</td>
            <td style="text-align:right;">${closed}</td>
            <td style="text-align:right;">${cancelledCount}</td>
            <td style="text-align:right;">${hold}</td>
            <td style="text-align:right;">${pct}%</td>
          </tr>`,
      );
    }
  });
  const phaseLabels = [];
  const closedPercentages = [];
  fixedPhases.forEach((phase) => {
    const total = phaseTotals[phase] || 0;
    const closed = phaseClosed[phase] || 0;
    const cancelled = phaseCancelled[phase] || 0;
    const pct = total ? (((closed + cancelled) / total) * 100).toFixed(1) : 0;
    phaseLabels.push(phase);
    closedPercentages.push(pct);
  });
  const totalOpen = Object.values(phaseOpen).reduce((a, b) => a + b, 0);
  const totalClosed = Object.values(phaseClosed).reduce((a, b) => a + b, 0);
  const totalCancelled = Object.values(phaseCancelled).reduce(
    (a, b) => a + b,
    0,
  );
  const totalHold = Object.values(phaseHold).reduce((a, b) => a + b, 0);
  const grandTotal = totalOpen + totalClosed + totalCancelled + totalHold;
  const totalPct = grandTotal
    ? (((totalClosed + totalCancelled) / grandTotal) * 100).toFixed(1)
    : 0;
  body.insertAdjacentHTML(
    "beforeend",
    `<tr style="font-weight:bold; background:#e7f5ff;">
        <td style="text-align:left;">TOTAL</td>
        <td style="text-align:right;">${totalOpen}</td>
        <td style="text-align:right;">${totalClosed}</td>
        <td style="text-align:right;">${totalCancelled}</td>
        <td style="text-align:right;">${totalHold}</td>
        <td style="text-align:right;">${totalPct}%</td>
      </tr>`,
  );
  if (window.phaseChartInstance) {
    window.phaseChartInstance.data.labels = phaseLabels;
    window.phaseChartInstance.data.datasets[0].data = closedPercentages;
    window.phaseChartInstance.update();
  } else {
    const ctx = document.getElementById("phaseChart").getContext("2d");
    window.phaseChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: phaseLabels,
        datasets: [
          {
            label: "% Closed",
            data: closedPercentages,
            backgroundColor: "rgba(5, 22, 77, 0.7)",
            borderColor: "rgba(5, 22, 77, 1)",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y}% closed`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: { display: true, text: "% Closed" },
          },
          x: {
            title: { display: true, text: "Phase" },
          },
        },
      },
    });
  }
  document.querySelectorAll("#phaseTotalsBody .phase-cell").forEach((cell) => {
    cell.addEventListener("click", () => {
      const phase = cell.dataset.phase;
      if (state.activePhase === phase) {
        state.activePhase = null;
      } else {
        state.activePhase = phase;
      }
      applyFilters();
    });
  });
}

const skillGroups = {
  CLEAR: [],
  AVI: ["AVI"],
  "CRG/ENG": ["CRG", "ENG-E", "ENG-F"],
  CAB: ["CAB"],
  "LDG/FLC": ["LDG", "FLC-W", "FLC-T"],
  STR: ["STR"],
  GEN: ["GEN"],
};

function attachSkillButtonListeners() {
  document.querySelectorAll(".skill-filters button").forEach((btn) => {
    btn.onclick = null;
    btn.onclick = () => {
      document
        .querySelectorAll(".skill-filters button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeSkill = btn.dataset.skill;
      localStorage.setItem("state.activeSkill", state.activeSkill);
      if (state.activeSkill === "CLEAR") {
        state.scannedSeqs = [];
        state.seqFilterValues = [];
        document
          .querySelectorAll(".filter")
          .forEach((input) => (input.value = ""));
      }
      applyFilters();
    };
  });
}

document.getElementById("multiSkillBtn").addEventListener("click", () => {
  state.multiSkillActive = !state.multiSkillActive;
  state.singleSkillActive = false;
  const multiBtn = document.getElementById("multiSkillBtn");
  const singleBtn = document.getElementById("singleSkillBtn");
  multiBtn.classList.toggle("active", state.multiSkillActive);
  singleBtn.classList.remove("active");
  applyFilters();
});

document.getElementById("singleSkillBtn").addEventListener("click", () => {
  state.singleSkillActive = !state.singleSkillActive;
  state.multiSkillActive = false;
  const multiBtn = document.getElementById("multiSkillBtn");
  const singleBtn = document.getElementById("singleSkillBtn");
  singleBtn.classList.toggle("active", state.singleSkillActive);
  multiBtn.classList.remove("active");
  applyFilters();
});

function getSkillFilteredDocs() {
  if (state.activeSkill === "CLEAR") return state.allDocs;
  if (skillGroups[state.activeSkill]) {
    const skills = skillGroups[state.activeSkill];
    return state.allDocs.filter((d) => skills.includes(d.skill));
  }
  return state.allDocs.filter((d) => d.skill === state.activeSkill);
}

async function applyFilters() {
  const filterConfig = collectActiveFilters();

  const skillFilteredDocs = getSkillFilteredDocs();
  const skillBaseTotal = skillFilteredDocs.length;

  const seqSkillMap = buildSeqSkillMapIfNeeded();

  const finalFilteredDocs = computeFilteredDocs(
    skillFilteredDocs,
    filterConfig,
    seqSkillMap,
  );

  const matchingSeqs = new Set(finalFilteredDocs.map((d) => String(d.seq)));

  const rowsToRender = state.allDocs.filter((d) =>
    matchingSeqs.has(String(d.seq)),
  );

  renderRows(rowsToRender);
  updateCounters(finalFilteredDocs, skillBaseTotal);
 
    listenToDiscrepancies(state.currentWO);

  if (typeof renderJCChart === "function" && state.currentWO) {
    await renderJCChart(state.currentWO, skillFilteredDocs);
  }
}
function collectActiveFilters() {
  const fieldFilters = {};
  document.querySelectorAll(".filter").forEach((input) => {
    const value = input.value.trim().toLowerCase();
    if (value && input.dataset.field !== "seq") {
      fieldFilters[input.dataset.field] = value;
    }
  });
  return {
    fieldFilters,
    seqFilterSet: new Set(state.seqFilterValues.map(String)),
    scannedSeqSet: new Set(state.scannedSeqs.map(String)),
    activePhase: state.activePhase,
    multiSkillActive: state.multiSkillActive,
    singleSkillActive: state.singleSkillActive,
  };
}
function docMatchesFilters(doc, config, seqSkillMap) {
  const seqStr = String(doc.seq);

  // --- Field filters ---
  for (const [field, value] of Object.entries(config.fieldFilters)) {
    if (
      !String(doc[field] ?? "")
        .toLowerCase()
        .includes(value)
    ) {
      return false;
    }
  }

  // --- Seq filters ---
  if (config.seqFilterSet.size && !config.seqFilterSet.has(seqStr)) {
    return false;
  }

  if (config.scannedSeqSet.size && !config.scannedSeqSet.has(seqStr)) {
    return false;
  }

  // --- Phase filter ---
  if (config.activePhase && doc.phase !== config.activePhase) {
    return false;
  }

  // --- Multi / Single skill filters ---
  if (seqSkillMap) {
    const skillCount = seqSkillMap[seqStr]?.size || 0;

    if (config.multiSkillActive && skillCount <= 1) {
      return false;
    }

    if (config.singleSkillActive && skillCount !== 1) {
      return false;
    }
  }

  return true;
}
function computeFilteredDocs(docs, config, seqSkillMap) {
  const result = [];

  for (const doc of docs) {
    if (docMatchesFilters(doc, config, seqSkillMap)) {
      result.push(doc);
    }
  }

  return result;
}
function buildSeqSkillMapIfNeeded() {
  if (!state.multiSkillActive && !state.singleSkillActive) return null;

  const map = {};

  for (const d of state.allDocs) {
    const seq = String(d.seq);
    if (!map[seq]) map[seq] = new Set();
    if (d.skill) map[seq].add(d.skill);
  }

  return map;
}
function updateCounters(skillFilteredDocs, skillBaseTotal) {
  const pctClosed = getClosedPercentage(skillFilteredDocs);
  const seqGroups = {};
  skillFilteredDocs.forEach((d) => {
    const seq = String(d.seq);
    if (!seqGroups[seq]) seqGroups[seq] = [];
    seqGroups[seq].push(d.status?.toLowerCase());
  });
  let totalMTC = 0,
    closedMTC = 0,
    openMTC = 0;
  Object.keys(seqGroups).forEach((seq) => {
    totalMTC++;
    const allClosed = seqGroups[seq].every(
      (s) => s === "closed" || s === "cancel" || s === "completed",
    );
    if (allClosed) closedMTC++;
    else openMTC++;
  });
  let counterText = `Showing ${skillFilteredDocs.length} of ${skillBaseTotal} tasks • 
    <span class="highlight">${pctClosed}% Closed</span>
    &nbsp;&nbsp;&nbsp; 
    Total MTC ${totalMTC} • 
    <span style="color:var(--lufthansa-danger); font-weight:bold;">Open MTC ${openMTC}</span> • 
    <span style="color:var(--lufthansa-success); font-weight:bold;">Closed MTC ${closedMTC}</span>`;

  if (state.activePhase) {
    counterText += ` • Filter: <span class="highlight">${state.activePhase}</span>
      <button id="clearPhaseBtn" style="margin-left:8px; padding:2px 8px; font-size:11px; background:#eee; border:1px solid #ccc; border-radius:12px; cursor:pointer; color:#333;">
        Clear
      </button>`;
  }
  if (state.activeSkill && state.activeSkill !== "CLEAR") {
    counterText += ` • Skill: <span class="highlight">${state.activeSkill}</span>`;
  }
  counterEl.innerHTML = counterText;
  document.getElementById("clearPhaseBtn")?.addEventListener("click", () => {
    state.activePhase = null;
    applyFilters();
  });
  const clearSeqBtn = document.getElementById("clearSeqBtn");
  clearSeqBtn.style.display =
    state.seqFilterValues.length > 0 || state.scannedSeqs.length > 0
      ? "inline"
      : "none";
  clearSeqBtn.onclick = () => {
    state.scannedSeqs = [];
    state.seqFilterValues = [];
    const seqInput = document.querySelector('.filter[data-field="seq"]');
    if (seqInput) seqInput.value = "";
    applyFilters();
  };
  renderPhaseTotals(skillFilteredDocs);
}

seqInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const val = seqInput.value.trim();
    if (val !== "" && !state.seqFilterValues.includes(val)) {
      state.seqFilterValues.push(val);
    }
    seqInput.value = "";
    applyFilters();
  }
});

attachSkillButtonListeners();
document
  .querySelectorAll(".filter")
  .forEach((input) => input.addEventListener("input", debouncedApplyFilters));

/* =======================
  Firestore Query by WO
======================== */
async function searchWorkorder(workorder) {
  showLoading();

  try {
    state.currentWO = workorder;
    localStorage.setItem("lastWorkorder", workorder);

    updateBadgeDisplay();

    const woRef = doc(db, "work_orders", String(workorder));
    const woSnap = await getDoc(woRef);

    if (!woSnap.exists()) {
      showToast("Work Order not found.", "error");
      return;
    }

    const woData = woSnap.data();
    const ac = woData.ac || "Unknown AC";
    const dayProgress = calculateDayProgress(woData);

    document.getElementById("dynamicHeader").textContent =
      `MTC Status for ${ac} ${dayProgress || ""}`;

    if (lastUpdateEl) {
      lastUpdateEl.textContent = "Live • " + new Date().toLocaleString();
    }

    // 🔥 Unsubscribe previous listener
    if (state.unsubscribe) state.unsubscribe();

    const taskcardsRef = collection(
      db,
      "work_orders",
      String(workorder),
      "taskcards",
    );

    const q = query(taskcardsRef, orderBy("seq"));

    state.unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        processSnapshot(snapshot);
      },
      (error) => {
        console.error("Snapshot error:", error);
        showToast("Realtime listener error", "error");
      },
    );

    listenToDiscrepancies(workorder);
  } catch (err) {
    console.error("Search error:", err);
    showToast("Error loading Work Order", "error");
  } finally {
    setTimeout(() => hideLoading(), 300);
  }
  listenToDiscrepancies(workorder);
}
function processSnapshot(snapshot) {
  // 🔥 Build once
  const allDocs = [];
  const groupedBySeq = new Map();
  const skillIndex = {};
  const phaseIndex = {};
  const seqSkillCount = {};

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const docObj = { id: docSnap.id, ...data };
    allDocs.push(docObj);

    const seq = String(docObj.seq);

    // Group by sequence
    if (!groupedBySeq.has(seq)) {
      groupedBySeq.set(seq, []);
    }
    groupedBySeq.get(seq).push(docObj);

    // Skill index
    if (!skillIndex[docObj.skill]) {
      skillIndex[docObj.skill] = [];
    }
    skillIndex[docObj.skill].push(docObj);

    // Phase index
    if (!phaseIndex[docObj.phase]) {
      phaseIndex[docObj.phase] = [];
    }
    phaseIndex[docObj.phase].push(docObj);

    // Seq skill count
    if (!seqSkillCount[seq]) {
      seqSkillCount[seq] = new Set();
    }
    seqSkillCount[seq].add(docObj.skill);
  }

  // 🔥 Assign once
  state.allDocs = allDocs;
  state.groupedBySeq = groupedBySeq;
  state.skillIndex = skillIndex;
  state.phaseIndex = phaseIndex;
  state.seqSkillCount = seqSkillCount;

  // 🔥 UI updates AFTER data ready
  buildDynamicSkillButtons(allDocs);

  // 🔥 Non-blocking heavy calculations
  requestIdleCallback(() => {
    handleCommentBadgeUpdates(snapshot);
  });

  applyFilters();
}
/* =======================
  Scan Modal + Scanner
======================== */
async function updateTaskStatus(taskId, newStatus) {
  try {
    const task = state.allDocs.find((d) => d.id === taskId);
    if (!task) {
      showToast("Task not found in cache", "error");
      return false;
    }
    const taskRef = doc(
      db,
      "work_orders",
      String(task.wo),
      "taskcards",
      taskId,
    );
    await updateDoc(taskRef, {
      status: newStatus,
      modified_at: serverTimestamp(),
      modified_by: loginUser || "Unknown",
    });
    const idx = state.allDocs.findIndex((d) => d.id === taskId);
    if (idx !== -1) {
      state.allDocs[idx] = { ...state.allDocs[idx], status: newStatus };
      await logHistoryEntry(state.allDocs[idx], newStatus);
    }
    applyFilters();
    showToast(`Status updated to ${newStatus}`, "success");
    return true;
  } catch (err) {
    console.error(err);
    showToast(`Failed to update task ${taskId}`, "error");
    return false;
  }
}

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

function openModal() {
  scanModal.style.display = "flex";
}
function closeModal() {
  scanModal.style.display = "none";
}

manualAddBtn.addEventListener("click", () => {
  const value = manualSeqInput.value.trim();
  if (value !== "") {
    handleScannedValue(value);
    manualSeqInput.value = "";
  }
});

manualSeqInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    manualAddBtn.click();
  }
});

function setScanning(active) {
  state.scanningActive = active;
  startScanBtn.classList.toggle("scanning", active);
  startScanBtn.disabled = active;
  stopScanBtn.style.display = active ? "inline-block" : "none";
  if (active) {
    barcodeInput.value = "";
    barcodeInput.focus();
  } else {
    barcodeInput.blur();
  }
}

startScanBtn.addEventListener("click", () => {
  if (!state.currentWO && !woInput.value.trim()) {
    showToast("Enter a Workorder first, then click Search.", "info");
    return;
  }
  if (!state.currentWO && woInput.value.trim()) {
    searchWorkorder(woInput.value.trim());
  }
  setScanning(true);
  openModal();
});

stopScanBtn.addEventListener("click", () => setScanning(false));

barcodeInput.addEventListener("keydown", (e) => {
  if (!state.scanningActive) return;
  if (e.key === "Enter") {
    const val = barcodeInput.value.trim();
    barcodeInput.value = "";
    if (val !== "") handleScannedValue(val);
  }
});

async function handleScannedValue(raw) {
  const num = Number(raw);
  if (Number.isNaN(num)) {
    showToast(`Invalid sequence (not a number): "${raw}"`, "error");
    return;
  }
  if (!state.currentWO) {
    showToast("No Work Order loaded.", "error");
    return;
  }
  try {
    const matchingTasks = state.allDocs.filter((t) => Number(t.seq) === num);

    scanResultsList.innerHTML = "";

    if (matchingTasks.length === 0) {
      scanResultsList.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; color:#777;">
        No tasks found for Seq ${num}
      </td>
    </tr>`;
      return;
    }

    let shown = 0;
    const showClosed = showClosedChk.checked;

    matchingTasks.forEach((task) => {
      const isClosed = (task.status ?? "").toUpperCase() === "CLOSED";
      if (isClosed && !showClosed) return;

      if (state.activeSkill !== "CLEAR") {
        if (skillGroups[state.activeSkill]) {
          if (!skillGroups[state.activeSkill].includes(task.skill)) return;
        } else {
          if (task.skill !== state.activeSkill) return;
        }
      }

      shown++;

      scanResultsList.insertAdjacentHTML(
        "beforeend",
        `
    <tr>
      <td>${task.seq ?? ""}</td>
      <td>${task.task_card ?? ""}</td>
      <td>${task.phase ?? "P?"}</td>
      <td>${task.skill ?? "GEN"}</td>
      <td>${task.status ?? "OPEN"}</td>
      <td>
        ${
          isClosed
            ? `<button type="button" data-reopen="${task.id}">Reopen</button>`
            : `<button type="button" data-add="${task.id}">Add</button>`
        }
      </td>
    </tr>
    `,
      );
    });
    if (shown === 0) {
      scanResultsList.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#777;">
            No matching tasks found for Seq ${num}
          </td>
        </tr>`;
    }
    if (scanModal.style.display !== "flex") openModal();
  } catch (err) {
    console.error(err);
    showToast("Error fetching tasks.", "error");
  }
}

scanResultsList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-add]");
  if (!btn) return;
  const taskId = btn.getAttribute("data-add");
  if (state.scannedTasks.some((t) => t.id === taskId)) {
    showToast("Task already queued", "info");
    return;
  }
  const row = btn.closest("tr");
  const seq = row.children[0].textContent.trim();
  const task_card = row.children[1].textContent.trim();
  const phase = row.children[2].textContent.trim();
  const skill = row.children[3].textContent.trim();
  const status = row.children[4].textContent.trim();
  state.scannedTasks.push({
    id: taskId,
    seq,
    task_card,
    phase,
    skill,
    status,
    display: `Seq ${seq}-${task_card}-${phase}-${skill}-${status}`,
  });
  renderQueuedList();
  row.remove();
});

scanResultsList.addEventListener("click", async (e) => {
  const reopenBtn = e.target.closest("button[data-reopen]");
  if (!reopenBtn) return;

  const taskId = reopenBtn.getAttribute("data-reopen");
  const ok = await updateTaskStatus(taskId, "OPEN");
  if (!ok) return;

  const row = reopenBtn.closest("tr");
  row.children[3].textContent = "OPEN";
  reopenBtn.outerHTML = `<button type="button" data-add="${taskId}">Add</button>`;
  showToast("Task reopened ✅", "success");
});

function renderQueuedList() {
  scannedList.innerHTML = "";
  if (!state.scannedTasks.length) {
    scannedList.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:#777;">No tasks queued</td>
      </tr>`;
  } else {
    state.scannedTasks.forEach((task) => {
      scannedList.insertAdjacentHTML(
        "beforeend",
        `
        <tr>
          <td>${task.seq}</td>
          <td>${task.task_card}</td><td>${task.phase}</td>
          <td>${task.skill}</td>
          <td>${task.status}</td>
          <td>
            <button type="button" data-remove="${task.id}">Remove</button>
          </td>
        </tr>
      `,
      );
    });
  }
  scanCountEl.textContent = String(state.scannedTasks.length);
}

scannedList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-remove]");
  if (!btn) return;
  const id = btn.getAttribute("data-remove");
  const task = state.scannedTasks.find((t) => t.id === id);
  state.scannedTasks = state.scannedTasks.filter((t) => t.id !== id);
  renderQueuedList();
  if (task) {
    scanResultsList.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${task.seq}</td>
       <td>${task.task_card}</td> <td>${task.phase}</td>
        <td>${task.skill}</td>
        <td>${task.status}</td>
        <td>
          <button type="button" data-add="${task.id}">Add</button>
        </td>
      </tr>
      `,
    );
  }
});

submitScanBtn.addEventListener("click", async () => {
  if (!state.currentWO) {
    showToast("Please search a Workorder first.", "error");
    return;
  }
  if (!state.scannedTasks.length) {
    showToast("No tasks queued.", "info");
    return;
  }
  closeModal();
  setScanning(false);
  showLoading();
  let updated = 0;
  try {
    for (const task of state.scannedTasks) {
      const ok = await updateTaskStatus(task.id, "CLOSED");
      if (ok) updated++;
    }
  } catch (err) {
    console.error(err);
    showToast("Error while updating tasks. Please try again.", "error");
  } finally {
    applyFilters();
    hideLoading();
    document
      .querySelectorAll(".skill-filters button")
      .forEach((b) => b.classList.remove("active"));

    const activeBtn = document.querySelector(
      `.skill-filters button[data-skill="${state.activeSkill}"]`,
    );
    if (activeBtn) activeBtn.classList.add("active");
  }

  state.scannedTasks = [];
  renderQueuedList();
  scanResultsList.innerHTML = "";
  showToast(`Updated to CLOSED: ${updated}`, updated ? "success" : "info");
});

closeScanBtn.addEventListener("click", () => {
  closeModal();
  setScanning(false);
  showClosedChk.checked = false;
});
clearScanBtn.addEventListener("click", () => {
  state.scannedTasks = [];
  renderQueuedList();
  scanResultsList.innerHTML = "";
});
renderQueuedList();

document.getElementById("logbookBtn").addEventListener("click", () => {
  const currentWO = document.getElementById("woInput").value?.trim();
  const selectedSkill = state.activeSkill !== "CLEAR" ? state.activeSkill : "";
  if (!state.currentWO) {
    showToast("Please select or enter a Work Order first.", "error");
    return;
  }
  const url = `digitallogbook.html?wo=${encodeURIComponent(
    state.currentWO,
  )}&skill=${encodeURIComponent(selectedSkill)}`;
  window.open(url, "_blank");
});

document.getElementById("manualTrigger").addEventListener("click", () => {
  const container = document.getElementById("dynamicBadgeContainer");
  container.innerHTML = `<div class="comment-badge" data-skill="${state.activeSkill}"></div>`;

  const badge = document.querySelector(
    `.comment-badge[data-skill="${state.activeSkill}"]`,
  );
  if (badge) badge.click();
});

document.getElementById("historyBadge").addEventListener("click", () => {
  if (state.newHistoryItems.length === 0) return;
  clearGlow();
  clearGlowState();
  state.newHistoryItems.forEach((id) => {
    const li = document.querySelector(`#historyList [data-id="${id}"]`);
    if (li) {
      const statusEl = li.querySelector(".status");
      let glowClass = "pulse-glow-amber";
      if (statusEl) {
        const statusText = statusEl.textContent.trim().toUpperCase();
        if (statusText.includes("COMPLETED")) {
          glowClass = "pulse-glow-green";
        } else if (statusText.includes("RE-OPEN")) {
          glowClass = "pulse-glow-blue";
        } else if (
          statusText.includes("WARNING") ||
          statusText.includes("NEWLY ADDED")
        ) {
          glowClass = "pulse-glow-amber";
        }
      }
      li.classList.add(glowClass);
      saveGlowState(id, glowClass);
    }
  });
  state.newHistoryItems = [];
  updateHistoryBadge();
});

async function renderJCChart(workorder, filteredDocs = []) {
  const getLocalDateKey = (date) => {
    if (!date || isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (!workorder) {
    console.warn("⚠️ No workorder specified for JC chart.");
    return;
  }

  const woId = String(workorder);

  // ============================
  // 🔹 1. GET WO START/END DATE
  // ============================
  const woRef = doc(db, "work_orders", woId);
  const woSnap = await getDoc(woRef);

  if (!woSnap.exists()) {
    console.warn("WO not found:", woId);
    return;
  }

  const woData = woSnap.data();

  const startRaw = woData.startdate?.toDate?.() || new Date(woData.startdate);
  const endRaw = woData.enddate?.toDate?.() || new Date(woData.enddate);

  if (!startRaw || !endRaw || isNaN(startRaw) || isNaN(endRaw)) {
    console.warn("Invalid WO start/end date");
    return;
  }

  startRaw.setHours(0, 0, 0, 0);
  endRaw.setHours(0, 0, 0, 0);

  // 🔹 Generate full date range
  const sortedDates = [];
  let current = new Date(startRaw);

  while (current <= endRaw) {
    sortedDates.push(getLocalDateKey(new Date(current)));
    current.setDate(current.getDate() + 1);
  }

  if (!sortedDates.length) return;

  // ============================
  // 🔹 2. GET TARGET DATA
  // ============================
  const targetRef = collection(db, "wo_jctargets", woId, "items");
  const targetSnap = await getDocs(query(targetRef, orderBy("tdate")));

  const groupedTarget = {};

  targetSnap.forEach((doc) => {
    const d = doc.data();
    if (!d.tdate || !d.tasktarget) return;

    const date = d.tdate.toDate?.() || new Date(d.tdate);
    const dateKey = getLocalDateKey(date);
    if (!dateKey) return;

    if (state.activeSkill && state.activeSkill !== "CLEAR") {
      const selectedSkills = skillGroups[state.activeSkill] || [
        state.activeSkill,
      ];
      if (!selectedSkills.includes(d.skill)) return;
    }

    groupedTarget[dateKey] =
      (groupedTarget[dateKey] || 0) + Number(d.tasktarget || 0);
  });

  // ============================
  // 🔹 3. GET ACTUAL CLOSED DATA
  // ============================
  const historyRef = collection(db, "wo_history", woId, "items");
  const histSnap = await getDocs(historyRef);

  const groupedActual = {};
  const uniqueTasks = new Set();

  histSnap.forEach((doc) => {
    const h = doc.data();
    if (!h.timestamp) return;

    if (state.activeSkill && state.activeSkill !== "CLEAR") {
      const selectedSkills = skillGroups[state.activeSkill] || [
        state.activeSkill,
      ];
      if (!selectedSkills.includes(h.skill)) return;
    }

    const status = (h.status || "").toLowerCase();
    if (status !== "closed" && status !== "completed" && status !== "cancel")
      return;

    const uniqueKey = `${h.seq || ""}-${h.task_card || ""}`;
    if (uniqueTasks.has(uniqueKey)) return;
    uniqueTasks.add(uniqueKey);

    const date = h.timestamp.toDate?.() || new Date(h.timestamp);
    const dateKey = getLocalDateKey(date);
    if (!dateKey) return;

    groupedActual[dateKey] = (groupedActual[dateKey] || 0) + 1;
  });

  // ============================
  // 🔹 4. BUILD CUMULATIVE DATA
  // ============================
  const labels = [];
  const cumulativeTargets = [];
  const cumulativeActual = [];

  let runningTarget = 0;
  let runningActual = 0;

  const todayKey = getLocalDateKey(new Date());

  sortedDates.forEach((dateKey, i) => {
    // Target
    runningTarget += groupedTarget[dateKey] || 0;
    cumulativeTargets.push(runningTarget);

    // Actual (stop after today)
    if (dateKey <= todayKey) {
      runningActual += groupedActual[dateKey] || 0;
      cumulativeActual.push(runningActual);
    } else {
      cumulativeActual.push(null);
    }

    labels.push(`Day ${i + 1} (${dateKey.slice(5)})`);
  });

  // ============================
  // 🔹 5. RENDER / UPDATE CHART
  // ============================
  const chartTitle =
    state.activeSkill && state.activeSkill !== "CLEAR"
      ? `Target vs Actual Closed — ${state.activeSkill}`
      : "Target vs Actual Closed Tasks";

  const ctx =
    window.jcChartCtx ||
    (window.jcChartCtx = document.getElementById("jcChart").getContext("2d"));

  if (window.jcChartInstance) {
    window.jcChartInstance.data.labels = labels;
    window.jcChartInstance.data.datasets[0].data = cumulativeTargets;
    window.jcChartInstance.data.datasets[1].data = cumulativeActual;
    window.jcChartInstance.update();
    return;
  }

  window.jcChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumulative Target",
          data: cumulativeTargets,
          borderColor: "rgba(5, 22, 77, 1)",
          backgroundColor: "rgba(5, 22, 77, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: "Cumulative Closed",
          data: cumulativeActual,
          borderColor: "rgba(34,197,94,1)",
          backgroundColor: "rgba(34,197,94,0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function buildDynamicSkillButtons(docs) {
  const container = document.getElementById("skillFilters");
  if (!container) return;
  container.innerHTML = "";
  const clearBtn = document.createElement("button");
  clearBtn.dataset.skill = "CLEAR";
  clearBtn.classList.add("active");
  clearBtn.innerHTML = `
    ALL SKILL
    <span class="comment-badge" data-skill="CLEAR">0</span>
  `;
  container.appendChild(clearBtn);
  const rawSkillSet = new Set();
  docs.forEach((doc) => {
    if (doc.skill) rawSkillSet.add(doc.skill);
  });
  const usedButtons = new Set();
  Object.entries(skillGroups).forEach(([groupName, members]) => {
    const hasMember = members.some((skill) => rawSkillSet.has(skill));
    if (hasMember) {
      usedButtons.add(groupName);

      const btn = document.createElement("button");
      btn.dataset.skill = groupName;
      btn.innerHTML = `
        ${groupName}
        <span class="comment-badge" data-skill="${groupName}">0</span>
      `;
      container.appendChild(btn);
    }
  });
  rawSkillSet.forEach((skill) => {
    const belongsToGroup = Object.values(skillGroups).some((groupArr) =>
      groupArr.includes(skill),
    );
    if (!belongsToGroup) {
      const btn = document.createElement("button");
      btn.dataset.skill = skill;
      btn.innerHTML = `
        ${skill}
        <span class="comment-badge" data-skill="${skill}">0</span>
      `;
      container.appendChild(btn);
    }
  });
  attachSkillButtonEvents();
}

function attachSkillButtonEvents() {
  document.querySelectorAll(".skill-filters button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".skill-filters button")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeSkill = btn.dataset.skill;
      applyFilters();
    });
  });
}
// SEQUENCE CLOSING START CTRL+S to Close CTRL+SHIFT+O to open*******************************************************************
document.addEventListener("keydown", async (e) => {
  const isCtrl = e.ctrlKey || e.metaKey;
  if (!isCtrl) return;
  const key = e.key.toLowerCase();
  if (key === "s" && !e.shiftKey) {
    e.preventDefault();
    const seqs = getBulkSeqList();
    if (!state.currentWO || seqs.length === 0) return;
    const ok = await modernConfirm(
      "Close Sequence",
      `Close ${seqs.length} selected Seq(s)?`,
    );
    if (!ok) return;
    await closeSequencesBulk(seqs);
  }
  if (key === "o" && e.shiftKey) {
    e.preventDefault();
    const seqs = getBulkSeqList();
    if (!state.currentWO || seqs.length === 0) return;
    const ok = await modernConfirm(
      "Reopen Sequence",
      `Reopen ${seqs.length} selected Seq(s)?`,
    );
    if (!ok) return;
    await reopenSequencesBulk(seqs);
  }
});
function getBulkSeqList() {
  let seqSet = new Set();
  if (state.scannedSeqs && state.scannedSeqs.length > 0) {
    state.scannedSeqs.forEach((seq) => seqSet.add(String(seq)));
  }
  if (state.seqFilterValues && state.seqFilterValues.length > 0) {
    state.seqFilterValues.forEach((seq) => seqSet.add(String(seq)));
  }
  const seqValue = seqInput?.value.trim();
  if (seqValue) {
    seqValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((seq) => seqSet.add(seq));
  }
  return Array.from(seqSet);
}
async function closeSequencesBulk(seqList) {
  try {
    showLoading();
    const woId = String(state.currentWO);
    const tasksToClose = state.allDocs.filter(
      (task) =>
        seqList.includes(String(task.seq)) &&
        (task.status || "").toLowerCase() === "open",
    );
    if (tasksToClose.length === 0) {
      showToast("No open tasks found for selected Seq(s).", "info");
      hideLoading();
      return;
    }
    const updatePromises = tasksToClose.map(async (task) => {
      const docRef = doc(db, "work_orders", woId, "taskcards", task.id);
      await updateDoc(docRef, { status: "Closed" });
      await logHistoryEntry(task, "CLOSED");
    });
    await Promise.all(updatePromises);
    showToast(
      `Closed ${tasksToClose.length} task(s) from ${seqList.length} Seq(s) ✔`,
      "success",
    );
  } catch (err) {
    console.error("Bulk close error:", err);
    showToast("Bulk close failed.", "error");
  } finally {
    hideLoading();
  }
}
async function reopenSequencesBulk(seqList) {
  try {
    showLoading();
    const woId = String(state.currentWO);
    const tasksToReopen = state.allDocs.filter(
      (task) =>
        seqList.includes(String(task.seq)) &&
        (task.status || "").toLowerCase() === "closed",
    );
    if (tasksToReopen.length === 0) {
      showToast("No closed tasks found for selected Seq(s).", "info");
      hideLoading();
      return;
    }
    const updatePromises = tasksToReopen.map(async (task) => {
      const docRef = doc(db, "work_orders", woId, "taskcards", task.id);
      await updateDoc(docRef, { status: "Open" });
      await logHistoryEntry(task, "OPEN");
    });
    await Promise.all(updatePromises);
    showToast(
      `Reopened ${tasksToReopen.length} task(s) from ${seqList.length} Seq(s) ✔`,
      "success",
    );
  } catch (err) {
    console.error("Bulk reopen error:", err);
    showToast("Bulk reopen failed.", "error");
  } finally {
    hideLoading();
  }
}

if (!document.getElementById("modernConfirm")) {
  const confirmModal = document.createElement("div");
  confirmModal.id = "modernConfirm";
  confirmModal.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    backdrop-filter:blur(4px);
    background:rgba(0,0,0,0.35);
    justify-content:center;
    align-items:center;
    z-index:100000;
  `;
  confirmModal.innerHTML = `
    <div class="confirm-card">
      <h3 id="confirmTitle">Confirm Action</h3>
      <p id="confirmMessage"></p>
      <div class="confirm-actions">
        <button id="confirmCancel" class="pill-btn">Cancel</button>
        <button id="confirmOk" class="pill-btn primary">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
}
function modernConfirm(title, message, type = "primary") {
  return new Promise((resolve) => {
    const modal = document.getElementById("modernConfirm");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMessage");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");
    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.classList.remove("primary", "danger");
    okBtn.classList.add(type);
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    okBtn.focus();
    const cleanup = (result) => {
      modal.style.display = "none";
      document.body.style.overflow = "";
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      document.removeEventListener("keydown", keyHandler);
      resolve(result);
    };
    const keyHandler = (e) => {
      if (e.key === "Escape") cleanup(false);
      if (e.key === "Enter") cleanup(true);
    };
    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(false);
    };
    document.addEventListener("keydown", keyHandler);
  });
}
// SEQUENCE CLOSING START*******************************************************************
window.addEventListener("load", () => {
  commentInputModal.style.display = "none";
});
