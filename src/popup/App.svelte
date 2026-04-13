<script>
  import { onMount } from "svelte";
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
  import { normalizeHost } from "./vault.js";
  import { initializeVault, lockVault as lockVaultSession, persistCredentials, setupMasterPassword, unlockVault } from "./vaultService.js";

  let authMode = "loading";
  let authError = "";
  let notice = "";
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
  }

  async function handleSetupMasterPassword(event) {
    event.preventDefault();
    authError = "";
    notice = "";
    const password = setupPassword.trim();
    if (password.length < 8) return (authError = "Master Password ต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (password !== setupConfirm.trim()) return (authError = "ยืนยันรหัสผ่านไม่ตรงกัน");

    const result = await setupMasterPassword(password);

    setupPassword = "";
    setupConfirm = "";
    masterKey = result.key;
    credentials = result.credentials;
    authMode = "ready";
    notice = "ตั้งค่า Master Password เรียบร้อย";
  }

  async function handleUnlockVault(event) {
    event.preventDefault();
    authError = "";
    notice = "";
    const result = await unlockVault(unlockPassword);
    if (!result.ok) {
      authError = result.reason === "invalid_password" ? "Master Password ไม่ถูกต้อง" : "ไม่สามารถปลดล็อกได้ ลองใหม่อีกครั้ง";
      return;
    }
    unlockPassword = "";
    masterKey = result.key;
    credentials = result.credentials;
    authMode = "ready";
    notice = "ปลดล็อก Vault แล้ว";
  }

  async function lockVault() {
    await lockVaultSession();
    masterKey = null;
    credentials = [];
    authMode = "locked";
    notice = "";
  }

  async function persist(nextCredentials) {
    if (!masterKey) return;
    await persistCredentials(nextCredentials, masterKey);
    credentials = nextCredentials;
  }

  async function saveCredential(event) {
    event.preventDefault();
    if (!masterKey) return;
    const { payload, error } = buildPayload(form);
    if (!payload) return (authError = error);
    authError = "";

    const next = credentials.slice();
    const idx = next.findIndex((item) => item.id === payload.id);
    if (idx >= 0) next[idx] = payload;
    else next.push(payload);
    await persist(next);
    clearForm();
    notice = "บันทึกข้อมูลแล้ว";
  }

  function clearForm() {
    form = createEmptyForm(form.domain || currentHost);
  }

  function editCredential(item) {
    form = formFromItem(item);
  }

  async function deleteCredential(id) {
    await persist(credentials.filter((item) => item.id !== id));
    if (form.id === id) clearForm();
    notice = "ลบข้อมูลแล้ว";
  }

  async function togglePin(id) {
    const next = credentials.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item));
    await persist(next);
  }

  async function markUsed(id) {
    const now = Date.now();
    const next = credentials.map((item) => (item.id === id ? { ...item, lastUsedAt: now } : item));
    await persist(next);
  }

  async function copyAndTrack(id, value) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    await markUsed(id);
    notice = "คัดลอกแล้ว";
  }

  function resetPagination() {
    page = 1;
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
</script>

<main class="container">
  <header>
    <h1>Quick Pass Copy</h1>
    <p>ค้นหาได้เร็วขึ้นด้วย Search / Tabs / Filter / Pin</p>
  </header>

  {#if authMode === "loading"}
    <section class="card"><div class="empty">กำลังโหลด...</div></section>
  {:else if authMode === "setup"}
    <form class="card" on:submit={handleSetupMasterPassword}>
      <h2>ตั้งค่า Master Password</h2>
      <label>Master Password<input type="password" bind:value={setupPassword} required /></label>
      <label>ยืนยัน Master Password<input type="password" bind:value={setupConfirm} required /></label>
      <button type="submit">ตั้งค่าและปลดล็อก</button>
    </form>
  {:else if authMode === "locked"}
    <form class="card" on:submit={handleUnlockVault}>
      <h2>ปลดล็อก Vault</h2>
      <label>Master Password<input type="password" bind:value={unlockPassword} required /></label>
      <button type="submit">ปลดล็อก</button>
    </form>
  {:else}
    <section class="card"><div class="security-row"><h2>สถานะ: ปลดล็อกแล้ว</h2><button type="button" class="secondary" on:click={lockVault}>ล็อก Vault</button></div></section>
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
      <div class="actions"><button type="submit">บันทึก</button><button type="button" class="secondary" on:click={clearForm}>ล้างฟอร์ม</button></div>
    </form>
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
                    <button type="button" on:click={() => copyAndTrack(item.id, item.secretValue)}>คัดลอก Secret</button>
                    <button type="button" class="secondary" on:click={() => copyAndTrack(item.id, item.secretName)}>คัดลอกชื่อคีย์</button>
                  {:else}
                    <button type="button" on:click={() => copyAndTrack(item.id, item.password)}>คัดลอกรหัส</button>
                    <button type="button" class="secondary" on:click={() => copyAndTrack(item.id, item.username)}>คัดลอกผู้ใช้</button>
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

  {#if authError}<section class="card"><div class="error">{authError}</div></section>{/if}
  {#if notice}<section class="card"><div class="notice">{notice}</div></section>{/if}
</main>
