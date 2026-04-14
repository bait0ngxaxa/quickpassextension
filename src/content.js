import { PANEL_ID } from "./content/constants.js";
import { QUICK_PANEL_MESSAGE } from "./content/messages.js";
import { loadEntriesByHost, touchEntry, unlockVault } from "./content/api.js";
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
    await loadAndRenderPanel(panelRoot, host);
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
      if (!(target instanceof Element)) return;
      const actionNode = target.closest("[data-action]");
      if (!(actionNode instanceof HTMLElement)) return;
      const action = actionNode.dataset.action;
      if (!action) return;
      if (action === "close") return hidePanel();

      const id = actionNode.dataset.id;
      if (!id) return;
      const entry = panelState.entries.find((item) => item.id === id);
      if (!entry) return;

      if (action === "copy-user") {
        await handleCopy(id, entry.username);
        return;
      }
      if (action === "copy-pass") {
        await handleCopy(id, entry.password);
        return;
      }
      if (action === "copy-secret-name") {
        await handleCopy(id, entry.secretName);
        return;
      }
      if (action === "copy-secret-value") {
        await handleCopy(id, entry.secretValue);
        return;
      }
      if (action === "fill-user") {
        await handleFill(id, entry.username);
        hidePanel();
        return;
      }
      if (action === "fill-pass") {
        await handleFill(id, entry.password);
        hidePanel();
        return;
      }
      if (action === "fill-secret-name") {
        await handleFill(id, entry.secretName);
        hidePanel();
        return;
      }
      if (action === "fill-secret-value") {
        await handleFill(id, entry.secretValue);
        hidePanel();
        return;
      }
    };
  }

  function bindUnlockEvents(panelRoot, host) {
    const unlockForm = panelRoot.querySelector('[data-role="unlock-form"]');
    if (!(unlockForm instanceof HTMLFormElement)) {
      return;
    }

    unlockForm.onsubmit = async (event) => {
      event.preventDefault();
      const formData = new FormData(unlockForm);
      const password = String(formData.get("password") || "");
      const submitButton = unlockForm.querySelector('[data-action="unlock-vault"]');
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = "กำลังปลดล็อก...";
      }

      const result = await unlockVault(password);
      if (!result.ok) {
        panelRoot.innerHTML = renderLockedPanel(host, "locked", result.error || "ไม่สามารถปลดล็อกได้");
        bindClickEvents(panelRoot);
        bindUnlockEvents(panelRoot, host);
        const passwordInput = panelRoot.querySelector("#qp-unlock-password");
        if (passwordInput instanceof HTMLInputElement) {
          passwordInput.focus();
        }
        return;
      }

      await loadAndRenderPanel(panelRoot, host);
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

  async function loadAndRenderPanel(panelRoot, host) {
    const result = await loadEntriesByHost(host);
    if (result.locked) {
      panelRoot.innerHTML = renderLockedPanel(host, result.reason);
      bindClickEvents(panelRoot);
      bindUnlockEvents(panelRoot, host);
      const passwordInput = panelRoot.querySelector("#qp-unlock-password");
      if (passwordInput instanceof HTMLInputElement) {
        passwordInput.focus();
      }
      return;
    }

    panelState = createPanelState({ host, entries: result.entries || [], reason: result.reason || "" });
    panelRoot.innerHTML = renderPanelShell(panelState.host, panelState.reason);
    bindClickEvents(panelRoot);
    bindFilterEvents(panelRoot);
    refreshList(panelRoot);
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
