/*
 * Saved in chrome.storage.local as:
 *   groups: [{ name, forms: [{ name, fields: [{ label, type, value }] }] }]
 * type: "text" | "check" | "uncheck" | "multi" | "click"
 * First run: seeded from data.js. Older versions' "forms" are moved into a group.
 */
const $ = (id) => document.getElementById(id);
const views = ["homeView", "listView", "editView", "groupEditView"].map($);
const list = $("list"), status = $("status"), groupsBox = $("groups");
const fieldsBox = $("fields"), formName = $("formName");

let groups = [];
let g = -1;          // open group
let forms = [];      // forms of the open group
let editing = -1;    // form being edited
let editingGroup = -1;

function showView(v) {
  views.forEach((el) => (el.hidden = el !== v));
  window.scrollTo(0, 0);
}

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
  const st = await chrome.storage.local.get(["groups", "forms", "lastGroup"]);
  if (Array.isArray(st.groups)) groups = st.groups;
  else {
    const old = Array.isArray(st.forms) ? st.forms : fromDataFile();
    groups = [{ name: "My forms", forms: old }];
    await chrome.storage.local.set({ groups });
    await chrome.storage.local.remove("forms");
  }
  return st.lastGroup;
}

// Save on every change, straight away, so nothing is lost if the popup closes
function save() {
  chrome.storage.local.set({ groups }).then(() => {
    document.querySelectorAll(".saved").forEach((m) => (m.textContent = "Saved"));
  });
}

// ---------- Home: groups ----------
function renderGroups() {
  groupsBox.innerHTML = "";
  if (!groups.length) {
    groupsBox.innerHTML = '<p class="empty">No groups yet. Add one to get started.</p>';
    return;
  }
  groups.forEach((grp, i) => {
    const row = document.createElement("div");
    row.className = "row";
    const open = document.createElement("button");
    open.className = "fill open"; open.type = "button";
    const name = document.createElement("span");
    name.className = "name"; name.textContent = grp.name || "Untitled group";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${grp.forms.length} form${grp.forms.length === 1 ? "" : "s"}`;
    open.append(name, count);
    open.addEventListener("click", () => openGroup(i));
    const edit = document.createElement("button");
    edit.className = "edit"; edit.type = "button"; edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit group ${grp.name}`);
    edit.addEventListener("click", () => openGroupEditor(i));
    row.append(open, edit);
    groupsBox.appendChild(row);
  });
}

function goHome() {
  g = -1;
  chrome.storage.local.remove("lastGroup");
  renderGroups();
  showView($("homeView"));
}

function openGroup(i) {
  g = i;
  forms = groups[i].forms;
  chrome.storage.local.set({ lastGroup: i });
  $("groupTitle").textContent = groups[i].name || "Untitled group";
  status.innerHTML = "";
  renderList();
  showView($("listView"));
}

$("toHome").addEventListener("click", goHome);

$("addGroup").addEventListener("click", () => {
  groups.push({ name: `Group ${groups.length + 1}`, forms: [] });
  save();
  openGroupEditor(groups.length - 1, true);
});

function openGroupEditor(i, isNew) {
  editingGroup = i;
  const grp = groups[i];
  $("groupName").value = grp.name;
  $("groupInfo").textContent = grp.forms.length
    ? `This group has ${grp.forms.length} form${grp.forms.length === 1 ? "" : "s"}. Deleting the group deletes them too.`
    : "This group is empty. Click Done, open the group, then add forms to it.";
  document.querySelectorAll(".saved").forEach((m) => (m.textContent = ""));
  showView($("groupEditView"));
  if (isNew) $("groupName").select();
}

$("groupName").addEventListener("input", () => { groups[editingGroup].name = $("groupName").value; save(); });
$("groupBack").addEventListener("click", () => { save(); goHome(); });
$("deleteGroup").addEventListener("click", () => {
  const grp = groups[editingGroup];
  const msg = grp.forms.length
    ? `Delete "${grp.name}" and its ${grp.forms.length} form(s)?`
    : `Delete "${grp.name}"?`;
  if (!confirm(msg)) return;
  groups.splice(editingGroup, 1);
  save(); goHome();
});

// Convert stored rows into ordered steps for the page filler
function toSteps(form) {
  return form.fields
    .filter((f) => f.label.trim())
    .map(({ label, type, value }) => {
      if (type === "click") return { kind: "click", label };
      if (type === "check") return { kind: "field", label, value: true };
      if (type === "uncheck") return { kind: "field", label, value: false };
      if (type === "multi") return { kind: "field", label, value: value.split(",").map((s) => s.trim()).filter(Boolean) };
      return { kind: "field", label, value };
    });
}

// ---------- List view ----------
function renderList() {
  list.innerHTML = "";
  if (!forms.length) {
    list.innerHTML = '<p class="empty">No forms in this group yet. Add one to get started.</p>';
    return;
  }
  forms.forEach((form, i) => {
    const row = document.createElement("div");
    row.className = "row";

    const fill = document.createElement("button");
    fill.className = "fill"; fill.type = "button";
    const name = document.createElement("span");
    name.className = "name"; name.textContent = form.name || "Untitled form";
    const named = form.fields.filter((f) => f.label.trim());
    const n = named.filter((f) => f.type !== "click").length;
    const c = named.length - n;
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = `${n} field${n === 1 ? "" : "s"}` + (c ? `, ${c} click${c === 1 ? "" : "s"}` : "");
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
  const sel = $("formGroup");
  sel.innerHTML = "";
  groups.forEach((grp, k) => sel.add(new Option(grp.name || "Untitled group", k, false, k === g)));
  document.querySelectorAll(".saved").forEach((m) => (m.textContent = ""));
  renderFields();
  showView($("editView"));
}

function closeEditor() {
  // Drop completely empty rows when leaving
  const f = forms[editing];
  if (f) f.fields = f.fields.filter((x) => x.label.trim() || x.value.trim());
  save();
  editing = -1;
  openGroup(g);
}

// Move the form to another group
$("formGroup").addEventListener("change", () => {
  const to = Number($("formGroup").value);
  if (to === g) return;
  const [f] = forms.splice(editing, 1);
  groups[to].forms.push(f);
  g = to; forms = groups[to].forms; editing = forms.length - 1;
  chrome.storage.local.set({ lastGroup: to });
  save();
});

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
  label.placeholder = field.type === "click" ? "Button text, e.g. Submit" : "e.g. Full Name";
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
  [["text", "Text / option"], ["check", "Tick checkbox"], ["uncheck", "Untick checkbox"], ["multi", "Multiple (a, b)"], ["click", "Click button"]]
    .forEach(([v, t]) => type.add(new Option(t, v, false, field.type === v)));

  const sync = () => {
    const noValue = ["check", "uncheck", "click"].includes(field.type);
    value.hidden = noValue;
    row.classList.toggle("is-click", field.type === "click");
    label.placeholder = field.type === "click" ? "Button text, e.g. Submit" : "e.g. Full Name";
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

  const tools = document.createElement("div");
  tools.className = "tools";
  const list = forms[editing].fields;
  const move = (dir, sym, name) => {
    const b = document.createElement("button");
    b.className = "remove move"; b.type = "button"; b.textContent = sym;
    b.setAttribute("aria-label", `Move ${field.label || "field"} ${name}`);
    const to = j + dir;
    b.disabled = to < 0 || to >= list.length;
    b.addEventListener("click", () => {
      [list[j], list[to]] = [list[to], list[j]];
      save(); renderFields();
      fieldsBox.querySelectorAll(".field")[to].querySelector(dir < 0 ? ".move" : ".move:last-child").focus();
    });
    return b;
  };
  tools.append(remove, move(-1, "↑", "up"), move(1, "↓", "down"));

  row.append(label, valBox, tools);
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
  openGroup(g);
});

// ---------- Filling ----------
function show(html, warn) {
  status.innerHTML = `<div class="msg${warn ? " warn" : ""}">${html}</div>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function fillPage(form, btn) {
  const steps = toSteps(form);
  if (!steps.length) { show("<strong>This form has no fields yet.</strong>Click Edit to add labels and values.", true); return; }

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
      args: [steps]
    });

    // A step counts as done if any frame did it
    const done = new Set();
    results.forEach((r) => r.result && r.result.done.forEach((i) => done.add(i)));
    const missing = steps.filter((_, i) => !done.has(i));
    const nFields = steps.filter((s) => s.kind === "field").length;
    const nClicks = steps.length - nFields;
    const fDone = steps.filter((s, i) => s.kind === "field" && done.has(i)).length;
    const cDone = steps.filter((s, i) => s.kind === "click" && done.has(i)).length;
    const summary = `Filled ${fDone} of ${nFields} field${nFields === 1 ? "" : "s"}` +
      (nClicks ? `, clicked ${cDone} of ${nClicks} button${nClicks === 1 ? "" : "s"}` : "") + ".";

    if (!missing.length) {
      show(`<strong>${summary}</strong>` + (nClicks ? "" : "Check the form before you submit it."));
    } else {
      show(`<strong>${summary}</strong>Not found on this page:` +
        `<ul>${missing.map((s) => `<li>${s.kind === "click" ? "Button: " : ""}${esc(s.label)}</li>`).join("")}</ul>`, true);
    }
  } catch (e) {
    show(`<strong>Couldn't fill this page.</strong>${esc(e.message)}`, true);
  } finally {
    btn.removeAttribute("aria-busy");
  }
}

// ---------- Start ----------
load().then((last) => {
  if (Number.isInteger(last) && groups[last]) openGroup(last);
  else goHome();
});
