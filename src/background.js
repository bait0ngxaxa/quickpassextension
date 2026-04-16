import { getEntriesForHost, resolveEntryFieldForHost, touchEntry } from "./background/credentialService.js";
import { GET_ENTRIES_MESSAGE, OPEN_VAULT_PAGE_MESSAGE, RESOLVE_ENTRY_FIELD_MESSAGE, TOUCH_ENTRY_MESSAGE } from "./background/messages.js";
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

  if (message?.type === RESOLVE_ENTRY_FIELD_MESSAGE) {
    void resolveEntryFieldForHost(message.host, message.id, message.field)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ ok: false, reason: "unknown", value: "", error: "ไม่สามารถอ่านข้อมูลได้" }));
    return true;
  }

  if (message?.type === OPEN_VAULT_PAGE_MESSAGE) {
    void chrome.tabs.create({ url: chrome.runtime.getURL("src/popup/popup.html") })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === TOUCH_ENTRY_MESSAGE) {
    void touchEntry(message.id)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return undefined;
});
