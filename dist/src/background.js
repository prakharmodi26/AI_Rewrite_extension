// extension/src/background.ts
var PARENT_ID = "ai_actions_parent";
var REWRITE_ITEMS = [
  { id: "rewrite_clear", title: "Rewrite \u2192 Clear & Professional (default)", tone: "clear" },
  { id: "rewrite_friendly", title: "Rewrite \u2192 Friendly", tone: "friendly" },
  { id: "rewrite_concise", title: "Rewrite \u2192 Concise", tone: "concise" },
  { id: "rewrite_formal", title: "Rewrite \u2192 Formal", tone: "formal" },
  { id: "rewrite_grammar", title: "Rewrite \u2192 Grammar only", tone: "grammar" }
];
var SUMMARIZE_ITEM = { id: "summarize", title: "Summarize (3\u20135 bullets)" };
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
  for (const item of REWRITE_ITEMS) {
    chrome.contextMenus.create({
      id: item.id,
      parentId: PARENT_ID,
      title: item.title,
      contexts: ["selection"]
    });
  }
  chrome.contextMenus.create({
    id: SUMMARIZE_ITEM.id,
    parentId: PARENT_ID,
    title: SUMMARIZE_ITEM.title,
    contexts: ["selection"]
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const selectionEmpty = !info.selectionText || info.selectionText.trim() === "";
  if (selectionEmpty) {
    await chrome.tabs.sendMessage(tab.id, { type: "AI_TOAST", text: "No text selected", level: "info" });
    return;
  }
  if (info.menuItemId === SUMMARIZE_ITEM.id) {
    const msg = { type: "AI_ACTION", task: "summarize" };
    await chrome.tabs.sendMessage(tab.id, msg);
    return;
  }
  const rewrite = REWRITE_ITEMS.find((i) => i.id === info.menuItemId);
  if (rewrite) {
    const msg = { type: "AI_ACTION", task: "rewrite", tone: rewrite.tone };
    await chrome.tabs.sendMessage(tab.id, msg);
  }
});
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === "rewrite_default") {
    const msg = { type: "AI_ACTION", task: "rewrite", tone: "clear" };
    await chrome.tabs.sendMessage(tab.id, msg);
  } else if (command === "summarize") {
    const msg = { type: "AI_ACTION", task: "summarize" };
    await chrome.tabs.sendMessage(tab.id, msg);
  }
});
//# sourceMappingURL=background.js.map
