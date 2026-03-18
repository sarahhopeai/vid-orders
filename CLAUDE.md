# VID Orders — Cloudflare Worker

## What This Is
Backend for ALL 4 order flows. Handles order processing, TazWorks integration, Authorize.net payments, Zoho CRM/Books record creation. Both members.verticalidentity.com and orderlabtest.com call this worker.

## Part of Vertical Identity Platform
Read the root `~/Claude_Code/CLAUDE.md` for full platform context. Key KB files:
- `~/Claude_Code/_KB/order-flow-architecture.md` — all 4 flows, domain routing, CRM/GHL split
- `~/Claude_Code/_KB/tazworks-products.md` — GUID mappings, routing, bundling
- `~/Claude_Code/_KB/zoho-books-items.md` — full item catalog

## Tech Stack
- Cloudflare Worker (JavaScript)
- TazWorks API via DigitalOcean proxy
- Authorize.net — payment processing
- Zoho CRM (`/crm/v7/Customers/`) — this worker correctly uses the right path
- Zoho Books — invoicing
- Twilio — SMS OTP for Flow 3
- GoHighLevel — lead creation for one-time orders (Flows 1+4)
- Zoho Creator credential vault (shared `vault.js`)
- **Supabase** — `order_submissions` table logs every submission across all 4 flows as safety net (added 2026-03-17)

## Key Files
- `src/index.js` — all route handlers + **PRICE CONSTANTS** (both sites pull from here)

## Four Flows
| Flow | Route | Purpose |
|---|---|---|
| Flow 1 | POST /flow1/order | Non-member drug test |
| Flow 2 | POST /flow2/enroll | New consortium enrollment |
| Flow 3 | POST /flow3/lookup, /flow3/add-driver, /flow3/order | Existing member actions |
| Flow 4 | POST /flow4/order | À la carte single service |

## CRITICAL: Pricing Lives Here
Price constants are defined in `src/index.js`. Both members.verticalidentity.com and orderlabtest.com pull pricing from this worker. To change any price: update the constant here and redeploy. Do NOT edit prices in the HTML pages.

## CRM/GHL Split
- Flows 2+3 (consortium members) → create/update Zoho CRM records
- Flows 1+4 (one-time orders) → Zoho Books + GHL only. NOT to CRM.

## Deploy
```
cd ~/Claude_Code/vid-orders
npx wrangler deploy
```
URL: `https://vid-orders.sarah-8e8.workers.dev`

## Supabase Safety Net
- **Table:** `order_submissions` in project `hjeucwvfdylmpddmaonm`
- Every form submission is logged BEFORE payment processing
- Status progression: received → payment_success → crm_success → completed
- If anything fails, raw payload + error_log are preserved for replay
- Uses anon key with RLS disabled (server-side only, no client access)
- Query failed submissions: `SELECT * FROM order_submissions WHERE status LIKE '%_failed'`

## SaferWebAPI Integration (DOT Lookup)
- **Endpoint:** `GET /dot-lookup/:dotNumber` — returns company info, address, driver/PU count, operating status
- **API key:** Stored as wrangler secret `SAFER_WEB_API_KEY` (also checked in vault under `SaferWebAPI/api_key`)
- **Used by:** Enrollment form (auto-populate company info on DOT entry)
- **Address parsing:** FMCSA merges street+city — parser uses street suffix heuristics to split
- **DER auto-select:** If 1 driver + 1 power unit → pre-selects "Yes, I Drive" (solo O/O)
- **Status warnings:** Non-authorized and out-of-service carriers get yellow/red banners

## Gotchas
- This is the ONE worker that correctly uses `/crm/v7/Customers/`
- CC surcharges are absorbed on ALL flows — do not add surcharge logic
- No sandbox for Auth.net — use production test mode with test card numbers
- Public Client Key goes in CF Pages env vars (client-side safe), other 3 keys server-side only
- **DER compliance:** CDL drivers CANNOT be their own DER. Flow 2 auto-sets VID as DER when enrollee is a driver.
