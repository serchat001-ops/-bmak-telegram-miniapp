const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

export async function apiFetch(path: string, method = 'GET', body?: object) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const url = API_BASE + path;
  const res = await fetch(url, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error((data as any).error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return res.json();
}

export function shorten(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function fmtNum(n: number | string, decimals = 2) {
  const num = parseFloat(String(n)) || 0;
  return decimals > 0
    ? num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : num.toLocaleString();
}

export function formatTime(ts: string) {
  if (!ts) return '';
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}
