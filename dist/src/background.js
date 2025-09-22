// extension/src/background.ts
var PARENT_ID = "ai_actions_parent";
var TONES = [
  { id: "formal", label: "Formal" },
  { id: "friendly", label: "Friendly" },
  { id: "confident", label: "Confident" },
  { id: "persuasive", label: "Persuasive" },
  { id: "casual", label: "Casual" }
];
var PERCENTS = [10, 20, 30, 40, 50, 60].map((p) => ({ id: p, label: `${p}%` }));
var SUMMARY_LEVELS = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" }
];
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.removeAll();
  } catch {
  }
  chrome.contextMenus.create({
    id: PARENT_ID,
    title: "AI Actions",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({ id: "task_rewrite", parentId: PARENT_ID, title: "Rewrite", contexts: ["selection"] });
  for (const tone of TONES) {
    chrome.contextMenus.create({ id: `task_rewrite_tone_${tone.id}`, parentId: "task_rewrite", title: tone.label, contexts: ["selection"] });
  }
  chrome.contextMenus.create({ id: "task_grammar", parentId: PARENT_ID, title: "Grammar & Spelling", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "task_shorten", parentId: PARENT_ID, title: "Shorten", contexts: ["selection"] });
  for (const p of PERCENTS) {
    chrome.contextMenus.create({ id: `task_shorten_percent_${p.id}`, parentId: "task_shorten", title: p.label, contexts: ["selection"] });
  }
  chrome.contextMenus.create({ id: "task_expand", parentId: PARENT_ID, title: "Expand", contexts: ["selection"] });
  for (const p of PERCENTS) {
    chrome.contextMenus.create({ id: `task_expand_percent_${p.id}`, parentId: "task_expand", title: p.label, contexts: ["selection"] });
  }
  chrome.contextMenus.create({ id: "task_summarize", parentId: PARENT_ID, title: "Summarize", contexts: ["selection"] });
  for (const s of SUMMARY_LEVELS) {
    chrome.contextMenus.create({ id: `task_summarize_level_${s.id}`, parentId: "task_summarize", title: s.label, contexts: ["selection"] });
  }
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const selectionEmpty = !info.selectionText || info.selectionText.trim() === "";
  if (selectionEmpty) {
    await chrome.tabs.sendMessage(tab.id, { type: "AI_TOAST", text: "No text selected", level: "info" });
    return;
  }
  const id = String(info.menuItemId);
  if (id === "task_grammar") {
    const msg = { type: "AI_ACTION", task: "grammar" };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }
  if (id.startsWith("task_rewrite_tone_")) {
    const tone = id.replace("task_rewrite_tone_", "");
    const msg = { type: "AI_ACTION", task: "rewrite", tone };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }
  if (id.startsWith("task_shorten_percent_")) {
    const p = parseInt(id.replace("task_shorten_percent_", ""), 10);
    const msg = { type: "AI_ACTION", task: "shorten", percent: p };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }
  if (id.startsWith("task_expand_percent_")) {
    const p = parseInt(id.replace("task_expand_percent_", ""), 10);
    const msg = { type: "AI_ACTION", task: "expand", percent: p };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }
  if (id.startsWith("task_summarize_level_")) {
    const s = id.replace("task_summarize_level_", "");
    const msg = { type: "AI_ACTION", task: "summarize", summary_level: s };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }
});
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === "rewrite_default") {
    const msg = { type: "AI_ACTION", task: "rewrite", tone: "friendly" };
    await chrome.tabs.sendMessage(tab.id, msg);
  } else if (command === "summarize") {
    const msg = { type: "AI_ACTION", task: "summarize", summary_level: "medium" };
    await chrome.tabs.sendMessage(tab.id, msg);
  }
});
//# sourceMappingURL=background.js.map
