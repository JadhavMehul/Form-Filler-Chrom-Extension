/*
 * Forms are saved in chrome.storage.local as:
 *   [{ name: "Form 1 data", fields: [{ label, type, value }] }]
 * type: "text" | "check" | "uncheck" | "multi"
 * On first run they are seeded from data.js.
 */
const $ = (id) => document.getElementById(id);
const listView = $("listView"), editView = $("editView");
const list = $("list"), status = $("status");
const fieldsBox = $("fields"), formName = $("formName"), saved = $("saved");

let forms = [];
let editing = -1;

// ---------- Storage ----------
function fromDataFile() {
  return FORMS.map((f) => ({
    name: f.name,
    fields: Object.entries(f.fields).map(([label, v]) =>
      v === true ? { label, type: "check", value: "" }
      : v === false ? { label, type: "uncheck", value: "" }
      : Array.isArray(v) ? { label, type: "multi", value: v.join(", ") }
      : { label, type: "text", value: String(v) })
  }));
}

async function load() {
  const { forms: stored } = await chrome.storage.local.get("forms");
  forms = Array.isArray(stored) ? stored : fromDataFile();
  if (!stored) await chrome.storage.local.set({ forms });
}

let saveTimer;
function save() {
  saved.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({ forms });
    saved.textContent = "Saved";
  }, 250);
}

// Convert stored rows into what the page filler expects
function toFillData(form) {
  const out = {};
  form.fields.forEach(({ label, type, value }) => {
    if (!label.trim()) return;
    if (type === "check") out[label] = true;
    else if (type === "uncheck") out[label] = false;
    else if (type === "multi") out[label] = value.split(",").map((s) => s.trim()).filter(Boolean);
    else out[label] = value;
  });
  return out;
}

// ---------- List view ----------
function renderList() {
  list.innerHTML = "";
  if (!forms.length) {
    list.innerHTML = '<p class="empty">No forms yet. Add one to get started.</p>';
    return;
  }
  forms.forEach((form, i) => {
    const row = document.createElement("div");
    row.className = "row";

    const fill = document.createElement("button");
    fill.className = "fill"; fill.type = "button";
    const name = document.createElement("span");
    name.className = "name"; name.textContent = form.name || "Untitled form";
    const n = form.fields.filter((f) => f.label.trim()).length;
    const count = document.createElement("span");
    count.className = "count"; count.textContent = `${n} field${n === 1 ? "" : "s"}`;
    fill.append(name, count);
    fill.addEventListener("click", () => fillPage(form, fill));

    const edit = document.createElement("button");
    edit.className = "edit"; edit.type = "button";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit ${form.name}`);
    edit.addEventListener("click", () => openEditor(i));

    row.append(fill, edit);
    list.appendChild(row);
  });
}

$("addForm").addEventListener("click", () => {
  forms.push({ name: `Form ${forms.length + 1} data`, fields: [{ label: "", type: "text", value: "" }] });
  save();
  openEditor(forms.length - 1);
  formName.select();
});

// ---------- Edit view ----------
function openEditor(i) {
  editing = i;
  status.innerHTML = "";
  formName.value = forms[i].name;
  saved.textContent = "";
  renderFields();
  listView.hidden = true;
  editView.hidden = false;
}

function closeEditor() {
  // Drop completely empty rows when leaving
  const f = forms[editing];
  if (f) f.fields = f.fields.filter((x) => x.label.trim() || x.value.trim());
  save();
  editing = -1;
  editView.hidden = true;
  listView.hidden = false;
  renderList();
}
$("back").addEventListener("click", closeEditor);

formName.addEventListener("input", () => { forms[editing].name = formName.value; save(); });

function renderFields() {
  fieldsBox.innerHTML = "";
  forms[editing].fields.forEach((field, j) => fieldsBox.appendChild(fieldRow(field, j)));
}

function fieldRow(field, j) {
  const row = document.createElement("div");
  row.className = "field";

  const label = document.createElement("input");
  label.className = "txt"; label.type = "text";
  label.placeholder = "e.g. Full Name";
  label.value = field.label;
  label.setAttribute("aria-label", "Label on the page");
  label.addEventListener("input", () => { field.label = label.value; save(); });

  const valBox = document.createElement("div");
  valBox.className = "val";

  const value = document.createElement("input");
  value.className = "txt"; value.type = "text";
  value.value = field.value;
  value.setAttribute("aria-label", "Value");
  value.addEventListener("input", () => { field.value = value.value; save(); });

  const type = document.createElement("select");
  type.className = "sel";
  type.setAttribute("aria-label", "Value type");
  [["text", "Text / option"], ["check", "Tick checkbox"], ["uncheck", "Untick checkbox"], ["multi", "Multiple (a, b)"]]
    .forEach(([v, t]) => type.add(new Option(t, v, false, field.type === v)));

  const sync = () => {
    const isBox = field.type === "check" || field.type === "uncheck";
    value.hidden = isBox;
    value.placeholder = field.type === "multi" ? "Sports, Music" : "Value";
  };
  type.addEventListener("change", () => { field.type = type.value; sync(); save(); });
  sync();

  valBox.append(value, type);

  const remove = document.createElement("button");
  remove.className = "remove"; remove.type = "button";
  remove.textContent = "×";
  remove.setAttribute("aria-label", `Remove ${field.label || "field"}`);
  remove.addEventListener("click", () => {
    forms[editing].fields.splice(j, 1);
    save(); renderFields();
  });

  row.append(label, valBox, remove);
  return row;
}

$("addField").addEventListener("click", () => {
  forms[editing].fields.push({ label: "", type: "text", value: "" });
  save(); renderFields();
  const inputs = fieldsBox.querySelectorAll(".field");
  inputs[inputs.length - 1].querySelector("input").focus();
});

$("deleteForm").addEventListener("click", () => {
  const name = forms[editing].name || "this form";
  if (!confirm(`Delete "${name}" and all its fields?`)) return;
  forms.splice(editing, 1);
  editing = -1;
  save();
  editView.hidden = true; listView.hidden = false;
  renderList();
});

// ---------- Filling ----------
function show(html, warn) {
  status.innerHTML = `<div class="msg${warn ? " warn" : ""}">${html}</div>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function fillPage(form, btn) {
  const data = toFillData(form);
  const keys = Object.keys(data);
  if (!keys.length) { show("<strong>This form has no fields yet.</strong>Click Edit to add labels and values.", true); return; }

  btn.setAttribute("aria-busy", "true");
  status.innerHTML = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !/^(https?|file):/.test(tab.url || "")) {
      show("<strong>This page can't be filled.</strong>Chrome blocks extensions on its own pages. Open your form page and try again.", true);
      return;
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillFormByLabels,
      args: [data]
    });

    const filled = new Set();
    results.forEach((r) => r.result && r.result.filled.forEach((k) => filled.add(k)));
    const missing = keys.filter((k) => !filled.has(k));

    if (!missing.length) {
      show(`<strong>Filled all ${keys.length} fields.</strong>Check the form before you submit it.`);
    } else {
      show(`<strong>Filled ${filled.size} of ${keys.length} fields.</strong>No matching label found for:` +
        `<ul>${missing.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>`, true);
    }
  } catch (e) {
    show(`<strong>Couldn't fill this page.</strong>${esc(e.message)}`, true);
  } finally {
    btn.removeAttribute("aria-busy");
  }
}

// ---------- Start ----------
load().then(renderList);
