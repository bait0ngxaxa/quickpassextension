export function isEditable(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return !element.readOnly && !element.disabled;
  }
  return element.isContentEditable;
}

export function normalizeHost(hostname) {
  return (hostname || "").replace(/^www\./i, "");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function copyText(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_error) {
    return fallbackCopy(value);
  }
}

function fallbackCopy(value) {
  const container = document.body || document.documentElement;
  if (!(container instanceof HTMLElement)) {
    return false;
  }

  const temp = document.createElement("textarea");
  temp.value = value;
  temp.setAttribute("readonly", "true");
  temp.style.position = "fixed";
  temp.style.opacity = "0";

  try {
    container.appendChild(temp);
    temp.select();
    return document.execCommand("copy");
  } catch (_error) {
    return false;
  } finally {
    temp.remove();
  }
}
