/*
 * Import / export.
 * File format:
 *   { "app": "form-filler", "version": 1, "kind": "all" | "group" | "form", "data": ... }
 *   all   -> data: [group, ...]
 *   group -> data: { name, forms: [...] }
 *   form  -> data: { name, fields: [...] }
 */
const TYPES = ["text", "check", "uncheck", "multi", "click"];
const fileInput = document.getElementById("importFile");
let importScope = null;

// ---------- Messages shown inside the current screen ----------
function note(html, { warn = false, actions = [] } = {}) {
  const slot = views.find((v) => !v.hidden).querySelector(".note-slot");
  if (!slot) return;
  slot.innerHTML = `<div class="msg${warn ? " warn" : ""}">${html}</div>`;
  if (actions.length) {
    const box = document.createElement("div");
    box.className = "choices";
    actions.forEach(({ label, kind, run }) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label;
      if (kind) b.className = kind;
      b.addEventListener("click", run);
      box.appendChild(b);
    });
    slot.firstChild.appendChild(box);
  }
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// ---------- Export ----------
function slug(s) {
  return (String(s || "").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-") || "untitled").slice(0, 40);
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function doExport(scope) {
  let kind = scope, data, fname;
  if (scope === "all") {
    data = groups; fname = `form-filler-all-${today()}.json`;
  } else if (scope === "group") {
    data = groups[g]; fname = `form-filler-group-${slug(data.name)}.json`;
  } else {
    data = forms[editing]; fname = `form-filler-form-${slug(data.name)}.json`;
  }
  const json = JSON.stringify({ app: "form-filler", version: 1, kind, data }, null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  const what = scope === "all" ? `${plural(groups.length, "group")}`
    : scope === "group" ? `${plural(data.forms.length, "form")}`
    : `${plural(data.fields.length, "row")}`;
  note(`<strong>Exported ${what}.</strong>Saved to your Downloads as ${fname.replace(/&/g, "&amp;").replace(/</g, "&lt;")}`);
}

// ---------- Validate / clean imported data ----------
function cleanField(f) {
  if (!f || typeof f !== "object") return null;
  return {
    label: String(f.label ?? ""),
    type: TYPES.includes(f.type) ? f.type : "text",
    value: String(f.value ?? "")
  };
}
function cleanForm(f) {
  if (!f || typeof f !== "object" || !Array.isArray(f.fields)) return null;
  return { name: String(f.name ?? "Imported form"), fields: f.fields.map(cleanField).filter(Boolean) };
}
function cleanGroup(gr) {
  if (!gr || typeof gr !== "object" || !Array.isArray(gr.forms)) return null;
  return { name: String(gr.name ?? "Imported group"), forms: gr.forms.map(cleanForm).filter(Boolean) };
}

// Returns { kind, groups } where groups is always a list of clean groups
function parseFile(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("This file isn't valid JSON."); }
  if (!obj || obj.app !== "form-filler") throw new Error("This isn't a Form Filler export file.");
  if (obj.kind === "all" && Array.isArray(obj.data)) {
    return { kind: "all", groups: obj.data.map(cleanGroup).filter(Boolean) };
  }
  if (obj.kind === "group") {
    const gr = cleanGroup(obj.data);
    if (gr) return { kind: "group", groups: [gr] };
  }
  if (obj.kind === "form") {
    const f = cleanForm(obj.data);
    if (f) return { kind: "form", groups: [{ name: "Imported forms", forms: [f] }] };
  }
  throw new Error("This file is damaged or from an unknown version.");
}

// ---------- Import ----------
function doImport(scope) {
  importScope = scope;
  fileInput.value = "";
  fileInput.click();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  let parsed;
  try { parsed = parseFile(await file.text()); }
  catch (e) { note(`<strong>Couldn't import ${file.name.replace(/</g, "&lt;")}.</strong>${e.message}`, { warn: true }); return; }

  const allForms = parsed.groups.flatMap((gr) => gr.forms);

  // --- Home screen: add groups (or replace everything) ---
  if (importScope === "all") {
    const addAll = () => {
      groups.push(...parsed.groups);
      save(); renderGroups();
      note(`<strong>Added ${plural(parsed.groups.length, "group")} with ${plural(allForms.length, "form")}.</strong>`);
    };
    if (parsed.kind === "all" && groups.some((gr) => gr.forms.length)) {
      note(`<strong>This is a full backup with ${plural(parsed.groups.length, "group")}.</strong>Add them next to your current groups, or replace everything you have now?`, {
        actions: [
          { label: "Add", kind: "primary", run: addAll },
          { label: "Replace all", kind: "danger-btn", run: () => {
              groups.splice(0, groups.length, ...parsed.groups);
              save(); renderGroups();
              note(`<strong>Replaced your data with ${plural(parsed.groups.length, "group")}.</strong>`);
            } },
          { label: "Cancel", run: () => note("<strong>Import cancelled.</strong>Nothing was changed.") }
        ]
      });
    } else addAll();
    return;
  }

  // --- Group screen: add forms to this group ---
  if (importScope === "group") {
    if (!allForms.length) { note("<strong>No forms found in this file.</strong>", { warn: true }); return; }
    forms.push(...allForms);
    save(); renderList();
    note(`<strong>Added ${plural(allForms.length, "form")} to ${groups[g].name.replace(/</g, "&lt;")}.</strong>`);
    return;
  }

  // --- Form screen: replace this form's rows ---
  if (importScope === "form") {
    if (allForms.length !== 1) {
      note(`<strong>This file has ${plural(allForms.length, "form")}.</strong>Here you can only import a single form. To add several, go back and use Import on the group screen.`, { warn: true });
      return;
    }
    const src = allForms[0];
    const apply = (keepName) => {
      const f = forms[editing];
      f.fields = src.fields;
      if (!keepName) { f.name = src.name; formName.value = src.name; }
      save(); renderFields();
      note(`<strong>Imported ${plural(src.fields.length, "row")} into this form.</strong>`);
    };
    note(`<strong>Replace this form's rows with the ${plural(src.fields.length, "row")} from "${src.name.replace(/</g, "&lt;")}"?</strong>`, {
      actions: [
        { label: "Replace rows", kind: "primary", run: () => apply(true) },
        { label: "Replace rows and name", run: () => apply(false) },
        { label: "Cancel", run: () => note("<strong>Import cancelled.</strong>Nothing was changed.") }
      ]
    });
  }
});

// ---------- Wire up all icon buttons ----------
document.querySelectorAll("[data-io]").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.io === "export") doExport(b.dataset.scope);
    else doImport(b.dataset.scope);
  });
});
