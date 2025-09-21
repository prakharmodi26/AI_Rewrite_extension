import { getSettings, regenerateInstallId, setLocalSettings, setSyncSettings } from './storage.js';

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function init() {
  const serverUrl = document.getElementById('serverUrl') as HTMLInputElement;
  const defaultTone = document.getElementById('defaultTone') as HTMLSelectElement;
  const redact = document.getElementById('redact') as HTMLInputElement;
  const secret = document.getElementById('secret') as HTMLInputElement;
  const installId = document.getElementById('installId') as HTMLInputElement;
  const regen = document.getElementById('regen') as HTMLButtonElement;
  const save = document.getElementById('save') as HTMLButtonElement;
  const test = document.getElementById('test') as HTMLButtonElement;
  const msg = document.getElementById('msg') as HTMLSpanElement;
  const urlStatus = document.getElementById('urlStatus') as HTMLSpanElement;

  const settings = await getSettings();
  serverUrl.value = settings.serverUrl;
  defaultTone.value = settings.defaultTone;
  redact.checked = settings.redact;
  secret.value = settings.secret || '';
  installId.value = settings.installId;

  function showUrlStatus() {
    const ok = isValidUrl(serverUrl.value);
    urlStatus.textContent = ok ? 'OK' : 'Error';
    urlStatus.className = 'status ' + (ok ? 'ok' : 'err');
  }
  serverUrl.addEventListener('blur', showUrlStatus);
  showUrlStatus();

  regen.addEventListener('click', async () => {
    const id = await regenerateInstallId();
    installId.value = id;
    await setLocalSettings({ installId: id });
    msg.textContent = 'Install ID regenerated.';
    setTimeout(() => (msg.textContent = ''), 1500);
  });

  save.addEventListener('click', async () => {
    await setSyncSettings({ serverUrl: serverUrl.value, defaultTone: defaultTone.value as any, redact: redact.checked });
    await setLocalSettings({ secret: secret.value });
    msg.textContent = 'Saved.';
    setTimeout(() => (msg.textContent = ''), 1200);
  });

  test.addEventListener('click', async () => {
    msg.textContent = 'Pinging...';
    try {
      const res = await fetch(new URL('/healthz', serverUrl.value).toString());
      const ok = res.ok && (await res.json()).ok === true;
      msg.textContent = ok ? 'Server healthy.' : 'Server responded, but not OK.';
    } catch (e) {
      msg.textContent = 'Failed to connect.';
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
