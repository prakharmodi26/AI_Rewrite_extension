// extension/src/storage.ts
var DEFAULTS = {
  serverUrl: "http://localhost:8080",
  defaultTone: "clear",
  redact: false
};
async function ensureInstallId() {
  const { installId } = await chrome.storage.local.get("installId");
  if (installId && typeof installId === "string") return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}
async function getSettings() {
  const sync = await chrome.storage.sync.get(["serverUrl", "defaultTone", "redact"]);
  const local = await chrome.storage.local.get(["secret", "installId"]);
  const installId = local.installId || await ensureInstallId();
  return {
    serverUrl: sync.serverUrl || DEFAULTS.serverUrl,
    defaultTone: sync.defaultTone || DEFAULTS.defaultTone,
    redact: typeof sync.redact === "boolean" ? sync.redact : DEFAULTS.redact,
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
  const secret = document.getElementById("secret");
  const installId = document.getElementById("installId");
  const regen = document.getElementById("regen");
  const save = document.getElementById("save");
  const test = document.getElementById("test");
  const msg = document.getElementById("msg");
  const urlStatus = document.getElementById("urlStatus");
  const settings = await getSettings();
  serverUrl.value = settings.serverUrl;
  defaultTone.value = settings.defaultTone;
  redact.checked = settings.redact;
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
    await setSyncSettings({ serverUrl: serverUrl.value, defaultTone: defaultTone.value, redact: redact.checked });
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
