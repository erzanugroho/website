/**
 * Simple API layer for multi-device sync via Vercel Serverless Functions.
 * Falls back to localStorage if API is unreachable.
 */

const STORAGE_KEY = 'hastmaTournamentData';

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isValidTournamentData(data) {
  return !!data && typeof data === 'object' && Array.isArray(data.teams) && Array.isArray(data.matches) && !!data.metadata;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store',
    ...options
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

export async function getTournamentData() {
  // 1) Try server (multi-device)
  try {
    const data = await fetchJson('/api/tournament', { method: 'GET' });
    if (isValidTournamentData(data)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    // ignore, fallback below
    console.warn('API unavailable, falling back to localStorage', e);
  }

  // 2) localStorage fallback
  const stored = safeJsonParse(localStorage.getItem(STORAGE_KEY));
  if (isValidTournamentData(stored)) return stored;

  // 3) ultimate fallback: rely on DEFAULT_TOURNAMENT_DATA provided by js/data.js
  if (typeof DEFAULT_TOURNAMENT_DATA !== 'undefined') {
    const cloned = JSON.parse(JSON.stringify(DEFAULT_TOURNAMENT_DATA));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cloned));
    return cloned;
  }

  throw new Error('No tournament data available');
}

export async function saveTournamentData(data) {
  if (!isValidTournamentData(data)) {
    throw new Error('Invalid tournament data');
  }

  // Always keep local cache up-to-date
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  // Try to persist to server
  try {
    return await fetchJson('/api/tournament', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.warn('Failed to save to API, kept localStorage only', e);
    return { ok: false, offline: true };
  }
}

export function getCachedTournamentData() {
  const stored = safeJsonParse(localStorage.getItem(STORAGE_KEY));
  return isValidTournamentData(stored) ? stored : null;
}
