import { PANEL_ID } from "./content/constants.js";
import { QUICK_PANEL_MESSAGE } from "./content/messages.js";
import { loadEntriesByHost, touchEntry } from "./content/api.js";
import { ensurePanelRoot, ensureStyles, renderEntries, renderLockedPanel, renderPanelShell } from "./content/render.js";
import { createPanelState, getFilteredEntries } from "./content/state.js";
import { copyText, isEditable, normalizeHost } from "./content/utils.js";

if (!window.__quickPassLoaded) {
  window.__quickPassLoaded = true;
  bootstrapContentPanel();
}

function bootstrapContentPanel() {
  let lastFocusedInput = null;
  let panelVisible = false;
  let panelState = createPanelState();

  document.addEventListener(
    "focusin",
    (event) => {
      if (isEditable(event.target)) {
        lastFocusedInput = event.target;
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== QUICK_PANEL_MESSAGE) return;
    void togglePanel();
  });

  async function togglePanel() {
    if (panelVisible) {
      hidePanel();
      return;
    }

    ensureStyles();
    const panelRoot = ensurePanelRoot();
    panelRoot.innerHTML = `<div class="qp-loading">กำลังโหลดข้อมูล...</div>`;
    panelRoot.classList.add("qp-open");
    panelVisible = true;

    const host = normalizeHost(window.location.hostname);
    const result = await loadEntriesByHost(host);
    if (result.locked) {
      panelRoot.innerHTML = renderLockedPanel(host, result.reason);
      bindClickEvents(panelRoot);
      return;
    }

    panelState = createPanelState({ host, entries: result.entries || [], reason: result.reason || "" });
    panelRoot.innerHTML = renderPanelShell(panelState.host, panelState.reason);
    bindClickEvents(panelRoot);
    bindFilterEvents(panelRoot);
    refreshList(panelRoot);
  }

  function hidePanel() {
    const panelRoot = document.getElementById(PANEL_ID);
    if (!panelRoot) {
      panelVisible = false;
      return;
    }
    panelRoot.classList.remove("qp-open");
    panelRoot.innerHTML = "";
    panelVisible = false;
    if (isEditable(lastFocusedInput)) {
      lastFocusedInput.focus();
    }
  }

  function bindClickEvents(panelRoot) {
    panelRoot.onclick = async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      if (!action) return;
      if (action === "close") return hidePanel();

      const id = target.dataset.id;
      if (!id) return;
      const entry = panelState.entries.find((item) => item.id === id);
      if (!entry) return;

      if (action === "copy-user") await handleCopy(id, entry.username);
      else if (action === "copy-pass") await handleCopy(id, entry.password);
      else if (action === "copy-secret-name") await handleCopy(id, entry.secretName);
      else if (action === "copy-secret-value") await handleCopy(id, entry.secretValue);
      else if (action === "fill-user") await handleFill(id, entry.username);
      else if (action === "fill-pass") await handleFill(id, entry.password);
      else if (action === "fill-secret-name") await handleFill(id, entry.secretName);
      else if (action === "fill-secret-value") await handleFill(id, entry.secretValue);
      else return;

      hidePanel();
    };
  }

  function bindFilterEvents(panelRoot) {
    const searchInput = panelRoot.querySelector("#qp-search");
    if (searchInput instanceof HTMLInputElement) {
      searchInput.oninput = () => {
        panelState.search = searchInput.value;
        refreshList(panelRoot);
      };
    }

    const chips = panelRoot.querySelectorAll("[data-filter]");
    chips.forEach((chip) => {
      if (!(chip instanceof HTMLElement)) return;
      chip.onclick = () => {
        const kind = chip.dataset.filter;
        const value = chip.dataset.value || "";
        if (kind === "tab") panelState.tab = value;
        if (kind === "scope") panelState.scope = value;
        updateActiveChips(panelRoot);
        refreshList(panelRoot);
      };
    });
  }

  function updateActiveChips(panelRoot) {
    const chips = panelRoot.querySelectorAll("[data-filter]");
    chips.forEach((chip) => {
      if (!(chip instanceof HTMLElement)) return;
      const kind = chip.dataset.filter;
      const value = chip.dataset.value || "";
      const active =
        (kind === "tab" && value === panelState.tab) || (kind === "scope" && value === panelState.scope);
      chip.className = active ? "qp-chip qp-chip-active" : "qp-chip";
    });
  }

  function refreshList(panelRoot) {
    const listNode = panelRoot.querySelector("#qp-list");
    if (!(listNode instanceof HTMLElement)) return;
    listNode.innerHTML = renderEntries(getFilteredEntries(panelState), panelState.host);
  }

  async function handleCopy(id, value) {
    if (!value) return;
    await copyText(value);
    await touchEntry(id);
  }

  async function handleFill(id, value) {
    if (!value || !isEditable(lastFocusedInput)) return;
    lastFocusedInput.focus();
    lastFocusedInput.value = value;
    lastFocusedInput.dispatchEvent(new Event("input", { bubbles: true }));
    lastFocusedInput.dispatchEvent(new Event("change", { bubbles: true }));
    await touchEntry(id);
  }
}
