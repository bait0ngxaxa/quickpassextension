import {
  SCOPE_ALL,
  SCOPE_CROSS,
  SCOPE_CURRENT,
  SCOPE_PINNED,
  TAB_ALL,
  TAB_LOGIN,
  TAB_SECRET
} from "../constants.js";
import { ENTRY_TYPE_SECRET } from "../constants.js";
import { createEmptyForm } from "../form.js";
import { filterAndSortCredentials, groupByDomain } from "../listing.js";

export const PAGE_SIZE = 20;

export const tabs = [
  { value: TAB_ALL, label: "ทั้งหมด", icon: "list" },
  { value: TAB_LOGIN, label: "บัญชีล็อกอิน", icon: "lock" },
  { value: TAB_SECRET, label: "API/Secret", icon: "cloud" }
];

export const scopes = [
  { value: SCOPE_ALL, label: "ทุกโดเมน", icon: "list" },
  { value: SCOPE_CURRENT, label: "โดเมนนี้", icon: "lock" },
  { value: SCOPE_CROSS, label: "ข้ามโดเมน", icon: "cloud" },
  { value: SCOPE_PINNED, label: "ปักหมุด", icon: "pin" }
];

export function createInitialState() {
  return {
    authMode: "loading",
    setupPassword: "",
    setupConfirm: "",
    unlockPassword: "",
    masterKey: null,
    currentHost: "",
    credentials: [],
    form: createEmptyForm(),
    search: "",
    tab: TAB_ALL,
    scope: SCOPE_ALL,
    page: 1,
    supabaseUrl: "",
    supabaseSessionEmail: "",
    supabaseProvider: "google",
    showSettings: false,
    activeMainTab: "save",
    supabaseConfigStatus: "not_ready",
    mainFeedback: emptyFeedback(),
    vaultFeedback: emptyFeedback(),
    settingsFeedback: emptyFeedback(),
    setupBusy: false,
    unlockBusy: false,
    lockBusy: false,
    entryBusy: false,
    copyBusyId: "",
    oauthBusy: false,
    signOutBusy: false,
    pullBusy: false
  };
}

export function buildViewModel(state) {
  const filtered = filterAndSortCredentials(state.credentials, state);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(state.page, totalPages);
  const pagedItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return {
    ...state,
    tabs,
    scopes,
    filtered,
    totalPages,
    page,
    groupedItems: groupByDomain(pagedItems, state.currentHost),
    isSecretType: state.form.kind === ENTRY_TYPE_SECRET
  };
}

export function emptyFeedback() {
  return { type: "", text: "" };
}
