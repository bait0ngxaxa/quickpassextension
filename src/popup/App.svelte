<script>
  import { onDestroy, onMount } from "svelte";
  import { buildPayload, createEmptyForm, formFromItem, getItemSubtitle, getItemTitle } from "./form.js";
  import { filterAndSortCredentials, groupByDomain } from "./listing.js";
  import {
    ENTRY_TYPE_LOGIN,
    ENTRY_TYPE_SECRET,
    SCOPE_ALL,
    SCOPE_CROSS,
    SCOPE_CURRENT,
    SCOPE_PINNED,
    TAB_ALL,
    TAB_LOGIN,
    TAB_SECRET
  } from "./constants.js";
  import { encryptCredentialItem, normalizeHost } from "./vault.js";
  import { AUTO_LOCK_MINUTES, getVaultSessionExpiry, touchVaultSession } from "../shared/vaultSession.js";
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
  import { readCloudSecurityProfile, saveCloudSecurityProfile } from "../supabase/securityStore.js";
  import { deleteVaultItem, listEncryptedVaultItems, upsertEncryptedVaultItems } from "../supabase/vaultStore.js";
  import { readSupabaseSetup, signInWithOAuthProvider, signOutSupabase } from "./supabaseService.js";

  let authMode = "loading";
  let setupPassword = "";
  let setupConfirm = "";
  let unlockPassword = "";
  let masterKey = null;
  let currentHost = "";
  let credentials = [];
  let form = createEmptyForm();
  let search = "";
  let tab = TAB_ALL;
  let scope = SCOPE_ALL;
  let page = 1;
  const pageSize = 20;
  let supabaseUrl = "";
  let supabaseSessionEmail = "";
  let supabaseProvider = "google";
  let feedbackTimerId = null;
  let activeMainTab = "save";
  let showSettings = false;
  let supabaseConfigStatus = "not_ready";
  let mainFeedback = { type: "", text: "" };
  let vaultFeedback = { type: "", text: "" };
  let settingsFeedback = { type: "", text: "" };
  let setupBusy = false;
  let unlockBusy = false;
  let lockBusy = false;
  let entryBusy = false;
  let copyBusyId = "";
  let oauthBusy = false;
  let signOutBusy = false;
  let pullBusy = false;
  let vaultAutoLockTimerId = null;

  const tabs = [
    { value: TAB_ALL, label: "ทั้งหมด" },
    { value: TAB_LOGIN, label: "บัญชีล็อกอิน" },
    { value: TAB_SECRET, label: "API/Secret" }
  ];
  const scopes = [
    { value: SCOPE_ALL, label: "ทุกโดเมน" },
    { value: SCOPE_CURRENT, label: "โดเมนนี้" },
    { value: SCOPE_CROSS, label: "ข้ามโดเมน" },
    { value: SCOPE_PINNED, label: "ปักหมุด" }
  ];

  $: filtered = filterAndSortCredentials(credentials, { search, tab, scope, currentHost });
  $: totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  $: if (page > totalPages) page = totalPages;
  $: pagedItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  $: groupedItems = groupByDomain(pagedItems, currentHost);
  $: isSecretType = form.kind === ENTRY_TYPE_SECRET;

  onMount(async () => {
    await prefillHost();
    await initializeVaultState();
    await initializeSupabaseState();
    if (masterKey && supabaseSessionEmail) {
      await hydrateCloudVault(true);
    }
  });

  onDestroy(() => {
    if (feedbackTimerId) {
      clearTimeout(feedbackTimerId);
    }
    if (vaultAutoLockTimerId) {
      clearTimeout(vaultAutoLockTimerId);
    }
  });

  async function prefillHost() {
    const [tabInfo] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabInfo?.url) return;
    try {
      const host = normalizeHost(new URL(tabInfo.url).hostname);
      currentHost = host;
      if (!form.domain) {
        form = { ...form, domain: host };
      }
    } catch (_error) {}
  }

  async function initializeVaultState() {
    const state = await initializeVault();
    authMode = state.mode;
    masterKey = state.key;
    credentials = state.credentials;
    if (authMode === "ready") {
      await scheduleVaultAutoLock();
    }
  }

  async function initializeSupabaseState() {
    const setup = await readSupabaseSetup();
    supabaseUrl = setup.config.url || "";
    supabaseSessionEmail = setup.sessionEmail || "";
    supabaseConfigStatus = supabaseUrl && !setup.setupError ? "ok" : "not_ready";
    if (setup.setupError) {
      setFeedback("settings", "error", setup.setupError, true);
    }
    if (supabaseSessionEmail) {
      await reconcileSecurityProfile(true);
    }
  }

  async function handleSetupMasterPassword(event) {
    event.preventDefault();
    clearFeedback("vault");
    const password = setupPassword.trim();
    if (password.length < 8) return setFeedback("vault", "error", "Master Password ต้องยาวอย่างน้อย 8 ตัวอักษร", true);
    if (password !== setupConfirm.trim()) return setFeedback("vault", "error", "ยืนยันรหัสผ่านไม่ตรงกัน", true);

    setupBusy = true;
    const result = await setupMasterPassword(password);

    setupPassword = "";
    setupConfirm = "";
    masterKey = result.key;
    credentials = result.credentials;
    authMode = "ready";
    setupBusy = false;
    setFeedback("vault", "success", "ตั้งค่า Master Password เรียบร้อย");
    await scheduleVaultAutoLock();
    await reconcileSecurityProfile(true);
    if (supabaseSessionEmail) {
      await hydrateCloudVault(true);
    }
  }

  async function handleUnlockVault(event) {
    event.preventDefault();
    clearFeedback("vault");
    unlockBusy = true;
    const result = await unlockVault(unlockPassword);
    if (!result.ok) {
      unlockBusy = false;
      setFeedback(
        "vault",
        "error",
        result.reason === "invalid_password" ? "Master Password ไม่ถูกต้อง" : "ไม่สามารถปลดล็อกได้ ลองใหม่อีกครั้ง",
        true
      );
      return;
    }
    unlockPassword = "";
    masterKey = result.key;
    credentials = result.credentials;
    authMode = "ready";
    unlockBusy = false;
    setFeedback(
      "vault",
      "success",
      result.reason === "migrated"
        ? "ปลดล็อก Vault แล้ว และอัปเกรดคีย์สำหรับการ sync ข้ามเครื่องให้แล้ว"
        : "ปลดล็อก Vault แล้ว"
    );
    await scheduleVaultAutoLock();
    await reconcileSecurityProfile(true);
    if (supabaseSessionEmail) {
      await hydrateCloudVault(true);
    }
  }

  async function lockVault() {
    lockBusy = true;
    await lockVaultSession();
    lockBusy = false;
    applyLockedState("ล็อก Vault แล้ว");
  }

  async function saveCredential(event) {
    event.preventDefault();
    if (!masterKey) return;
    if (!(await keepVaultSessionAlive())) return;
    const { payload, error } = buildPayload(form);
    if (!payload) return setFeedback("main", "error", error, true);
    clearFeedback("main");
    entryBusy = true;
    const encryptedItem = await encryptCredentialItem(payload, masterKey);
    const result = await upsertEncryptedVaultItems([encryptedItem]);
    if (!result.ok) {
      entryBusy = false;
      setFeedback("main", "error", result.error, true);
      return;
    }

    const next = credentials.slice();
    const idx = next.findIndex((item) => item.id === payload.id);
    if (idx >= 0) {
      next[idx] = payload;
    } else {
      next.push(payload);
    }
    credentials = next;
    clearForm();
    entryBusy = false;
    setFeedback("main", "success", "บันทึกข้อมูลแล้ว");
  }

  function clearForm() {
    form = createEmptyForm(form.domain || currentHost);
  }

  function editCredential(item) {
    form = formFromItem(item);
  }

  async function deleteCredential(id) {
    if (!(await keepVaultSessionAlive())) return;
    clearFeedback("main");
    const result = await deleteVaultItem(id);
    if (!result.ok) {
      setFeedback("main", "error", result.error, true);
      return;
    }
    credentials = credentials.filter((item) => item.id !== id);
    if (form.id === id) clearForm();
    setFeedback("main", "success", "ลบข้อมูลแล้ว");
  }

  async function togglePin(id) {
    const current = credentials.find((item) => item.id === id);
    if (!current || !masterKey) return;
    if (!(await keepVaultSessionAlive())) return;
    const nextItem = { ...current, pinned: !current.pinned, updatedAt: Date.now() };
    const result = await upsertEncryptedVaultItems([await encryptCredentialItem(nextItem, masterKey)]);
    if (!result.ok) {
      setFeedback("main", "error", result.error, true);
      return;
    }
    credentials = credentials.map((item) => (item.id === id ? nextItem : item));
    setFeedback("main", "success", "อัปเดตปักหมุดแล้ว");
  }

  async function markUsed(id) {
    if (!masterKey) return;
    if (!(await keepVaultSessionAlive())) return;
    const current = credentials.find((item) => item.id === id);
    if (!current) return;
    const now = Date.now();
    const nextItem = { ...current, lastUsedAt: now, updatedAt: now };
    const result = await upsertEncryptedVaultItems([await encryptCredentialItem(nextItem, masterKey)]);
    if (!result.ok) {
      setFeedback("main", "error", result.error, true);
      return;
    }
    credentials = credentials.map((item) => (item.id === id ? nextItem : item));
  }

  async function copyAndTrack(id, value) {
    if (!value) return;
    if (!(await keepVaultSessionAlive())) return;
    copyBusyId = id;
    await navigator.clipboard.writeText(value);
    await markUsed(id);
    copyBusyId = "";
    setFeedback("main", "success", "คัดลอกแล้ว");
  }

  async function signOutFromSupabase() {
    signOutBusy = true;
    await signOutSupabase();
    supabaseSessionEmail = "";
    credentials = [];
    signOutBusy = false;
    setFeedback("settings", "success", "ออกจากระบบ Supabase แล้ว");
  }

  function openSetupInTab() {
    window.open(chrome.runtime.getURL("src/popup/popup.html"), "_blank", "noopener,noreferrer");
  }

  function closePopup() {
    window.close();
  }

  async function signInSupabaseOAuth() {
    clearFeedback("settings");
    if (!supabaseUrl) {
      setFeedback("settings", "error", "ยังไม่ได้ตั้งค่า Supabase ผ่าน .env", true);
      return;
    }
    oauthBusy = true;
    const result = await signInWithOAuthProvider(supabaseProvider);
    if (!result.ok) {
      oauthBusy = false;
      setFeedback("settings", "error", result.error, true);
      return;
    }
    supabaseSessionEmail = result.sessionEmail || "";
    oauthBusy = false;
    setFeedback("settings", "success", `ล็อกอิน OAuth สำเร็จ (${supabaseProvider})`);
    await reconcileSecurityProfile(false);
    if (masterKey) {
      await hydrateCloudVault(true);
    }
  }

  async function hydrateCloudVault(silent = false) {
    if (!masterKey) {
      if (!silent) {
        setFeedback("settings", "error", "ต้องปลดล็อก Vault ก่อนโหลดข้อมูล", true);
      }
      return;
    }
    if (!(await keepVaultSessionAlive(silent))) return;

    clearFeedback("settings");
    pullBusy = true;
    if (!silent) {
      setFeedback("settings", "info", "กำลังโหลดข้อมูลจาก cloud...", true);
    }

    const legacyItems = await getLegacyEncryptedVaultItems();
    if (legacyItems.length) {
      const legacyPush = await upsertEncryptedVaultItems(legacyItems);
      if (!legacyPush.ok) {
        pullBusy = false;
        setFeedback("settings", "error", legacyPush.error, true);
        return;
      }
      await clearLegacyEncryptedVaultItems();
    }

    const result = await listEncryptedVaultItems();
    if (!result.ok) {
      pullBusy = false;
      if (!silent || result.error !== "ยังไม่ได้ login Supabase") {
        setFeedback("settings", "error", result.error, true);
      }
      return;
    }

    const decryptResult = await decryptEncryptedVaultItems(result.items, masterKey);
    credentials = decryptResult.credentials;
    resetPagination();
    pullBusy = false;

    if (decryptResult.failedCount > 0) {
      setFeedback(
        "settings",
        "error",
        `โหลดข้อมูลจาก cloud ได้ แต่ถอดรหัสไม่ได้ ${decryptResult.failedCount} รายการ`,
        true
      );
      return;
    }

    if (!silent) {
      setFeedback("settings", "success", `โหลดข้อมูลจาก cloud แล้ว ${decryptResult.credentials.length} รายการ`);
    }
  }

  async function reconcileSecurityProfile(silent = false) {
    if (!supabaseSessionEmail) {
      return;
    }

    const localProfile = await getLocalSecurityProfile();
    const cloudResult = await readCloudSecurityProfile();
    if (!cloudResult.ok) {
      if (!silent && cloudResult.error !== "ยังไม่ได้ login Supabase") {
        setFeedback("settings", "error", cloudResult.error, true);
      }
      return;
    }

    if (cloudResult.profile) {
      if (!isSameSecurityProfile(localProfile, cloudResult.profile)) {
        await saveLocalSecurityProfile(cloudResult.profile);
        if (authMode === "setup") {
          authMode = "locked";
        }
      }
      return;
    }

    if (localProfile?.verifier) {
      const saveResult = await saveCloudSecurityProfile(localProfile);
      if (!saveResult.ok) {
        if (!silent) {
          setFeedback("settings", "error", saveResult.error, true);
        }
        return;
      }

      if (!silent) {
        setFeedback("settings", "success", "อัปโหลด security profile ขึ้น cloud แล้ว");
      }
    }
  }

  function resetPagination() {
    page = 1;
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
    if (vaultAutoLockTimerId) {
      clearTimeout(vaultAutoLockTimerId);
      vaultAutoLockTimerId = null;
    }

    if (authMode !== "ready") {
      return;
    }

    const expiresAt = await getVaultSessionExpiry();
    if (!expiresAt) {
      return;
    }

    const delay = Math.max(0, expiresAt - Date.now());
    vaultAutoLockTimerId = setTimeout(() => {
      void expireVaultSession();
    }, delay);
  }

  async function expireVaultSession() {
    await lockVaultSession();
    applyLockedState(`Vault ถูกล็อกอัตโนมัติหลังไม่ใช้งาน ${AUTO_LOCK_MINUTES} นาที`, true, "info");
  }

  function applyLockedState(message, sticky = false, type = "success") {
    if (vaultAutoLockTimerId) {
      clearTimeout(vaultAutoLockTimerId);
      vaultAutoLockTimerId = null;
    }
    masterKey = null;
    credentials = [];
    authMode = "locked";
    clearFeedback("main");
    clearFeedback("settings");
    setFeedback("vault", type, message, sticky);
  }

  function applySearch(event) {
    search = event.currentTarget.value;
    resetPagination();
  }

  function setTab(value) {
    tab = value;
    resetPagination();
  }

  function setScope(value) {
    scope = value;
    resetPagination();
  }

  function prevPage() {
    if (page > 1) page -= 1;
  }

  function nextPage() {
    if (page < totalPages) page += 1;
  }

  function maskAnonKey(value) {
    const raw = String(value || "");
    if (raw.length <= 12) return raw;
    return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
  }

  function setMainTab(value) {
    activeMainTab = value;
  }

  function toggleSettings() {
    showSettings = !showSettings;
  }

  function clearFeedback(scope) {
    if (scope === "main") mainFeedback = { type: "", text: "" };
    if (scope === "vault") vaultFeedback = { type: "", text: "" };
    if (scope === "settings") settingsFeedback = { type: "", text: "" };
  }

  function setFeedback(scope, type, text, sticky = false) {
    const next = { type, text };
    if (scope === "main") mainFeedback = next;
    if (scope === "vault") vaultFeedback = next;
    if (scope === "settings") settingsFeedback = next;

    if (feedbackTimerId) {
      clearTimeout(feedbackTimerId);
      feedbackTimerId = null;
    }

    if (!sticky) {
      feedbackTimerId = setTimeout(() => {
        clearFeedback(scope);
        feedbackTimerId = null;
      }, 2600);
    }
  }

  function isSameSecurityProfile(left, right) {
    return (
      left?.strategy === right?.strategy &&
      Number(left?.iterations) === Number(right?.iterations) &&
      left?.verifier?.cipherBase64 === right?.verifier?.cipherBase64 &&
      left?.verifier?.ivBase64 === right?.verifier?.ivBase64
    );
  }
</script>

<main class="container">
  <header class="top-header">
    <div>
      <h1>Quick Pass Copy</h1>
      <p>โหมดใช้งานหลัก: บันทึก / รายการ</p>
    </div>
    <div class="header-actions">
      {#if authMode === "ready"}
        <button type="button" class="secondary gear-btn" on:click={toggleSettings}>⚙</button>
      {/if}
      <button type="button" class="secondary close-btn" on:click={closePopup}>ปิด</button>
    </div>
  </header>

  {#if authMode === "loading"}
    <section class="card"><div class="empty">กำลังโหลด...</div></section>
  {:else if authMode === "setup"}
    <form class="card" on:submit={handleSetupMasterPassword}>
      <h2>ตั้งค่า Master Password</h2>
      <label>Master Password<input type="password" bind:value={setupPassword} required /></label>
      <label>ยืนยัน Master Password<input type="password" bind:value={setupConfirm} required /></label>
      <button type="submit" disabled={setupBusy}>{setupBusy ? "กำลังตั้งค่า..." : "ตั้งค่าและปลดล็อก"}</button>
      {#if vaultFeedback.text}<div class={"feedback " + vaultFeedback.type}>{vaultFeedback.text}</div>{/if}
    </form>
  {:else if authMode === "locked"}
    <form class="card" on:submit={handleUnlockVault}>
      <h2>ปลดล็อก Vault</h2>
      <label>Master Password<input type="password" bind:value={unlockPassword} required /></label>
      <button type="submit" disabled={unlockBusy}>{unlockBusy ? "กำลังปลดล็อก..." : "ปลดล็อก"}</button>
      {#if vaultFeedback.text}<div class={"feedback " + vaultFeedback.type}>{vaultFeedback.text}</div>{/if}
    </form>
  {:else}
    {#if showSettings}
      <section class="card">
        <h2>Settings</h2>
        {#if settingsFeedback.text}<div class={"feedback " + settingsFeedback.type}>{settingsFeedback.text}</div>{/if}
        <div class="inline-actions">
          <button type="button" class="secondary" on:click={openSetupInTab}>เปิดหน้าตั้งค่าในแท็บ</button>
        </div>
        <div class="saved-config">
          <div class="saved-title">Supabase Config</div>
          <div class="status-row">
            <span class="status-label">สถานะ</span>
            <span class={supabaseConfigStatus === "ok" ? "status-pill success" : "status-pill muted"}>
              {supabaseConfigStatus === "ok" ? "OK" : "ไม่พร้อมใช้งาน"}
            </span>
          </div>
          <div class="saved-text">URL: {supabaseUrl || "ยังไม่ได้ตั้งค่า"}</div>
          <div class="saved-text">
            {supabaseConfigStatus === "ok"
              ? "โหลดค่า .env สำเร็จ"
              : "โหลดค่า .env ไม่สำเร็จ หรือยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"}
          </div>
        </div>

        {#if supabaseSessionEmail}
          <div class="saved-config oauth-row">
            <div class="saved-title">ล็อกอินแล้ว</div>
            <div class="saved-text">{supabaseSessionEmail}</div>
            <div class="status-pill success">พร้อมใช้งาน</div>
            <div class="inline-actions">
              <button type="button" class="secondary" on:click={signOutFromSupabase} disabled={signOutBusy}>
                {signOutBusy ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
              </button>
            </div>
          </div>
        {:else}
          <div class="stack oauth-row">
            <label>
              OAuth Provider
              <select bind:value={supabaseProvider}>
                <option value="google">Google</option>
                <option value="github">GitHub</option>
                <option value="discord">Discord</option>
              </select>
            </label>
            <button type="button" on:click={signInSupabaseOAuth} disabled={oauthBusy}>
              {oauthBusy ? "กำลังเปิด OAuth..." : "ล็อกอินด้วย OAuth"}
            </button>
          </div>
        {/if}
        <div class="actions">
          <button type="button" class="secondary" on:click={() => hydrateCloudVault(false)} disabled={pullBusy}>
            {pullBusy ? "กำลังโหลด..." : "โหลดข้อมูลจาก Cloud ใหม่"}
          </button>
        </div>
      </section>
    {:else}
      <section class="main-tabs">
        <button
          type="button"
          class={activeMainTab === "save" ? "main-tab-btn active" : "main-tab-btn"}
          on:click={() => setMainTab("save")}
        >
          บันทึก
        </button>
        <button
          type="button"
          class={activeMainTab === "list" ? "main-tab-btn active" : "main-tab-btn"}
          on:click={() => setMainTab("list")}
        >
          รายการ
        </button>
      </section>

      <section class="card">
        <div class="security-row">
          <h2>สถานะ</h2>
          <button type="button" class="secondary" on:click={lockVault} disabled={lockBusy}>
            {lockBusy ? "กำลังล็อก..." : "ล็อก Vault"}
          </button>
        </div>
        <div class="status-grid">
          <div class="status-card">
            <span class="status-label">Vault</span>
            <span class="status-pill success">ปลดล็อกแล้ว</span>
          </div>
          <div class="status-card">
            <span class="status-label">Cloud</span>
            {#if supabaseSessionEmail}
              <span class="status-pill success">เชื่อมแล้ว</span>
            {:else}
              <span class="status-pill muted">ยังไม่เชื่อม</span>
            {/if}
          </div>
        </div>
        <div class="saved-text">
          Cloud:
          {#if supabaseSessionEmail}
            Login อยู่ {supabaseSessionEmail}
          {:else}
            ยังไม่ได้ล็อกอิน
          {/if}
        </div>
        {#if mainFeedback.text}<div class={"feedback " + mainFeedback.type}>{mainFeedback.text}</div>{/if}
      </section>

      {#if activeMainTab === "save"}
        <form class="card" on:submit={saveCredential}>
          <input type="hidden" bind:value={form.id} />
          <label>ประเภทข้อมูล<select bind:value={form.kind}><option value={ENTRY_TYPE_LOGIN}>บัญชีล็อกอิน</option><option value={ENTRY_TYPE_SECRET}>API Key / Secret</option></select></label>
          <label>โดเมน<input type="text" required bind:value={form.domain} /></label>
          <label>ป้ายชื่อ<input type="text" bind:value={form.label} /></label>
          {#if isSecretType}
            <label>ชื่อคีย์<input type="text" bind:value={form.secretName} /></label>
            <label>ค่า Secret<input type="text" required bind:value={form.secretValue} /></label>
          {:else}
            <label>Username / Email<input type="text" required bind:value={form.username} /></label>
            <label>Password<input type="text" required bind:value={form.password} /></label>
          {/if}
          <div class="actions">
            <button type="submit" disabled={entryBusy}>{entryBusy ? "กำลังบันทึก..." : "บันทึก"}</button>
            <button type="button" class="secondary" on:click={clearForm} disabled={entryBusy}>ล้างฟอร์ม</button>
          </div>
        </form>
      {:else}
        <section class="card">
          <h2>รายการที่บันทึกไว้</h2>
          <input class="search-input" type="text" placeholder="ค้นหาโดเมน / ชื่อ / key" bind:value={search} on:input={applySearch} />
          <div class="chips">{#each tabs as item}<button type="button" class={tab === item.value ? "chip active" : "chip"} on:click={() => setTab(item.value)}>{item.label}</button>{/each}</div>
          <div class="chips">{#each scopes as item}<button type="button" class={scope === item.value ? "chip active" : "chip"} on:click={() => setScope(item.value)}>{item.label}</button>{/each}</div>
          <div class="pagination-row">
            <div class="pagination-text">ทั้งหมด {filtered.length} รายการ · หน้า {page}/{totalPages}</div>
            <div class="pagination-actions">
              <button type="button" class="secondary" on:click={prevPage} disabled={page <= 1}>ก่อนหน้า</button>
              <button type="button" class="secondary" on:click={nextPage} disabled={page >= totalPages}>ถัดไป</button>
            </div>
          </div>
          {#if groupedItems.length === 0}
            <div class="empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
          {:else}
            {#each groupedItems as group}
              <div class="group-head">{group.domain}{#if group.isCurrent} · โดเมนปัจจุบัน{/if}</div>
              <div class="list">
                {#each group.items as item (item.id)}
                  <article class="item">
                    <div class="item-text"><div class="item-title">{item.pinned ? "★ " : ""}{getItemTitle(item)}</div><div class="item-sub">{getItemSubtitle(item)}</div></div>
                    <div class="item-actions">
                      {#if item.kind === ENTRY_TYPE_SECRET}
                        <button type="button" on:click={() => copyAndTrack(item.id, item.secretValue)} disabled={copyBusyId === item.id}>
                          {copyBusyId === item.id ? "กำลังคัดลอก..." : "คัดลอก Secret"}
                        </button>
                        <button type="button" class="secondary" on:click={() => copyAndTrack(item.id, item.secretName)} disabled={copyBusyId === item.id}>คัดลอกชื่อคีย์</button>
                      {:else}
                        <button type="button" on:click={() => copyAndTrack(item.id, item.password)} disabled={copyBusyId === item.id}>
                          {copyBusyId === item.id ? "กำลังคัดลอก..." : "คัดลอกรหัส"}
                        </button>
                        <button type="button" class="secondary" on:click={() => copyAndTrack(item.id, item.username)} disabled={copyBusyId === item.id}>คัดลอกผู้ใช้</button>
                      {/if}
                      <button type="button" class="secondary" on:click={() => togglePin(item.id)}>{item.pinned ? "ยกเลิกปักหมุด" : "ปักหมุด"}</button>
                      <button type="button" class="secondary" on:click={() => editCredential(item)}>แก้ไข</button>
                      <button type="button" class="danger" on:click={() => deleteCredential(item.id)}>ลบ</button>
                    </div>
                  </article>
                {/each}
              </div>
            {/each}
          {/if}
        </section>
      {/if}
    {/if}
  {/if}
</main>
