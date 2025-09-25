// extension/src/storage.ts
var DEFAULTS = {
  serverUrl: "http://localhost:8080",
  defaultTone: "friendly",
  redact: false,
  dismissOnOutsideClick: true
};
async function ensureInstallId() {
  const { installId } = await chrome.storage.local.get("installId");
  if (installId && typeof installId === "string") return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}
async function getSettings() {
  const sync = await chrome.storage.sync.get(["serverUrl", "defaultTone", "redact", "dismissOnOutsideClick"]);
  const local = await chrome.storage.local.get(["secret", "installId"]);
  const installId = local.installId || await ensureInstallId();
  const allowedTones = ["friendly", "formal", "confident", "persuasive", "casual"];
  const rawTone = sync.defaultTone || "";
  const safeTone = allowedTones.includes(rawTone) ? rawTone : DEFAULTS.defaultTone;
  return {
    serverUrl: sync.serverUrl || DEFAULTS.serverUrl,
    defaultTone: safeTone,
    redact: typeof sync.redact === "boolean" ? sync.redact : DEFAULTS.redact,
    dismissOnOutsideClick: typeof sync.dismissOnOutsideClick === "boolean" ? sync.dismissOnOutsideClick : DEFAULTS.dismissOnOutsideClick,
    secret: typeof local.secret === "string" ? local.secret : void 0,
    installId
  };
}
async function getHistory() {
  const { history } = await chrome.storage.local.get("history");
  if (Array.isArray(history)) return history;
  return [];
}
async function addHistoryItem(item) {
  const current = await getHistory();
  const full = {
    id: item.id || crypto.randomUUID(),
    ts: item.ts || Date.now(),
    task: item.task,
    output: item.output,
    inputPreview: item.inputPreview,
    tone: item.tone,
    percent: item.percent,
    summary_level: item.summary_level
  };
  const updated = [full, ...current].slice(0, 10);
  await chrome.storage.local.set({ history: updated });
}

// extension/src/hmac.ts
function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}
function bytesToHex(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = "";
  for (let i = 0; i < u8.length; i++) {
    const h = u8[i].toString(16).padStart(2, "0");
    hex += h;
  }
  return hex;
}
async function hmacSha256Hex(secretUtf8, data) {
  const secretBytes = utf8ToBytes(secretUtf8);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const dataBytes = utf8ToBytes(data);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return bytesToHex(sig);
}

// extension/src/content.ts
function getSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { text: "", rect: null, range: null };
  const range = sel.getRangeAt(0);
  const text = sel.toString();
  const rect = range.getBoundingClientRect();
  return { text, rect, range };
}
function createOverlay(title) {
  const container = document.createElement("div");
  container.className = "ai-overlay-container";
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-label", "AI Actions");
  container.tabIndex = -1;
  const header = document.createElement("div");
  header.className = "ai-overlay-header";
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("src/icons/pencil.svg");
  icon.addEventListener("error", () => {
    const fallback = chrome.runtime.getURL("src/icons/icon-32.png");
    if (icon.src !== fallback) icon.src = fallback;
  });
  icon.alt = "";
  icon.width = 16;
  icon.height = 16;
  icon.style.marginRight = "8px";
  const h = document.createElement("div");
  h.className = "ai-overlay-title";
  h.textContent = title;
  const close = document.createElement("button");
  close.className = "ai-close-btn";
  close.setAttribute("aria-label", "Close overlay");
  close.textContent = "\u2715";
  close.addEventListener("click", () => container.remove());
  const left = document.createElement("div");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.append(icon, h);
  header.append(left, close);
  const content = document.createElement("div");
  content.className = "ai-overlay-content";
  const pre = document.createElement("pre");
  pre.className = "ai-overlay-pre";
  pre.textContent = "";
  content.append(pre);
  const actions = document.createElement("div");
  actions.className = "ai-overlay-actions";
  const copyBtn = document.createElement("button");
  copyBtn.className = "ai-btn ai-focus-ring";
  copyBtn.setAttribute("aria-label", "Copy to clipboard");
  copyBtn.textContent = "Copy";
  const replaceBtn = document.createElement("button");
  replaceBtn.className = "ai-btn secondary ai-focus-ring";
  replaceBtn.setAttribute("aria-label", "Replace selection");
  replaceBtn.textContent = "Replace Selection";
  const toneBtn = document.createElement("button");
  toneBtn.className = "ai-btn secondary ai-focus-ring";
  toneBtn.setAttribute("aria-label", "Change tone and retry");
  toneBtn.textContent = "Change Tone";
  const dismissBtn = document.createElement("button");
  dismissBtn.className = "ai-btn secondary ai-focus-ring";
  dismissBtn.setAttribute("aria-label", "Dismiss overlay");
  dismissBtn.textContent = "Cancel";
  actions.append(copyBtn, toneBtn, replaceBtn, dismissBtn);
  container.append(header, content, actions);
  let dragStartX = 0, dragStartY = 0, startLeft = 0, startTop = 0, dragging = false;
  header.style.cursor = "move";
  header.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = container.getBoundingClientRect();
    startLeft = rect.left + window.scrollX;
    startTop = rect.top + window.scrollY;
    dragStartX = e.clientX + window.scrollX;
    dragStartY = e.clientY + window.scrollY;
    e.preventDefault();
  });
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX + window.scrollX - dragStartX;
    const dy = e.clientY + window.scrollY - dragStartY;
    let left2 = startLeft + dx;
    let top = startTop + dy;
    const maxLeft = window.scrollX + window.innerWidth - container.offsetWidth - 10;
    const maxTop = window.scrollY + window.innerHeight - container.offsetHeight - 10;
    left2 = Math.max(window.scrollX + 10, Math.min(maxLeft, left2));
    top = Math.max(window.scrollY + 10, Math.min(maxTop, top));
    container.style.left = `${left2}px`;
    container.style.top = `${top}px`;
  };
  const onUp = () => {
    dragging = false;
  };
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("mouseup", onUp, true);
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      container.remove();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      copyBtn.click();
    }
    if (e.key === "Enter") {
      copyBtn.click();
    }
  }
  container.addEventListener("keydown", onKey);
  const focusables = [copyBtn, toneBtn, replaceBtn, dismissBtn, close];
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const activeEl = document.activeElement;
    const idx = activeEl ? Math.max(0, focusables.indexOf(activeEl)) : 0;
    const dir = e.shiftKey ? -1 : 1;
    const next = (idx + dir + focusables.length) % focusables.length;
    focusables[next].focus();
    e.preventDefault();
  });
  return { container, pre, copyBtn, toneBtn, replaceBtn, dismissBtn, close };
}
function positionOverlay(el, rect) {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  let left = scrollX + (rect ? rect.right : 20) + margin;
  let top = scrollY + (rect ? rect.top : 20);
  document.body.appendChild(el);
  const { width, height } = el.getBoundingClientRect();
  if (left + width > scrollX + vw - 10) left = Math.max(scrollX + 10, scrollX + (rect ? rect.left : 10) - width - margin);
  if (top + height > scrollY + vh - 10) top = Math.max(scrollY + 10, scrollY + (rect ? rect.bottom : 10) - height - margin);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
function showToast(text, level = "info") {
  const t = document.createElement("div");
  t.className = "ai-toast" + (level === "error" ? " error" : " success");
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
async function callServer(task, input, opts) {
  const settings = await getSettings();
  const body = { task, input };
  if (settings.redact) body.redact = true;
  if (task === "rewrite") {
    if (!opts.tone) throw new Error("Tone is required for rewrite");
    body.tone = opts.tone;
  } else if (task === "shorten" || task === "expand") {
    if (!opts.percent) throw new Error("Percent is required");
    body.percent = opts.percent;
  } else if (task === "summarize") {
    if (!opts.summary_level) throw new Error("Summary level is required");
    body.summary_level = opts.summary_level;
  }
  const bodyString = JSON.stringify(body);
  const ts = Date.now().toString();
  const nonce = crypto.randomUUID();
  const dataToSign = `${bodyString}.${ts}.${nonce}`;
  const secret = settings.secret || "";
  const signature = await hmacSha256Hex(secret, dataToSign);
  const res = await fetch(new URL("/transform", settings.serverUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ts": ts,
      "x-nonce": nonce,
      "x-signature": signature,
      "x-install-id": settings.installId
    },
    body: bodyString
  });
  if (!res.ok) {
    const msgByStatus = {
      400: "Invalid request.",
      401: "Auth error (signature/timing). Try again.",
      409: "Auth error (signature/timing). Try again.",
      429: "Too many requests. Please slow down.",
      500: "Server error. Try again."
    };
    const msg = msgByStatus[res.status] || "Request failed.";
    throw new Error(msg);
  }
  const json = await res.json();
  return json.output;
}
async function handleAction(task, tone, percent, summary_level) {
  const selectionInfo = getSelectionInfo();
  let { text, rect, range } = selectionInfo;
  const activeAtInvoke = document.activeElement;
  let inputSelection = null;
  if (activeAtInvoke instanceof HTMLInputElement || activeAtInvoke instanceof HTMLTextAreaElement) {
    inputSelection = {
      start: activeAtInvoke.selectionStart ?? 0,
      end: activeAtInvoke.selectionEnd ?? 0
    };
    if (!text && inputSelection.start !== inputSelection.end) {
      text = activeAtInvoke.value.slice(inputSelection.start, inputSelection.end);
      const r = activeAtInvoke.getBoundingClientRect();
      rect = r;
    }
  }
  if (!text || text.trim() === "") {
    showToast("No text selected");
    return;
  }
  const titleMap = {
    rewrite: "Rewrite",
    grammar: "Fix Grammar & Spelling",
    summarize: "Summarize",
    shorten: "Shorten",
    expand: "Expand"
  };
  const title = titleMap[task];
  const ui = createOverlay(title);
  positionOverlay(ui.container, rect);
  ui.container.focus();
  ui.pre.innerHTML = `<div class="ai-spinner" aria-label="Loading" role="status" aria-live="polite"></div>`;
  try {
    const settings = await getSettings();
    let useTone = void 0;
    let usePercent = percent;
    let useSummary = summary_level;
    if (task === "rewrite") {
      useTone = tone || settings.defaultTone;
    }
    const clipped = text.slice(0, 1e4);
    const output = await callServer(task, clipped, { tone: useTone, percent: usePercent, summary_level: useSummary });
    ui.pre.textContent = output;
    await addHistoryItem({
      task,
      output,
      inputPreview: clipped.slice(0, 200),
      tone: useTone,
      percent: usePercent,
      summary_level: useSummary
    });
    ui.copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(output);
      showToast("Copied", "info");
    });
    ui.dismissBtn.addEventListener("click", () => ui.container.remove());
    if (settings.dismissOnOutsideClick !== false) {
      const onDocClick = (ev) => {
        if (!ui.container.contains(ev.target)) {
          ui.container.remove();
          document.removeEventListener("mousedown", onDocClick, true);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", onDocClick, true), 0);
    }
    const canReplace = !!((activeAtInvoke instanceof HTMLInputElement || activeAtInvoke instanceof HTMLTextAreaElement) && inputSelection && inputSelection.start !== inputSelection.end) || !!(activeAtInvoke && activeAtInvoke.isContentEditable && range && !range.collapsed);
    ui.replaceBtn.disabled = !canReplace;
    ui.replaceBtn.setAttribute("aria-disabled", ui.replaceBtn.disabled ? "true" : "false");
    ui.replaceBtn.addEventListener("click", async () => {
      const target = activeAtInvoke;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = inputSelection ? inputSelection.start : target.selectionStart ?? 0;
        const end = inputSelection ? inputSelection.end : target.selectionEnd ?? 0;
        const val = target.value;
        target.focus();
        target.value = val.slice(0, start) + output + val.slice(end);
        const pos = start + output.length;
        target.selectionStart = target.selectionEnd = pos;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        showToast("Replaced", "info");
        return;
      }
      if (target && target.isContentEditable) {
        target.focus();
        const sel = window.getSelection();
        sel?.removeAllRanges();
        if (range) {
          try {
            sel?.addRange(range);
          } catch {
          }
        }
        if (range) {
          range.deleteContents();
          range.insertNode(document.createTextNode(output));
          showToast("Replaced", "info");
          return;
        }
      }
      await navigator.clipboard.writeText(output);
      showToast("Copied (no original selection)", "info");
    });
    ui.toneBtn.style.display = task === "rewrite" ? "inline-block" : "none";
    ui.toneBtn.addEventListener("click", async () => {
      const menu = document.createElement("div");
      menu.className = "ai-tone-menu";
      const tones = [
        { key: "formal", label: "Formal" },
        { key: "friendly", label: "Friendly" },
        { key: "confident", label: "Confident" },
        { key: "persuasive", label: "Persuasive" },
        { key: "casual", label: "Casual" }
      ];
      tones.forEach((t) => {
        const b = document.createElement("button");
        b.textContent = t.label;
        b.addEventListener("click", async () => {
          menu.remove();
          ui.pre.innerHTML = `<div class="ai-spinner" aria-label="Loading" role="status" aria-live="polite"></div>`;
          try {
            const clipped2 = text.slice(0, 1e4);
            const out2 = await callServer("rewrite", clipped2, { tone: t.key });
            ui.pre.textContent = out2;
            await addHistoryItem({ task: "rewrite", output: out2, inputPreview: clipped2.slice(0, 200), tone: t.key });
          } catch (err) {
            ui.pre.textContent = err?.message || "Failed.";
            showToast(ui.pre.textContent, "error");
          }
        });
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      const r = ui.toneBtn.getBoundingClientRect();
      menu.style.left = `${window.scrollX + r.left}px`;
      menu.style.top = `${window.scrollY + r.bottom + 6}px`;
      menu.style.display = "block";
      const closeMenu = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== ui.toneBtn) {
          menu.remove();
          document.removeEventListener("mousedown", closeMenu, true);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", closeMenu, true), 0);
    });
  } catch (e) {
    ui.pre.textContent = e?.message || "Failed.";
    showToast(ui.pre.textContent, "error");
  }
}
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg.type === "AI_ACTION") {
    handleAction(msg.task, msg.tone, msg.percent, msg.summary_level);
  } else if (msg.type === "AI_TOAST") {
    showToast(msg.text, msg.level || "info");
  }
});
//# sourceMappingURL=content.js.map
