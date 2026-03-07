// vault.js — Zoho Creator credential vault helper
// Copy this file into each Worker's src/ directory.
// Usage:
//   import { loadVault, getSecret } from './vault.js';
//   const vault = await loadVault(env);
//   const token = vault['TazWorks/token'];
//
// Requires KV namespace binding: VAULT_TOKEN_CACHE

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const VAULT_API = 'https://creator.zoho.com/api/v2/sarahhope/vid-credential-vault/report/credential_vault_Report';

const KV_TOKEN_KEY = 'zoho_access_token';
const KV_VAULT_KEY = 'vault_data';
const TOKEN_TTL_SECONDS = 55 * 60;       // 55 min — Zoho access tokens expire at 60 min
const VAULT_DATA_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — vault data rarely changes

// In-memory fallback for the current isolate lifetime
let _memCache = null;

/**
 * Get a Zoho access token — reads from KV cache first, only hits Zoho OAuth if expired.
 */
async function getZohoAccessToken(env) {
  // Try KV cache first
  if (env.VAULT_TOKEN_CACHE) {
    const cached = await env.VAULT_TOKEN_CACHE.get(KV_TOKEN_KEY);
    if (cached) return cached;
  }

  // No cached token — request a new one from Zoho
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.CF_ZOHO_CLIENT_ID,
    client_secret: env.CF_ZOHO_CLIENT_SECRET,
    refresh_token: env.CF_ZOHO_REFRESH_TOKEN,
  });

  const res = await fetch(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Zoho token response missing access_token: ${JSON.stringify(data)}`);
  }

  // Store in KV with 55-minute TTL
  if (env.VAULT_TOKEN_CACHE) {
    await env.VAULT_TOKEN_CACHE.put(KV_TOKEN_KEY, data.access_token, {
      expirationTtl: TOKEN_TTL_SECONDS,
    });
  }

  return data.access_token;
}

/**
 * Fetch all credentials from the vault and return them as a flat object.
 * Keys are "Service/field_name" (e.g., "Zoho/client_id", "TazWorks/token").
 *
 * Caching strategy (layered):
 *   1. In-memory module cache (fastest, lasts for isolate lifetime)
 *   2. KV cache with 7-day TTL (persists across invocations — vault data rarely changes)
 *   3. Fresh fetch from Zoho Creator (only when both caches miss)
 *
 * Note: The Zoho access token (for Creator API auth) has a separate 55-minute TTL.
 * Vault data is cached much longer because the credential values themselves rarely change.
 */
export async function loadVault(env) {
  // Layer 1: in-memory cache
  if (_memCache) return _memCache;

  // Layer 2: KV cache (7-day TTL)
  if (env.VAULT_TOKEN_CACHE) {
    const cached = await env.VAULT_TOKEN_CACHE.get(KV_VAULT_KEY, 'json');
    if (cached) {
      _memCache = cached;
      return cached;
    }
  }

  // Layer 3: fresh fetch from Zoho Creator
  const accessToken = await getZohoAccessToken(env);

  const res = await fetch(VAULT_API, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vault fetch failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const records = json.data || [];

  const vault = {};
  for (const row of records) {
    const service = (row.service || row.Service || '').trim();
    const field = row.credential_key || row.Field_Name || row.field_name || row.Field || row.field;
    const value = row.credential_value || row.Value || row.value;
    if (service && field) {
      vault[`${service}/${field}`] = value;
    }
  }

  // Store vault data in KV with 7-day TTL (data rarely changes)
  if (env.VAULT_TOKEN_CACHE) {
    await env.VAULT_TOKEN_CACHE.put(KV_VAULT_KEY, JSON.stringify(vault), {
      expirationTtl: VAULT_DATA_TTL_SECONDS,
    });
  }

  _memCache = vault;
  return vault;
}

/**
 * Fetch a single secret by service + field name.
 * Uses the cached vault if available, otherwise loads everything.
 */
export async function getSecret(env, service, field) {
  const vault = await loadVault(env);
  return vault[`${service}/${field}`];
}
