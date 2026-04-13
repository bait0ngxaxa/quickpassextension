import { QUICK_PANEL_MESSAGE } from "./messages.js";

export async function sendToggleToActiveTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!activeTab || typeof activeTab.id !== "number") {
    return;
  }

  await sendToggleMessage(activeTab.id);
}

async function sendToggleMessage(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: QUICK_PANEL_MESSAGE });
    return;
  } catch (_error) {
    // บางหน้าจะยังไม่มี content script listener พร้อมใช้งาน จึงลองฉีดซ้ำ
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content.js"]
    });
    await chrome.tabs.sendMessage(tabId, { type: QUICK_PANEL_MESSAGE });
  } catch (_error) {
    // ไม่ต้อง throw เพื่อไม่ให้ service worker crash
  }
}
