import {
  PANEL_ID,
  SCOPE_ALL,
  SCOPE_CROSS,
  SCOPE_CURRENT,
  SCOPE_PINNED,
  STYLE_ID,
  TAB_ALL,
  TAB_LOGIN,
  TAB_SECRET
} from "./constants.js";
import { getEntrySubtitle, getEntryTitle } from "./state.js";
import { escapeHtml } from "./utils.js";

const ICONS = {
  close:
    '<path d="M6.47 5.53a.75.75 0 0 1 1.06 0L12 9.94l4.47-4.41a.75.75 0 1 1 1.06 1.06L13.06 11l4.47 4.41a.75.75 0 1 1-1.06 1.06L12 12.06l-4.47 4.41a.75.75 0 1 1-1.06-1.06L10.94 11L6.47 6.59a.75.75 0 0 1 0-1.06Z"/>',
  lock:
    '<path d="M8.75 9V7.25a3.25 3.25 0 1 1 6.5 0V9h.75A1.75 1.75 0 0 1 17.75 10.75v5.5A1.75 1.75 0 0 1 16 18H8A1.75 1.75 0 0 1 6.25 16.25v-5.5A1.75 1.75 0 0 1 8 9h.75Zm1.5 0h3.5V7.25a1.75 1.75 0 1 0-3.5 0V9Z"/><path d="M12 12a1 1 0 0 1 1 1v1.25a1 1 0 1 1-2 0V13a1 1 0 0 1 1-1Z"/>',
  unlock:
    '<path d="M15.25 9V7.4a3.25 3.25 0 0 0-6.32-1.05a.75.75 0 0 1-1.4-.55a4.75 4.75 0 0 1 9.22 1.6V9H16A1.75 1.75 0 0 1 17.75 10.75v5.5A1.75 1.75 0 0 1 16 18H8A1.75 1.75 0 0 1 6.25 16.25v-5.5A1.75 1.75 0 0 1 8 9h7.25Z"/><path d="M12 12a1 1 0 0 1 1 1v1.25a1 1 0 1 1-2 0V13a1 1 0 0 1 1-1Z"/>',
  cloud:
    '<path d="M8.2 17.25h7.1a3.45 3.45 0 0 0 .54-6.86A4.75 4.75 0 0 0 6.8 8.67A3.5 3.5 0 0 0 8.2 17.25Z"/><path d="M12 10.75a.75.75 0 0 1 .75.75v2.69l.72-.72a.75.75 0 1 1 1.06 1.06l-2 2a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l.72.72V11.5a.75.75 0 0 1 .75-.75Z"/>',
  search:
    '<path d="M10.75 4.5a6.25 6.25 0 1 1 0 12.5a6.25 6.25 0 0 1 0-12.5Zm0 1.5a4.75 4.75 0 1 0 0 9.5a4.75 4.75 0 0 0 0-9.5Z"/><path d="M15.03 15.03a.75.75 0 0 1 1.06 0l2.69 2.69a.75.75 0 1 1-1.06 1.06l-2.69-2.69a.75.75 0 0 1 0-1.06Z"/>',
  copy:
    '<path d="M8 5.75A1.75 1.75 0 0 1 9.75 4h6.5A1.75 1.75 0 0 1 18 5.75v7.5A1.75 1.75 0 0 1 16.25 15h-6.5A1.75 1.75 0 0 1 8 13.25v-7.5Z"/><path d="M5.75 8A1.75 1.75 0 0 0 4 9.75v6.5A1.75 1.75 0 0 0 5.75 18h7.5A1.75 1.75 0 0 0 15 16.25V16h-5.25A1.75 1.75 0 0 1 8 14.25V9H5.75Z"/>'
};

function renderIcon(name, className = "") {
  const paths = ICONS[name];
  if (!paths) {
    return "";
  }

  const cssClass = className ? ` class="${className}"` : "";
  return `<svg${cssClass} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${paths}</svg>`;
}

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID}{position:fixed;top:16px;right:16px;width:min(390px,calc(100vw - 32px));max-height:78vh;background:linear-gradient(180deg,#0f1f38 0%,#0c1a2e 100%);color:#e8f1ff;border:1px solid #324766;border-radius:14px;box-shadow:0 20px 48px rgba(5,14,28,.56);z-index:2147483647;overflow:auto;display:none;font-family:"Segoe UI","Noto Sans Thai",Tahoma,sans-serif;}
    #${PANEL_ID}.qp-open{display:block;}
    #${PANEL_ID} .qp-top{position:sticky;top:0;z-index:2;background:linear-gradient(180deg,rgba(15,31,56,.98) 0%,rgba(12,26,46,.92) 100%);backdrop-filter:blur(6px);border-bottom:1px solid #2c4363;padding:8px 10px 6px;}
    #${PANEL_ID} .qp-top-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
    #${PANEL_ID} .qp-head{font-size:13px;color:#a7bad4;font-weight:700;}
    #${PANEL_ID} .qp-head-row{display:inline-flex;align-items:center;gap:7px;}
    #${PANEL_ID} .qp-icon{width:14px;height:14px;display:block;flex:0 0 auto;}
    #${PANEL_ID} .qp-note{font-size:11px;color:#93a8c6;padding:0 14px 6px;}
    #${PANEL_ID} .qp-search-wrap{position:relative;margin-top:8px;}
    #${PANEL_ID} .qp-search-icon{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#7ea0ca;display:inline-flex;pointer-events:none;}
    #${PANEL_ID} .qp-search{margin:0 2px 2px;width:100%;border:1px solid #395279;background:#091324;color:#e8f1ff;border-radius:9px;padding:8px 9px 8px 34px;font-size:12px;}
    #${PANEL_ID} .qp-search:focus{outline:none;border-color:#2b86f1;box-shadow:0 0 0 3px rgba(43,134,241,.2);}
    #${PANEL_ID} .qp-unlock-form{padding:12px 14px 14px;display:grid;gap:8px;}
    #${PANEL_ID} .qp-unlock-label{font-size:11px;color:#bcd0ed;font-weight:700;}
    #${PANEL_ID} .qp-unlock-input{width:100%;border:1px solid #395279;background:#091324;color:#e8f1ff;border-radius:9px;padding:8px 9px;font-size:12px;}
    #${PANEL_ID} .qp-unlock-input:focus{outline:none;border-color:#2b86f1;box-shadow:0 0 0 3px rgba(43,134,241,.2);}
    #${PANEL_ID} .qp-unlock-feedback{font-size:11px;line-height:1.4;border-radius:9px;padding:8px 9px;background:rgba(225,75,104,.12);border:1px solid rgba(225,75,104,.36);color:#ffd2db;display:none;}
    #${PANEL_ID} .qp-unlock-feedback.qp-show{display:block;}
    #${PANEL_ID} .qp-chip-row{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0;}
    #${PANEL_ID} .qp-chip{background:#1a2a45;color:#cfe0f9;border:1px solid #2b4468;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;}
    #${PANEL_ID} .qp-chip-active{background:linear-gradient(180deg,#2b86f1 0%,#0f6ad7 100%);color:#f3f9ff;border-color:#0d5fc2;}
    #${PANEL_ID} .qp-list{padding:10px 12px 12px;display:grid;gap:8px;}
    #${PANEL_ID} .qp-item{background:linear-gradient(180deg,#132543 0%,#10203a 100%);border:1px solid #2d466d;border-radius:11px;padding:8px;}
    #${PANEL_ID} .qp-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:3px;}
    #${PANEL_ID} .qp-title{font-size:12px;color:#f1f7ff;font-weight:800;word-break:break-word;}
    #${PANEL_ID} .qp-kind{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:800;}
    #${PANEL_ID} .qp-kind-login{background:#e1ecff;color:#164f9f;}
    #${PANEL_ID} .qp-kind-secret{background:#e5faf4;color:#0e6d5f;}
    #${PANEL_ID} .qp-subtitle{font-size:11px;color:#9bb2d2;margin-bottom:8px;word-break:break-word;}
    #${PANEL_ID} .qp-actions{display:grid;gap:5px;grid-template-columns:repeat(2,minmax(0,1fr));}
    #${PANEL_ID} button{background:linear-gradient(180deg,#2b86f1 0%,#0f6ad7 100%);border:none;color:#edf5ff;font-weight:700;font-size:11px;border-radius:9px;padding:6px 8px;cursor:pointer;line-height:1.2;transition:transform 120ms ease,filter 120ms ease;}
    #${PANEL_ID} button:hover{filter:brightness(1.03);}
    #${PANEL_ID} button:active{transform:translateY(1px);}
    #${PANEL_ID} button.qp-secondary{background:#1a2a45;color:#d8e7fb;border:1px solid #2d466d;}
    #${PANEL_ID} button.qp-close-top{min-width:30px;min-height:30px;padding:0 8px;background:#182842;color:#dbe8fb;border:1px solid #355078;font-size:14px;line-height:1;}
    #${PANEL_ID} .qp-empty{padding:16px 14px 20px;color:#cad8ef;font-size:12px;line-height:1.45;}
    #${PANEL_ID} .qp-loading{padding:14px;font-size:12px;color:#c8d8ef;}
    #${PANEL_ID} .qp-close{background:linear-gradient(180deg,#e14b68 0%,#ce2648 100%);}
    #${PANEL_ID} .qp-foot{padding:0 12px 12px;}
    #${PANEL_ID} .qp-btn-content{display:inline-flex;align-items:center;justify-content:center;gap:6px;}
  `;
  document.documentElement.appendChild(style);
}

export function ensurePanelRoot() {
  let panelRoot = document.getElementById(PANEL_ID);
  if (!panelRoot) {
    panelRoot = document.createElement("section");
    panelRoot.id = PANEL_ID;
    document.documentElement.appendChild(panelRoot);
  }
  return panelRoot;
}

export function renderLockedPanel(host, reason, feedback = "") {
  const message =
    reason === "not_initialized"
      ? "ยังไม่ได้ตั้ง Master Password"
      : reason === "not_logged_in"
        ? "ยังไม่ได้ล็อกอิน Supabase"
        : "Vault ยังถูกล็อกอยู่";
  const canUnlock = reason === "locked";
  return `
    <div class="qp-top">
      <div class="qp-top-row">
        <div class="qp-head"><span class="qp-head-row">${renderIcon("lock", "qp-icon")}<span>Quick Pass · ${escapeHtml(host || "เว็บไซต์นี้")}</span></span></div>
        <button class="qp-close-top" data-action="close" aria-label="ปิด">${renderIcon("close", "qp-icon")}</button>
      </div>
    </div>
    <div class="qp-empty">${escapeHtml(message)}<br />${
      canUnlock ? "ปลดล็อกได้จากแผงนี้ทันที" : "ให้เปิด popup ของส่วนเสริม แล้วตั้งค่า/ปลดล็อกก่อนใช้งาน"
    }</div>
    ${
      canUnlock
        ? `
          <form class="qp-unlock-form" data-role="unlock-form">
            <label class="qp-unlock-label" for="qp-unlock-password">Master Password</label>
            <input id="qp-unlock-password" class="qp-unlock-input" name="password" type="password" autocomplete="current-password" />
            <div class="${feedback ? "qp-unlock-feedback qp-show" : "qp-unlock-feedback"}" id="qp-unlock-feedback">${escapeHtml(feedback)}</div>
            <button type="submit" data-action="unlock-vault"><span class="qp-btn-content">${renderIcon("unlock", "qp-icon")}<span>ปลดล็อก Vault</span></span></button>
          </form>
        `
        : ""
    }
    <div class="qp-foot"><button class="qp-close" data-action="close">ปิด</button></div>
  `;
}

export function renderPanelShell(host, reason) {
  const note =
    reason === "fallback_all"
      ? "ไม่พบโดเมนตรง แสดงรายการจากทุกโดเมน"
      : "รายการโดเมนตรงและปักหมุดจะถูกดันขึ้นก่อน";
  return `
    <div class="qp-top">
      <div class="qp-top-row">
        <div class="qp-head"><span class="qp-head-row">${renderIcon("lock", "qp-icon")}<span>Quick Pass · ${escapeHtml(host || "เว็บไซต์นี้")}</span></span></div>
        <button class="qp-close-top" data-action="close" aria-label="ปิด">${renderIcon("close", "qp-icon")}</button>
      </div>
      <div class="qp-search-wrap">
        <span class="qp-search-icon">${renderIcon("search", "qp-icon")}</span>
        <input id="qp-search" class="qp-search" type="text" placeholder="ค้นหาโดเมน / ชื่อ / key" />
      </div>
    </div>
    <div class="qp-note">${escapeHtml(note)}</div>
    <div class="qp-chip-row">${chip("tab", TAB_ALL, "ทั้งหมด", true)}${chip("tab", TAB_LOGIN, "ล็อกอิน")}${chip("tab", TAB_SECRET, "API/Secret")}</div>
    <div class="qp-chip-row">${chip("scope", SCOPE_ALL, "ทุกโดเมน", true)}${chip("scope", SCOPE_CURRENT, "โดเมนนี้")}${chip("scope", SCOPE_CROSS, "ข้ามโดเมน")}${chip("scope", SCOPE_PINNED, "ปักหมุด")}</div>
    <div class="qp-list" id="qp-list"></div>
    <div class="qp-foot"><button class="qp-close" data-action="close">ปิด</button></div>
  `;
}

export function renderEntries(entries, host) {
  if (!entries.length) {
    return `<div class="qp-empty">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>`;
  }

  return entries
    .map(
      (entry, index) => `
        <article class="qp-item">
          <div class="qp-title-row">
            <div class="qp-title">${escapeHtml(getEntryTitle(entry, index))}</div>
            <div class="${entry.kind === "secret" ? "qp-kind qp-kind-secret" : "qp-kind qp-kind-login"}">${entry.kind === "secret" ? renderIcon("cloud", "qp-icon") : renderIcon("lock", "qp-icon")}<span>${entry.kind === "secret" ? "Secret" : "Login"}</span></div>
          </div>
          <div class="qp-subtitle">${escapeHtml(getEntrySubtitle(entry, host))}</div>
          <div class="qp-actions">${renderActions(entry)}</div>
        </article>
      `
    )
    .join("");
}

function renderActions(entry) {
  if (entry.kind === "secret") {
    return `
      <button data-action="fill-secret-name" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("unlock", "qp-icon")}<span>เติมชื่อคีย์</span></span></button>
      <button data-action="fill-secret-value" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("unlock", "qp-icon")}<span>เติมค่า Secret</span></span></button>
      <button class="qp-secondary" data-action="copy-secret-name" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("copy", "qp-icon")}<span>คัดลอกชื่อคีย์</span></span></button>
      <button class="qp-secondary" data-action="copy-secret-value" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("copy", "qp-icon")}<span>คัดลอกค่า Secret</span></span></button>
    `;
  }
  return `
    <button data-action="fill-user" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("unlock", "qp-icon")}<span>เติมผู้ใช้</span></span></button>
    <button data-action="fill-pass" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("unlock", "qp-icon")}<span>เติมรหัส</span></span></button>
    <button class="qp-secondary" data-action="copy-user" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("copy", "qp-icon")}<span>คัดลอกผู้ใช้</span></span></button>
    <button class="qp-secondary" data-action="copy-pass" data-id="${entry.id}"><span class="qp-btn-content">${renderIcon("copy", "qp-icon")}<span>คัดลอกรหัส</span></span></button>
  `;
}

function chip(type, value, label, active = false) {
  return `<button data-filter="${type}" data-value="${value}" class="${active ? "qp-chip qp-chip-active" : "qp-chip"}">${label}</button>`;
}
