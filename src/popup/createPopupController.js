import { get, writable } from "svelte/store";
import { renderIcon } from "../shared/icons.js";
import { AUTO_LOCK_MINUTES, getVaultSessionExpiry, touchVaultSession } from "../shared/vaultSession.js";
import { encryptCredentialItem, normalizeHost } from "./vault.js";
import {
  clearLegacyEncryptedVaultItems,
  decryptEncryptedVaultItems,
  getLocalSecurityProfile,
  getLegacyEncryptedVaultItems,
  initializeVault,
  lockVault as lockVaultSession,
  saveLocalSecurityProfile,
  setupMasterPassword,
  unlockVault
} from "./vaultService.js";
import { buildPayload, createEmptyForm, formFromItem } from "./form.js";
import { createInitialState, buildViewModel, emptyFeedback } from "./controller/state.js";
import { readCloudSecurityProfile, saveCloudSecurityProfile } from "../supabase/securityStore.js";
import { deleteVaultItem, listEncryptedVaultItems, upsertEncryptedVaultItems } from "../supabase/vaultStore.js";
import { readSupabaseSetup, signInWithOAuthProvider, signOutSupabase } from "./supabaseService.js";

export function createPopupController() {
  const state = writable(createInitialState());
  const view = { subscribe: (run) => state.subscribe((value) => run(buildViewModel(value))) };
  let feedbackTimerId = null;
  let vaultAutoLockTimerId = null;

  function update(payload) {
    state.update((current) => updateState(current, payload));
  }

  async function init() {
    await prefillHost();
    await initializeVaultState();
    await initializeSupabaseState();
    const current = get(state);
    if (current.masterKey && current.supabaseSessionEmail) {
      await hydrateCloudVault(true);
    }
  }

  function destroy() {
    if (feedbackTimerId) clearTimeout(feedbackTimerId);
    if (vaultAutoLockTimerId) clearTimeout(vaultAutoLockTimerId);
  }

  async function prefillHost() {
    const [tabInfo] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabInfo?.url) return;
    try {
      const host = normalizeHost(new URL(tabInfo.url).hostname);
      update({ currentHost: host, form: { ...get(state).form, domain: get(state).form.domain || host } });
    } catch (_error) {}
  }

  async function initializeVaultState() {
    const vaultState = await initializeVault();
    update({ authMode: vaultState.mode, masterKey: vaultState.key, credentials: vaultState.credentials });
    if (vaultState.mode === "ready") {
      await scheduleVaultAutoLock();
    }
  }

  async function initializeSupabaseState() {
    const setup = await readSupabaseSetup();
    update({
      supabaseUrl: setup.config.url || "",
      supabaseSessionEmail: setup.sessionEmail || "",
      supabaseConfigStatus: setup.config.url && !setup.setupError ? "ok" : "not_ready"
    });
    if (setup.setupError) {
      setFeedback("settings", "error", setup.setupError, true);
    }
    if (setup.sessionEmail) {
      await reconcileSecurityProfile(true);
    }
  }

  async function submitSetupMasterPassword() {
    clearFeedback("vault");
    const current = get(state);
    const password = current.setupPassword.trim();
    if (password.length < 8) return setFeedback("vault", "error", "Master Password ต้องยาวอย่างน้อย 8 ตัวอักษร", true);
    if (password !== current.setupConfirm.trim()) return setFeedback("vault", "error", "ยืนยันรหัสผ่านไม่ตรงกัน", true);
    update({ setupBusy: true });
    const result = await setupMasterPassword(password);
    update({
      setupPassword: "",
      setupConfirm: "",
      masterKey: result.key,
      credentials: result.credentials,
      authMode: "ready",
      setupBusy: false
    });
    setFeedback("vault", "success", "ตั้งค่า Master Password เรียบร้อย");
    await scheduleVaultAutoLock();
    await reconcileSecurityProfile(true);
    if (get(state).supabaseSessionEmail) await hydrateCloudVault(true);
  }

  async function submitUnlockVault() {
    clearFeedback("vault");
    update({ unlockBusy: true });
    const result = await unlockVault(get(state).unlockPassword);
    if (!result.ok) {
      update({ unlockBusy: false });
      return setFeedback("vault", "error", result.reason === "invalid_password" ? "Master Password ไม่ถูกต้อง" : "ไม่สามารถปลดล็อกได้ ลองใหม่อีกครั้ง", true);
    }
    update({
      unlockPassword: "",
      masterKey: result.key,
      credentials: result.credentials,
      authMode: "ready",
      unlockBusy: false
    });
    setFeedback("vault", "success", result.reason === "migrated" ? "ปลดล็อก Vault แล้ว และอัปเกรดคีย์สำหรับการ sync ข้ามเครื่องให้แล้ว" : "ปลดล็อก Vault แล้ว");
    await scheduleVaultAutoLock();
    await reconcileSecurityProfile(true);
    if (get(state).supabaseSessionEmail) await hydrateCloudVault(true);
  }

  async function lockVault() {
    update({ lockBusy: true });
    await lockVaultSession();
    update({ lockBusy: false });
    applyLockedState("ล็อก Vault แล้ว");
  }

  async function saveCredential() {
    const current = get(state);
    if (!current.masterKey || !(await keepVaultSessionAlive())) return;
    const { payload, error } = buildPayload(current.form);
    if (!payload) return setFeedback("main", "error", error, true);
    clearFeedback("main");
    update({ entryBusy: true });
    const result = await upsertEncryptedVaultItems([await encryptCredentialItem(payload, current.masterKey)]);
    if (!result.ok) {
      update({ entryBusy: false });
      return setFeedback("main", "error", result.error, true);
    }
    const credentials = replaceById(current.credentials, payload);
    update({ credentials, form: createEmptyForm(current.form.domain || current.currentHost), entryBusy: false, page: 1 });
    setFeedback("main", "success", "บันทึกข้อมูลแล้ว");
  }

  async function deleteCredential(id) {
    if (!(await keepVaultSessionAlive())) return;
    clearFeedback("main");
    const result = await deleteVaultItem(id);
    if (!result.ok) return setFeedback("main", "error", result.error, true);
    const current = get(state);
    update({ credentials: current.credentials.filter((item) => item.id !== id), form: current.form.id === id ? createEmptyForm(current.form.domain || current.currentHost) : current.form, page: 1 });
    setFeedback("main", "success", "ลบข้อมูลแล้ว");
  }

  async function togglePin(id) {
    const current = get(state);
    const item = current.credentials.find((entry) => entry.id === id);
    if (!item || !current.masterKey || !(await keepVaultSessionAlive())) return;
    const nextItem = { ...item, pinned: !item.pinned, updatedAt: Date.now() };
    const result = await upsertEncryptedVaultItems([await encryptCredentialItem(nextItem, current.masterKey)]);
    if (!result.ok) return setFeedback("main", "error", result.error, true);
    update({ credentials: current.credentials.map((entry) => (entry.id === id ? nextItem : entry)) });
    setFeedback("main", "success", "อัปเดตปักหมุดแล้ว");
  }

  async function copyAndTrack(id, value) {
    const current = get(state);
    if (!value || !current.masterKey || !(await keepVaultSessionAlive())) return;
    update({ copyBusyId: id });
    await navigator.clipboard.writeText(value);
    await markUsed(id);
    update({ copyBusyId: "" });
    setFeedback("main", "success", "คัดลอกแล้ว");
  }

  async function signInSupabaseOAuth() {
    clearFeedback("settings");
    const current = get(state);
    if (!current.supabaseUrl) return setFeedback("settings", "error", "ยังไม่ได้ตั้งค่า Supabase ผ่าน .env", true);
    update({ oauthBusy: true });
    const result = await signInWithOAuthProvider(current.supabaseProvider);
    if (!result.ok) {
      update({ oauthBusy: false });
      return setFeedback("settings", "error", result.error, true);
    }
    update({ supabaseSessionEmail: result.sessionEmail || "", oauthBusy: false });
    setFeedback("settings", "success", `ล็อกอิน OAuth สำเร็จ (${get(state).supabaseProvider})`);
    await reconcileSecurityProfile(false);
    if (get(state).masterKey) await hydrateCloudVault(true);
  }

  async function signOutFromSupabaseAction() {
    update({ signOutBusy: true });
    await signOutSupabase();
    update({ supabaseSessionEmail: "", credentials: [], signOutBusy: false });
    setFeedback("settings", "success", "ออกจากระบบ Supabase แล้ว");
  }

  async function hydrateCloudVault(silent = false) {
    const current = get(state);
    if (!current.masterKey) {
      if (!silent) setFeedback("settings", "error", "ต้องปลดล็อก Vault ก่อนโหลดข้อมูล", true);
      return;
    }
    if (!(await keepVaultSessionAlive(silent))) return;
    clearFeedback("settings");
    update({ pullBusy: true });
    if (!silent) setFeedback("settings", "info", "กำลังโหลดข้อมูลจาก cloud...", true);
    const legacyItems = await getLegacyEncryptedVaultItems();
    if (legacyItems.length) {
      const legacyPush = await upsertEncryptedVaultItems(legacyItems);
      if (!legacyPush.ok) {
        update({ pullBusy: false });
        return setFeedback("settings", "error", legacyPush.error, true);
      }
      await clearLegacyEncryptedVaultItems();
    }
    const result = await listEncryptedVaultItems();
    if (!result.ok) {
      update({ pullBusy: false });
      if (!silent || result.error !== "ยังไม่ได้ login Supabase") setFeedback("settings", "error", result.error, true);
      return;
    }
    const decryptResult = await decryptEncryptedVaultItems(result.items, current.masterKey);
    update({ credentials: decryptResult.credentials, pullBusy: false, page: 1 });
    if (decryptResult.failedCount > 0) return setFeedback("settings", "error", `โหลดข้อมูลจาก cloud ได้ แต่ถอดรหัสไม่ได้ ${decryptResult.failedCount} รายการ`, true);
    if (!silent) setFeedback("settings", "success", `โหลดข้อมูลจาก cloud แล้ว ${decryptResult.credentials.length} รายการ`);
  }

  async function reconcileSecurityProfile(silent = false) {
    const current = get(state);
    if (!current.supabaseSessionEmail) return;
    const localProfile = await getLocalSecurityProfile();
    const cloudResult = await readCloudSecurityProfile();
    if (!cloudResult.ok) {
      if (!silent && cloudResult.error !== "ยังไม่ได้ login Supabase") setFeedback("settings", "error", cloudResult.error, true);
      return;
    }
    if (cloudResult.profile) {
      if (!isSameSecurityProfile(localProfile, cloudResult.profile)) {
        await saveLocalSecurityProfile(cloudResult.profile);
        if (get(state).authMode === "setup") update({ authMode: "locked" });
      }
      return;
    }
    if (localProfile?.verifier) {
      const saveResult = await saveCloudSecurityProfile(localProfile);
      if (!saveResult.ok) return !silent && setFeedback("settings", "error", saveResult.error, true);
      if (!silent) setFeedback("settings", "success", "อัปโหลด security profile ขึ้น cloud แล้ว");
    }
  }

  async function keepVaultSessionAlive(silent = false) {
    const active = await touchVaultSession();
    if (!active) {
      applyLockedState(`Vault ถูกล็อกอัตโนมัติหลังไม่ใช้งาน ${AUTO_LOCK_MINUTES} นาที`, !silent, "info");
      return false;
    }
    await scheduleVaultAutoLock();
    return true;
  }

  async function scheduleVaultAutoLock() {
    if (vaultAutoLockTimerId) clearTimeout(vaultAutoLockTimerId);
    if (get(state).authMode !== "ready") return;
    const expiresAt = await getVaultSessionExpiry();
    if (!expiresAt) return;
    vaultAutoLockTimerId = setTimeout(() => void expireVaultSession(), Math.max(0, expiresAt - Date.now()));
  }

  async function expireVaultSession() {
    await lockVaultSession();
    applyLockedState(`Vault ถูกล็อกอัตโนมัติหลังไม่ใช้งาน ${AUTO_LOCK_MINUTES} นาที`, true, "info");
  }

  function applyLockedState(message, sticky = false, type = "success") {
    if (vaultAutoLockTimerId) clearTimeout(vaultAutoLockTimerId);
    update({ authMode: "locked", masterKey: null, credentials: [] });
    clearFeedback("main");
    clearFeedback("settings");
    setFeedback("vault", type, message, sticky);
  }

  function clearFeedback(scope) {
    update({ [`${scope}Feedback`]: emptyFeedback() });
  }

  function setFeedback(scope, type, text, sticky = false) {
    update({ [`${scope}Feedback`]: { type, text } });
    if (feedbackTimerId) clearTimeout(feedbackTimerId);
    if (!sticky) feedbackTimerId = setTimeout(() => clearFeedback(scope), 2600);
  }

  async function markUsed(id) {
    const current = get(state);
    const item = current.credentials.find((entry) => entry.id === id);
    if (!item || !current.masterKey || !(await keepVaultSessionAlive())) return;
    const nextItem = { ...item, lastUsedAt: Date.now(), updatedAt: Date.now() };
    const result = await upsertEncryptedVaultItems([await encryptCredentialItem(nextItem, current.masterKey)]);
    if (!result.ok) return setFeedback("main", "error", result.error, true);
    update({ credentials: current.credentials.map((entry) => (entry.id === id ? nextItem : entry)) });
  }

  return {
    view, init, destroy, renderIcon, closePopup: () => window.close(), openSetupInTab: () => window.open(chrome.runtime.getURL("src/popup/popup.html"), "_blank", "noopener,noreferrer"), setSetupPassword: (value) => update({ setupPassword: value }), setSetupConfirm: (value) => update({ setupConfirm: value }), setUnlockPassword: (value) => update({ unlockPassword: value }), setSupabaseProvider: (value) => update({ supabaseProvider: value }), setMainTab: (value) => update({ activeMainTab: value }), toggleSettings: () => update({ showSettings: !get(state).showSettings }), setFormField: (field, value) => update({ form: { ...get(state).form, [field]: value } }), clearForm: () => update({ form: createEmptyForm(get(state).form.domain || get(state).currentHost) }), editCredential: (item) => update({ form: formFromItem(item) }), setSearch: (value) => update({ search: value, page: 1 }), setTab: (value) => update({ tab: value, page: 1 }), setScope: (value) => update({ scope: value, page: 1 }), prevPage: () => update({ page: Math.max(1, buildViewModel(get(state)).page - 1) }), nextPage: () => update({ page: Math.min(buildViewModel(get(state)).totalPages, buildViewModel(get(state)).page + 1) }), submitSetupMasterPassword, submitUnlockVault, lockVault, saveCredential, deleteCredential, togglePin, copyAndTrack, signInSupabaseOAuth, signOutFromSupabase: signOutFromSupabaseAction, hydrateCloudVault
  };
}

function updateState(current, payload) {
  return { ...current, ...payload };
}

function replaceById(items, nextItem) {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index < 0) return [...items, nextItem];
  const next = items.slice();
  next[index] = nextItem;
  return next;
}

function isSameSecurityProfile(left, right) {
  return left?.strategy === right?.strategy &&
    Number(left?.iterations) === Number(right?.iterations) &&
    left?.verifier?.cipherBase64 === right?.verifier?.cipherBase64 &&
    left?.verifier?.ivBase64 === right?.verifier?.ivBase64;
}
