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
async function setSyncSettings(partial) {
  await chrome.storage.sync.set(partial);
}
async function setLocalSettings(partial) {
  await chrome.storage.local.set(partial);
}
async function regenerateInstallId() {
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

// extension/src/options.ts
function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
async function init() {
  const serverUrl = document.getElementById("serverUrl");
  const defaultTone = document.getElementById("defaultTone");
  const redact = document.getElementById("redact");
  const dismissOnOutsideClick = document.getElementById("dismissOnOutsideClick");
  const secret = document.getElementById("secret");
  const installId = document.getElementById("installId");
  const regen = document.getElementById("regen");
  const save = document.getElementById("save");
  const test = document.getElementById("test");
  const msg = document.getElementById("msg");
  const urlStatus = document.getElementById("urlStatus");
  const settings = await getSettings();
  serverUrl.value = settings.serverUrl;
  const available = Array.from(defaultTone.options).map((o) => o.value);
  defaultTone.value = available.includes(settings.defaultTone) ? settings.defaultTone : "friendly";
  redact.checked = settings.redact;
  dismissOnOutsideClick.checked = !!settings.dismissOnOutsideClick;
  secret.value = settings.secret || "";
  installId.value = settings.installId;
  function showUrlStatus() {
    const ok = isValidUrl(serverUrl.value);
    urlStatus.textContent = ok ? "OK" : "Error";
    urlStatus.className = "status " + (ok ? "ok" : "err");
  }
  serverUrl.addEventListener("blur", showUrlStatus);
  showUrlStatus();
  regen.addEventListener("click", async () => {
    const id = await regenerateInstallId();
    installId.value = id;
    await setLocalSettings({ installId: id });
    msg.textContent = "Install ID regenerated.";
    setTimeout(() => msg.textContent = "", 1500);
  });
  save.addEventListener("click", async () => {
    await setSyncSettings({ serverUrl: serverUrl.value, defaultTone: defaultTone.value, redact: redact.checked, dismissOnOutsideClick: dismissOnOutsideClick.checked });
    await setLocalSettings({ secret: secret.value });
    msg.textContent = "Saved.";
    setTimeout(() => msg.textContent = "", 1200);
  });
  test.addEventListener("click", async () => {
    msg.textContent = "Pinging...";
    try {
      const res = await fetch(new URL("/healthz", serverUrl.value).toString());
      const ok = res.ok && (await res.json()).ok === true;
      msg.textContent = ok ? "Server healthy." : "Server responded, but not OK.";
    } catch (e) {
      msg.textContent = "Failed to connect.";
    }
  });
}
document.addEventListener("DOMContentLoaded", init);
//# sourceMappingURL=options.js.map
