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
    #${PANEL_ID} .qp-note{font-size:11px;color:#93a8c6;padding:0 14px 6px;}
    #${PANEL_ID} .qp-search{margin:8px 2px 2px;width:100%;border:1px solid #395279;background:#091324;color:#e8f1ff;border-radius:9px;padding:8px 9px;font-size:12px;}
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
    #${PANEL_ID} .qp-title{font-size:12px;margin-bottom:3px;color:#f1f7ff;font-weight:800;word-break:break-word;}
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
        <div class="qp-head">Quick Pass · ${escapeHtml(host || "เว็บไซต์นี้")}</div>
        <button class="qp-close-top" data-action="close" aria-label="ปิด">×</button>
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
            <button type="submit" data-action="unlock-vault">ปลดล็อก Vault</button>
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
        <div class="qp-head">Quick Pass · ${escapeHtml(host || "เว็บไซต์นี้")}</div>
        <button class="qp-close-top" data-action="close" aria-label="ปิด">×</button>
      </div>
      <input id="qp-search" class="qp-search" type="text" placeholder="ค้นหาโดเมน / ชื่อ / key" />
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
          <div class="qp-title">${escapeHtml(getEntryTitle(entry, index))}</div>
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
      <button data-action="fill-secret-name" data-id="${entry.id}">เติมชื่อคีย์</button>
      <button data-action="fill-secret-value" data-id="${entry.id}">เติมค่า Secret</button>
      <button class="qp-secondary" data-action="copy-secret-name" data-id="${entry.id}">คัดลอกชื่อคีย์</button>
      <button class="qp-secondary" data-action="copy-secret-value" data-id="${entry.id}">คัดลอกค่า Secret</button>
    `;
  }
  return `
    <button data-action="fill-user" data-id="${entry.id}">เติมผู้ใช้</button>
    <button data-action="fill-pass" data-id="${entry.id}">เติมรหัส</button>
    <button class="qp-secondary" data-action="copy-user" data-id="${entry.id}">คัดลอกผู้ใช้</button>
    <button class="qp-secondary" data-action="copy-pass" data-id="${entry.id}">คัดลอกรหัส</button>
  `;
}

function chip(type, value, label, active = false) {
  return `<button data-filter="${type}" data-value="${value}" class="${active ? "qp-chip qp-chip-active" : "qp-chip"}">${label}</button>`;
}
