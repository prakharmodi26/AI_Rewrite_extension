import { AiActionMessage, Task, Tone, TransformRequestBody, TransformResponseBody, PercentLevel, SummaryLevel } from './types.js';
import { getSettings, addHistoryItem } from './storage.js';
import { hmacSha256Hex } from './hmac.js';

function getSelectionInfo() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { text: '', rect: null as DOMRect | null, range: null as Range | null };
  const range = sel.getRangeAt(0);
  const text = sel.toString();
  const rect = range.getBoundingClientRect();
  return { text, rect, range };
}

function createOverlay(title: string) {
  const container = document.createElement('div');
  container.className = 'ai-overlay-container';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-label', 'AI Actions');
  container.tabIndex = -1;

  const header = document.createElement('div');
  header.className = 'ai-overlay-header';
  const icon = document.createElement('img');
  icon.src = chrome.runtime.getURL('src/icons/pencil.svg');
  icon.alt = '';
  icon.width = 16;
  icon.height = 16;
  icon.style.marginRight = '8px';
  const h = document.createElement('div');
  h.className = 'ai-overlay-title';
  h.textContent = title;
  const close = document.createElement('button');
  close.className = 'ai-close-btn';
  close.setAttribute('aria-label', 'Close overlay');
  close.textContent = '✕';
  close.addEventListener('click', () => container.remove());
  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.alignItems = 'center';
  left.append(icon, h);
  header.append(left, close);

  const content = document.createElement('div');
  content.className = 'ai-overlay-content';
  const pre = document.createElement('pre');
  pre.className = 'ai-overlay-pre';
  pre.textContent = '';
  content.append(pre);

  const actions = document.createElement('div');
  actions.className = 'ai-overlay-actions';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'ai-btn ai-focus-ring';
  copyBtn.setAttribute('aria-label', 'Copy to clipboard');
  copyBtn.textContent = 'Copy';
  const replaceBtn = document.createElement('button');
  replaceBtn.className = 'ai-btn secondary ai-focus-ring';
  replaceBtn.setAttribute('aria-label', 'Replace selection');
  replaceBtn.textContent = 'Replace Selection';
  const toneBtn = document.createElement('button');
  toneBtn.className = 'ai-btn secondary ai-focus-ring';
  toneBtn.setAttribute('aria-label', 'Change tone and retry');
  toneBtn.textContent = 'Change Tone';
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'ai-btn secondary ai-focus-ring';
  dismissBtn.setAttribute('aria-label', 'Dismiss overlay');
  dismissBtn.textContent = 'Cancel';
  actions.append(copyBtn, toneBtn, replaceBtn, dismissBtn);

  container.append(header, content, actions);

  // Draggable by header
  let dragStartX = 0, dragStartY = 0, startLeft = 0, startTop = 0, dragging = false;
  header.style.cursor = 'move';
  header.addEventListener('mousedown', (e) => {
    dragging = true;
    const rect = container.getBoundingClientRect();
    startLeft = rect.left + window.scrollX;
    startTop = rect.top + window.scrollY;
    dragStartX = e.clientX + window.scrollX;
    dragStartY = e.clientY + window.scrollY;
    e.preventDefault();
  });
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = (e.clientX + window.scrollX) - dragStartX;
    const dy = (e.clientY + window.scrollY) - dragStartY;
    let left = startLeft + dx;
    let top = startTop + dy;
    const maxLeft = window.scrollX + window.innerWidth - container.offsetWidth - 10;
    const maxTop = window.scrollY + window.innerHeight - container.offsetHeight - 10;
    left = Math.max(window.scrollX + 10, Math.min(maxLeft, left));
    top = Math.max(window.scrollY + 10, Math.min(maxTop, top));
    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
  };
  const onUp = () => { dragging = false; };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      container.remove();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
      copyBtn.click();
    }
    if (e.key === 'Enter') {
      copyBtn.click();
    }
  }
  container.addEventListener('keydown', onKey);

  // Simple focus trap
  const focusables: HTMLElement[] = [copyBtn, toneBtn, replaceBtn, dismissBtn, close];
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const activeEl = document.activeElement as HTMLElement | null;
    const idx = activeEl ? Math.max(0, focusables.indexOf(activeEl)) : 0;
    const dir = e.shiftKey ? -1 : 1;
    const next = (idx + dir + focusables.length) % focusables.length;
    focusables[next].focus();
    e.preventDefault();
  });

  return { container, pre, copyBtn, toneBtn, replaceBtn, dismissBtn, close };
}

function positionOverlay(el: HTMLElement, rect: DOMRect | null) {
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

function showToast(text: string, level: 'info' | 'error' = 'info') {
  const t = document.createElement('div');
  t.className = 'ai-toast' + (level === 'error' ? ' error' : ' success');
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

async function callServer(task: Task, input: string, opts: { tone?: Tone; percent?: PercentLevel; summary_level?: SummaryLevel }) {
  const settings = await getSettings();
  const body: TransformRequestBody = { task, input };
  // redact optional
  if (settings.redact) body.redact = true;
  // include task-specific parameters
  if (task === 'rewrite') {
    if (!opts.tone) throw new Error('Tone is required for rewrite');
    body.tone = opts.tone;
  } else if (task === 'shorten' || task === 'expand') {
    if (!opts.percent) throw new Error('Percent is required');
    body.percent = opts.percent;
  } else if (task === 'summarize') {
    if (!opts.summary_level) throw new Error('Summary level is required');
    body.summary_level = opts.summary_level;
  }
  const bodyString = JSON.stringify(body);
  const ts = Date.now().toString();
  const nonce = crypto.randomUUID();
  const dataToSign = `${bodyString}.${ts}.${nonce}`;
  const secret = settings.secret || '';
  const signature = await hmacSha256Hex(secret, dataToSign);

  const res = await fetch(new URL('/transform', settings.serverUrl).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ts': ts,
      'x-nonce': nonce,
      'x-signature': signature,
      'x-install-id': settings.installId,
    },
    body: bodyString,
  });

  if (!res.ok) {
    const msgByStatus: Record<number, string> = {
      400: 'Invalid request.',
      401: 'Auth error (signature/timing). Try again.',
      409: 'Auth error (signature/timing). Try again.',
      429: 'Too many requests. Please slow down.',
      500: 'Server error. Try again.',
    };
    const msg = msgByStatus[res.status] || 'Request failed.';
    throw new Error(msg);
  }

  const json = (await res.json()) as TransformResponseBody;
  return json.output;
}

async function handleAction(task: Task, tone?: Tone, percent?: PercentLevel, summary_level?: SummaryLevel) {
  const { text, rect, range } = getSelectionInfo();
  if (!text || text.trim() === '') {
    showToast('No text selected');
    return;
  }

  const titleMap: Record<Task, string> = {
    rewrite: 'Rewrite',
    grammar: 'Fix Grammar & Spelling',
    summarize: 'Summarize',
    shorten: 'Shorten',
    expand: 'Expand',
  };
  const title = titleMap[task];
  const ui = createOverlay(title);
  positionOverlay(ui.container, rect);
  ui.container.focus();

  // loading spinner
  ui.pre.innerHTML = `<div class="ai-spinner" aria-label="Loading" role="status" aria-live="polite"></div>`;

  try {
    const settings = await getSettings();
    let useTone: Tone | undefined = undefined;
    let usePercent: PercentLevel | undefined = percent;
    let useSummary: SummaryLevel | undefined = summary_level;
    if (task === 'rewrite') {
      useTone = tone || settings.defaultTone;
    }
    const clipped = text.slice(0, 10000);
    const output = await callServer(task, clipped, { tone: useTone, percent: usePercent, summary_level: useSummary });
    ui.pre.textContent = output;
    // Save to history
    await addHistoryItem({
      task,
      output,
      inputPreview: clipped.slice(0, 200),
      tone: useTone,
      percent: usePercent,
      summary_level: useSummary,
    });

    ui.copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(output);
      showToast('Copied', 'info');
    });

    ui.dismissBtn.addEventListener('click', () => ui.container.remove());
    // outside click dismiss (toggleable)
    if (settings.dismissOnOutsideClick !== false) {
      const onDocClick = (ev: MouseEvent) => {
        if (!ui.container.contains(ev.target as Node)) {
          ui.container.remove();
          document.removeEventListener('mousedown', onDocClick, true);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', onDocClick, true), 0);
    }

    const isEditable = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return false;
      if ((active as HTMLInputElement).value !== undefined || (active as HTMLTextAreaElement).value !== undefined) return true;
      if (active.isContentEditable) return true;
      return false;
    };

    const updateReplaceState = () => {
      ui.replaceBtn.disabled = !isEditable();
      ui.replaceBtn.setAttribute('aria-disabled', ui.replaceBtn.disabled ? 'true' : 'false');
    };
    updateReplaceState();
    window.addEventListener('focusin', updateReplaceState);

    ui.replaceBtn.addEventListener('click', async () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) {
        await navigator.clipboard.writeText(output);
        showToast('Copied (no editable target)', 'info');
        return;
      }
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        const start = active.selectionStart ?? 0;
        const end = active.selectionEnd ?? 0;
        const val = active.value;
        active.value = val.slice(0, start) + output + val.slice(end);
        // set caret after inserted text
        const pos = (start + output.length);
        active.selectionStart = active.selectionEnd = pos;
        active.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (active && active.isContentEditable) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          r.deleteContents();
          r.insertNode(document.createTextNode(output));
        } else if (range) {
          range.deleteContents();
          range.insertNode(document.createTextNode(output));
        } else {
          await navigator.clipboard.writeText(output);
          showToast('Copied (no selection)', 'info');
        }
      } else {
        await navigator.clipboard.writeText(output);
        showToast('Copied (no editable target)', 'info');
      }
    });

    // Change tone and re-run (rewrite only)
    ui.toneBtn.style.display = task === 'rewrite' ? 'inline-block' : 'none';
    ui.toneBtn.addEventListener('click', async () => {
      const menu = document.createElement('div');
      menu.className = 'ai-tone-menu';
      const tones: { key: Tone; label: string }[] = [
        { key: 'formal', label: 'Formal' },
        { key: 'friendly', label: 'Friendly' },
        { key: 'confident', label: 'Confident' },
        { key: 'persuasive', label: 'Persuasive' },
        { key: 'casual', label: 'Casual' },
      ];
      tones.forEach((t) => {
        const b = document.createElement('button');
        b.textContent = t.label;
        b.addEventListener('click', async () => {
          menu.remove();
          ui.pre.innerHTML = `<div class="ai-spinner" aria-label="Loading" role="status" aria-live="polite"></div>`;
          try {
            const clipped2 = text.slice(0, 10000);
            const out2 = await callServer('rewrite', clipped2, { tone: t.key });
            ui.pre.textContent = out2;
            await addHistoryItem({ task: 'rewrite', output: out2, inputPreview: clipped2.slice(0, 200), tone: t.key });
          } catch (err: any) {
            ui.pre.textContent = err?.message || 'Failed.';
            showToast(ui.pre.textContent, 'error');
          }
        });
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      const r = ui.toneBtn.getBoundingClientRect();
      menu.style.left = `${window.scrollX + r.left}px`;
      menu.style.top = `${window.scrollY + r.bottom + 6}px`;
      menu.style.display = 'block';
      const closeMenu = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node) && ev.target !== ui.toneBtn) {
          menu.remove();
          document.removeEventListener('mousedown', closeMenu, true);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', closeMenu, true), 0);
    });
  } catch (e: any) {
    ui.pre.textContent = (e?.message as string) || 'Failed.';
    showToast(ui.pre.textContent, 'error');
  }
}

chrome.runtime.onMessage.addListener((msg: AiActionMessage | { type: 'AI_TOAST'; text: string; level?: 'info' | 'error' }, _sender, _sendResponse) => {
  if (msg.type === 'AI_ACTION') {
    handleAction(msg.task, msg.tone as Tone, msg.percent as PercentLevel, msg.summary_level as SummaryLevel);
  } else if (msg.type === 'AI_TOAST') {
    showToast(msg.text, msg.level || 'info');
  }
});
