import { getEntriesForHost, touchEntry, unlockVaultFromPanel } from "./background/credentialService.js";
import { GET_ENTRIES_MESSAGE, TOUCH_ENTRY_MESSAGE, UNLOCK_VAULT_MESSAGE } from "./background/messages.js";
import { sendToggleToActiveTab } from "./background/tabService.js";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle_quick_panel") {
    return;
  }
  await sendToggleToActiveTab();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === GET_ENTRIES_MESSAGE) {
    void getEntriesForHost(message.host)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ locked: true, reason: "unknown", entries: [] }));
    return true;
  }

  if (message?.type === TOUCH_ENTRY_MESSAGE) {
    void touchEntry(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === UNLOCK_VAULT_MESSAGE) {
    void unlockVaultFromPanel(message.password)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, error: "ไม่สามารถปลดล็อก Vault ได้" }));
    return true;
  }

  return undefined;
});
