// Firebase (CDN modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBHwRjGAQWAMhNERUnC3US9Pjn0pcLYEew",
  authDomain: "checklist-8b760.firebaseapp.com",
  projectId: "checklist-8b760",
  storageBucket: "checklist-8b760.firebasestorage.app",
  messagingSenderId: "95517221504",
  appId: "1:95517221504:web:da5b85b6c809b2886f7c65"
};

// App init
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

// UI helpers
const $ = (id) => document.getElementById(id);

const listSelect = $("listSelect");
const itemInput = $("itemInput");
const itemsEl = $("items");
const progressBar = $("progressBar");
const progressText = $("progressText");

const btnAddItem = $("btnAddItem");
const btnNewList = $("btnNewList");
const btnRenameList = $("btnRenameList");
const btnDeleteList = $("btnDeleteList");
const btnCheckAll = $("btnCheckAll");
const btnUncheckAll = $("btnUncheckAll");

const btnExport = $("btnExport");
const fileImport = $("fileImport");
const btnReset = $("btnReset");

const tripCodeInput = $("tripCodeInput");
const btnConnect = $("btnConnect");
const syncStatus = $("syncStatus");
// Paste Import UI
const pasteListTitle = $("pasteListTitle");
const pasteBox = $("pasteBox");
const btnPasteImport = $("btnPasteImport");

const templates = document.querySelectorAll("[data-template]");

// Local fallback key
const LOCAL_KEY = "checklist_app_local_state_v2";
const LAST_TRIP_KEY = "checklist_last_trip_code_v1";

// Firestore collection/doc
const COLLECTION = "shared_checklists";

// Sync state
let state = loadLocalState();
let activeTripCode = localStorage.getItem(LAST_TRIP_KEY) || "";
let unsub = null;
let isApplyingRemote = false;
let saveTimer = null;
let authed = false;

// Prefill trip code input
tripCodeInput.value = activeTripCode;

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function defaultState() {
  return {
    activeListId: "tennessee",
    lists: {
      tennessee: { id: "tennessee", name: "Tennessee (4 days)", items: [] }
    }
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.lists) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveLocalState() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

function setStatus(text) {
  syncStatus.textContent = text;
}

function normalizeTripCode(code) {
  return (code || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, ""); // keep safe chars
}

function getActiveList() {
  const list = state.lists[state.activeListId];
  if (list) return list;

  const firstKey = Object.keys(state.lists)[0];
  state.activeListId = firstKey || "tennessee";
  if (!state.lists[state.activeListId]) state = defaultState();
  return state.lists[state.activeListId];
}

function renderLists() {
  listSelect.innerHTML = "";
  const ids = Object.keys(state.lists);
  ids.sort((a, b) => state.lists[a].name.localeCompare(state.lists[b].name));

  for (const id of ids) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = state.lists[id].name;
    if (id === state.activeListId) opt.selected = true;
    listSelect.appendChild(opt);
  }
}

function renderItems() {
  const list = getActiveList();
  itemsEl.innerHTML = "";

  for (const item of list.items) {
    const li = document.createElement("li");
    li.className = "item" + (item.done ? " done" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!item.done;
    cb.addEventListener("change", () => {
      item.done = cb.checked;
      persist();
      renderItems();
    });

    const label = document.createElement("label");
    label.textContent = item.text;

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      list.items = list.items.filter((x) => x.id !== item.id);
      persist();
      renderItems();
    });

    li.appendChild(cb);
    li.appendChild(label);
    li.appendChild(del);
    itemsEl.appendChild(li);
  }

  updateProgress();
}

function updateProgress() {
  const list = getActiveList();
  const total = list.items.length;
  const done = list.items.filter((i) => i.done).length;
  progressText.textContent = `${done}/${total}`;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progressBar.style.width = `${pct}%`;
}

function promptText(message, fallback = "") {
  const val = window.prompt(message, fallback);
  if (val === null) return null;
  const t = val.trim();
  return t.length ? t : null;
}

function addItem(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  const list = getActiveList();
  list.items.unshift({ id: uid(), text: trimmed, done: false });
  itemInput.value = "";
  persist();
  renderItems();
}

function createList(name) {
  const id = uid();
  state.lists[id] = { id, name, items: [] };
  state.activeListId = id;
  persist();
  renderLists();
  renderItems();
}

function renameActiveList(newName) {
  const list = getActiveList();
  list.name = newName;
  persist();
  renderLists();
}

function deleteActiveList() {
  const ids = Object.keys(state.lists);
  if (ids.length <= 1) {
    alert("Keep at least one list.");
    return;
  }
  const list = getActiveList();
  if (!confirm(`Delete list "${list.name}"?`)) return;

  delete state.lists[list.id];
  state.activeListId = Object.keys(state.lists)[0];
  persist();
  renderLists();
  renderItems();
}

function setAll(doneValue) {
  const list = getActiveList();
  list.items.forEach((i) => (i.done = doneValue));
  persist();
  renderItems();
}

function exportData() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "checklist-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !parsed.lists) throw new Error("Invalid file");
      state = parsed;
      persist();
      renderLists();
      renderItems();
    } catch {
      alert("Could not import. File format is not valid.");
    }
  };
  reader.readAsText(file);
}

function hardReset() {
  if (!confirm("Reset all lists and items on this device?")) return;
  state = defaultState();
  persist();
  renderLists();
  renderItems();
}

const TEMPLATE_TENNESSEE = [
  "JBL speaker",
  "JBL speaker charger cable",
  "Power generator / power station",
  "Generator charging cable",
  "Extension cord",
  "Power strip",
  "Monitor",
  "Monitor power cable",
  "Laptop",
  "Laptop charger",
  "HDMI cable",
  "USB-C cable",
  "Extra adapters (if needed)",
  "Main camera",
  "Main camera charger",
  "DJI / action camera",
  "DJI charging cable",
  "Selfie stick",
  "SD cards",
  "Camera bag",
  "Credit cards (1–2)",
  "Driver’s license",
  "Black Adidas pouch",
  "Briefcase",
  "Cooler",
  "Indian store chips",
  "Other snacks",
  "Water bottles",
  "Flask"
];

const TEMPLATE_DOG = [
  "Dog food (4–6 days)",
  "Food bowl",
  "Water bowl",
  "Leash + harness",
  "Waste bags",
  "Towel",
  "Blanket",
  "Treats",
  "Ear wipes/cleaner (if you use one)",
  "Vet contact saved"
];

function pasteImportToNewList() {
  const title = (pasteListTitle?.value || "").trim() || "janikutty checklist";
  const raw = (pasteBox?.value || "").trim();

  if (!raw) {
    alert("Paste the checklist text first.");
    return;
  }

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const importedItems = [];
  for (const line of lines) {
    const isCheckbox =
      line.startsWith("☐") ||
      line.startsWith("✅") ||
      line.startsWith("✔") ||
      line.startsWith("- [ ]") ||
      line.startsWith("- [x]") ||
      line.startsWith("* [ ]") ||
      line.startsWith("* [x]");

    if (!isCheckbox) continue;

    const done =
      line.startsWith("✅") ||
      line.startsWith("✔") ||
      line.startsWith("- [x]") ||
      line.startsWith("* [x]");

    const text = line
      .replace(/^☐\s*/, "")
      .replace(/^✅\s*/, "")
      .replace(/^✔\s*/, "")
      .replace(/^- \[( |x)\]\s*/i, "")
      .replace(/^\* \[( |x)\]\s*/i, "")
      .trim();

    if (text) items.push({ id: uid(), text, done });
  }

  if (items.length === 0) {
    alert("I couldn’t find any checkbox lines (☐). Make sure your pasted text includes ☐ items.");
    return;
  }

  const id = uid();
  state.lists[id] = { id, name: title, items };
  state.activeListId = id;

  pasteBox.value = "";

  persist();
  renderLists();
  renderItems();

  alert(`Imported ${items.length} items into "${title}".`);
}


function loadTemplate(type) {
  const list = getActiveList();
  const items = type === "dog" ? TEMPLATE_DOG : TEMPLATE_TENNESSEE;

  

  const existing = new Set(list.items.map((i) => i.text.toLowerCase()));
  for (const text of items) {
    if (!existing.has(text.toLowerCase())) {
      list.items.push({ id: uid(), text, done: false });
    }
  }
  persist();
  renderItems();
}

// Persist: local + (if connected) cloud
function persist() {
  saveLocalState();
  queueCloudSave();
}

function queueCloudSave() {
  if (!activeTripCode || !authed) return;
  if (isApplyingRemote) return;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const ref = doc(db, COLLECTION, activeTripCode);
      await updateDoc(ref, {
        state,
        updatedAt: serverTimestamp()
      });
      setStatus(`Connected: ${activeTripCode} (synced)`);
    } catch (e) {
      // If doc doesn't exist yet, create it
      try {
        const ref = doc(db, COLLECTION, activeTripCode);
        await setDoc(ref, { state, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        setStatus(`Connected: ${activeTripCode} (created + synced)`);
      } catch {
        setStatus(`Connected: ${activeTripCode} (sync error)`);
      }
    }
  }, 250);
}

async function connectTrip(codeRaw) {
  const code = normalizeTripCode(codeRaw);
  if (!code) {
    alert("Enter a Trip Code (example: TN4days-2026).");
    return;
  }

  // Stop previous listener
  if (unsub) unsub();
  activeTripCode = code;
  localStorage.setItem(LAST_TRIP_KEY, activeTripCode);

  setStatus(`Connecting: ${activeTripCode}...`);

  const ref = doc(db, COLLECTION, activeTripCode);

  // Create doc if missing (so listener has something to watch)
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { state, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  }

  unsub = onSnapshot(ref, (docSnap) => {
    const data = docSnap.data();
    if (!data || !data.state) return;

    // Apply remote without re-saving back immediately
    isApplyingRemote = true;
    try {
      state = data.state;
      saveLocalState();
      renderLists();
      renderItems();
      setStatus(`Connected: ${activeTripCode} (live)`);
    } finally {
      isApplyingRemote = false;
    }
  });

  setStatus(`Connected: ${activeTripCode} (live)`);
}

// Auth: anonymous
onAuthStateChanged(auth, (user) => {
  authed = !!user;
  if (authed) {
    setStatus(activeTripCode ? `Ready to connect: ${activeTripCode}` : "Ready. Enter Trip Code to sync.");
  } else {
    setStatus("Signing in...");
  }
});

signInAnonymously(auth).catch(() => {
  setStatus("Auth error (anonymous sign-in failed).");
});

// Events
btnAddItem.addEventListener("click", () => addItem(itemInput.value));
itemInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addItem(itemInput.value);
});

listSelect.addEventListener("change", () => {
  state.activeListId = listSelect.value;
  persist();
  renderItems();
});

btnNewList.addEventListener("click", () => {
  const name = promptText("New list name?", "New checklist");
  if (name) createList(name);
});

btnRenameList.addEventListener("click", () => {
  const list = getActiveList();
  const name = promptText("Rename list to:", list.name);
  if (name) renameActiveList(name);
});

btnDeleteList.addEventListener("click", deleteActiveList);

btnCheckAll.addEventListener("click", () => setAll(true));
btnUncheckAll.addEventListener("click", () => setAll(false));

btnExport.addEventListener("click", exportData);
fileImport.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importData(file);
  e.target.value = "";
});

btnReset.addEventListener("click", hardReset);

templates.forEach((btn) => {
  btn.addEventListener("click", () => loadTemplate(btn.dataset.template));
});

btnConnect.addEventListener("click", () => connectTrip(tripCodeInput.value));
tripCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") connectTrip(tripCodeInput.value);
});

if (btnPasteImport) {
  btnPasteImport.addEventListener("click", pasteImportToNewList);
}

// Initial render (local)
renderLists();
renderItems();
setStatus("Ready. Enter Trip Code to sync.");
