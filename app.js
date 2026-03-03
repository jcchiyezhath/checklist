const STORAGE_KEY = "checklist_app_v1";

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

const templates = document.querySelectorAll("[data-template]");

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function defaultState() {
  return {
    activeListId: "tennessee",
    lists: {
      tennessee: {
        id: "tennessee",
        name: "Tennessee (4 days)",
        items: []
      }
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.lists) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function getActiveList() {
  const list = state.lists[state.activeListId];
  if (list) return list;

  // fallback to first list
  const firstKey = Object.keys(state.lists)[0];
  state.activeListId = firstKey || "tennessee";
  if (!state.lists[state.activeListId]) state = defaultState();
  saveState(state);
  return state.lists[state.activeListId];
}

function renderLists() {
  listSelect.innerHTML = "";
  const ids = Object.keys(state.lists);
  ids.sort((a,b) => state.lists[a].name.localeCompare(state.lists[b].name));

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
      saveState(state);
      renderItems();
    });

    const label = document.createElement("label");
    label.textContent = item.text;

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      list.items = list.items.filter(x => x.id !== item.id);
      saveState(state);
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
  const done = list.items.filter(i => i.done).length;

  progressText.textContent = `${done}/${total}`;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  progressBar.style.width = `${pct}%`;
}

function addItem(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;

  const list = getActiveList();
  list.items.unshift({
    id: uid(),
    text: trimmed,
    done: false
  });

  saveState(state);
  itemInput.value = "";
  renderItems();
}

function promptText(message, fallback = "") {
  const val = window.prompt(message, fallback);
  if (val === null) return null;
  const t = val.trim();
  return t.length ? t : null;
}

function createList(name) {
  const id = uid();
  state.lists[id] = { id, name, items: [] };
  state.activeListId = id;
  saveState(state);
  renderLists();
  renderItems();
}

function renameActiveList(newName) {
  const list = getActiveList();
  list.name = newName;
  saveState(state);
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
  saveState(state);
  renderLists();
  renderItems();
}

function setAll(doneValue) {
  const list = getActiveList();
  list.items.forEach(i => i.done = doneValue);
  saveState(state);
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
      saveState(state);
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
  saveState(state);
  renderLists();
  renderItems();
}

/* templates */
const TEMPLATE_TENNESSEE = [
  // Electronics & media
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

  // Cameras
  "Main camera",
  "Main camera charger",
  "DJI / action camera",
  "DJI charging cable",
  "Selfie stick",
  "SD cards",
  "Camera bag",

  // Personal
  "Credit cards (1–2)",
  "Driver’s license",
  "Black Adidas pouch",
  "Briefcase",

  // Travel / food
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

function loadTemplate(type) {
  const list = getActiveList();
  const items = (type === "dog") ? TEMPLATE_DOG : TEMPLATE_TENNESSEE;

  // Add without duplicates
  const existing = new Set(list.items.map(i => i.text.toLowerCase()));
  for (const text of items) {
    if (!existing.has(text.toLowerCase())) {
      list.items.push({ id: uid(), text, done: false });
    }
  }
  saveState(state);
  renderItems();
}

/* events */
btnAddItem.addEventListener("click", () => addItem(itemInput.value));
itemInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addItem(itemInput.value);
});

listSelect.addEventListener("change", () => {
  state.activeListId = listSelect.value;
  saveState(state);
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

templates.forEach(btn => {
  btn.addEventListener("click", () => loadTemplate(btn.dataset.template));
});

/* initial render */
renderLists();
renderItems();
