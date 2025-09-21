import { Settings, Tone } from './types.js';

const DEFAULTS = {
  serverUrl: 'http://localhost:8080',
  defaultTone: 'clear' as Tone,
  redact: false,
};

async function ensureInstallId(): Promise<string> {
  const { installId } = await chrome.storage.local.get('installId');
  if (installId && typeof installId === 'string') return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

export async function getSettings(): Promise<Settings> {
  const sync = await chrome.storage.sync.get(['serverUrl', 'defaultTone', 'redact']);
  const local = await chrome.storage.local.get(['secret', 'installId']);
  const installId = local.installId || (await ensureInstallId());
  return {
    serverUrl: sync.serverUrl || DEFAULTS.serverUrl,
    defaultTone: (sync.defaultTone as Tone) || DEFAULTS.defaultTone,
    redact: typeof sync.redact === 'boolean' ? sync.redact : DEFAULTS.redact,
    secret: typeof local.secret === 'string' ? local.secret : undefined,
    installId,
  };
}

export async function setSyncSettings(partial: Partial<Pick<Settings, 'serverUrl' | 'defaultTone' | 'redact'>>): Promise<void> {
  await chrome.storage.sync.set(partial);
}

export async function setLocalSettings(partial: Partial<Pick<Settings, 'secret' | 'installId'>>): Promise<void> {
  await chrome.storage.local.set(partial);
}

export async function regenerateInstallId(): Promise<string> {
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}
