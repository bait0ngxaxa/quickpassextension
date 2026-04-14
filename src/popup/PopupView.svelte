<script>
  import { ENTRY_TYPE_LOGIN, ENTRY_TYPE_SECRET } from "./constants.js";
  import { getItemSubtitle, getItemTitle } from "./form.js";

  export let view;
  export let actions;
</script>

<main class="container">
  <header class="top-header">
    <div>
      <h1>Quick Pass Copy</h1>
      <p>โหมดใช้งานหลัก: บันทึก / รายการ</p>
    </div>
    <div class="header-actions">
      {#if view.authMode === "ready"}
        <button type="button" class="secondary gear-btn icon-only-btn" on:click={actions.toggleSettings} aria-label="Settings">
          {@html actions.renderIcon("settings", "ui-icon")}
        </button>
      {/if}
      <button type="button" class="secondary close-btn" on:click={actions.closePopup}>
        <span class="btn-content">{@html actions.renderIcon("close", "ui-icon")}<span>ปิด</span></span>
      </button>
    </div>
  </header>

  {#if view.authMode === "loading"}
    <section class="card"><div class="empty">กำลังโหลด...</div></section>
  {:else if view.authMode === "setup"}
    <form class="card" on:submit|preventDefault={actions.submitSetupMasterPassword}>
      <h2>ตั้งค่า Master Password</h2>
      <label>
        Master Password
        <input type="password" value={view.setupPassword} on:input={(event) => actions.setSetupPassword(event.currentTarget.value)} required />
      </label>
      <label>
        ยืนยัน Master Password
        <input type="password" value={view.setupConfirm} on:input={(event) => actions.setSetupConfirm(event.currentTarget.value)} required />
      </label>
      <button type="submit" disabled={view.setupBusy}>
        <span class="btn-content">
          {@html actions.renderIcon("unlock", "ui-icon")}
          <span>{view.setupBusy ? "กำลังตั้งค่า..." : "ตั้งค่าและปลดล็อก"}</span>
        </span>
      </button>
      {#if view.vaultFeedback.text}<div class={"feedback " + view.vaultFeedback.type}>{view.vaultFeedback.text}</div>{/if}
    </form>
  {:else if view.authMode === "locked"}
    <form class="card" on:submit|preventDefault={actions.submitUnlockVault}>
      <h2>ปลดล็อก Vault</h2>
      <label>
        Master Password
        <input type="password" value={view.unlockPassword} on:input={(event) => actions.setUnlockPassword(event.currentTarget.value)} required />
      </label>
      <button type="submit" disabled={view.unlockBusy}>
        <span class="btn-content">
          {@html actions.renderIcon("unlock", "ui-icon")}
          <span>{view.unlockBusy ? "กำลังปลดล็อก..." : "ปลดล็อก"}</span>
        </span>
      </button>
      {#if view.vaultFeedback.text}<div class={"feedback " + view.vaultFeedback.type}>{view.vaultFeedback.text}</div>{/if}
    </form>
  {:else}
    {#if view.showSettings}
      <section class="card">
        <h2>Settings</h2>
        {#if view.settingsFeedback.text}<div class={"feedback " + view.settingsFeedback.type}>{view.settingsFeedback.text}</div>{/if}
        <div class="inline-actions">
          <button type="button" class="secondary" on:click={actions.openSetupInTab}>
            <span class="btn-content">{@html actions.renderIcon("settings", "ui-icon")}<span>เปิดหน้าตั้งค่าในแท็บ</span></span>
          </button>
        </div>
        <div class="saved-config">
          <div class="saved-title">Supabase Config</div>
          <div class="status-row">
            <span class="status-label">สถานะ</span>
            <span class={view.supabaseConfigStatus === "ok" ? "status-pill success" : "status-pill muted"}>
              {view.supabaseConfigStatus === "ok" ? "OK" : "ไม่พร้อมใช้งาน"}
            </span>
          </div>
          <div class="saved-text">URL: {view.supabaseUrl || "ยังไม่ได้ตั้งค่า"}</div>
          <div class="saved-text">
            {view.supabaseConfigStatus === "ok"
              ? "โหลดค่า .env สำเร็จ"
              : "โหลดค่า .env ไม่สำเร็จ หรือยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"}
          </div>
        </div>

        {#if view.supabaseSessionEmail}
          <div class="saved-config oauth-row">
            <div class="saved-title">ล็อกอินแล้ว</div>
            <div class="saved-text">{view.supabaseSessionEmail}</div>
            <div class="status-pill success">พร้อมใช้งาน</div>
            <div class="inline-actions">
              <button type="button" class="secondary" on:click={actions.signOutFromSupabase} disabled={view.signOutBusy}>
                <span class="btn-content">
                  {@html actions.renderIcon("close", "ui-icon")}
                  <span>{view.signOutBusy ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}</span>
                </span>
              </button>
            </div>
          </div>
        {:else}
          <div class="stack oauth-row">
            <label>
              OAuth Provider
              <select value={view.supabaseProvider} on:change={(event) => actions.setSupabaseProvider(event.currentTarget.value)}>
                <option value="google">Google</option>
                <option value="github">GitHub</option>
                <option value="discord">Discord</option>
              </select>
            </label>
            <button type="button" on:click={actions.signInSupabaseOAuth} disabled={view.oauthBusy}>
              <span class="btn-content">
                {@html actions.renderIcon("cloud", "ui-icon")}
                <span>{view.oauthBusy ? "กำลังเปิด OAuth..." : "ล็อกอินด้วย OAuth"}</span>
              </span>
            </button>
          </div>
        {/if}

        <div class="actions">
          <button type="button" class="secondary" on:click={() => actions.hydrateCloudVault(false)} disabled={view.pullBusy}>
            <span class="btn-content">
              {@html actions.renderIcon("refresh", "ui-icon")}
              <span>{view.pullBusy ? "กำลังโหลด..." : "โหลดข้อมูลจาก Cloud ใหม่"}</span>
            </span>
          </button>
        </div>
      </section>
    {:else}
      <section class="main-tabs">
        <button type="button" class={view.activeMainTab === "save" ? "main-tab-btn active" : "main-tab-btn"} on:click={() => actions.setMainTab("save")}>
          <span class="btn-content">{@html actions.renderIcon("save", "ui-icon")}<span>บันทึก</span></span>
        </button>
        <button type="button" class={view.activeMainTab === "list" ? "main-tab-btn active" : "main-tab-btn"} on:click={() => actions.setMainTab("list")}>
          <span class="btn-content">{@html actions.renderIcon("list", "ui-icon")}<span>รายการ</span></span>
        </button>
      </section>

      <section class="card">
        <div class="security-row">
          <h2>สถานะ</h2>
          <button type="button" class="secondary" on:click={actions.lockVault} disabled={view.lockBusy}>
            <span class="btn-content">
              {@html actions.renderIcon("lock", "ui-icon")}
              <span>{view.lockBusy ? "กำลังล็อก..." : "ล็อก Vault"}</span>
            </span>
          </button>
        </div>
        <div class="status-grid">
          <div class="status-card">
            <span class="status-label status-inline">{@html actions.renderIcon("lock", "ui-icon")}<span>Vault</span></span>
            <span class="status-pill success">ปลดล็อกแล้ว</span>
          </div>
          <div class="status-card">
            <span class="status-label status-inline">{@html actions.renderIcon("cloud", "ui-icon")}<span>Cloud</span></span>
            {#if view.supabaseSessionEmail}
              <span class="status-pill success">เชื่อมแล้ว</span>
            {:else}
              <span class="status-pill muted">ยังไม่เชื่อม</span>
            {/if}
          </div>
        </div>
        <div class="saved-text">
          Cloud:
          {#if view.supabaseSessionEmail}
            Login อยู่ {view.supabaseSessionEmail}
          {:else}
            ยังไม่ได้ล็อกอิน
          {/if}
        </div>
        {#if view.mainFeedback.text}<div class={"feedback " + view.mainFeedback.type}>{view.mainFeedback.text}</div>{/if}
      </section>

      {#if view.activeMainTab === "save"}
        <form class="card" on:submit|preventDefault={actions.saveCredential}>
          <input type="hidden" value={view.form.id} />
          <label>
            ประเภทข้อมูล
            <select value={view.form.kind} on:change={(event) => actions.setFormField("kind", event.currentTarget.value)}>
              <option value={ENTRY_TYPE_LOGIN}>บัญชีล็อกอิน</option>
              <option value={ENTRY_TYPE_SECRET}>API Key / Secret</option>
            </select>
          </label>
          <label>โดเมน<input type="text" required value={view.form.domain} on:input={(event) => actions.setFormField("domain", event.currentTarget.value)} /></label>
          <label>ป้ายชื่อ<input type="text" value={view.form.label} on:input={(event) => actions.setFormField("label", event.currentTarget.value)} /></label>
          {#if view.isSecretType}
            <label>ชื่อคีย์<input type="text" value={view.form.secretName} on:input={(event) => actions.setFormField("secretName", event.currentTarget.value)} /></label>
            <label>ค่า Secret<input type="text" required value={view.form.secretValue} on:input={(event) => actions.setFormField("secretValue", event.currentTarget.value)} /></label>
          {:else}
            <label>Username / Email<input type="text" required value={view.form.username} on:input={(event) => actions.setFormField("username", event.currentTarget.value)} /></label>
            <label>Password<input type="text" required value={view.form.password} on:input={(event) => actions.setFormField("password", event.currentTarget.value)} /></label>
          {/if}
          <div class="actions">
            <button type="submit" disabled={view.entryBusy}>
              <span class="btn-content">{@html actions.renderIcon("save", "ui-icon")}<span>{view.entryBusy ? "กำลังบันทึก..." : "บันทึก"}</span></span>
            </button>
            <button type="button" class="secondary" on:click={actions.clearForm} disabled={view.entryBusy}>
              <span class="btn-content">{@html actions.renderIcon("refresh", "ui-icon")}<span>ล้างฟอร์ม</span></span>
            </button>
          </div>
        </form>
      {:else}
        <section class="card">
          <h2>รายการที่บันทึกไว้</h2>
          <div class="search-wrap">
            <span class="search-icon">{@html actions.renderIcon("search", "ui-icon")}</span>
            <input class="search-input" type="text" placeholder="ค้นหาโดเมน / ชื่อ / key" value={view.search} on:input={(event) => actions.setSearch(event.currentTarget.value)} />
          </div>
          <div class="chips">
            {#each view.tabs as item}
              <button type="button" class={view.tab === item.value ? "chip active" : "chip"} on:click={() => actions.setTab(item.value)}>
                <span class="btn-content">{@html actions.renderIcon(item.icon, "chip-icon")}<span>{item.label}</span></span>
              </button>
            {/each}
          </div>
          <div class="chips">
            {#each view.scopes as item}
              <button type="button" class={view.scope === item.value ? "chip active" : "chip"} on:click={() => actions.setScope(item.value)}>
                <span class="btn-content">{@html actions.renderIcon(item.icon, "chip-icon")}<span>{item.label}</span></span>
              </button>
            {/each}
          </div>
          <div class="pagination-row">
            <div class="pagination-text">ทั้งหมด {view.filtered.length} รายการ · หน้า {view.page}/{view.totalPages}</div>
            <div class="pagination-actions">
              <button type="button" class="secondary" on:click={actions.prevPage} disabled={view.page <= 1}>ก่อนหน้า</button>
              <button type="button" class="secondary" on:click={actions.nextPage} disabled={view.page >= view.totalPages}>ถัดไป</button>
            </div>
          </div>
          {#if view.groupedItems.length === 0}
            <div class="empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>
          {:else}
            {#each view.groupedItems as group}
              <div class="group-head">{group.domain}{#if group.isCurrent} · โดเมนปัจจุบัน{/if}</div>
              <div class="list">
                {#each group.items as item (item.id)}
                  <article class="item">
                    <div class="item-text">
                      <div class="item-title-row">
                        <div class="item-title">{getItemTitle(item)}</div>
                        <div class="item-badges">
                          {#if item.kind === ENTRY_TYPE_SECRET}
                            <span class="item-kind-badge secret">{@html actions.renderIcon("cloud", "badge-icon")}<span>Secret</span></span>
                          {:else}
                            <span class="item-kind-badge login">{@html actions.renderIcon("lock", "badge-icon")}<span>Login</span></span>
                          {/if}
                          {#if item.pinned}
                            <span class="item-kind-badge pinned">{@html actions.renderIcon("pin", "badge-icon")}<span>Pinned</span></span>
                          {/if}
                        </div>
                      </div>
                      <div class="item-sub">{getItemSubtitle(item)}</div>
                    </div>
                    <div class="item-actions">
                      {#if item.kind === ENTRY_TYPE_SECRET}
                        <button type="button" on:click={() => actions.copyAndTrack(item.id, item.secretValue)} disabled={view.copyBusyId === item.id}>
                          <span class="btn-content">{@html actions.renderIcon("copy", "ui-icon")}<span>{view.copyBusyId === item.id ? "กำลังคัดลอก..." : "คัดลอก Secret"}</span></span>
                        </button>
                        <button type="button" class="secondary" on:click={() => actions.copyAndTrack(item.id, item.secretName)} disabled={view.copyBusyId === item.id}>
                          <span class="btn-content">{@html actions.renderIcon("copy", "ui-icon")}<span>คัดลอกชื่อคีย์</span></span>
                        </button>
                      {:else}
                        <button type="button" on:click={() => actions.copyAndTrack(item.id, item.password)} disabled={view.copyBusyId === item.id}>
                          <span class="btn-content">{@html actions.renderIcon("copy", "ui-icon")}<span>{view.copyBusyId === item.id ? "กำลังคัดลอก..." : "คัดลอกรหัส"}</span></span>
                        </button>
                        <button type="button" class="secondary" on:click={() => actions.copyAndTrack(item.id, item.username)} disabled={view.copyBusyId === item.id}>
                          <span class="btn-content">{@html actions.renderIcon("copy", "ui-icon")}<span>คัดลอกผู้ใช้</span></span>
                        </button>
                      {/if}
                      <button type="button" class="secondary" on:click={() => actions.togglePin(item.id)}>
                        <span class="btn-content">{@html actions.renderIcon("pin", "ui-icon")}<span>{item.pinned ? "ยกเลิกปักหมุด" : "ปักหมุด"}</span></span>
                      </button>
                      <button type="button" class="secondary" on:click={() => actions.editCredential(item)}>
                        <span class="btn-content">{@html actions.renderIcon("edit", "ui-icon")}<span>แก้ไข</span></span>
                      </button>
                      <button type="button" class="danger" on:click={() => actions.deleteCredential(item.id)}>
                        <span class="btn-content">{@html actions.renderIcon("delete", "ui-icon")}<span>ลบ</span></span>
                      </button>
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
