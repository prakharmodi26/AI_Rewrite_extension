import { AiActionMessage, Tone } from './types.js';

const PARENT_ID = 'ai_actions_parent';

const REWRITE_ITEMS: { id: string; title: string; tone: Tone }[] = [
  { id: 'rewrite_clear', title: 'Rewrite → Clear & Professional (default)', tone: 'clear' },
  { id: 'rewrite_friendly', title: 'Rewrite → Friendly', tone: 'friendly' },
  { id: 'rewrite_concise', title: 'Rewrite → Concise', tone: 'concise' },
  { id: 'rewrite_formal', title: 'Rewrite → Formal', tone: 'formal' },
  { id: 'rewrite_grammar', title: 'Rewrite → Grammar only', tone: 'grammar' },
];

const SUMMARIZE_ITEM = { id: 'summarize', title: 'Summarize (3–5 bullets)' };

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.removeAll();
  } catch {}

  chrome.contextMenus.create({
    id: PARENT_ID,
    title: 'AI Actions',
    contexts: ['selection'],
  });

  for (const item of REWRITE_ITEMS) {
    chrome.contextMenus.create({
      id: item.id,
      parentId: PARENT_ID,
      title: item.title,
      contexts: ['selection'],
    });
  }

  chrome.contextMenus.create({
    id: SUMMARIZE_ITEM.id,
    parentId: PARENT_ID,
    title: SUMMARIZE_ITEM.title,
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const selectionEmpty = !info.selectionText || info.selectionText.trim() === '';
  if (selectionEmpty) {
    await chrome.tabs.sendMessage(tab.id, { type: 'AI_TOAST', text: 'No text selected', level: 'info' });
    return;
  }

  if (info.menuItemId === SUMMARIZE_ITEM.id) {
    const msg: AiActionMessage = { type: 'AI_ACTION', task: 'summarize' };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }

  const rewrite = REWRITE_ITEMS.find((i) => i.id === info.menuItemId);
  if (rewrite) {
    const msg: AiActionMessage = { type: 'AI_ACTION', task: 'rewrite', tone: rewrite.tone };
    await chrome.tabs.sendMessage(tab.id, msg);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === 'rewrite_default') {
    const msg: AiActionMessage = { type: 'AI_ACTION', task: 'rewrite', tone: 'clear' };
    await chrome.tabs.sendMessage(tab.id, msg);
  } else if (command === 'summarize') {
    const msg: AiActionMessage = { type: 'AI_ACTION', task: 'summarize' };
    await chrome.tabs.sendMessage(tab.id, msg);
  }
});
