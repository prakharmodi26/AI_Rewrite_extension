import { getHistory } from './storage.js';

function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function renderMeta(item: any) {
  const parts: string[] = [item.task];
  if (item.tone) parts.push(`tone: ${item.tone}`);
  if (item.percent) parts.push(`${item.percent}%`);
  if (item.summary_level) parts.push(`summary: ${item.summary_level}`);
  return parts.join(' · ');
}

async function init() {
  const list = document.getElementById('list') as HTMLDivElement;
  const btn = document.getElementById('openOptions') as HTMLButtonElement;
  btn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const items = await getHistory();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No history yet. Select text, then right-click → AI Actions to generate your first result.';
    list.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'item';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${renderMeta(item)} · ${fmtDate(item.ts)}`;

    const output = document.createElement('div');
    output.className = 'output';
    output.textContent = item.output;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(item.output);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    });

    actions.append(copyBtn);
    card.append(meta, output, actions);
    list.appendChild(card);
  }
}

document.addEventListener('DOMContentLoaded', init);
