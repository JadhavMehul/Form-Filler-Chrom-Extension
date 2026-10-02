const list = document.getElementById("list");
const status = document.getElementById("status");

FORMS.forEach((form) => {
  const btn = document.createElement("button");
  btn.className = "fill";
  btn.type = "button";
  const n = Object.keys(form.fields).length;
  btn.innerHTML = `<span></span><span class="count">${n} field${n === 1 ? "" : "s"}</span>`;
  btn.firstChild.textContent = form.name;
  btn.addEventListener("click", () => fill(form, btn));
  list.appendChild(btn);
});

function show(html, warn) {
  status.innerHTML = `<div class="msg${warn ? " warn" : ""}">${html}</div>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function fill(form, btn) {
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
      args: [form.fields]
    });

    // A field counts as filled if any frame filled it
    const filled = new Set();
    results.forEach((r) => r.result && r.result.filled.forEach((k) => filled.add(k)));
    const keys = Object.keys(form.fields);
    const missing = keys.filter((k) => !filled.has(k));

    if (!missing.length) {
      show(`<strong>Filled all ${keys.length} fields.</strong>Check the form before you submit it.`);
    } else {
      show(
        `<strong>Filled ${filled.size} of ${keys.length} fields.</strong>No matching label found for:` +
        `<ul>${missing.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>`,
        true
      );
    }
  } catch (e) {
    show(`<strong>Couldn't fill this page.</strong>${esc(e.message)}`, true);
  } finally {
    btn.removeAttribute("aria-busy");
  }
}
