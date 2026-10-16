/*
 * This function runs INSIDE the web page (injected by popup.js).
 * It must stay self-contained: no references to anything outside it.
 *
 * steps: [{ kind: "field", label, value } | { kind: "click", label }]
 * Steps run in order. Returns the indexes of steps that worked.
 */
async function fillFormByLabels(steps) {
  const norm = (s) =>
    String(s == null ? "" : s)
      .replace(/[*:：]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const visible = (el) => {
    if (el.type === "hidden") return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" &&
      (r.width > 0 || r.height > 0 || el.type === "radio" || el.type === "checkbox");
  };

  const textOf = (el) => (el ? el.innerText || el.textContent || "" : "");

  // ---- Find every possible label text for a control ----------------
  function labelsFor(el) {
    const out = [];
    const lb = el.getAttribute("aria-labelledby");
    if (lb) lb.split(/\s+/).forEach((id) => {
      const t = document.getElementById(id);
      if (t) out.push(textOf(t));
    });
    if (el.getAttribute("aria-label")) out.push(el.getAttribute("aria-label"));
    if (el.labels) Array.from(el.labels).forEach((l) => out.push(textOf(l)));
    if (el.id) {
      document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)
        .forEach((l) => out.push(textOf(l)));
    }
    const wrap = el.closest("label");
    if (wrap) out.push(textOf(wrap));
    if (el.placeholder) out.push(el.placeholder);
    if (el.title) out.push(el.title);

    // Nearby text: previous sibling / parent's previous text (for unlabeled layouts)
    let node = el;
    for (let depth = 0; depth < 3 && node; depth++) {
      let prev = node.previousElementSibling;
      while (prev && !textOf(prev).trim()) prev = prev.previousElementSibling;
      if (prev && textOf(prev).trim().length < 80) { out.push(textOf(prev)); break; }
      node = node.parentElement;
    }
    // Table layouts: label in the previous cell
    const td = el.closest("td");
    if (td && td.previousElementSibling) out.push(textOf(td.previousElementSibling));

    if (el.name) out.push(el.name.replace(/[_\-\[\]]+/g, " "));
    return out.map(norm).filter(Boolean);
  }

  // Label of a radio/checkbox GROUP (the question, not the option)
  function groupLabels(el) {
    const out = [];
    const fs = el.closest("fieldset");
    if (fs) { const lg = fs.querySelector("legend"); if (lg) out.push(textOf(lg)); }
    const grp = el.closest('[role="radiogroup"],[role="group"],[role="list"] > [role="listitem"]');
    if (grp) {
      const lb = grp.getAttribute("aria-labelledby");
      if (lb) lb.split(/\s+/).forEach((id) => {
        const t = document.getElementById(id); if (t) out.push(textOf(t));
      });
      if (grp.getAttribute("aria-label")) out.push(grp.getAttribute("aria-label"));
      const h = grp.querySelector('[role="heading"]'); if (h) out.push(textOf(h));
    }
    // Walk up to find a preceding text label for the group
    let node = el.parentElement;
    for (let depth = 0; depth < 4 && node; depth++) {
      let prev = node.previousElementSibling;
      while (prev && !textOf(prev).trim()) prev = prev.previousElementSibling;
      if (prev && !prev.querySelector("input") && textOf(prev).trim().length < 120) {
        out.push(textOf(prev)); break;
      }
      node = node.parentElement;
    }
    if (el.name) out.push(el.name.replace(/[_\-\[\]]+/g, " "));
    return out.map(norm).filter(Boolean);
  }

  // Label of a single radio/checkbox OPTION (only its own label, no guessing)
  function optionLabels(el) {
    const out = [el.value, el.getAttribute("data-value"), el.getAttribute("aria-label")];
    if (el.labels) Array.from(el.labels).forEach((l) => out.push(textOf(l)));
    const wrap = el.closest("label"); if (wrap) out.push(textOf(wrap));
    const lb = el.getAttribute("aria-labelledby");
    if (lb) lb.split(/\s+/).forEach((id) => {
      const t = document.getElementById(id); if (t) out.push(textOf(t));
    });
    // Text right after the input, e.g. <input type=radio> Male
    if (el.nextSibling && el.nextSibling.nodeType === 3) out.push(el.nextSibling.textContent);
    if (el.nextElementSibling && el.nextElementSibling.tagName !== "INPUT")
      out.push(textOf(el.nextElementSibling));
    return out.map(norm).filter(Boolean);
  }

  function score(labelList, key) {
    let best = 0;
    for (const l of labelList) {
      if (l === key) return 3;
      if (l.startsWith(key) || l.endsWith(key)) best = Math.max(best, 2);
      else if (l.includes(key) || (key.includes(l) && l.length > 2)) best = Math.max(best, 1);
    }
    return best;
  }

  // ---- Setting values so React / Angular / Vue notice --------------
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setChecked(el, on) {
    if (el.checked !== on) el.click();
    if (el.checked !== on) {
      el.checked = on;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function fillSelect(sel, value) {
    const v = norm(value);
    const opts = Array.from(sel.options);
    const opt = opts.find((o) => norm(o.value) === v || norm(o.text) === v) ||
      opts.find((o) => norm(o.text).includes(v));
    if (!opt) return false;
    setNativeValue(sel, opt.value);
    return true;
  }

  // ---- Buttons ----------------------------------------------------
  function buttonLabels(el) {
    const out = [el.innerText, el.textContent, el.value, el.getAttribute("aria-label"), el.title];
    const lb = el.getAttribute("aria-labelledby");
    if (lb) lb.split(/\s+/).forEach((id) => {
      const t = document.getElementById(id); if (t) out.push(textOf(t));
    });
    return out.map(norm).filter(Boolean);
  }

  function findButton(key) {
    const els = Array.from(document.querySelectorAll(
      'button, input[type=submit], input[type=button], input[type=reset], input[type=image], a, [role=button], [role=link], [role=tab], [role=menuitem]'
    )).filter((el) => visible(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true");
    let best = null, bestS = 0;
    for (const el of els) {
      const labels = buttonLabels(el);
      // Buttons: exact text wins strongly; avoid matching long paragraphs/links
      let s = 0;
      for (const l of labels) {
        if (l === key) { s = 3; break; }
        if (l.length <= key.length + 20 && (l.startsWith(key) || l.endsWith(key))) s = Math.max(s, 2);
        else if (l.length <= key.length + 20 && l.includes(key)) s = Math.max(s, 1);
      }
      // Prefer real buttons over links on ties
      if (s && el.tagName !== "A") s += 0.5;
      if (s > bestS) { best = el; bestS = s; }
    }
    return best;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- Collect controls (re-run after each click, the page may change)
  function collect() {
    const textLike = Array.from(document.querySelectorAll(
      'input:not([type=radio]):not([type=checkbox]):not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]):not([type=image]), textarea, select, [contenteditable="true"]'
    )).filter((el) => visible(el) && !el.disabled && !el.readOnly);
    const choices = Array.from(document.querySelectorAll(
      'input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]'
    )).filter((el) => visible(el) && !el.disabled);
    return { textLike, choices };
  }

  let { textLike, choices } = collect();
  const used = new Set();
  const done = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const key = norm(step.label);
    if (!key) continue;

    // ---- Click a button ----
    if (step.kind === "click") {
      const btn = findButton(key);
      if (!btn) continue;
      done.push(i);
      const isLast = steps.slice(i + 1).every((s) => !norm(s.label));
      if (isLast) {
        // Last step (often "Submit"): click after we've reported back,
        // because the page may navigate away.
        setTimeout(() => btn.click(), 150);
      } else {
        btn.scrollIntoView({ block: "center" });
        btn.click();
        await wait(1000);           // let the page update (e.g. "Next" page)
        ({ textLike, choices } = collect());
        used.clear();
      }
      continue;
    }

    const value = step.value;
    let ok = false;

    // 1) Single checkbox with true/false
    if (typeof value === "boolean") {
      let best = null, bestS = 0;
      for (const el of choices) {
        if (used.has(el)) continue;
        const isCb = el.type === "checkbox" || el.getAttribute("role") === "checkbox";
        if (!isCb) continue;
        const s = score(labelsFor(el), key);
        if (s > bestS) { best = el; bestS = s; }
      }
      if (best) {
        if (best.getAttribute("role") === "checkbox") {
          const on = best.getAttribute("aria-checked") === "true";
          if (on !== value) best.click();
        } else setChecked(best, value);
        used.add(best); ok = true;
      }
    }

    // 2) Radio group / checkbox group: question label -> pick option(s)
    if (!ok && typeof value !== "boolean") {
      const wanted = (Array.isArray(value) ? value : [value]).map(norm);
      const groupMatches = choices.filter((el) => score(groupLabels(el), key) >= 1);
      if (groupMatches.length) {
        let hits = 0;
        for (const el of groupMatches) {
          const optLabels = optionLabels(el);
          const want = wanted.some((w) => optLabels.includes(w));
          const isRole = el.hasAttribute("role");
          if (want) {
            if (isRole) { if (el.getAttribute("aria-checked") !== "true") el.click(); }
            else setChecked(el, true);
            hits++;
          } else if (Array.isArray(value) && (el.type === "checkbox" || el.getAttribute("role") === "checkbox")) {
            if (isRole) { if (el.getAttribute("aria-checked") === "true") el.click(); }
            else setChecked(el, false);
          }
        }
        if (hits) ok = true;
      }
    }

    // 3) Text inputs, textareas, dropdowns
    if (!ok && !Array.isArray(value) && typeof value !== "boolean") {
      let best = null, bestS = 0;
      for (const el of textLike) {
        if (used.has(el)) continue;
        const s = score(labelsFor(el), key);
        if (s > bestS) { best = el; bestS = s; }
      }
      if (best) {
        if (best.tagName === "SELECT") ok = fillSelect(best, value);
        else if (best.isContentEditable) {
          best.focus(); best.textContent = String(value);
          best.dispatchEvent(new Event("input", { bubbles: true }));
          ok = true;
        } else { best.focus(); setNativeValue(best, String(value)); ok = true; }
        if (ok) {
          used.add(best);
          const el = best;
          el.style.outline = "2px solid #3b6fe0";
          setTimeout(() => (el.style.outline = ""), 1500);
        }
      }
    }

    if (ok) done.push(i);
  }

  return { done, frame: location.href };
}
