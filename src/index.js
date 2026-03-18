import { loadVault } from './vault.js';

// ── Supabase Safety Net ─────────────────────────────────────────────────────
const SUPABASE_URL = 'https://hjeucwvfdylmpddmaonm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZXVjd3ZmZHlsbXBkZG1hb25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzU5MTcsImV4cCI6MjA4NjUxMTkxN30.pB_v7ZU88UKsv9xBXE2Q08VunMbI503nY6tTwW9BlGk';

/** Insert a new order_submissions row. Returns the row ID or null on failure. */
async function sbInsert(flow, body, request) {
  try {
    const ep = body.enrolling_person || {};
    const contactName = ep.first_name
      ? `${ep.first_name} ${ep.last_name}`.trim()
      : `${body.der_first_name || body.first_name || ''} ${body.der_last_name || body.last_name || ''}`.trim();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/order_submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        flow,
        dot_number: (body.dot_number || '').toString(),
        company_name: body.company_name || '',
        contact_name: contactName,
        contact_email: ep.email || body.der_email || body.email || '',
        contact_phone: ep.phone || body.der_phone || body.phone || '',
        status: 'received',
        payload: body,
        source_url: request?.headers?.get('origin') || request?.headers?.get('referer') || '',
        ip_address: request?.headers?.get('cf-connecting-ip') || '',
      }),
    });
    if (res.ok) {
      const rows = await res.json();
      const id = rows?.[0]?.id;
      console.log(`[supabase] order_submissions row created: ${id} flow=${flow}`);
      return id;
    }
    console.log(`[supabase] insert failed (${res.status}): ${await res.text()}`);
    return null;
  } catch (e) {
    console.log(`[supabase] insert error (non-blocking): ${e.message}`);
    return null;
  }
}

/** Update an order_submissions row by ID. Non-blocking — errors are logged, not thrown. */
async function sbUpdate(id, updates) {
  if (!id) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/order_submissions?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) console.log(`[supabase] update failed (${res.status}): ${await res.text()}`);
  } catch (e) {
    console.log(`[supabase] update error (non-blocking): ${e.message}`);
  }
}

/** Append an error to the error_log JSONB array */
async function sbLogError(id, step, message) {
  if (!id) return;
  try {
    // Read current error_log, append, write back (PostgREST doesn't support jsonb append natively)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/order_submissions?id=eq.${id}&select=error_log`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    let errors = [];
    if (res.ok) {
      const rows = await res.json();
      errors = rows?.[0]?.error_log || [];
    }
    errors.push({ step, message, timestamp: new Date().toISOString() });
    await sbUpdate(id, { error_log: errors, status: `${step}_failed` });
  } catch (e) {
    console.log(`[supabase] logError error (non-blocking): ${e.message}`);
  }
}

// ── Constants ────────────────────────────────────────────────────────────────
const ZOHO_CRM_CUSTOMERS = 'https://www.zohoapis.com/crm/v7/Accounts/';
const TAZWORKS_PROXY_BASE = 'http://tazproxy.verticalidentity.com:3456';
const TAZWORKS_CLIENT_GUID = '3911d1df-6d66-449d-894c-235367c8dcd7';
const AUTHNET_ENDPOINT = 'https://api.authorize.net/xml/v1/request.api';
const ZOHO_MAIL_ACCOUNT_ID = '2638799000000008002';

// ── Flow 1 Pricing ───────────────────────────────────────────────────────────
const FLOW1_PRICING = {
  pre_employment:       { amount: 69, name: 'DOT Pre-Employment Drug Test' },
  reasonable_suspicion:  { amount: 69, name: 'DOT Reasonable Suspicion Drug Test' },
  return_to_duty:       { amount: 99, name: 'DOT Return to Duty Drug Test' },
  follow_up:            { amount: 99, name: 'DOT Follow-Up Drug Test' },
  post_accident:        { amount: 69, name: 'DOT Post-Accident Drug Test' },
  random:               { amount: 69, name: 'DOT Random Drug Test' },
  dot_alcohol:          { amount: 59, name: 'DOT Breath Alcohol Test' },
};

// ── Flow 2 (Enrollment) Pricing ──────────────────────────────────────────────
const ENROLL_PLAN_PRICING = {
  single:    { base: 85,  label: 'Individual Consortium Membership' },
  fleet:     { per_driver: 25, label: 'Fleet Consortium Membership' },
  fleet_295: { base: 295, label: 'Fleet Consortium Membership (Flat Rate)' },
};
const PEDT_PRICE = 69; // per driver pre-employment drug test

// ── Flow 3 (Account Portal) Pricing ─────────────────────────────────────────
const ADD_DRIVER_PRICE = 25;
const FLOW3_SERVICE_PRICING = {
  pre_employment:       { amount: 69, name: 'DOT Pre-Employment Drug Test' },
  reasonable_suspicion:  { amount: 69, name: 'DOT Reasonable Suspicion Drug Test' },
  return_to_duty:       { amount: 99, name: 'DOT Return to Duty Drug Test' },
  follow_up:            { amount: 99, name: 'DOT Follow-Up Drug Test' },
  post_accident:        { amount: 69, name: 'DOT Post-Accident Drug Test' },
  random:               { amount: 69, name: 'DOT Random Drug Test' },
  dot_alcohol:          { amount: 59, name: 'DOT Breath Alcohol Test' },
};

// ── Flow 4 (À la Carte Order) Pricing ────────────────────────────────────────
const FLOW4_PRICING = {
  dot_drug_test:          { amount: 69,  name: 'DOT Drug Test',                    tazworks: true,  taz_type: 'dot_drug' },
  dot_alcohol_test:       { amount: 59,  name: 'DOT Breath Alcohol Test',          tazworks: true,  taz_type: 'dot_alcohol' },
  mvr:                    { amount: 25,  name: 'Motor Vehicle Record (MVR)',        tazworks: true,  taz_type: 'mvr' },
  psp_report:             { amount: 20,  name: 'PSP Report',                       tazworks: true,  taz_type: 'psp_report' },
  background_check:       { amount: 39,  name: 'Background Check',                 tazworks: true,  taz_type: 'background_check' },
  background_check_driving: { amount: 65, name: 'Background Check + Driving',      tazworks: true,  taz_type: 'background_check_driving' },
  dot_drug_clearmd_pe:    { amount: 69,  name: 'DOT Drug Test (ClearMD) - Pre-Employment', tazworks: true, taz_type: 'dot_drug_clearmd_pe' },
  dot_drug_clearmd_random: { amount: 69, name: 'DOT Drug Test (ClearMD) - Random', tazworks: true,  taz_type: 'dot_drug_clearmd_random' },
  clearinghouse_query:    { amount: 12,  name: 'Clearinghouse Query',              tazworks: false },
};

// ── Twilio / OTP ─────────────────────────────────────────────────────────────
const TWILIO_MESSAGING_SERVICE_SID = 'MG069b413987cc3ca6559de46f87487f1b';
const OTP_TTL_SECONDS = 600;      // 10 minutes
const SESSION_TTL_SECONDS = 1800;  // 30 minutes

// ── Zoho Books Item IDs (for invoice line items) ─────────────────────────────
const BOOKS_ITEM_MAP = {
  pre_employment:       '1456902000032331466',
  reasonable_suspicion:  '1456902000032331534',
  return_to_duty:       '1456902000032331568',
  follow_up:            '1456902000032331415',
  post_accident:        '1456902000032331449',
  random:               '1456902000032736113',
  dot_alcohol:          '1456902000011729062',
};

// ── TazWorks Product GUID Map ────────────────────────────────────────────────
const TAZWORKS_PRODUCT_MAP = {
  dot_drug: {
    pre_employment:       'd24fcced-ef1d-4708-90cd-bc3b9b6d86c5',
    random:               'd50ec8cf-585d-4a53-8568-bc1dc5f8842e',
    post_accident:        'f3261a52-9367-423c-a84f-0d4c2c183d50',
    reasonable_suspicion:  '6076a199-0dbc-4723-b06c-348a59fffc48',
    follow_up:            'ce66b5cf-ab8f-4b48-9198-2cfa3be0c4e5',
    return_to_duty:       '73814ccc-ba74-42fa-b0d9-1b5bd623e92c',
    _default:             'd24fcced-ef1d-4708-90cd-bc3b9b6d86c5',
  },
  dot_alcohol: {
    reasonable_suspicion:  'cc366f3a-5416-4638-afc0-5dd47e45ebd9',
    follow_up:            '012c9194-7343-4aef-9f1b-9ec8711d9c55',
    return_to_duty:       '5e2a3c0d-64c7-4cea-bd57-a95e9e9b6dd1',
    _default:             'cc366f3a-5416-4638-afc0-5dd47e45ebd9',
  },
  mvr:                    'f021bad3-241f-4af8-b761-94413b90100d',
  psp_report:             '399c203c-4d07-4aa8-a825-725b15153bf1',
  background_check:       '63649df2-1742-48e1-9842-6b62457b6e23',
  background_check_driving: '67403a90-cd1d-460e-bbf3-7f6d26060fd2',
  dot_drug_clearmd_pe:    'c91ada1e-5484-4692-8e5f-508581844275',
  dot_drug_clearmd_random: 'b31d3b70-ec5a-4f30-84f6-f0f6754bc49c',
};

const TAZWORKS_REASON_MAP = {
  pre_employment:       'PRE_EMPLOYMENT',
  random:               'RANDOM',
  post_accident:        'POST_ACCIDENT',
  reasonable_suspicion:  'SUSPICION',
  follow_up:            'FOLLOW_UP',
  return_to_duty:       'RETURN_TO_DUTY',
};

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://orderlabtest.com',
  'https://www.orderlabtest.com',
  'https://members.verticalidentity.com',
  'https://www.members.verticalidentity.com',
];

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

// ── Zoho OAuth ───────────────────────────────────────────────────────────────
let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getAccessToken(env) {
  // 1. In-memory cache (fastest, survives within same isolate)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }
  // 2. KV cache — check plain string format (vault.js style) first
  try {
    const kvPlain = await env.VAULT_TOKEN_CACHE.get('zoho_access_token');
    if (kvPlain && !kvPlain.startsWith('{')) {
      // Plain token string (from vault.js)
      cachedAccessToken = kvPlain;
      tokenExpiresAt = Date.now() + 50 * 60 * 1000; // assume ~50 min left
      return cachedAccessToken;
    }
    if (kvPlain) {
      // JSON format (our format)
      const parsed = JSON.parse(kvPlain);
      if (parsed.token && Date.now() < parsed.expires_at - 300000) {
        cachedAccessToken = parsed.token;
        tokenExpiresAt = parsed.expires_at;
        return cachedAccessToken;
      }
    }
  } catch (_) {}
  // 3. Refresh from Zoho OAuth — try both credential sets
  const credSets = [
    { client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: env.ZOHO_REFRESH_TOKEN },
    { client_id: env.CF_ZOHO_CLIENT_ID, client_secret: env.CF_ZOHO_CLIENT_SECRET, refresh_token: env.CF_ZOHO_REFRESH_TOKEN },
  ];
  for (const creds of credSets) {
    if (!creds.client_id || !creds.refresh_token) continue;
    const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', ...creds }),
    });
    const data = await res.json();
    if (data.access_token) {
      cachedAccessToken = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in || 3300) * 1000;
      // Store in KV (plain string, compatible with vault.js)
      try {
        await env.VAULT_TOKEN_CACHE.put('zoho_access_token', cachedAccessToken, { expirationTtl: 3300 });
      } catch (_) {}
      return cachedAccessToken;
    }
  }
  throw new Error('Zoho OAuth refresh failed with all credential sets');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPhoneForTazWorks(phone) {
  const digits = phone.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return phone;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

// ── Authorize.net Charge ─────────────────────────────────────────────────────
async function chargeAuthNet(nonce, amount, orderDescription, customer, env) {
  const payload = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: env.AUTHNET_API_LOGIN_ID,
        transactionKey: env.AUTHNET_TRANSACTION_KEY,
      },
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: amount.toFixed(2),
        payment: {
          opaqueData: {
            dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
            dataValue: nonce,
          },
        },
        order: {
          description: orderDescription.slice(0, 255),
        },
        customer: {
          email: customer.email,
        },
        billTo: {
          firstName: customer.first_name,
          lastName: customer.last_name,
          address: customer.billing_address || '',
          city: customer.billing_city || '',
          state: customer.billing_state || '',
          zip: customer.billing_zip || customer.zip_code || '',
        },
      },
    },
  };

  const res = await fetch(AUTHNET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  const messages = data.messages || {};
  const txnResponse = data.transactionResponse || {};

  if (messages.resultCode !== 'Ok' || !txnResponse.transId) {
    const errorMsg = txnResponse.errors?.[0]?.errorText
      || messages.message?.[0]?.text
      || 'Payment processing failed';
    return { success: false, error: errorMsg };
  }

  return {
    success: true,
    transactionId: txnResponse.transId,
    authCode: txnResponse.authCode,
  };
}

// ── TazWorks API ─────────────────────────────────────────────────────────────
async function callTazWorks(path, method, body, env) {
  const url = `${TAZWORKS_PROXY_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.TAZWORKS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Proxy-Secret': env.PROXY_SECRET,
    },
    ...(method !== 'GET' && { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TazWorks API error (${res.status}) at ${path}: ${text}`);
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function createTazWorksApplicant(customer, env) {
  const payload = {
    firstName: customer.first_name,
    lastName: customer.last_name,
    email: customer.email,
    phoneNumber: formatPhoneForTazWorks(customer.phone),
    textingEnabled: true,
    noMiddleName: true,
    ssn: '111-11-1111', // placeholder — QuickApp handles real identity verification
  };
  const data = await callTazWorks(
    `/v1/clients/${TAZWORKS_CLIENT_GUID}/applicants`,
    'POST', payload, env
  );
  const applicantGuid = data.applicantGuid || data.guid || data.id || '';
  if (!applicantGuid) {
    throw new Error('TazWorks create applicant returned no GUID: ' + JSON.stringify(data));
  }
  return applicantGuid;
}

async function placeTazWorksOrder(applicantGuid, testType, reason, invoiceNumber, customerEmail, zipCode, env, notePrefix = 'Flow 1 One-Time Order', extraFields = {}) {
  // Resolve product GUID — nested map for dot_drug/dot_alcohol, flat string for others
  let clientProductGuid;
  const productEntry = TAZWORKS_PRODUCT_MAP[testType];
  if (typeof productEntry === 'string') {
    clientProductGuid = productEntry;
  } else if (typeof productEntry === 'object') {
    clientProductGuid = productEntry[reason] || productEntry._default;
  }
  if (!clientProductGuid) {
    throw new Error(`No TazWorks product GUID for testType=${testType} reason=${reason}`);
  }

  const tazReason = TAZWORKS_REASON_MAP[reason] || 'PRE_EMPLOYMENT';

  // Determine if this is a drug/alcohol test (needs QuickApp + occupational health) vs non-DOT product
  const isDotTest = testType === 'dot_drug' || testType === 'dot_alcohol'
    || testType === 'dot_drug_clearmd_pe' || testType === 'dot_drug_clearmd_random';

  const orderPayload = {
    applicantGuid,
    clientProductGuid,
    certifyPermissiblePurpose: true,
    ...(invoiceNumber && { externalIdentifier: invoiceNumber }),
    orderNotes: `${notePrefix} | ${testType.replace(/_/g, ' ').toUpperCase()} | Reason: ${reason.replace(/_/g, ' ').toUpperCase()} | ZIP: ${zipCode}${extraFields.dot_number ? ' | DOT: ' + extraFields.dot_number : ''}${extraFields.ip_address ? ' | IP: ' + extraFields.ip_address : ''}`,
    customFields: {
      field3: customerEmail, // "Send Report To"
      ...(extraFields.cdl_number && { field4: extraFields.cdl_number }),
      ...(extraFields.cdl_state && { field5: extraFields.cdl_state }),
    },
    useQuickApp: isDotTest,
    quickappNotifyApplicants: isDotTest,
    ...(isDotTest && {
      occupationalHealthData: {
        substanceAbuseReasonForTesting: tazReason,
      },
    }),
  };

  const data = await callTazWorks(
    `/v1/clients/${TAZWORKS_CLIENT_GUID}/orders`,
    'POST', orderPayload, env
  );

  const orderGuid = data.orderGuid || data.guid || data.id || '';
  if (!orderGuid) {
    throw new Error('TazWorks place order returned no orderGuid: ' + JSON.stringify(data));
  }

  return {
    orderGuid,
    fileNumber: data.fileNumber || data.file_number || 0,
    orderStatus: data.orderStatus || data.status || 'New',
    quickappLink: data.quickappApplicantLink || '',
  };
}

// ── Zoho CRM: Create One-Time Customer ───────────────────────────────────────
async function createCrmCustomer(customer, token) {
  const accountName = customer.company_name && customer.company_name.trim()
    ? customer.company_name.trim()
    : `Individual - ${customer.first_name} ${customer.last_name}`;

  const payload = {
    data: [{
      Account_Name: accountName,
      Phone: normalizePhone(customer.phone),
      Primary_Contract_Email: customer.email,
      Client_Type: 'One-Time Order',
      Client_Status: 'Active',
      ...(customer.dot_number && { DOT_CA_Number: customer.dot_number }),
      Description: `Source: OrderLabTest.com | DOT#: ${customer.dot_number || 'not provided'} | IP: ${customer.ip_address || 'unknown'} | Date: ${new Date().toISOString()}`,
    }],
  };

  const res = await fetch(ZOHO_CRM_CUSTOMERS, {
    method: 'POST',
    headers: {
      Authorization: 'Zoho-oauthtoken ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.log(`[flow1] CRM customer create failed (${res.status}): ${err}`);
    return null;
  }

  const data = await res.json();
  const created = data.data?.[0];
  if (!created || created.status === 'error') {
    console.log('[flow1] CRM customer create returned error: ' + JSON.stringify(created));
    return null;
  }

  return created.details?.id || null;
}

// ── Zoho Books: Create Invoice ───────────────────────────────────────────────
async function createBooksInvoice(customer, testType, pricing, customerId, token, env) {
  // Step 1: Find or create Books contact
  let contactId = null;
  const searchUrl = `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}&search_text=${encodeURIComponent(customer.email)}&per_page=1`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: 'Zoho-oauthtoken ' + token },
  });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData.contacts?.[0]?.contact_id || null;
  }

  // If no contact found, create one
  if (!contactId) {
    const contactName = customer.company_name && customer.company_name.trim()
      ? customer.company_name.trim()
      : `${customer.first_name} ${customer.last_name}`;

    const contactPayload = {
      contact_name: contactName,
      email: customer.email,
      phone: customer.phone,
      contact_type: 'customer',
      contact_persons: [{
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        is_primary_contact: true,
      }],
    };

    const createRes = await fetch(
      `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Zoho-oauthtoken ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      }
    );

    if (createRes.ok) {
      const createData = await createRes.json();
      contactId = createData.contact?.contact_id || null;
    }
  }

  if (!contactId) {
    console.log('[flow1] Could not find or create Books contact');
    return null;
  }

  // Step 2: Create invoice
  const today = new Date().toISOString().split('T')[0];
  const itemId = BOOKS_ITEM_MAP[testType] || BOOKS_ITEM_MAP.pre_employment;

  const invoicePayload = {
    customer_id: contactId,
    date: today,
    payment_terms: 0,
    notes: `One-Time Order via orderlabtest.com | ${customer.first_name} ${customer.last_name} | ${customer.email}`,
    line_items: [{
      item_id: itemId,
      name: pricing.name,
      description: `${pricing.name} | ${customer.first_name} ${customer.last_name} | ${customer.email}`,
      rate: pricing.amount,
      quantity: 1,
    }],
    payment_options: {
      payment_gateways: [{
        configured: true,
        gateway_name: 'authorize_net',
        additional_field1: 'standard',
      }],
    },
  };

  const invoiceRes = await fetch(
    `https://www.zohoapis.com/books/v3/invoices?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    }
  );

  if (!invoiceRes.ok) {
    const err = await invoiceRes.text();
    console.log(`[flow1] Books invoice create failed (${invoiceRes.status}): ${err}`);
    return null;
  }

  const invoiceData = await invoiceRes.json();
  const invoice = invoiceData.invoice;
  if (!invoice) {
    console.log('[flow1] Books invoice create returned no invoice');
    return null;
  }

  // Step 3: Mark invoice as sent
  await fetch(
    `https://www.zohoapis.com/books/v3/invoices/${invoice.invoice_id}/status/sent?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  // Step 4: Record payment against the invoice (card was already charged via Auth.net)
  await fetch(
    `https://www.zohoapis.com/books/v3/customerpayments?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: contactId,
        payment_mode: 'Credit Card',
        amount: pricing.amount,
        date: today,
        invoices: [{ invoice_id: invoice.invoice_id, amount_applied: pricing.amount }],
      }),
    }
  );

  return {
    invoiceId: invoice.invoice_id,
    invoiceNumber: invoice.invoice_number,
  };
}

// ── CRM Send Mail (shows in CRM email history) ─────────────────────────────
async function sendCrmEmail(accountId, toEmail, subject, htmlContent, token) {
  // Try CRM send_mail first (shows in CRM email history)
  const crmUrl = `https://www.zohoapis.com/crm/v7/Accounts/${accountId}/actions/send_mail`;
  const crmRes = await fetch(crmUrl, {
    method: 'POST',
    headers: {
      Authorization: 'Zoho-oauthtoken ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [{
        from: {
          user_name: 'Vertical Identity',
          email: 'consortium@verticalidentity.com',
          id: '2466160000002776014'
        },
        to: [{ user_name: toEmail.split('@')[0], email: toEmail }],
        subject,
        content: htmlContent,
        mail_format: 'html',
        org_email: true
      }]
    }),
  });
  if (crmRes.ok) {
    console.log(`[crm-email] CRM send_mail success to ${toEmail}`);
    return true;
  }
  console.log(`[crm-email] CRM send_mail failed (${crmRes.status}), falling back to Zoho Mail API`);
  // Fallback: Zoho Mail API (email still sends, just won't appear in CRM history)
  const mailRes = await fetch(
    `https://mail.zoho.com/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromAddress: '"Vertical Identity Consortium" <developer@verticalidentity.com>',
        toAddress: toEmail,
        replyTo: 'consortium@verticalidentity.com',
        subject,
        content: htmlContent,
        mailFormat: 'html',
      }),
    }
  );
  const ok = mailRes.ok;
  if (!ok) console.log(`[crm-email] Zoho Mail fallback also failed (${mailRes.status}): ${await mailRes.text()}`);
  else console.log(`[crm-email] Zoho Mail fallback success to ${toEmail}`);
  return ok;
}

// ── Pool Verification Email Template ────────────────────────────────────────
function buildPoolVerificationEmail(account, drivers, ghostDrivers, der, safer, portalLink) {
  // Active = no inactive_date. Inactive = has an inactive_date.
  const activeDrivers = drivers.filter(d => !d.inactive_date);
  // Strip DOT number from company name if it ends with one (CRM stores "Company Name 1234567")
  const rawName = account.company_name || 'Your Company';
  const companyName = rawName.replace(/\s+\d{5,}$/, '').trim() || rawName;
  const dotNumber = account.dot_number || '';

  let sections = [];

  // ROSTER section (always included)
  let rosterRows = activeDrivers.map(d =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${d.name}</td><td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${d.cdl_number || 'N/A'}</td><td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${d.cdl_state || 'N/A'}</td></tr>`
  ).join('');
  if (!rosterRows) rosterRows = '<tr><td colspan="3" style="padding:8px;color:#c0392b;">No active drivers found in your pool.</td></tr>';

  sections.push('ROSTER');
  const rosterHtml = `
    <h3 style="color:#1a3a5c;margin-top:24px;">Your Current Driver Roster</h3>
    <p>The following drivers are currently listed in your random testing pool:</p>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">
      <tr style="background:#1a3a5c;color:#fff;"><th style="padding:8px 12px;text-align:left;">Driver Name</th><th style="padding:8px 12px;text-align:left;">CDL #</th><th style="padding:8px 12px;text-align:left;">State</th></tr>
      ${rosterRows}
    </table>
    <p><strong>Total active drivers: ${activeDrivers.length}</strong></p>
  `;

  // GHOST_DRIVERS section
  let ghostHtml = '';
  if (ghostDrivers && ghostDrivers.length > 0) {
    sections.push('GHOST_DRIVERS');
    const ghostRows = ghostDrivers.map(g =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${g.name}</td><td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${g.product || 'Drug Test'}</td><td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${g.service_date || 'N/A'}</td></tr>`
    ).join('');
    ghostHtml = `
      <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px;margin:16px 0;">
        <h3 style="color:#856404;margin-top:0;">&#9888; Drivers We've Tested Who Aren't In Your Pool</h3>
        <p>The following individuals had tests ordered under your DOT but are <strong>not</strong> in your active random testing pool. If they are still driving for you, they <strong>must</strong> be added.</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <tr style="background:#856404;color:#fff;"><th style="padding:8px 12px;text-align:left;">Name</th><th style="padding:8px 12px;text-align:left;">Test Type</th><th style="padding:8px 12px;text-align:left;">Date</th></tr>
          ${ghostRows}
        </table>
      </div>
    `;
  }

  // SAFER_MISMATCH section
  let saferHtml = '';
  if (safer && safer.mismatch) {
    sections.push('SAFER_MISMATCH');
    saferHtml = `
      <div style="background:#f8d7da;border-left:4px solid #dc3545;padding:16px;margin:16px 0;">
        <h3 style="color:#721c24;margin-top:0;">FMCSA Driver Count Mismatch</h3>
        <p>FMCSA SAFER shows <strong>${safer.safer_drivers} driver(s)</strong> on file, but your random pool has <strong>${safer.pool_count}</strong>. All safety-sensitive employees must be enrolled per 49 CFR &sect;382.305.</p>
      </div>
    `;
  }

  // DER sections — SKIP if VI acts as DER (nothing to collect)
  let derHtml = '';
  const derStatus = (der?.der_status || '').toLowerCase();
  const viIsDer = derStatus.includes('vi acts') || derStatus.includes('vertical');

  if (!viIsDer) {
    if (!der?.der_status) {
      sections.push('DER_BLANK');
      derHtml = `
        <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px;margin:16px 0;">
          <h3 style="color:#856404;margin-top:0;">DER Not Designated</h3>
          <p>Your account does not have a Designated Employer Representative. Federal regulations require a DER for your random pool. Please designate one during your review.</p>
        </div>
      `;
    } else if (!der.der_phone || !der.der_email) {
      sections.push('DER_MISSING_INFO');
      const missing = [];
      if (!der.der_phone) missing.push('phone number');
      if (!der.der_email) missing.push('email address');
      derHtml = `
        <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px;margin:16px 0;">
          <h3 style="color:#856404;margin-top:0;">DER Contact Info Incomplete</h3>
          <p>Your DER (${der.der_name || 'on file'}) is missing a ${missing.join(' and ')}. Please update this so we can reach them for random selections.</p>
        </div>
      `;
    }
  }

  // Count how many action items
  const actionItems = [];
  if (activeDrivers.length > 0) actionItems.push('confirm your driver roster');
  if (ghostDrivers?.length > 0) actionItems.push('review unmatched test records');
  if (derHtml) actionItems.push('update your DER info');
  if (safer?.mismatch) actionItems.push('resolve driver count mismatch');
  const actionSummary = actionItems.length > 0
    ? `You need to: <strong>${actionItems.join(', ')}</strong>.`
    : 'Please confirm your information is current.';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#333;">
      <div style="background:#1a3a5c;padding:24px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:22px;">Vertical Identity</h1>
        <p style="color:#a0c4e8;margin:4px 0 0;font-size:14px;">DOT Drug &amp; Alcohol Testing Consortium</p>
      </div>
      <div style="padding:24px;">

        <div style="text-align:center;margin-bottom:20px;">
          <a href="${portalLink}" style="color:#C8102E;font-size:20px;font-weight:bold;text-decoration:underline;">&#128680; Quarterly Random Verification — Action Required</a>
        </div>

        <p>Dear ${companyName} (DOT# ${dotNumber}),</p>

        <p><strong style="color:#C8102E;">URGENT:</strong> Your Q2 2026 random drug &amp; alcohol selection is approaching. Before we can run the quarterly selection, you must verify your driver roster is current.</p>

        <p>${actionSummary}</p>

        ${rosterHtml}
        ${ghostHtml}
        ${saferHtml}
        ${derHtml}

        <div style="text-align:center;margin:32px 0;">
          <a href="${portalLink}" style="display:inline-block;background:#C8102E;color:#fff;padding:16px 40px;text-decoration:none;border-radius:6px;font-size:18px;font-weight:bold;letter-spacing:0.5px;">Review &amp; Confirm Your Pool Now</a>
        </div>

        <p style="font-size:13px;color:#666;text-align:center;">Or copy this link: <a href="${portalLink}" style="color:#1a3a5c;">${portalLink}</a></p>

        <p style="font-size:13px;color:#666;">If you have questions, call us at <strong>(602) 899-1606</strong> or reply to this email.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;">
        <p style="font-size:11px;color:#999;">Per 49 CFR &sect;382.305, all safety-sensitive employees must be included in a random drug and alcohol testing program. Failure to maintain an accurate roster may result in FMCSA audit findings and penalties up to $16,000 per violation.</p>
        <p style="font-size:11px;color:#999;">Vertical Identity | 5227 N 7th Street, #18043, Phoenix AZ 85014 | (602) 899-1606 | consortium@verticalidentity.com</p>
      </div>
    </div>
  `;

  return { html, sections };
}

// ── Confirmation Email ───────────────────────────────────────────────────────
async function sendConfirmationEmail(customer, pricing, orderResult, invoiceNumber, token) {
  const subject = `Order Confirmation — ${pricing.name}`;
  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a5276;">Order Confirmation</h2>
      <p>Hi ${customer.first_name},</p>
      <p>Thank you for your order! Here are your details:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Test:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${pricing.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Amount Charged:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$${pricing.amount.toFixed(2)}</td></tr>
        ${invoiceNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Invoice:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${invoiceNumber}</td></tr>` : ''}
        ${orderResult?.fileNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>File #:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${orderResult.fileNumber}</td></tr>` : ''}
      </table>
      <p><strong>What happens next:</strong></p>
      <p>You will receive a text message and email with a link to complete your ePassport. The ePassport will direct you to the nearest collection site for your test.</p>
      <p>If you have any questions, call us at <strong>(888) 475-0078</strong> or email <strong>consortium@verticalidentity.com</strong>.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">Vertical Identity | DOT Drug Testing Compliance</p>
    </div>
  `;

  try {
    await fetch(
      `https://mail.zoho.com/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Zoho-oauthtoken ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: 'developer@verticalidentity.com',
          toAddress: customer.email,
          ccAddress: 'consortium@verticalidentity.com',
          subject,
          content,
          mailFormat: 'html',
        }),
      }
    );
    console.log(`[flow1] confirmation email sent to ${customer.email}`);
  } catch (e) {
    console.log(`[flow1] confirmation email failed: ${e.message}`);
  }
}

// ── Urgent TazWorks Failure Alert ─────────────────────────────────────────────
async function sendTazWorksFailureAlert(flowName, customer, testInfo, transactionId, errorMessage, token) {
  const subject = `⚠️ URGENT: TazWorks Order Failed — ${flowName} | ${customer.first_name} ${customer.last_name}`;
  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #c0392b;">TazWorks Order Failed — Manual Action Required</h2>
      <p><strong>Payment was successfully charged</strong> but the TazWorks order could not be placed automatically. Please place this order manually in TazWorks.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Flow:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${flowName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${customer.first_name} ${customer.last_name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${customer.email || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Phone:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${customer.phone || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Test:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${testInfo}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${transactionId}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Error:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd; color: #c0392b;">${errorMessage}</td></tr>
      </table>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">Automated alert from vid-orders Worker</p>
    </div>
  `;

  try {
    await fetch(
      `https://mail.zoho.com/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Zoho-oauthtoken ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: 'developer@verticalidentity.com',
          toAddress: 'consortium@verticalidentity.com',
          subject,
          content,
          mailFormat: 'html',
        }),
      }
    );
    console.log(`[alert] TazWorks failure alert sent for ${customer.email}`);
  } catch (e) {
    console.log(`[alert] Failed to send TazWorks failure alert: ${e.message}`);
  }
}

// ── Flow 2: Enrollment Invoice ───────────────────────────────────────────────
async function createEnrollInvoice(body, plan, planConfig, planAmount, drivers, pedtDrivers, pedtTotal, totalAmount, token, env) {
  // Find or create Books contact
  let contactId = null;
  const searchUrl = `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}&search_text=${encodeURIComponent(body.der_email)}&per_page=1`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: 'Zoho-oauthtoken ' + token },
  });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData.contacts?.[0]?.contact_id || null;
  }

  if (!contactId) {
    const createRes = await fetch(
      `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
      {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: body.company_name.trim(),
          email: body.der_email,
          phone: body.der_phone,
          contact_type: 'customer',
          billing_address: { street: body.address, city: body.city, state: body.state, zip: body.zip },
          contact_persons: [{
            first_name: body.der_first_name,
            last_name: body.der_last_name,
            email: body.der_email,
            phone: body.der_phone,
            is_primary_contact: true,
          }],
        }),
      }
    );
    if (createRes.ok) {
      const createData = await createRes.json();
      contactId = createData.contact?.contact_id || null;
    }
  }

  if (!contactId) {
    console.log('[enroll] Could not find or create Books contact');
    return null;
  }

  // Build line items
  const lineItems = [];

  // Plan line item
  if (plan === 'fleet') {
    lineItems.push({
      name: planConfig.label,
      description: `Fleet membership — ${drivers.length} drivers × $${planConfig.per_driver}`,
      rate: planConfig.per_driver,
      quantity: drivers.length,
    });
  } else {
    lineItems.push({
      name: planConfig.label,
      description: plan === 'single'
        ? 'Individual consortium membership (1 driver)'
        : `Fleet consortium membership (flat rate, ${drivers.length} drivers)`,
      rate: plan === 'single' ? planConfig.base : planConfig.base,
      quantity: 1,
    });
  }

  // PEDT line items (one per driver)
  for (const d of pedtDrivers) {
    lineItems.push({
      name: 'DOT Pre-Employment Drug Test',
      description: `PEDT — ${d.first_name} ${d.last_name}`,
      rate: PEDT_PRICE,
      quantity: 1,
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const invoiceRes = await fetch(
    `https://www.zohoapis.com/books/v3/invoices?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: contactId,
        date: today,
        payment_terms: 0,
        notes: `Enrollment via members.verticalidentity.com | ${body.company_name} | DOT#${body.dot_number}`,
        line_items: lineItems,
      }),
    }
  );

  if (!invoiceRes.ok) {
    console.log(`[enroll] Books invoice create failed (${invoiceRes.status}): ${await invoiceRes.text()}`);
    return null;
  }

  const invoiceData = await invoiceRes.json();
  const invoice = invoiceData.invoice;
  if (!invoice) return null;

  // Mark sent
  await fetch(
    `https://www.zohoapis.com/books/v3/invoices/${invoice.invoice_id}/status/sent?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    { method: 'POST', headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' }, body: '{}' }
  );

  // Record payment
  await fetch(
    `https://www.zohoapis.com/books/v3/customerpayments?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: contactId,
        payment_mode: 'Credit Card',
        amount: totalAmount,
        date: today,
        invoices: [{ invoice_id: invoice.invoice_id, amount_applied: totalAmount }],
      }),
    }
  );

  return { invoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number };
}

// ── Flow 2: Welcome Email ────────────────────────────────────────────────────
async function sendWelcomeEmail(body, plan, planConfig, totalAmount, drivers, tazworksOrders, invoiceNumber, token) {
  const driverRows = drivers.map(d => {
    const hasPedt = d.pedt === true;
    const order = tazworksOrders.find(o => o.driver === `${d.first_name} ${d.last_name}`);
    return `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.first_name} ${d.last_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${d.dob}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${hasPedt ? 'Yes — ordered' : 'No'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${order?.file_number || '—'}</td>
    </tr>`;
  }).join('');

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #1a5276;">Welcome to Vertical Identity!</h2>
      <p>Hi ${body.der_first_name},</p>
      <p>Thank you for enrolling <strong>${body.company_name}</strong> (DOT# ${body.dot_number}) in our DOT compliance consortium. Here's a summary of your enrollment:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Plan:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${planConfig.label}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Drivers Enrolled:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${drivers.length}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Amount Charged:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$${totalAmount.toFixed(2)}</td></tr>
        ${invoiceNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Invoice:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${invoiceNumber}</td></tr>` : ''}
      </table>
      <h3 style="color: #1a5276;">Enrolled Drivers</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead><tr style="background: #f5f5f5;">
          <th style="padding: 8px; text-align: left;">Name</th>
          <th style="padding: 8px; text-align: left;">DOB</th>
          <th style="padding: 8px; text-align: left;">PEDT</th>
          <th style="padding: 8px; text-align: left;">File #</th>
        </tr></thead>
        <tbody>${driverRows}</tbody>
      </table>
      ${tazworksOrders.length > 0 ? '<p><strong>Pre-Employment Drug Tests:</strong> Drivers with PEDTs will receive a text message and email with a link to complete their ePassport, which will direct them to the nearest collection site.</p>' : ''}
      <p><strong>What happens next:</strong></p>
      <ul>
        <li>Your company is now enrolled in our DOT random drug and alcohol testing consortium.</li>
        <li>You will receive your Drug & Alcohol Policy and consortium agreement shortly.</li>
        <li>Our team will be in touch with your DER credentials and portal access.</li>
      </ul>
      <p>If you have any questions, call us at <strong>(888) 475-0078</strong> or email <strong>consortium@verticalidentity.com</strong>.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">Vertical Identity | DOT Drug Testing Compliance</p>
    </div>
  `;

  await fetch(
    `https://mail.zoho.com/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddress: 'developer@verticalidentity.com',
        toAddress: body.der_email,
        ccAddress: 'consortium@verticalidentity.com',
        subject: `Welcome to Vertical Identity — ${body.company_name} Enrollment Confirmation`,
        content,
        mailFormat: 'html',
      }),
    }
  );
  console.log(`[enroll] welcome email sent to ${body.der_email}`);
}

// ── Twilio SMS ───────────────────────────────────────────────────────────────
async function sendOtpSms(toPhone, otp, env) {
  const digits = normalizePhone(toPhone);
  const to = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      To: to,
      MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      Body: `Your Vertical Identity verification code is ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio SMS failed (${res.status}): ${err}`);
  }
}

// ── CRM Lookup by DOT ───────────────────────────────────────────────────────
async function lookupCustomerByDot(dotNumber, token) {
  const cleaned = dotNumber.toString().replace(/\D/g, '');
  if (!cleaned) return null;

  // Try Customers module first, then Accounts fallback
  // Records may exist in either module depending on which worker created them
  const modules = [ZOHO_CRM_CUSTOMERS, 'https://www.zohoapis.com/crm/v7/Accounts/'];
  const strategies = [
    `(DOT_CA_Number:equals:${cleaned})`,
    `(DOT_CA_Number:starts_with:${cleaned})`,
  ];

  let foundModule = null;
  let account = null;

  for (const base of modules) {
    for (const criteria of strategies) {
      const url = `${base}search?criteria=${encodeURIComponent(criteria)}`;
      const res = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (res.status === 204 || !res.ok) continue;
      const data = await res.json();
      if (data.data?.length > 0) {
        const r = data.data[0];
        foundModule = base;
        account = {
          id: r.id,
          company_name: r.Account_Name || '',
          dot_number: r.DOT_CA_Number || '',
          phone: r.Company_Phone || r.Phone || r.Main_Business_Phone || '',
          email: r.Primary_Contract_Email || r.Email || '',
          client_type: r.Client_Type || '',
          client_status: r.Client_Status || '',
          address: r.Mailing_Street || '',
          city: r.Mailing_City || '',
          state: r.Mailing_State || '',
          zip: r.Mailing_Zip || '',
        };
        break;
      }
    }
    if (account) break;
  }
  if (!account) return null;

  // If account-level phone is empty, try fetching the primary contact's phone
  if (!account.phone && foundModule.includes('/Accounts/')) {
    try {
      const contactUrl = `https://www.zohoapis.com/crm/v7/Contacts/search?criteria=(Account_Name:equals:${account.id})&fields=Phone,Mobile,Primary_Contact`;
      const cRes = await fetch(contactUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (cRes.ok && cRes.status !== 204) {
        const cData = await cRes.json();
        if (cData.data?.length > 0) {
          // Prefer primary contact, otherwise take first contact with a phone
          const primary = cData.data.find(c => c.Primary_Contact === true);
          const withPhone = cData.data.find(c => c.Phone || c.Mobile);
          const contact = primary || withPhone;
          if (contact) {
            account.phone = contact.Phone || contact.Mobile || '';
            console.log(`[account] Used contact phone for ${account.company_name}: ***${(account.phone || '').slice(-4)}`);
          }
        }
      }
    } catch (e) {
      console.log('[account] Contact phone lookup failed:', e.message);
    }
  }

  return account;
}

// ── Fetch Account-Level Contacts (NOT Drivers) ─────────────────────────────
async function fetchAccountContacts(accountId, token) {
  const contacts = [];
  try {
    const url = `https://www.zohoapis.com/crm/v7/Contacts/search?criteria=(Account_Name:equals:${accountId})&fields=First_Name,Last_Name,Full_Name,Email,Phone,Mobile,Primary_Contact`;
    const res = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
    if (res.ok && res.status !== 204) {
      const data = await res.json();
      if (data.data?.length > 0) {
        for (const c of data.data) {
          const phone = c.Phone || c.Mobile || '';
          const digits = normalizePhone(phone);
          if (digits.length < 10) continue; // skip contacts with no valid phone
          contacts.push({
            id: c.id,
            name: [c.First_Name, c.Last_Name].filter(Boolean).join(' ') || c.Full_Name || 'Contact',
            phone: digits, // raw — never sent to frontend
            last4: digits.slice(-4),
            is_primary: c.Primary_Contact === true,
          });
        }
      }
    }
  } catch (e) {
    console.log('[account] fetchAccountContacts error:', e.message);
  }
  // Sort: primary contact first
  contacts.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  return contacts;
}

// ── Zoho Subscriptions ───────────────────────────────────────────────────────
const SUBSCRIPTIONS_ORG_ID = '671481277';

// Map enrollment plan names → Zoho Subscriptions plan codes
const SUBSCRIPTION_PLAN_MAP = {
  single:    'FMCSA1',   // $85/yr — Single Owner Operator
  fleet:     'Fleet10',  // $295/yr — Fleet 2-100 Drivers
  fleet_295: 'Fleet10',  // same Zoho plan, different frontend label
};

async function createSubscription(body, plan, drivers, token) {
  const planCode = SUBSCRIPTION_PLAN_MAP[plan];
  if (!planCode) {
    console.log(`[subscriptions] no plan code mapping for plan "${plan}" — skipping`);
    return null;
  }
  try {
    const ep = body.enrolling_person || {};
    const customerPayload = {
      display_name: body.company_name,
      email: ep.email || body.der_email,
      phone: ep.phone || body.der_phone,
      first_name: ep.first_name || body.der_first_name,
      last_name: ep.last_name || body.der_last_name,
      billing_address: {
        street: body.address || '',
        city: body.city || '',
        state: body.state || '',
        zip: body.zip || '',
        country: 'US',
      },
    };
    const subscriptionPayload = {
      customer: customerPayload,
      plan: {
        plan_code: planCode,
        quantity: plan === 'single' ? 1 : drivers.length,
      },
      auto_collect: false, // payment already collected via Authorize.net
    };
    const res = await fetch('https://www.zohoapis.com/subscriptions/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
        'X-com-zoho-subscriptions-organizationid': SUBSCRIPTIONS_ORG_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionPayload),
    });
    const data = await res.json();
    if (data.code === 0 && data.subscription) {
      console.log(`[subscriptions] created: ${data.subscription.subscription_id} plan=${planCode}`);
      return data.subscription.subscription_id;
    }
    console.log(`[subscriptions] create failed (code ${data.code}): ${data.message}`);
    return null;
  } catch (e) {
    console.log(`[subscriptions] create error: ${e.message}`);
    return null;
  }
}

async function fetchSubscriptions(companyName, token) {
  try {
    const url = `https://www.zohoapis.com/subscriptions/v1/subscriptions?search_text=${encodeURIComponent(companyName)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: 'Zoho-oauthtoken ' + token,
        'X-com-zoho-subscriptions-organizationid': SUBSCRIPTIONS_ORG_ID,
      },
    });
    if (!res.ok) {
      console.log(`[subscriptions] fetch failed (${res.status})`);
      return [];
    }
    const data = await res.json();
    const subs = (data.subscriptions || [])
      .filter(s => s.customer_name === companyName) // exact match to avoid false positives
      .map(s => ({
        subscription_id: s.subscription_id,
        plan_name: s.plan_name,
        status: s.status, // live, cancelled, expired, non_renewing, etc.
        amount: s.amount,
        interval: s.interval,
        interval_unit: s.interval_unit,
        current_term_starts_at: s.current_term_starts_at,
        current_term_ends_at: s.current_term_ends_at,
        next_billing_at: s.next_billing_at || s.current_term_ends_at,
        created_at: s.created_at,
        cancelled_at: s.cancelled_at || null,
      }))
      .sort((a, b) => (a.status === 'live' ? -1 : 1) - (b.status === 'live' ? -1 : 1)); // live first
    console.log(`[subscriptions] found ${subs.length} for "${companyName}"`);
    return subs;
  } catch (e) {
    console.log(`[subscriptions] error: ${e.message}`);
    return [];
  }
}

// ── Flow 3: Account Invoice ─────────────────────────────────────────────────
async function createAccountInvoice(account, lineItems, totalAmount, noteText, token, env, opts = {}) {
  // Find or create Books contact
  let contactId = null;
  const searchUrl = `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}&search_text=${encodeURIComponent(account.email)}&per_page=1`;
  const searchRes = await fetch(searchUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData.contacts?.[0]?.contact_id || null;
  }

  if (!contactId) {
    const createRes = await fetch(
      `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
      {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: account.company_name,
          email: account.email,
          phone: account.phone,
          contact_type: 'customer',
        }),
      }
    );
    if (createRes.ok) {
      const createData = await createRes.json();
      contactId = createData.contact?.contact_id || null;
    }
  }

  if (!contactId) {
    console.log('[account] Could not find or create Books contact');
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const invoiceRes = await fetch(
    `https://www.zohoapis.com/books/v3/invoices?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: contactId, date: today, payment_terms: 0, notes: noteText, line_items: lineItems }),
    }
  );

  if (!invoiceRes.ok) {
    console.log(`[account] Books invoice create failed (${invoiceRes.status}): ${await invoiceRes.text()}`);
    return null;
  }

  const invoiceData = await invoiceRes.json();
  const invoice = invoiceData.invoice;
  if (!invoice) return null;

  // Mark sent
  await fetch(
    `https://www.zohoapis.com/books/v3/invoices/${invoice.invoice_id}/status/sent?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    { method: 'POST', headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' }, body: '{}' }
  );

  // Record payment — skip for pool review (no card charged, invoice stays unpaid)
  if (!opts.skipPayment) {
    await fetch(
      `https://www.zohoapis.com/books/v3/customerpayments?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
      {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: contactId, payment_mode: 'Credit Card', amount: totalAmount,
          date: today, invoices: [{ invoice_id: invoice.invoice_id, amount_applied: totalAmount }],
        }),
      }
    );
  }

  return { invoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number };
}

// ── Flow 1 Handler ───────────────────────────────────────────────────────────

/** POST /flow1 — Non-member one-time drug test (orderlabtest.com) */
async function handleFlow1(body, env, request) {
  // 1. Validate required fields
  const required = ['first_name', 'last_name', 'phone', 'email', 'zip_code', 'test_type', 'authnet_nonce'];
  const missing = required.filter(f => !body[f]?.toString().trim());
  if (missing.length) {
    return jsonResponse({
      success: false, error: 'missing_fields',
      message: `Missing required fields: ${missing.join(', ')}`,
    }, 400, request);
  }

  const testType = body.test_type.trim().toLowerCase();
  const pricing = FLOW1_PRICING[testType];
  if (!pricing) {
    return jsonResponse({
      success: false, error: 'invalid_test_type',
      message: `Invalid test type: ${testType}. Valid types: ${Object.keys(FLOW1_PRICING).join(', ')}`,
    }, 400, request);
  }

  // Determine the reason for TazWorks — for Flow 1, test_type maps directly to reason
  const reason = testType === 'dot_alcohol' ? 'reasonable_suspicion' : testType;

  // Capture IP address from CF header
  const ipAddress = request.headers.get('cf-connecting-ip') || '';

  // ── Supabase safety net: log submission immediately ──
  const sbId = await sbInsert(1, body, request);

  // 2. Charge via Authorize.net
  console.log(`[flow1] charging $${pricing.amount} for ${pricing.name}`);
  const chargeResult = await chargeAuthNet(
    body.authnet_nonce, pricing.amount, pricing.name,
    {
      email: body.email, first_name: body.first_name, last_name: body.last_name,
      zip_code: body.zip_code,
      billing_address: body.billing_address || '',
      billing_city: body.billing_city || '',
      billing_state: body.billing_state || '',
      billing_zip: body.billing_zip || body.zip_code,
    },
    env
  );

  if (!chargeResult.success) {
    await sbLogError(sbId, 'payment', chargeResult.error);
    return jsonResponse({
      success: false, error: 'payment_declined',
      message: chargeResult.error,
    }, 402, request);
  }

  console.log(`[flow1] charge successful: txn=${chargeResult.transactionId}`);
  await sbUpdate(sbId, { status: 'payment_success', payment_transaction_id: chargeResult.transactionId, total_amount: pricing.amount });

  // Get Zoho access token for CRM + Books
  const token = await getAccessToken(env);

  // 3. Create Zoho CRM Customer (non-blocking — don't fail the order)
  let customerId = null;
  try {
    customerId = await createCrmCustomer({ ...body, ip_address: ipAddress }, token);
    console.log(`[flow1] CRM customer created: ${customerId}`);
  } catch (e) {
    console.log(`[flow1] CRM customer create error (non-blocking): ${e.message}`);
  }

  // 4. Create Zoho Books Invoice
  let invoiceResult = null;
  try {
    invoiceResult = await createBooksInvoice(body, testType, pricing, customerId, token, env);
    console.log(`[flow1] invoice created: ${invoiceResult?.invoiceNumber}`);
  } catch (e) {
    console.log(`[flow1] invoice create error (non-blocking): ${e.message}`);
  }

  // 5. Create TazWorks applicant + place order (non-blocking — payment already charged)
  const tazTestType = testType === 'dot_alcohol' ? 'dot_alcohol' : 'dot_drug';
  let orderResult = null;
  let tazFailed = false;
  try {
    const applicantGuid = await createTazWorksApplicant(body, env);
    console.log(`[flow1] TazWorks applicant created: ${applicantGuid}`);
    orderResult = await placeTazWorksOrder(
      applicantGuid, tazTestType, reason,
      invoiceResult?.invoiceNumber || '', body.email, body.zip_code, env,
      'Flow 1 One-Time Order', { dot_number: body.dot_number || '', ip_address: ipAddress }
    );
    console.log(`[flow1] TazWorks order placed: ${orderResult.orderGuid} file=${orderResult.fileNumber}`);
  } catch (e) {
    console.log(`[flow1] TazWorks FAILED (non-blocking): ${e.message}`);
    tazFailed = true;
    // Send urgent alert — payment was charged but TazWorks order needs manual placement
    try {
      await sendTazWorksFailureAlert('Flow 1 One-Time Order', body, pricing.name, chargeResult.transactionId, e.message, token);
    } catch (alertErr) {
      console.log(`[flow1] alert email also failed: ${alertErr.message}`);
    }
  }

  // 6. Send confirmation email (non-blocking)
  try {
    await sendConfirmationEmail(body, pricing, orderResult, invoiceResult?.invoiceNumber, token);
  } catch (e) {
    console.log(`[flow1] email error (non-blocking): ${e.message}`);
  }

  // 7. Mark Supabase complete
  await sbUpdate(sbId, {
    status: 'completed',
    crm_record_ids: { customer_id: customerId },
    ...(invoiceResult && { }),
  });

  // 8. Return success — payment was charged, UI should show confirmation
  return jsonResponse({
    success: true,
    route: 'flow1',
    transaction_id: chargeResult.transactionId,
    ...(orderResult?.orderGuid && { order_guid: orderResult.orderGuid }),
    ...(orderResult?.fileNumber && { file_number: orderResult.fileNumber }),
    ...(orderResult?.quickappLink && { quickapp_link: orderResult.quickappLink }),
    ...(invoiceResult && { invoice_number: invoiceResult.invoiceNumber }),
    test: pricing.name,
    amount_charged: pricing.amount,
    ...(tazFailed && { note: 'Your payment was processed successfully. Our team will follow up with testing details shortly.' }),
  }, 200, request);
}

// ── Stub Route Handlers ──────────────────────────────────────────────────────

/** POST /enroll — New consortium enrollment (members.verticalidentity.com/enroll) */
async function handleEnroll(body, env, request) {
  // 1. Validate required fields
  const required = ['company_name', 'dot_number', 'der_first_name', 'der_last_name',
    'der_phone', 'der_email', 'address', 'city', 'state', 'zip', 'plan', 'drivers', 'authnet_nonce'];
  const missing = required.filter(f => {
    const v = body[f];
    if (Array.isArray(v)) return v.length === 0;
    return !v?.toString().trim();
  });
  if (missing.length) {
    return jsonResponse({ success: false, error: 'missing_fields',
      message: `Missing required fields: ${missing.join(', ')}` }, 400, request);
  }

  // Enrolling person info (new form sends this; backward compat: fall back to DER fields)
  const ep = body.enrolling_person || {
    first_name: body.der_first_name, last_name: body.der_last_name,
    email: body.der_email, phone: body.der_phone,
  };
  if (!ep.first_name?.trim() || !ep.last_name?.trim() || !ep.email?.trim() || !ep.phone?.trim()) {
    return jsonResponse({ success: false, error: 'missing_fields',
      message: 'Enrolling person must have first_name, last_name, email, and phone' }, 400, request);
  }

  // der_selection: 'vid' (VID is DER for drivers), 'self' (enrolling person IS the DER), or 'separate' (different person)
  const derSelection = body.der_selection || 'self';

  if (!body.tc_accepted) {
    return jsonResponse({ success: false, error: 'tc_not_accepted',
      message: 'Terms and conditions must be accepted' }, 400, request);
  }

  const plan = body.plan.trim().toLowerCase();
  const planConfig = ENROLL_PLAN_PRICING[plan];
  if (!planConfig) {
    return jsonResponse({ success: false, error: 'invalid_plan',
      message: `Invalid plan: ${plan}. Valid plans: ${Object.keys(ENROLL_PLAN_PRICING).join(', ')}` }, 400, request);
  }

  const drivers = body.drivers;
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return jsonResponse({ success: false, error: 'invalid_drivers',
      message: 'drivers must be a non-empty array' }, 400, request);
  }

  // Validate each driver has required fields
  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i];
    if (!d.first_name?.trim() || !d.last_name?.trim() || !d.dob?.trim()) {
      return jsonResponse({ success: false, error: 'invalid_driver',
        message: `Driver ${i + 1} is missing first_name, last_name, or dob` }, 400, request);
    }
  }

  // 2. Calculate total (includes per-driver services beyond PEDT)
  let planAmount;
  if (plan === 'single') planAmount = planConfig.base;
  else if (plan === 'fleet') planAmount = planConfig.per_driver * drivers.length;
  else planAmount = planConfig.base; // fleet_295

  const pedtDrivers = drivers.filter(d => d.pedt === true);
  const pedtTotal = pedtDrivers.length * PEDT_PRICE;

  // Per-driver additional services (MVR, CHQ, BGC, PSP)
  let driverServicesTotal = 0;
  for (const d of drivers) {
    if (d.mvr && d.mvr_price) driverServicesTotal += parseFloat(d.mvr_price) || 0;
    if (d.clearinghouse_query) driverServicesTotal += 12;
    if (d.background_check) driverServicesTotal += 39;
    if (d.psp_report) driverServicesTotal += 20;
  }

  // Company-level upsells
  let companyUpsellTotal = 0;
  const companyUpsells = body.company_upsells || [];
  const COMPANY_UPSELL_PRICES = { clearinghouse_setup: 199, fmcsa_policy: 39, boc3: 59, ucr: 129 };
  for (const svc of companyUpsells) {
    companyUpsellTotal += COMPANY_UPSELL_PRICES[svc] || 0;
  }

  const totalAmount = planAmount + pedtTotal + driverServicesTotal + companyUpsellTotal;

  console.log(`[enroll] plan=${plan} drivers=${drivers.length} pedt=${pedtDrivers.length} driverSvcs=$${driverServicesTotal} companyUpsells=$${companyUpsellTotal} total=$${totalAmount}`);

  // ── Supabase safety net: log submission immediately ──
  const sbId = await sbInsert(2, body, request);

  // 3. Charge Auth.net (use enrolling person as billing contact — they entered the card)
  const chargeResult = await chargeAuthNet(
    body.authnet_nonce, totalAmount,
    `${planConfig.label} | ${body.company_name} | DOT#${body.dot_number}`,
    { email: ep.email, first_name: ep.first_name, last_name: ep.last_name, zip_code: body.zip },
    env
  );

  // 4. If charge fails → stop
  if (!chargeResult.success) {
    await sbLogError(sbId, 'payment', chargeResult.error);
    return jsonResponse({ success: false, error: 'payment_declined',
      message: chargeResult.error }, 402, request);
  }
  console.log(`[enroll] charge successful: txn=${chargeResult.transactionId} amount=$${totalAmount}`);
  await sbUpdate(sbId, { status: 'payment_success', payment_transaction_id: chargeResult.transactionId, total_amount: totalAmount });

  const token = await getAccessToken(env);
  let crmAccountId = null;
  let invoiceResult = null;
  const tazworksOrders = [];

  // 5. Create Zoho CRM Customer (non-blocking)
  try {
    const crmPayload = {
      data: [{
        Account_Name: body.company_name.trim(),
        DOT_CA_Number: body.dot_number.toString().trim(),
        Phone: normalizePhone(body.company_phone || body.der_phone),
        Primary_Contract_Email: body.der_email,
        Customer_Type: 'Consortium Client',
        Client_Status: 'Active',
        Mailing_Street: body.address,
        Mailing_City: body.city,
        Mailing_State: body.state,
        Mailing_Zip: body.zip,
        // DER fields
        DER_Name: `${body.der_first_name.trim()} ${body.der_last_name.trim()}`,
        DER_Phone: normalizePhone(body.der_phone),
        DER_Email: body.der_email,
        Sign_Up_Date: new Date().toISOString().split('T')[0],
      }],
    };
    const crmRes = await fetch(ZOHO_CRM_CUSTOMERS, {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(crmPayload),
    });
    if (crmRes.ok) {
      const crmData = await crmRes.json();
      crmAccountId = crmData.data?.[0]?.details?.id || null;
      console.log(`[enroll] CRM customer created: ${crmAccountId}`);
      await sbUpdate(sbId, { status: 'crm_success', crm_record_ids: { account_id: crmAccountId } });
    } else {
      const errText = await crmRes.text();
      console.log(`[enroll] CRM customer create failed (${crmRes.status}): ${errText}`);
      await sbLogError(sbId, 'crm', `Customer create failed (${crmRes.status}): ${errText}`);
    }
  } catch (e) {
    console.log(`[enroll] CRM customer create error (non-blocking): ${e.message}`);
    await sbLogError(sbId, 'crm', `Customer create error: ${e.message}`);
  }

  // 6. Create CRM Contact record(s) — non-blocking
  // Enrolling person is ALWAYS created as a Contact. If separate DER, create a second Contact.
  if (crmAccountId) {
    try {
      // Contact 1: The enrolling person
      const contactPayload = {
        data: [{
          First_Name: ep.first_name.trim(),
          Last_Name: ep.last_name.trim(),
          Email: ep.email.trim(),
          Phone: normalizePhone(ep.phone),
          Mobile: normalizePhone(ep.phone),
          Account_Name: { id: crmAccountId },
        }],
      };
      const contactRes = await fetch('https://www.zohoapis.com/crm/v7/Contacts/', {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPayload),
      });
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        const contactId = contactData.data?.[0]?.details?.id;
        console.log(`[enroll] CRM contact created for enrolling person: ${contactId}`);
      } else {
        console.log(`[enroll] CRM contact create failed (${contactRes.status}): ${await contactRes.text()}`);
      }

      // Contact 2: Separate DER (only if a different person is the DER)
      if (derSelection === 'separate') {
        const derContactPayload = {
          data: [{
            First_Name: body.der_first_name.trim(),
            Last_Name: body.der_last_name.trim(),
            Email: body.der_email.trim(),
            Phone: normalizePhone(body.der_phone),
            Mobile: normalizePhone(body.der_phone),
            Account_Name: { id: crmAccountId },
          }],
        };
        const derRes = await fetch('https://www.zohoapis.com/crm/v7/Contacts/', {
          method: 'POST',
          headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify(derContactPayload),
        });
        if (derRes.ok) {
          console.log(`[enroll] CRM contact created for separate DER`);
        } else {
          console.log(`[enroll] CRM DER contact create failed (${derRes.status}): ${await derRes.text()}`);
        }
      }
    } catch (e) {
      console.log(`[enroll] CRM contact create error (non-blocking): ${e.message}`);
    }
  }

  // 7. Create Zoho Subscription (non-blocking — payment already collected via Auth.net)
  let subscriptionId = null;
  try {
    subscriptionId = await createSubscription(body, plan, drivers, token);
    if (subscriptionId) {
      console.log(`[enroll] Zoho Subscription created: ${subscriptionId}`);
    } else {
      console.log('[enroll] Zoho Subscription creation returned null — logged but not blocking');
      await sbLogError(sbId, 'subscription', 'createSubscription returned null');
    }
  } catch (e) {
    console.log(`[enroll] Zoho Subscription error (non-blocking): ${e.message}`);
    await sbLogError(sbId, 'subscription', e.message);
  }

  // 8. Create driver records in Zoho CRM (non-blocking) — enriched with CDL fields
  if (crmAccountId) {
    try {
      const driverRecords = drivers.map(d => ({
        First_Name: d.first_name.trim(),
        Last_Name: d.last_name.trim(),
        Name: `${d.first_name.trim()} ${d.last_name.trim()}`,
        Customer_Name: { id: crmAccountId },
        DOB_for_Driver: d.dob,
        DOT_CA_Number: body.dot_number.toString().trim(),
        Pool_Status: 'Active',
        ...(d.email && { Email: d.email.trim() }),
        ...(d.phone && { Cellular_Telephone_Number: normalizePhone(d.phone) }),
        ...(d.cdl_number && { CDL_Drivers_License: d.cdl_number.trim() }),
        ...(d.cdl_state && { CDL_State_Issued: d.cdl_state.trim() }),
      }));
      const driverRes = await fetch('https://www.zohoapis.com/crm/v7/Drivers', {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: driverRecords }),
      });
      if (driverRes.ok) {
        console.log(`[enroll] ${drivers.length} CRM driver records created`);
      } else {
        console.log(`[enroll] CRM drivers create failed (${driverRes.status}): ${await driverRes.text()}`);
      }
    } catch (e) {
      console.log(`[enroll] CRM drivers create error (non-blocking): ${e.message}`);
    }
  }

  // 9. Create Zoho Books invoice with line items (non-blocking)
  try {
    invoiceResult = await createEnrollInvoice(body, plan, planConfig, planAmount, drivers, pedtDrivers, pedtTotal, totalAmount, token, env);
    console.log(`[enroll] invoice created: ${invoiceResult?.invoiceNumber}`);
  } catch (e) {
    console.log(`[enroll] invoice create error (non-blocking): ${e.message}`);
  }

  // 10. TazWorks PEDT orders — BLOCKING (return error if any fail)
  for (const driver of pedtDrivers) {
    try {
      // Create TazWorks applicant — use driver's own email/phone if available, fall back to DER
      const applicantGuid = await createTazWorksApplicant({
        first_name: driver.first_name.trim(),
        last_name: driver.last_name.trim(),
        email: driver.email?.trim() || body.der_email,
        phone: driver.phone?.trim() || body.der_phone,
      }, env);
      console.log(`[enroll] TazWorks applicant created for ${driver.first_name} ${driver.last_name}: ${applicantGuid}`);

      const orderResult = await placeTazWorksOrder(
        applicantGuid, 'dot_drug', 'pre_employment',
        invoiceResult?.invoiceNumber || '', body.der_email, body.zip, env,
        'Flow 2 Enrollment PEDT'
      );
      console.log(`[enroll] TazWorks PEDT order placed: ${orderResult.orderGuid} file=${orderResult.fileNumber}`);

      tazworksOrders.push({
        driver: `${driver.first_name} ${driver.last_name}`,
        order_guid: orderResult.orderGuid,
        file_number: orderResult.fileNumber,
        quickapp_link: orderResult.quickappLink || '',
      });
    } catch (e) {
      console.log(`[enroll] TazWorks PEDT order FAILED for ${driver.first_name} ${driver.last_name}: ${e.message}`);
      await sbLogError(sbId, 'tazworks', `PEDT failed for ${driver.first_name} ${driver.last_name}: ${e.message}`);
      return jsonResponse({
        success: false, error: 'pedt_order_failed',
        message: `Payment was charged but PEDT order failed for ${driver.first_name} ${driver.last_name}. Our team will follow up. Transaction ID: ${chargeResult.transactionId}`,
        transaction_id: chargeResult.transactionId,
        completed_orders: tazworksOrders,
      }, 500, request);
    }
  }

  // 11. Send welcome email (non-blocking)
  try {
    await sendWelcomeEmail(body, plan, planConfig, totalAmount, drivers, tazworksOrders, invoiceResult?.invoiceNumber, token);
  } catch (e) {
    console.log(`[enroll] welcome email error (non-blocking): ${e.message}`);
  }

  // TODO: Zoho Sign — enrollment agreement. Requires OAuth scope expansion. Will wire in separate session.

  // 12. Mark Supabase completed
  await sbUpdate(sbId, {
    status: 'completed',
    crm_record_ids: { account_id: crmAccountId, contacts: derSelection === 'separate' ? 2 : 1, drivers: drivers.length, subscription_id: subscriptionId },
  });

  // 13. Return success
  return jsonResponse({
    success: true,
    route: 'enroll',
    transaction_id: chargeResult.transactionId,
    ...(crmAccountId && { crm_account_id: crmAccountId }),
    ...(invoiceResult && { invoice_number: invoiceResult.invoiceNumber }),
    ...(subscriptionId && { subscription_id: subscriptionId }),
    tazworks_orders: tazworksOrders,
    plan,
    drivers_enrolled: drivers.length,
    pedt_orders: pedtDrivers.length,
    amount_charged: totalAmount,
    contacts_created: derSelection === 'separate' ? 2 : 1,
  }, 200, request);
}

/** POST /account — Existing customer actions (members.verticalidentity.com/account)
 *  Action-based router:
 *    lookup       → find CRM customer by DOT#, return masked phone
 *    send_otp     → send OTP to phone on file via Twilio
 *    verify_otp   → verify code, return account data + session token
 *    add_driver   → charge $35, create CRM driver, Books invoice
 *    order_service→ charge, fire TazWorks order, Books invoice
 */
async function handleAccount(body, env, request) {
  const action = (body.action || '').trim().toLowerCase();
  if (!action) {
    return jsonResponse({ success: false, error: 'missing_action',
      message: 'action is required: lookup, send_otp, verify_otp, add_driver, order_service' }, 400, request);
  }

  const token = await getAccessToken(env);

  // ── LOOKUP ──────────────────────────────────────────────────────────
  if (action === 'lookup') {
    if (!body.dot_number?.toString().trim()) {
      return jsonResponse({ success: false, error: 'missing_fields', message: 'dot_number is required' }, 400, request);
    }
    const account = await lookupCustomerByDot(body.dot_number, token);
    if (!account) {
      return jsonResponse({ success: false, error: 'not_found',
        message: 'No account found for that DOT number' }, 404, request);
    }

    // Build list of available phone numbers (account-level + CRM Contacts, NOT Drivers)
    const phoneOptions = [];

    // 1. CRM Contacts (MC-level contacts only — not from Drivers module)
    const contacts = await fetchAccountContacts(account.id, token);
    for (const c of contacts) {
      phoneOptions.push({ id: c.id, last4: c.last4 });
    }

    // 2. Account-level phone as fallback (only if no contacts had it)
    const acctDigits = normalizePhone(account.phone);
    if (acctDigits.length >= 10) {
      const alreadyListed = contacts.some(c => c.phone === acctDigits);
      if (!alreadyListed) {
        phoneOptions.unshift({ id: 'account', last4: acctDigits.slice(-4) });
      }
    }

    if (phoneOptions.length === 0) {
      return jsonResponse({ success: false, error: 'no_phone',
        message: 'No valid phone numbers on file. Contact support at (888) 475-0078.' }, 400, request);
    }

    return jsonResponse({
      success: true, action: 'lookup',
      company_name: account.company_name,
      dot_number: account.dot_number,
      phone_options: phoneOptions,
      client_type: account.client_type,
      client_status: account.client_status,
    }, 200, request);
  }

  // ── SEND OTP ────────────────────────────────────────────────────────
  if (action === 'send_otp') {
    if (!body.dot_number?.toString().trim()) {
      return jsonResponse({ success: false, error: 'missing_fields', message: 'dot_number is required' }, 400, request);
    }
    const account = await lookupCustomerByDot(body.dot_number, token);
    if (!account) {
      return jsonResponse({ success: false, error: 'not_found', message: 'No account found for that DOT number' }, 404, request);
    }

    // Resolve which phone to send to based on contact_id
    let phone = '';
    const contactId = (body.contact_id || '').toString().trim();

    if (contactId === 'account' || !contactId) {
      // Use account-level phone
      phone = normalizePhone(account.phone);
    } else {
      // Look up the specific CRM Contact by ID — must belong to this account
      try {
        const cUrl = `https://www.zohoapis.com/crm/v7/Contacts/${contactId}?fields=Phone,Mobile,Account_Name`;
        const cRes = await fetch(cUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
        if (cRes.ok) {
          const cData = await cRes.json();
          const contact = cData.data?.[0];
          // Verify this contact belongs to the right account
          if (contact && (contact.Account_Name?.id === account.id || contact.Account_Name === account.id)) {
            phone = normalizePhone(contact.Phone || contact.Mobile || '');
          }
        }
      } catch (e) {
        console.log('[account] Contact phone resolve error:', e.message);
      }
      // Fallback: search contacts to find the matching one
      if (!phone) {
        const contacts = await fetchAccountContacts(account.id, token);
        const match = contacts.find(c => c.id === contactId);
        if (match) phone = match.phone;
      }
    }

    if (phone.length < 10) {
      return jsonResponse({ success: false, error: 'no_phone',
        message: 'No valid phone number for that contact. Contact support at (888) 475-0078.' }, 400, request);
    }

    // Generate 6-digit OTP and store in KV
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const kvKey = `otp:${account.dot_number}`;
    await env.VAULT_TOKEN_CACHE.put(kvKey, JSON.stringify({ code: otp, phone, crm_id: account.id }), {
      expirationTtl: OTP_TTL_SECONDS,
    });
    await sendOtpSms(phone, otp, env);
    console.log(`[account] OTP sent to ***${phone.slice(-4)} for DOT#${account.dot_number} (contact: ${contactId || 'account'})`);
    return jsonResponse({ success: true, action: 'send_otp', message: 'Verification code sent' }, 200, request);
  }

  // ── VERIFY OTP ──────────────────────────────────────────────────────
  if (action === 'verify_otp') {
    if (!body.dot_number?.toString().trim() || !body.code?.toString().trim()) {
      return jsonResponse({ success: false, error: 'missing_fields', message: 'dot_number and code are required' }, 400, request);
    }
    const cleaned = body.dot_number.toString().replace(/\D/g, '');
    const kvKey = `otp:${cleaned}`;
    const stored = await env.VAULT_TOKEN_CACHE.get(kvKey, 'json');
    if (!stored) {
      return jsonResponse({ success: false, error: 'otp_expired',
        message: 'No verification code found or it has expired. Request a new one.' }, 400, request);
    }
    const userCode = body.code.toString().replace(/\D/g, '');
    if (stored.code !== userCode) {
      return jsonResponse({ success: false, error: 'otp_invalid', message: 'Incorrect verification code' }, 400, request);
    }
    // OTP valid — delete it (single use)
    await env.VAULT_TOKEN_CACHE.delete(kvKey);

    // Generate session token, store in KV with 30-min TTL
    const sessionToken = crypto.randomUUID();
    const account = await lookupCustomerByDot(body.dot_number, token);
    if (!account) {
      return jsonResponse({ success: false, error: 'not_found', message: 'Account no longer found' }, 404, request);
    }

    // Fetch drivers linked to this account
    let drivers = [];
    try {
      // Strategy 1: Search by Account_Name or Customer_Name lookup (ID match)
      // Strategy 2: Search by DOT_CA_Number (text match fallback)
      const searchStrategies = [
        { field: 'Customer_Name', value: account.id },
        { field: 'DOT_CA_Number', value: account.dot_number },
      ];
      let driverRes = null;
      for (const { field, value } of searchStrategies) {
        const driverUrl = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(${field}:equals:${value})`)}`;
        console.log(`[account] trying driver search: ${field}=${value}`);
        driverRes = await fetch(driverUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
        console.log(`[account] driver search ${field}: status=${driverRes.status}`);
        if (driverRes.ok && driverRes.status !== 204) break;
      }
      if (driverRes && driverRes.ok && driverRes.status !== 204) {
        const driverData = await driverRes.json();
        console.log(`[account] found ${driverData.data?.length || 0} drivers`);
        drivers = (driverData.data || []).map(d => ({
            id: d.id,
            first_name: d.First_Name || '',
            last_name: d.Last_Name || '',
            name: d.Name || `${d.First_Name || ''} ${d.Last_Name || ''}`.trim(),
            dob: d.Date_of_Birth || d.DOB_for_Driver || '',
            email: d.Email || d.Work_Contact_Work_Email || '',
            phone: d.Cellular_Telephone_Number || d.Work_Contact_Work_Mobile || '',
            cdl_state: d.CDL_State_Issued || '',
            cdl_number: d.CDL_Drivers_License || d.DL_Number || '',
          }));
      } else {
        console.log(`[account] no drivers found for DOT#${account.dot_number} (account id: ${account.id})`);
      }
    } catch (e) {
      console.log(`[account] driver fetch error: ${e.message}`);
    }

    // Fetch subscriptions (non-blocking — don't let it break OTP)
    let subscriptions = [];
    try {
      subscriptions = await fetchSubscriptions(account.company_name, token);
    } catch (e) {
      console.log(`[account] subscription fetch error: ${e.message}`);
    }

    await env.VAULT_TOKEN_CACHE.put(`session:${sessionToken}`, JSON.stringify({
      dot_number: account.dot_number,
      crm_id: account.id,
      company_name: account.company_name,
      phone: account.phone,
      email: account.email,
    }), { expirationTtl: SESSION_TTL_SECONDS });

    return jsonResponse({
      success: true, action: 'verify_otp',
      session_token: sessionToken,
      account: {
        company_name: account.company_name,
        dot_number: account.dot_number,
        email: account.email,
        client_type: account.client_type,
        client_status: account.client_status,
        address: account.address,
        city: account.city,
        state: account.state,
        zip: account.zip,
      },
      drivers,
      subscriptions,
    }, 200, request);
  }

  // ── Session validation for add_driver and order_service ────────────
  if (action === 'add_driver' || action === 'order_service') {
    if (!body.session_token?.trim()) {
      return jsonResponse({ success: false, error: 'unauthorized',
        message: 'session_token is required. Complete OTP verification first.' }, 401, request);
    }
    const session = await env.VAULT_TOKEN_CACHE.get(`session:${body.session_token}`, 'json');
    if (!session) {
      return jsonResponse({ success: false, error: 'session_expired',
        message: 'Session expired. Please verify your account again.' }, 401, request);
    }

    // ── ADD DRIVER ──────────────────────────────────────────────────
    if (action === 'add_driver') {
      const driver = body.driver;
      if (!driver?.first_name?.trim() || !driver?.last_name?.trim() || !driver?.dob?.trim()) {
        return jsonResponse({ success: false, error: 'missing_fields',
          message: 'driver.first_name, driver.last_name, and driver.dob are required' }, 400, request);
      }
      if (!body.authnet_nonce?.trim()) {
        return jsonResponse({ success: false, error: 'missing_fields', message: 'authnet_nonce is required' }, 400, request);
      }

      // ── Supabase safety net ──
      const sbId = await sbInsert(3, { ...body, action: 'add_driver', company_name: session.company_name, dot_number: session.dot_number }, request);

      // Charge $35
      const chargeResult = await chargeAuthNet(
        body.authnet_nonce, ADD_DRIVER_PRICE,
        `Add Driver | ${session.company_name} | DOT#${session.dot_number}`,
        { email: session.email, first_name: driver.first_name, last_name: driver.last_name, zip_code: '' },
        env
      );
      if (!chargeResult.success) {
        await sbLogError(sbId, 'payment', chargeResult.error);
        return jsonResponse({ success: false, error: 'payment_declined', message: chargeResult.error }, 402, request);
      }
      console.log(`[account] add_driver charge: txn=${chargeResult.transactionId}`);
      await sbUpdate(sbId, { status: 'payment_success', payment_transaction_id: chargeResult.transactionId, total_amount: ADD_DRIVER_PRICE });

      // Create CRM driver record (non-blocking)
      let driverCrmId = null;
      try {
        const driverRes = await fetch('https://www.zohoapis.com/crm/v7/Drivers', {
          method: 'POST',
          headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{
            First_Name: driver.first_name.trim(),
            Last_Name: driver.last_name.trim(),
            Name: `${driver.first_name.trim()} ${driver.last_name.trim()}`,
            Customer_Name: { id: session.crm_id },
            Date_of_Birth: driver.dob,
          }] }),
        });
        if (driverRes.ok) {
          const driverData = await driverRes.json();
          driverCrmId = driverData.data?.[0]?.details?.id || null;
          console.log(`[account] CRM driver created: ${driverCrmId}`);
        } else {
          console.log(`[account] CRM driver create failed: ${await driverRes.text()}`);
        }
      } catch (e) {
        console.log(`[account] CRM driver create error (non-blocking): ${e.message}`);
      }

      // Create Books invoice (non-blocking)
      let invoiceResult = null;
      try {
        invoiceResult = await createAccountInvoice(
          session,
          [{ name: 'Add Driver', description: `Add driver: ${driver.first_name} ${driver.last_name}`, rate: ADD_DRIVER_PRICE, quantity: 1 }],
          ADD_DRIVER_PRICE,
          `Add Driver | ${session.company_name} | DOT#${session.dot_number} | ${driver.first_name} ${driver.last_name}`,
          token, env
        );
      } catch (e) {
        console.log(`[account] invoice error (non-blocking): ${e.message}`);
      }

      await sbUpdate(sbId, { status: 'completed', crm_record_ids: { driver_id: driverCrmId } });

      return jsonResponse({
        success: true, action: 'add_driver',
        transaction_id: chargeResult.transactionId,
        ...(driverCrmId && { driver_crm_id: driverCrmId }),
        ...(invoiceResult && { invoice_number: invoiceResult.invoiceNumber }),
        driver_name: `${driver.first_name} ${driver.last_name}`,
        amount_charged: ADD_DRIVER_PRICE,
      }, 200, request);
    }

    // ── ORDER SERVICE ───────────────────────────────────────────────
    if (action === 'order_service') {
      const driver = body.driver;
      if (!driver?.first_name?.trim() || !driver?.last_name?.trim()) {
        return jsonResponse({ success: false, error: 'missing_fields',
          message: 'driver.first_name and driver.last_name are required' }, 400, request);
      }
      const serviceType = (body.service || '').trim().toLowerCase();
      const pricing = FLOW3_SERVICE_PRICING[serviceType];
      if (!pricing) {
        return jsonResponse({ success: false, error: 'invalid_service',
          message: `Invalid service: ${serviceType}. Valid: ${Object.keys(FLOW3_SERVICE_PRICING).join(', ')}` }, 400, request);
      }
      if (!body.authnet_nonce?.trim()) {
        return jsonResponse({ success: false, error: 'missing_fields', message: 'authnet_nonce is required' }, 400, request);
      }

      // ── Supabase safety net ──
      const sbId = await sbInsert(3, { ...body, action: 'order_service', company_name: session.company_name, dot_number: session.dot_number }, request);

      // Charge
      const chargeResult = await chargeAuthNet(
        body.authnet_nonce, pricing.amount,
        `${pricing.name} | ${session.company_name} | ${driver.first_name} ${driver.last_name}`,
        { email: session.email, first_name: driver.first_name, last_name: driver.last_name, zip_code: session.zip || '' },
        env
      );
      if (!chargeResult.success) {
        await sbLogError(sbId, 'payment', chargeResult.error);
        return jsonResponse({ success: false, error: 'payment_declined', message: chargeResult.error }, 402, request);
      }
      console.log(`[account] order_service charge: txn=${chargeResult.transactionId} service=${serviceType}`);
      await sbUpdate(sbId, { status: 'payment_success', payment_transaction_id: chargeResult.transactionId, total_amount: pricing.amount });

      // Books invoice (non-blocking)
      let invoiceResult = null;
      try {
        invoiceResult = await createAccountInvoice(
          session,
          [{ name: pricing.name, description: `${pricing.name} | ${driver.first_name} ${driver.last_name}`, rate: pricing.amount, quantity: 1 }],
          pricing.amount,
          `${pricing.name} | ${session.company_name} | DOT#${session.dot_number} | ${driver.first_name} ${driver.last_name}`,
          token, env
        );
      } catch (e) {
        console.log(`[account] invoice error (non-blocking): ${e.message}`);
      }

      // TazWorks order — non-blocking (payment already charged)
      const tazTestType = serviceType === 'dot_alcohol' ? 'dot_alcohol' : 'dot_drug';
      const reason = serviceType === 'dot_alcohol' ? 'reasonable_suspicion' : (TAZWORKS_REASON_MAP[serviceType] ? serviceType : 'pre_employment');
      let orderResult;
      let tazFailed = false;
      try {
        const applicantGuid = await createTazWorksApplicant({
          first_name: driver.first_name.trim(),
          last_name: driver.last_name.trim(),
          email: session.email,
          phone: session.phone,
        }, env);

        orderResult = await placeTazWorksOrder(
          applicantGuid, tazTestType, reason,
          invoiceResult?.invoiceNumber || '', session.email, session.zip || '', env,
          'Flow 3 Account Order'
        );
        console.log(`[account] TazWorks order: ${orderResult.orderGuid} file=${orderResult.fileNumber}`);
      } catch (e) {
        console.log(`[account] TazWorks order FAILED (non-blocking): ${e.message}`);
        tazFailed = true;
        try {
          const token = await getAccessToken(env);
          await sendTazWorksFailureAlert('Flow 3 Account Order',
            { first_name: driver.first_name, last_name: driver.last_name, email: session.email, phone: session.phone },
            pricing.name, chargeResult.transactionId, e.message, token);
        } catch (alertErr) {
          console.log(`[account] alert email also failed: ${alertErr.message}`);
        }
      }

      await sbUpdate(sbId, { status: tazFailed ? 'tazworks_failed' : 'completed' });

      return jsonResponse({
        success: true, action: 'order_service',
        transaction_id: chargeResult.transactionId,
        ...(orderResult?.orderGuid && { order_guid: orderResult.orderGuid }),
        ...(orderResult?.fileNumber && { file_number: orderResult.fileNumber }),
        ...(orderResult?.quickappLink && { quickapp_link: orderResult.quickappLink }),
        ...(invoiceResult && { invoice_number: invoiceResult.invoiceNumber }),
        service: pricing.name,
        amount_charged: pricing.amount,
        ...(tazFailed && { note: 'Your payment was processed successfully. Our team will follow up with testing details shortly.' }),
      }, 200, request);
    }
  }

  return jsonResponse({ success: false, error: 'unknown_action',
    message: `Unknown action: ${action}. Valid: lookup, send_otp, verify_otp, add_driver, order_service` }, 400, request);
}

// ── Flow 4: Invoice for non-TazWorks services ───────────────────────────────
async function createFlow4Invoice(customer, pricing, customerId, token, env) {
  // Find or create Books contact
  let contactId = null;
  const searchUrl = `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}&search_text=${encodeURIComponent(customer.email)}&per_page=1`;
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: 'Zoho-oauthtoken ' + token },
  });
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData.contacts?.[0]?.contact_id || null;
  }

  if (!contactId) {
    const contactName = customer.company_name && customer.company_name.trim()
      ? customer.company_name.trim()
      : `${customer.first_name} ${customer.last_name}`;

    const createRes = await fetch(
      `https://www.zohoapis.com/books/v3/contacts?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
      {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_name: contactName,
          email: customer.email,
          phone: customer.phone,
          contact_type: 'customer',
          contact_persons: [{
            first_name: customer.first_name,
            last_name: customer.last_name,
            email: customer.email,
            phone: customer.phone,
            is_primary_contact: true,
          }],
        }),
      }
    );
    if (createRes.ok) {
      const createData = await createRes.json();
      contactId = createData.contact?.contact_id || null;
    }
  }

  if (!contactId) {
    console.log('[order] Could not find or create Books contact');
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const invoicePayload = {
    customer_id: contactId,
    date: today,
    payment_terms: 0,
    notes: `À la Carte Order via orderlabtest.com | ${customer.first_name} ${customer.last_name} | ${customer.email}`,
    line_items: [{
      name: pricing.name,
      description: `${pricing.name} | ${customer.first_name} ${customer.last_name}`,
      rate: pricing.amount,
      quantity: 1,
    }],
  };

  const invoiceRes = await fetch(
    `https://www.zohoapis.com/books/v3/invoices?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(invoicePayload),
    }
  );

  if (!invoiceRes.ok) {
    console.log(`[order] Books invoice create failed (${invoiceRes.status}): ${await invoiceRes.text()}`);
    return null;
  }

  const invoiceData = await invoiceRes.json();
  const invoice = invoiceData.invoice;
  if (!invoice) return null;

  // Mark sent
  await fetch(
    `https://www.zohoapis.com/books/v3/invoices/${invoice.invoice_id}/status/sent?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    { method: 'POST', headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' }, body: '{}' }
  );

  // Record payment
  await fetch(
    `https://www.zohoapis.com/books/v3/customerpayments?organization_id=${env.ZOHO_BOOKS_ORG_ID}`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: contactId,
        payment_mode: 'Credit Card',
        amount: pricing.amount,
        date: today,
        invoices: [{ invoice_id: invoice.invoice_id, amount_applied: pricing.amount }],
      }),
    }
  );

  return { invoiceId: invoice.invoice_id, invoiceNumber: invoice.invoice_number };
}

// ── Flow 4: Confirmation Email ───────────────────────────────────────────────
async function sendOrderConfirmationEmail(customer, pricing, orderResult, invoiceNumber, fulfillmentStatus, token) {
  const isPending = fulfillmentStatus === 'pending_manual';
  const nextSteps = isPending
    ? '<p><strong>What happens next:</strong></p><p>Our team will process your order and follow up with you shortly via email or phone.</p>'
    : '<p><strong>What happens next:</strong></p><p>You will receive a text message and email with a link to complete your ePassport. The ePassport will direct you to the nearest collection site for your test.</p>';

  const content = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a5276;">Order Confirmation</h2>
      <p>Hi ${customer.first_name},</p>
      <p>Thank you for your order! Here are your details:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Service:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${pricing.name}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Amount Charged:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">$${pricing.amount.toFixed(2)}</td></tr>
        ${invoiceNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Invoice:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${invoiceNumber}</td></tr>` : ''}
        ${orderResult?.fileNumber ? `<tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>File #:</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${orderResult.fileNumber}</td></tr>` : ''}
      </table>
      ${nextSteps}
      <p>If you have any questions, call us at <strong>(888) 475-0078</strong> or email <strong>consortium@verticalidentity.com</strong>.</p>
      <p style="color: #666; font-size: 12px; margin-top: 30px;">Vertical Identity | DOT Drug Testing Compliance</p>
    </div>
  `;

  await fetch(
    `https://mail.zoho.com/api/accounts/${ZOHO_MAIL_ACCOUNT_ID}/messages`,
    {
      method: 'POST',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddress: 'developer@verticalidentity.com',
        toAddress: customer.email,
        ccAddress: 'consortium@verticalidentity.com',
        subject: `Order Confirmation — ${pricing.name}`,
        content,
        mailFormat: 'html',
      }),
    }
  );
  console.log(`[order] confirmation email sent to ${customer.email}`);
}

/** POST /order — À la carte single services (orderlabtest.com) */
async function handleOrder(body, env, request) {
  // 1. Validate required fields
  const required = ['first_name', 'last_name', 'phone', 'email', 'service_type', 'authnet_nonce'];
  const missing = required.filter(f => !body[f]?.toString().trim());
  if (missing.length) {
    return jsonResponse({
      success: false, error: 'missing_fields',
      message: `Missing required fields: ${missing.join(', ')}`,
    }, 400, request);
  }

  const serviceType = body.service_type.trim().toLowerCase();
  const pricing = FLOW4_PRICING[serviceType];
  if (!pricing) {
    return jsonResponse({
      success: false, error: 'invalid_service_type',
      message: `Invalid service_type: ${serviceType}. Valid types: ${Object.keys(FLOW4_PRICING).join(', ')}`,
    }, 400, request);
  }

  // CDL number + state required for MVR and background_check_driving
  const CDL_REQUIRED_TYPES = ['mvr', 'background_check_driving'];
  if (CDL_REQUIRED_TYPES.includes(serviceType)) {
    const cdlMissing = ['cdl_number', 'cdl_state'].filter(f => !body[f]?.toString().trim());
    if (cdlMissing.length) {
      return jsonResponse({
        success: false, error: 'missing_fields',
        message: `${pricing.name} requires: ${cdlMissing.join(', ')}`,
      }, 400, request);
    }
  }

  // ── Supabase safety net: log submission immediately ──
  const sbId = await sbInsert(4, body, request);

  // 2. Charge via Authorize.net
  console.log(`[order] charging $${pricing.amount} for ${pricing.name}`);
  const chargeResult = await chargeAuthNet(
    body.authnet_nonce, pricing.amount, pricing.name,
    { email: body.email, first_name: body.first_name, last_name: body.last_name, zip_code: body.zip_code || '' },
    env
  );

  if (!chargeResult.success) {
    await sbLogError(sbId, 'payment', chargeResult.error);
    return jsonResponse({
      success: false, error: 'payment_declined',
      message: chargeResult.error,
    }, 402, request);
  }

  console.log(`[order] charge successful: txn=${chargeResult.transactionId}`);
  await sbUpdate(sbId, { status: 'payment_success', payment_transaction_id: chargeResult.transactionId, total_amount: pricing.amount });

  // Get Zoho access token for CRM + Books
  const token = await getAccessToken(env);

  // 3. Create Zoho CRM Customer (non-blocking)
  let customerId = null;
  try {
    customerId = await createCrmCustomer(body, token);
    console.log(`[order] CRM customer created: ${customerId}`);
  } catch (e) {
    console.log(`[order] CRM customer create error (non-blocking): ${e.message}`);
  }

  // 4. Create Zoho Books Invoice (non-blocking)
  let invoiceResult = null;
  try {
    // Reuse Flow 1 invoice helper — map service_type to a Books item key
    const booksKey = pricing.taz_type === 'dot_drug' ? 'pre_employment'
                   : pricing.taz_type === 'dot_alcohol' ? 'dot_alcohol'
                   : null;
    if (booksKey) {
      invoiceResult = await createBooksInvoice(body, booksKey, pricing, customerId, token, env);
    } else {
      // For non-TazWorks services, create invoice manually (no Books item ID yet)
      invoiceResult = await createFlow4Invoice(body, pricing, customerId, token, env);
    }
    console.log(`[order] invoice created: ${invoiceResult?.invoiceNumber}`);
  } catch (e) {
    console.log(`[order] invoice create error (non-blocking): ${e.message}`);
  }

  // 5. If TazWorks service, place order (BLOCKING)
  let orderResult = null;
  let fulfillmentStatus = 'completed';

  if (pricing.tazworks) {
    // Map service to TazWorks reason — à la carte uses pre_employment as default reason
    const reason = 'pre_employment';
    const extraFields = {};
    if (body.cdl_number) extraFields.cdl_number = body.cdl_number;
    if (body.cdl_state) extraFields.cdl_state = body.cdl_state;

    try {
      const applicantGuid = await createTazWorksApplicant(body, env);
      console.log(`[order] TazWorks applicant created: ${applicantGuid}`);

      orderResult = await placeTazWorksOrder(
        applicantGuid, pricing.taz_type, reason,
        invoiceResult?.invoiceNumber || '', body.email, body.zip_code || '', env,
        'Flow 4 À la Carte Order', extraFields
      );
      console.log(`[order] TazWorks order placed: ${orderResult.orderGuid} file=${orderResult.fileNumber}`);
    } catch (e) {
      console.log(`[order] TazWorks order FAILED (non-blocking): ${e.message}`);
      fulfillmentStatus = 'pending_manual';
      try {
        await sendTazWorksFailureAlert('Flow 4 À la Carte Order', body, pricing.name, chargeResult.transactionId, e.message, token);
      } catch (alertErr) {
        console.log(`[order] alert email also failed: ${alertErr.message}`);
      }
    }
  } else {
    // Non-TazWorks services (e.g. clearinghouse_query) — manual fulfillment
    fulfillmentStatus = 'pending_manual';
    console.log(`[order] ${serviceType} — no TazWorks integration, flagged as pending_manual`);
  }

  // 6. Send confirmation email (non-blocking)
  try {
    await sendOrderConfirmationEmail(body, pricing, orderResult, invoiceResult?.invoiceNumber, fulfillmentStatus, token);
  } catch (e) {
    console.log(`[order] email error (non-blocking): ${e.message}`);
  }

  // 7. Mark Supabase complete
  await sbUpdate(sbId, { status: fulfillmentStatus === 'completed' ? 'completed' : 'pending_manual', crm_record_ids: { customer_id: customerId } });

  // 8. Return success
  return jsonResponse({
    success: true,
    route: 'order',
    transaction_id: chargeResult.transactionId,
    service: pricing.name,
    amount_charged: pricing.amount,
    fulfillment_status: fulfillmentStatus,
    ...(orderResult && { order_guid: orderResult.orderGuid }),
    ...(orderResult?.fileNumber && { file_number: orderResult.fileNumber }),
    ...(orderResult?.quickappLink && { quickapp_link: orderResult.quickappLink }),
    ...(invoiceResult && { invoice_number: invoiceResult.invoiceNumber }),
  }, 200, request);
}

// ── Pool Review Handler ──────────────────────────────────────────────────────
async function handlePoolReview(body, env, request) {
  const action = body.action;
  if (!action) {
    return jsonResponse({ success: false, error: 'missing_action', message: 'action is required' }, 400, request);
  }

  const token = await getAccessToken(env);

  // ── SEND POOL EMAIL ────────────────────────────────────────────────
  if (action === 'send_pool_email') {
    const dotNumber = (body.dot_number || '').toString().replace(/\D/g, '');
    if (!dotNumber) {
      return jsonResponse({ success: false, error: 'missing_fields', message: 'dot_number is required' }, 400, request);
    }

    // Lookup account
    const account = await lookupCustomerByDot(dotNumber, token);
    if (!account) {
      return jsonResponse({ success: false, error: 'not_found', message: `No account found for DOT ${dotNumber}` }, 404, request);
    }

    // Fetch DER fields from CRM
    let der = { der_status: '', der_name: '', der_phone: '', der_email: '' };
    let saferDrivers = 0;
    try {
      const accUrl = `https://www.zohoapis.com/crm/v7/Accounts/${account.id}?fields=DER,DER_Name,DER_Phone,DER_Email,SAFER_Drivers`;
      const accRes = await fetch(accUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (accRes.ok) {
        const accData = await accRes.json();
        const r = accData.data?.[0];
        if (r) {
          der = { der_status: r.DER || '', der_name: r.DER_Name || '', der_phone: r.DER_Phone || '', der_email: r.DER_Email || '' };
          saferDrivers = r.SAFER_Drivers || 0;
        }
      }
    } catch (e) {
      console.log(`[pool-review] DER fetch error: ${e.message}`);
    }

    // Fetch drivers
    let drivers = [];
    try {
      const searchStrategies = [
        { field: 'Customer_Name', value: account.id },
        { field: 'DOT_CA_Number', value: account.dot_number },
      ];
      let driverRes = null;
      for (const { field, value } of searchStrategies) {
        const driverUrl = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(${field}:equals:${value})`)}`;
        driverRes = await fetch(driverUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
        if (driverRes.ok && driverRes.status !== 204) break;
      }
      if (driverRes && driverRes.ok && driverRes.status !== 204) {
        const driverData = await driverRes.json();
        drivers = (driverData.data || []).map(d => ({
          id: d.id,
          name: d.Name || `${d.First_Name || ''} ${d.Last_Name || ''}`.trim(),
          first_name: d.First_Name || '',
          last_name: d.Last_Name || '',
          cdl_number: d.CDL_Drivers_License || d.DL_Number || '',
          cdl_state: d.CDL_State_Issued || '',
          pool_status: d.Pool_Status || '',
          dob: d.Date_of_Birth || d.DOB_for_Driver || '',
          inactive_date: d.Inactive_Date || '',
          email: d.Email || d.Work_Contact_Work_Email || '',
          phone: d.Cellular_Telephone_Number || d.Work_Contact_Work_Mobile || '',
        }));
      }
    } catch (e) {
      console.log(`[pool-review] driver fetch error: ${e.message}`);
    }

    // Fetch ghost drivers from KV
    let ghostDrivers = [];
    try {
      const ghostData = await env.VAULT_TOKEN_CACHE.get('pool_ghost_drivers', 'json');
      if (ghostData && ghostData[dotNumber]) {
        ghostDrivers = ghostData[dotNumber];
      }
    } catch (e) {
      console.log(`[pool-review] ghost driver fetch error: ${e.message}`);
    }

    const activeCount = drivers.filter(d => !d.inactive_date).length;
    const safer = { safer_drivers: saferDrivers, pool_count: activeCount, mismatch: saferDrivers > 0 && saferDrivers !== activeCount };
    const portalLink = `https://members.verticalidentity.com/pool-review?dot=${dotNumber}`;

    const { html, sections } = buildPoolVerificationEmail(account, drivers, ghostDrivers, der, safer, portalLink);
    const cleanName = (account.company_name || '').replace(/\s+\d{5,}$/, '').trim() || account.company_name;
    const subject = `URGENT: Action Required Before Q2 Random Selection — ${cleanName} DOT ${dotNumber}`;

    const toEmail = body.to_email || account.email;
    if (!toEmail) {
      return jsonResponse({ success: false, error: 'no_email', message: 'No email address found for this account' }, 400, request);
    }

    const sent = await sendCrmEmail(account.id, toEmail, subject, html, token);
    if (!sent) {
      return jsonResponse({ success: false, error: 'email_failed', message: 'Failed to send email via CRM' }, 500, request);
    }

    console.log(`[pool-review] email sent to ${toEmail} for DOT#${dotNumber} sections=[${sections.join(',')}]`);

    // Log to KV for dashboard tracking
    try {
      const emailLog = await env.VAULT_TOKEN_CACHE.get('pool_email_log', 'json') || {};
      emailLog[dotNumber] = {
        dot_number: dotNumber,
        company_name: account.company_name || '',
        email: toEmail,
        sent_at: new Date().toISOString(),
        sections,
      };
      await env.VAULT_TOKEN_CACHE.put('pool_email_log', JSON.stringify(emailLog));
    } catch (e) {
      console.log(`[pool-review] email log save error: ${e.message}`);
    }

    // Add CRM note with portal link + flagged issues — so team can handle call-ins
    try {
      const portalUrl = `https://members.verticalidentity.com/pool-review?dot=${dotNumber}`;
      const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      const flagList = [];
      if (sections.includes('GHOST_DRIVERS')) flagList.push('Unmatched drivers found in TazWorks');
      if (sections.includes('SAFER_MISMATCH')) flagList.push('FMCSA driver count mismatch');
      if (sections.includes('DER_BLANK')) flagList.push('No DER designated');
      if (sections.includes('DER_MISSING_INFO')) flagList.push('DER contact info incomplete');
      const flags = flagList.length > 0 ? '\n\nFlags:\n' + flagList.map(f => '  ⚠ ' + f).join('\n') : '\n\nNo flags — roster confirmation only.';

      const noteContent = `Q2 2026 Pool Verification Email Sent — ${now}\n\nSent to: ${toEmail}\nPortal link: ${portalUrl}${flags}\n\nIf customer calls in, use the portal link above to walk them through verification or send it to them directly.`;

      await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${account.id}/Notes`, {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ Note_Title: 'Q2 Pool Verification — Email Sent', Note_Content: noteContent }] }),
      });
      console.log(`[pool-review] CRM send note added for DOT#${dotNumber}`);
    } catch (e) {
      console.log(`[pool-review] CRM send note error: ${e.message}`);
    }

    return jsonResponse({ success: true, sent_to: toEmail, subject, sections_included: sections }, 200, request);
  }

  // ── LOAD PAYMENT — no auth needed, pay page accessed by bookkeeper ──
  if (action === 'load_payment') {
    const payToken = body.pay_token?.trim();
    if (!payToken) return jsonResponse({ success: false, error: 'missing_token' }, 400, request);
    const payData = await env.VAULT_TOKEN_CACHE.get(`pool_pay:${payToken}`, 'json');
    if (!payData) return jsonResponse({ success: false, error: 'expired', message: 'This payment link has expired or already been used.' }, 404, request);
    const cleanName = (payData.company_name || '').replace(/\s+\d{5,}$/, '').trim();
    return jsonResponse({ success: true, company_name: cleanName, dot_number: payData.dot_number, amount: payData.amount }, 200, request);
  }

  // ── PROCESS PAYMENT — no auth needed, uses pay token + card nonce ──
  if (action === 'process_payment') {
    const payToken = body.pay_token?.trim();
    const authnetNonce = body.authnet_nonce?.trim();
    if (!payToken || !authnetNonce) return jsonResponse({ success: false, error: 'missing_fields' }, 400, request);

    const payData = await env.VAULT_TOKEN_CACHE.get(`pool_pay:${payToken}`, 'json');
    if (!payData) return jsonResponse({ success: false, error: 'expired', message: 'This payment link has expired or already been used.' }, 404, request);

    // Create a temporary session for the submit
    const tempSession = `temp_${Date.now()}`;
    await env.VAULT_TOKEN_CACHE.put(`session:${tempSession}`, JSON.stringify({
      dot_number: payData.dot_number,
      crm_id: payData.crm_id,
      company_name: payData.company_name,
      phone: payData.phone,
      email: payData.email,
    }), { expirationTtl: 300 });

    const submitBody = {
      action: 'submit_review',
      session_token: tempSession,
      ...payData.pending_changes,
      authnet_nonce: authnetNonce,
      zip_code: body.zip_code || '',
    };
    const submitRes = await handlePoolReview(submitBody, env, request);

    // Delete the payment token so it can't be used again
    await env.VAULT_TOKEN_CACHE.delete(`pool_pay:${payToken}`);
    await env.VAULT_TOKEN_CACHE.delete(`session:${tempSession}`);

    return submitRes;
  }

  // ── Session-protected actions ──────────────────────────────────────
  if (!body.session_token?.trim()) {
    return jsonResponse({ success: false, error: 'unauthorized', message: 'session_token is required' }, 401, request);
  }
  const session = await env.VAULT_TOKEN_CACHE.get(`session:${body.session_token}`, 'json');
  if (!session) {
    return jsonResponse({ success: false, error: 'session_expired', message: 'Session expired. Please verify your account again.' }, 401, request);
  }

  // ── NOTIFY SKIP PAYMENT — customer has changes but can't pay now ──
  if (action === 'notify_skip_payment') {
    const dotNumber = body.dot_number || session.dot_number;
    const companyName = (body.company_name || session.company_name || '').replace(/\s+\d{5,}$/, '').trim();
    const amount = body.amount_due || 0;

    // Send email to Nick
    try {
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;">
          <h2 style="color:#C8102E;">Pool Verification — Payment Skipped</h2>
          <p><strong>${companyName}</strong> (DOT# ${dotNumber}) completed their Q2 pool verification but chose not to pay at this time.</p>
          <p><strong>Amount due:</strong> $${amount}</p>
          <p><strong>Portal link:</strong> <a href="https://members.verticalidentity.com/pool-review?dot=${dotNumber}">View their verification</a></p>
          <p style="color:#856404;font-weight:bold;">Changes were NOT submitted. Follow up to collect payment and process their updates.</p>
        </div>
      `;
      await sendCrmEmail(session.crm_id, 'nicholas@verticalidentity.com', `Pool Verification: ${companyName} DOT ${dotNumber} — Payment Skipped ($${amount})`, emailHtml, token);
      console.log(`[pool-review] skip payment notification sent for DOT#${dotNumber}`);
    } catch (e) {
      console.log(`[pool-review] skip payment notify error: ${e.message}`);
    }

    return jsonResponse({ success: true, notified: true }, 200, request);
  }

  // ── SEND PAYMENT LINK — save pending changes + email a pay link ──
  if (action === 'send_payment_link') {
    const toEmail = body.to_email?.trim();
    if (!toEmail) return jsonResponse({ success: false, message: 'Email address is required' }, 400, request);

    const amount = body.amount || 0;
    const pendingChanges = body.pending_changes || {};
    const cleanName = (session.company_name || '').replace(/\s+\d{5,}$/, '').trim();

    // Generate a unique payment token and save pending changes to KV
    const payToken = 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const payData = {
      dot_number: session.dot_number,
      crm_id: session.crm_id,
      company_name: session.company_name,
      email: session.email,
      phone: session.phone,
      amount,
      pending_changes: pendingChanges,
      created_at: new Date().toISOString(),
      to_email: toEmail,
    };
    await env.VAULT_TOKEN_CACHE.put(`pool_pay:${payToken}`, JSON.stringify(payData), { expirationTtl: 7 * 24 * 3600 }); // 7 day expiry

    const payUrl = `https://members.verticalidentity.com/pool-pay.html?token=${payToken}`;

    // Send email with payment link
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0A1628;padding:20px;text-align:center;">
          <img src="https://verticalidentity.com/wp-content/uploads/2023/01/Logo-1.png" alt="Vertical Identity" style="height:40px;">
        </div>
        <div style="padding:24px;">
          <h2 style="color:#0A1628;margin-top:0;">Payment Required — Pool Verification</h2>
          <p><strong>${cleanName}</strong> (DOT# ${session.dot_number}) has completed their quarterly random pool verification and has changes that require payment.</p>
          <div style="background:#f7f8fa;border:1px solid #e2e5eb;border-radius:8px;padding:16px;margin:16px 0;text-align:center;">
            <div style="font-size:12px;color:#5a6278;text-transform:uppercase;letter-spacing:1px;">Amount Due</div>
            <div style="font-family:'Arial Black',sans-serif;font-size:36px;font-weight:800;color:#0A1628;">$${amount.toFixed(2)}</div>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${payUrl}" style="display:inline-block;background:#C8102E;color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.5px;">Pay Now</a>
          </div>
          <p style="font-size:13px;color:#5a6278;">This link expires in 7 days. Once payment is received, the pool changes will be processed automatically.</p>
          <p style="font-size:13px;color:#5a6278;">Questions? Call us at <a href="tel:6028991606" style="color:#C8102E;">602-899-1606</a></p>
        </div>
      </div>
    `;
    await sendCrmEmail(session.crm_id, toEmail, `Payment Required: ${cleanName} Pool Verification — $${amount.toFixed(2)}`, emailHtml, token);

    console.log(`[pool-review] payment link sent to ${toEmail} for DOT#${session.dot_number} amount=$${amount} token=${payToken}`);
    return jsonResponse({ success: true, sent_to: toEmail, pay_url: payUrl }, 200, request);
  }


  // ── LOAD REVIEW ────────────────────────────────────────────────────
  if (action === 'load_review') {
    const account = await lookupCustomerByDot(session.dot_number, token);
    if (!account) {
      return jsonResponse({ success: false, error: 'not_found', message: 'Account not found' }, 404, request);
    }

    // Fetch DER + SAFER from CRM account record
    let der = { der_status: '', der_name: '', der_phone: '', der_email: '' };
    let saferDrivers = 0;
    try {
      const accUrl = `https://www.zohoapis.com/crm/v7/Accounts/${account.id}?fields=DER,DER_Name,DER_Phone,DER_Email,SAFER_Drivers`;
      const accRes = await fetch(accUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (accRes.ok) {
        const accData = await accRes.json();
        const r = accData.data?.[0];
        if (r) {
          der = { der_status: r.DER || '', der_name: r.DER_Name || '', der_phone: r.DER_Phone || '', der_email: r.DER_Email || '' };
          saferDrivers = r.SAFER_Drivers || 0;
        }
      }
    } catch (e) {
      console.log(`[pool-review] DER fetch error: ${e.message}`);
    }

    // Fetch drivers (same pattern as verify_otp)
    let drivers = [];
    try {
      const searchStrategies = [
        { field: 'Customer_Name', value: account.id },
        { field: 'DOT_CA_Number', value: account.dot_number },
      ];
      let driverRes = null;
      for (const { field, value } of searchStrategies) {
        const driverUrl = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(${field}:equals:${value})`)}&fields=First_Name,Last_Name,Name,Date_of_Birth,DOB_for_Driver,Email,Work_Contact_Work_Email,Cellular_Telephone_Number,Work_Contact_Work_Mobile,CDL_Drivers_License,DL_Number,CDL_State_Issued,Pool_Status,Inactive_Date`;
        driverRes = await fetch(driverUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
        if (driverRes.ok && driverRes.status !== 204) break;
      }
      if (driverRes && driverRes.ok && driverRes.status !== 204) {
        const driverData = await driverRes.json();
        drivers = (driverData.data || []).map(d => ({
          id: d.id,
          name: d.Name || `${d.First_Name || ''} ${d.Last_Name || ''}`.trim(),
          first_name: d.First_Name || '',
          last_name: d.Last_Name || '',
          cdl_number: d.CDL_Drivers_License || d.DL_Number || '',
          cdl_state: d.CDL_State_Issued || '',
          pool_status: d.Pool_Status || '',
          dob: d.Date_of_Birth || d.DOB_for_Driver || '',
          inactive_date: d.Inactive_Date || '',
          email: d.Email || d.Work_Contact_Work_Email || '',
          phone: d.Cellular_Telephone_Number || d.Work_Contact_Work_Mobile || '',
        }));
      }
    } catch (e) {
      console.log(`[pool-review] driver fetch error: ${e.message}`);
    }

    // Fetch ghost drivers from KV
    let ghostDrivers = [];
    try {
      const ghostData = await env.VAULT_TOKEN_CACHE.get('pool_ghost_drivers', 'json');
      if (ghostData && ghostData[session.dot_number]) {
        ghostDrivers = ghostData[session.dot_number];
      }
    } catch (e) {
      console.log(`[pool-review] ghost driver fetch error: ${e.message}`);
    }

    const activeCount = drivers.filter(d => !d.inactive_date).length;
    const safer = {
      safer_drivers: saferDrivers,
      pool_count: activeCount,
      mismatch: saferDrivers > 0 && saferDrivers !== activeCount,
    };

    return jsonResponse({
      success: true,
      account: {
        company_name: account.company_name,
        dot_number: account.dot_number,
        email: account.email,
        client_status: account.client_status,
      },
      drivers,
      ghost_drivers: ghostDrivers,
      der,
      safer,
    }, 200, request);
  }

  // ── SUBMIT REVIEW ──────────────────────────────────────────────────
  if (action === 'submit_review') {
    const sbId = await sbInsert(5, { ...body, company_name: session.company_name, dot_number: session.dot_number }, request);
    const results = { removed: [], added: [], reactivated: [], der_updated: false, charged: 0, invoice: null };

    // Build a lookup of driver IDs → names for the CRM note
    const driverNameMap = {};
    try {
      const dUrl = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(Customer_Name:equals:${session.crm_id})`)}&fields=Name,First_Name,Last_Name`;
      const dRes = await fetch(dUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (dRes.ok && dRes.status !== 204) {
        const dData = await dRes.json();
        (dData.data || []).forEach(d => { driverNameMap[d.id] = d.Name || `${d.First_Name || ''} ${d.Last_Name || ''}`.trim(); });
      }
    } catch (e) { /* non-critical */ }
    body._driver_names = driverNameMap;

    // Process driver_confirmations — mark drivers as inactive
    // Removal date is ALWAYS today — the date they report it is the official date
    const today = new Date().toISOString().split('T')[0];
    if (body.driver_confirmations?.length) {
      for (const dc of body.driver_confirmations) {
        if (dc.still_driving === false && dc.driver_id) {
          try {
            const updateRes = await fetch(`https://www.zohoapis.com/crm/v7/Drivers/${dc.driver_id}`, {
              method: 'PUT',
              headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: [{ Pool_Status: 'Inactive', Inactive_Date: today }] }),
            });
            if (updateRes.ok) {
              results.removed.push({ id: dc.driver_id, name: driverNameMap[dc.driver_id] || dc.driver_id });
              console.log(`[pool-review] driver ${dc.driver_id} set to Inactive (${today})`);
            } else {
              console.log(`[pool-review] driver ${dc.driver_id} update failed: ${updateRes.status}`);
            }
          } catch (e) {
            console.log(`[pool-review] driver ${dc.driver_id} update error: ${e.message}`);
          }
        }
      }
    }

    // Process reactivations — create NEW driver record (old stays as history with Inactive_Date)
    // Frontend sends array of driver ID strings
    if (body.reactivations?.length) {
      for (const r of body.reactivations) {
        const driverId = typeof r === 'string' ? r : r.driver_id;
        if (!driverId) continue;
        try {
          // Fetch old driver's info to clone into new record
          const oldRes = await fetch(`https://www.zohoapis.com/crm/v7/Drivers/${driverId}?fields=First_Name,Last_Name,Name,Date_of_Birth,DOB_for_Driver,Email,Work_Contact_Work_Email,Cellular_Telephone_Number,Work_Contact_Work_Mobile,CDL_Drivers_License,DL_Number,CDL_State_Issued,Customer_Name,DOT_CA_Number`, {
            headers: { Authorization: 'Zoho-oauthtoken ' + token },
          });
          if (!oldRes.ok) {
            console.log(`[pool-review] could not fetch old driver ${driverId}: ${oldRes.status}`);
            continue;
          }
          const oldData = await oldRes.json();
          const old = oldData.data?.[0];
          if (!old) continue;

          // Create new active driver record with same info
          const newDriver = {
            First_Name: old.First_Name || '',
            Last_Name: old.Last_Name || '',
            Name: old.Name || `${old.First_Name || ''} ${old.Last_Name || ''}`.trim(),
            Customer_Name: old.Customer_Name?.id ? { id: old.Customer_Name.id } : { id: session.crm_id },
            DOT_CA_Number: old.DOT_CA_Number || session.dot_number,
            Pool_Status: 'Active',
            // No Inactive_Date = active in pool
            ...(old.Date_of_Birth && { Date_of_Birth: old.Date_of_Birth }),
            ...(old.DOB_for_Driver && { DOB_for_Driver: old.DOB_for_Driver }),
            ...((old.Email || old.Work_Contact_Work_Email) && { Email: old.Email || old.Work_Contact_Work_Email }),
            ...((old.Cellular_Telephone_Number || old.Work_Contact_Work_Mobile) && { Cellular_Telephone_Number: old.Cellular_Telephone_Number || old.Work_Contact_Work_Mobile }),
            ...((old.CDL_Drivers_License || old.DL_Number) && { CDL_Drivers_License: old.CDL_Drivers_License || old.DL_Number }),
            ...(old.CDL_State_Issued && { CDL_State_Issued: old.CDL_State_Issued }),
          };

          const createRes = await fetch('https://www.zohoapis.com/crm/v7/Drivers', {
            method: 'POST',
            headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [newDriver] }),
          });
          if (createRes.ok) {
            const dd = await createRes.json();
            const newId = dd.data?.[0]?.details?.id || 'created';
            results.reactivated.push({ id: newId, name: old.Name || `${old.First_Name || ''} ${old.Last_Name || ''}`.trim() });
            console.log(`[pool-review] driver ${old.Name} reactivated as new record ${newId} (old ${driverId} kept with Inactive_Date)`);
          } else {
            const errText = await createRes.text();
            console.log(`[pool-review] reactivation create failed: ${createRes.status} ${errText}`);
          }
        } catch (e) {
          console.log(`[pool-review] reactivation error: ${e.message}`);
        }
      }
    }

    // Process ghost_adds — create new CRM driver records
    const ghostAdds = body.ghost_adds || [];
    for (const g of ghostAdds) {
      try {
        const driverRes = await fetch('https://www.zohoapis.com/crm/v7/Drivers', {
          method: 'POST',
          headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{
            First_Name: (g.first_name || g.name?.split(' ')[0] || '').trim(),
            Last_Name: (g.last_name || g.name?.split(' ').slice(1).join(' ') || '').trim(),
            Name: g.name || `${g.first_name || ''} ${g.last_name || ''}`.trim(),
            Customer_Name: { id: session.crm_id },
            DOT_CA_Number: session.dot_number,
            Pool_Status: 'Active',
            ...(g.dob && { DOB_for_Driver: g.dob }),
            ...(g.cdl_number && { CDL_Drivers_License: g.cdl_number }),
            ...(g.cdl_state && { CDL_State_Issued: g.cdl_state }),
            ...(g.email && { Email: g.email }),
            ...(g.phone && { Cellular_Telephone_Number: normalizePhone(g.phone) }),
          }] }),
        });
        if (driverRes.ok) {
          const dd = await driverRes.json();
          results.added.push({ id: dd.data?.[0]?.details?.id || 'created', name: g.name || `${g.first_name || ''} ${g.last_name || ''}`.trim(), type: 'ghost' });
          console.log(`[pool-review] ghost driver added: ${g.name}`);
        } else {
          console.log(`[pool-review] ghost driver create failed: ${driverRes.status}`);
        }
      } catch (e) {
        console.log(`[pool-review] ghost add error: ${e.message}`);
      }
    }

    // Process new_drivers — create new CRM driver records
    const newDrivers = body.new_drivers || [];
    for (const nd of newDrivers) {
      try {
        const driverRes = await fetch('https://www.zohoapis.com/crm/v7/Drivers', {
          method: 'POST',
          headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{
            First_Name: (nd.first_name || '').trim(),
            Last_Name: (nd.last_name || '').trim(),
            Name: `${(nd.first_name || '').trim()} ${(nd.last_name || '').trim()}`.trim(),
            Customer_Name: { id: session.crm_id },
            DOT_CA_Number: session.dot_number,
            Pool_Status: 'Active',
            ...(nd.dob && { DOB_for_Driver: nd.dob }),
            ...(nd.cdl_number && { CDL_Drivers_License: nd.cdl_number }),
            ...(nd.cdl_state && { CDL_State_Issued: nd.cdl_state }),
            ...(nd.email && { Email: nd.email }),
            ...(nd.phone && { Cellular_Telephone_Number: normalizePhone(nd.phone) }),
          }] }),
        });
        if (driverRes.ok) {
          const dd = await driverRes.json();
          results.added.push({ id: dd.data?.[0]?.details?.id || 'created', name: `${(nd.first_name || '').trim()} ${(nd.last_name || '').trim()}`.trim(), type: 'new' });
          console.log(`[pool-review] new driver added: ${nd.first_name} ${nd.last_name}`);
        } else {
          console.log(`[pool-review] new driver create failed: ${driverRes.status}`);
        }
      } catch (e) {
        console.log(`[pool-review] new driver error: ${e.message}`);
      }
    }

    // Process DER choice — frontend sends der_choice as string + der_info as object
    if (body.der_choice && body.der_choice !== 'vi_acts_as_der') {
      try {
        const derUpdate = {};
        const info = body.der_info || {};
        if (body.der_choice === 'own_der') {
          derUpdate.DER = 'Own DER';
          if (info.name) derUpdate.DER_Name = info.name;
          if (info.phone) derUpdate.DER_Phone = info.phone;
          if (info.email) derUpdate.DER_Email = info.email;
        }
        if (Object.keys(derUpdate).length > 0) {
          const updateRes = await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${session.crm_id}`, {
            method: 'PUT',
            headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [derUpdate] }),
          });
          results.der_updated = updateRes.ok;
          console.log(`[pool-review] DER updated: ${updateRes.ok}`);
        }
      } catch (e) {
        console.log(`[pool-review] DER update error: ${e.message}`);
      }
    } else if (body.der_choice === 'vi_acts_as_der') {
      try {
        const updateRes = await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${session.crm_id}`, {
          method: 'PUT',
          headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{ DER: 'VI Acts as DER', DER_Name: 'Vertical Identity Consortium', DER_Phone: '6028991606', DER_Email: 'consortium@verticalidentity.com' }] }),
        });
        results.der_updated = updateRes.ok;
        console.log(`[pool-review] DER set to VI: ${updateRes.ok}`);
      } catch (e) {
        console.log(`[pool-review] DER update error: ${e.message}`);
      }
    }

    // Create invoice for billable additions (reactivations + ghost adds)
    const addCount = results.added.length + results.reactivated.length;
    if (addCount > 0) {
      const chargeAmount = 25 * addCount;
      results.billable_amount = chargeAmount;

      // Always create a Books invoice — use actual CON-ADD1 item, one line per driver
      try {
        const BOOKS_ADD_DRIVER_ITEM_ID = '1456902000001874001'; // CON-ADD1: Consortium Additional Driver Fee $25
        const lineItems = [];
        for (const r of results.reactivated) {
          const driverName = typeof r === 'object' ? r.name : 'Driver';
          lineItems.push({ item_id: BOOKS_ADD_DRIVER_ITEM_ID, description: `Driver Reactivation: ${driverName} — Q2 2026 pool verification`, rate: 25, quantity: 1 });
        }
        for (const a of results.added) {
          const driverName = typeof a === 'object' ? a.name : 'Driver';
          lineItems.push({ item_id: BOOKS_ADD_DRIVER_ITEM_ID, description: `Add Driver: ${driverName} — Q2 2026 pool verification`, rate: 25, quantity: 1 });
        }
        const invoiceResult = await createAccountInvoice(session, lineItems, chargeAmount, `Q2 2026 Pool Review — ${addCount} driver(s) added/reactivated`, token, env, { skipPayment: true });
        if (invoiceResult) {
          results.invoice = invoiceResult.invoiceNumber;
          console.log(`[pool-review] invoice created: ${invoiceResult.invoiceNumber} for $${chargeAmount}`);
        }
      } catch (e) {
        console.log(`[pool-review] invoice error: ${e.message}`);
        results.invoice_error = e.message;
      }

      // If card nonce provided, charge immediately and mark invoice paid
      // Handle both string nonce and {dataValue, dataDescriptor} object
      const rawNonce = body.authnet_nonce;
      const nonce = typeof rawNonce === 'object' ? rawNonce?.dataValue : rawNonce;
      if (nonce?.trim()) {
        const chargeResult = await chargeAuthNet(
          nonce, chargeAmount,
          `Pool Review (${addCount} drivers) | ${session.company_name} | DOT#${session.dot_number}`,
          { email: session.email, first_name: session.company_name, last_name: '', zip_code: body.zip_code || '' },
          env
        );
        if (chargeResult.success) {
          results.charged = chargeAmount;
          results.transaction_id = chargeResult.transactionId;
          console.log(`[pool-review] charged $${chargeAmount} txn=${chargeResult.transactionId}`);
          // Record payment on the invoice to mark it paid
          if (results.invoice) {
            try {
              // Lookup invoice ID by number
              const invSearchUrl = `https://www.zohoapis.com/books/v3/invoices?organization_id=${env.ZOHO_BOOKS_ORG_ID}&invoice_number=${results.invoice}`;
              const invSearchRes = await fetch(invSearchUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
              if (invSearchRes.ok) {
                const invData = await invSearchRes.json();
                const inv = invData.invoices?.[0];
                if (inv) {
                  const today = new Date().toISOString().split('T')[0];
                  await fetch(`https://www.zohoapis.com/books/v3/customerpayments?organization_id=${env.ZOHO_BOOKS_ORG_ID}`, {
                    method: 'POST',
                    headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      customer_id: inv.customer_id, payment_mode: 'Credit Card', amount: chargeAmount,
                      date: today, reference_number: chargeResult.transactionId,
                      invoices: [{ invoice_id: inv.invoice_id, amount_applied: chargeAmount }],
                    }),
                  });
                  results.payment_recorded = true;
                  console.log(`[pool-review] payment recorded on invoice ${results.invoice}`);
                }
              }
            } catch (e) {
              console.log(`[pool-review] payment record error: ${e.message}`);
            }
          }
        } else {
          console.log(`[pool-review] payment failed: ${chargeResult.error}`);
          results.payment_error = chargeResult.error;
        }
      } else {
        results.charged = 0;
        results.payment_note = `Invoice created for $${chargeAmount} — payment pending`;
        console.log(`[pool-review] invoice created, no card — payment pending $${chargeAmount}`);
      }
    }

    // Update CRM account with review timestamp
    try {
      await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${session.crm_id}`, {
        method: 'PUT',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ Last_Pool_Review: new Date().toISOString().split('T')[0] }] }),
      });
    } catch (e) {
      console.log(`[pool-review] timestamp update error: ${e.message}`);
    }

    // Add CRM note with full summary of what the customer did
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      const lines = [`Q2 2026 Pool Verification — Completed ${dateStr}`];
      lines.push('');

      // Confirmed active
      const confirmedActive = (body.driver_confirmations || []).filter(c => c.still_driving);
      if (confirmedActive.length > 0) {
        lines.push(`✓ Confirmed ${confirmedActive.length} active driver(s) — no changes`);
      }

      // Removed
      if (results.removed.length > 0) {
        lines.push(`✗ Removed ${results.removed.length} driver(s) from pool:`);
        for (const dc of (body.driver_confirmations || [])) {
          if (!dc.still_driving) {
            const d = (body._driver_names || {})[dc.driver_id] || dc.driver_id;
            lines.push(`  - ${d} (effective today)`);
          }
        }
      }

      // Reactivated
      if (results.reactivated.length > 0) {
        lines.push(`↻ Reactivated ${results.reactivated.length} driver(s):`);
        for (const r of results.reactivated) {
          const name = typeof r === 'object' ? r.name : r;
          lines.push(`  - ${name}`);
        }
      }

      // Ghost drivers added
      const ghostsAdded = (body.ghost_adds || []).filter(g => g.name);
      if (ghostsAdded.length > 0) {
        lines.push(`+ Added ${ghostsAdded.length} previously tested driver(s) to pool:`);
        for (const g of ghostsAdded) {
          lines.push(`  - ${g.name}`);
        }
      }

      // New drivers added
      const newDriversAdded = body.new_drivers || [];
      if (newDriversAdded.length > 0) {
        lines.push(`+ Added ${newDriversAdded.length} new driver(s) to pool:`);
        for (const nd of newDriversAdded) {
          lines.push(`  - ${(nd.first_name || '')} ${(nd.last_name || '')}`.trim());
        }
      }

      // DER
      if (results.der_updated) {
        const info = body.der_info || {};
        if (body.der_choice === 'vi_acts_as_der') {
          lines.push('⚙ DER: Changed to VI Acts as DER');
        } else {
          lines.push(`⚙ DER updated: ${info.name || 'N/A'} | ${info.phone || 'N/A'} | ${info.email || 'N/A'}`);
        }
      }

      // Invoice
      if (results.invoice) {
        lines.push(`💲 Invoice ${results.invoice} created — $${results.billable_amount || 0} (unpaid)`);
      }

      if (!results.removed.length && !results.reactivated.length && !ghostsAdded.length && !newDriversAdded.length && !results.der_updated) {
        lines.push('No changes made — roster confirmed as-is.');
      }

      const noteContent = lines.join('\n');
      await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${session.crm_id}/Notes`, {
        method: 'POST',
        headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ Note_Title: 'Q2 2026 Pool Verification', Note_Content: noteContent }] }),
      });
      console.log(`[pool-review] CRM note added for DOT#${session.dot_number}`);
    } catch (e) {
      console.log(`[pool-review] CRM note error: ${e.message}`);
    }

    await sbUpdate(sbId, { status: 'completed' });
    console.log(`[pool-review] review submitted for DOT#${session.dot_number}: removed=${results.removed.length} added=${results.added.length} reactivated=${results.reactivated.length}`);

    // ── Save to KV tracking for dashboard ──
    try {
      const trackingKey = 'pool_verification_tracking';
      const tracking = await env.VAULT_TOKEN_CACHE.get(trackingKey, 'json') || {};
      tracking[session.dot_number] = {
        dot_number: session.dot_number,
        company_name: session.company_name || '',
        responded_at: new Date().toISOString(),
        removed_count: results.removed.length,
        added_count: results.added.length,
        reactivated_count: results.reactivated.length,
        der_updated: results.der_updated,
        charged: results.charged || 0,
        no_changes: results.removed.length === 0 && results.added.length === 0 && results.reactivated.length === 0 && !results.der_updated,
        driver_confirmations: body.driver_confirmations || [],
        ghost_adds: (body.ghost_adds || []).map(g => g.name),
        reactivations: (body.reactivations || []).map(r => typeof r === 'string' ? r : r.driver_id),
      };
      await env.VAULT_TOKEN_CACHE.put(trackingKey, JSON.stringify(tracking));
    } catch (e) {
      console.log(`[pool-review] tracking save error: ${e.message}`);
    }

    return jsonResponse({ success: true, results }, 200, request);
  }

  return jsonResponse({ success: false, error: 'unknown_action', message: `Unknown action: ${action}` }, 400, request);
}

// ── Pool Debug — check raw driver data for a DOT ────────────────────────────
async function handlePoolDebug(body, env, request) {
  const dotNumber = (body.dot_number || '').toString().replace(/\D/g, '');
  if (!dotNumber) return jsonResponse({ error: 'dot_number required' }, 400, request);

  const token = await getAccessToken(env);
  const account = await lookupCustomerByDot(dotNumber, token);
  if (!account) return jsonResponse({ error: 'Account not found' }, 404, request);

  // Fetch raw driver data
  const strategies = [
    { field: 'Customer_Name', value: account.id },
    { field: 'DOT_CA_Number', value: dotNumber },
  ];
  let rawDrivers = [];
  for (const { field, value } of strategies) {
    const url = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(${field}:equals:${value})`)}&fields=First_Name,Last_Name,Name,Pool_Status,Inactive_Date,CDL_Drivers_License,CDL_State_Issued`;
    const res = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
    if (res.ok && res.status !== 204) {
      const data = await res.json();
      rawDrivers = (data.data || []).map(d => ({
        id: d.id,
        name: d.Name,
        first_name: d.First_Name,
        last_name: d.Last_Name,
        inactive_date: d.Inactive_Date,
        in_pool: !d.Inactive_Date,
        cdl: d.CDL_Drivers_License,
        cdl_state: d.CDL_State_Issued,
      }));
      break;
    }
  }

  // Check tracking
  const tracking = await env.VAULT_TOKEN_CACHE.get('pool_verification_tracking', 'json') || {};

  return jsonResponse({
    success: true,
    account: { id: account.id, name: account.company_name, dot: account.dot_number },
    drivers: rawDrivers,
    tracking: tracking[dotNumber] || null,
  }, 200, request);
}

// ── Pool Dashboard — returns all tracking data + email send log ─────────────
async function handlePoolDashboard(body, env, request) {
  const action = body.action || 'summary';

  if (action === 'summary') {
    const tracking = await env.VAULT_TOKEN_CACHE.get('pool_verification_tracking', 'json') || {};
    const emailLog = await env.VAULT_TOKEN_CACHE.get('pool_email_log', 'json') || {};

    const totalSent = Object.keys(emailLog).length;
    const totalResponded = Object.keys(tracking).length;
    const totalPending = totalSent - totalResponded;

    // Build combined list
    const accounts = {};
    for (const [dot, info] of Object.entries(emailLog)) {
      accounts[dot] = { ...info, responded: false, response: null };
    }
    for (const [dot, info] of Object.entries(tracking)) {
      if (!accounts[dot]) accounts[dot] = { dot_number: dot, company_name: info.company_name, sent_at: null };
      accounts[dot].responded = true;
      accounts[dot].response = info;
    }

    return jsonResponse({
      success: true,
      summary: { total_sent: totalSent, total_responded: totalResponded, total_pending: totalPending },
      accounts: Object.values(accounts),
    }, 200, request);
  }

  if (action === 'log_send') {
    const dotNumber = (body.dot_number || '').toString();
    if (!dotNumber) return jsonResponse({ error: 'dot_number required' }, 400, request);
    const emailLog = await env.VAULT_TOKEN_CACHE.get('pool_email_log', 'json') || {};
    emailLog[dotNumber] = {
      dot_number: dotNumber,
      company_name: body.company_name || '',
      email: body.email || '',
      sent_at: new Date().toISOString(),
      sections: body.sections || [],
    };
    await env.VAULT_TOKEN_CACHE.put('pool_email_log', JSON.stringify(emailLog));
    return jsonResponse({ success: true }, 200, request);
  }

  if (action === 'count_accounts') {
    const token = await getAccessToken(env);
    let total = 0;
    let hasEmail = 0;
    let noEmail = 0;
    let noDot = 0;
    let page_token = null;
    const sampleNoEmail = [];

    // Only count live subscription accounts
    do {
      let url = `https://www.zohoapis.com/crm/v7/Accounts/search?criteria=${encodeURIComponent('(Subscription_Status:equals:Live)')}&fields=Account_Name,DOT_CA_Number,Primary_Contract_Email,Email&per_page=200&sort_by=id&sort_order=asc`;
      if (page_token) url += `&page_token=${page_token}`;
      const res = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (!res.ok || res.status === 204) break;
      const data = await res.json();
      const records = data.data || [];
      total += records.length;
      for (const r of records) {
        const email = r.Primary_Contract_Email || r.Email || '';
        const dot = r.DOT_CA_Number || '';
        if (!dot) { noDot++; continue; }
        if (email) { hasEmail++; } else { noEmail++; if (sampleNoEmail.length < 5) sampleNoEmail.push(r.Account_Name); }
      }
      page_token = data.info?.next_page_token || null;
    } while (page_token);

    return jsonResponse({
      success: true,
      total_live_subscriptions: total,
      with_dot_and_email: hasEmail,
      with_dot_no_email: noEmail,
      no_dot_number: noDot,
      sample_no_email: sampleNoEmail,
    }, 200, request);
  }

  return jsonResponse({ error: 'Unknown action' }, 400, request);
}

// ── Pool Test Harness (TEMPORARY — remove before mass send) ─────────────────
async function handlePoolTest(body, env, request) {
  const testKey = body.test_key;
  if (testKey !== 'vi-pool-test-2026') {
    return jsonResponse({ error: 'unauthorized' }, 401, request);
  }

  const token = await getAccessToken(env);
  const dotNumber = (body.dot_number || '3436961').toString();
  const scenario = body.scenario;

  // Helper: fetch current driver state from CRM
  async function getDriverState(driverId) {
    const res = await fetch(`https://www.zohoapis.com/crm/v7/Drivers/${driverId}?fields=Name,Pool_Status,Inactive_Date,CDL_Drivers_License,CDL_State_Issued,Email,Cellular_Telephone_Number,DOB_for_Driver`, {
      headers: { Authorization: 'Zoho-oauthtoken ' + token },
    });
    if (!res.ok) return { error: res.status };
    const data = await res.json();
    return data.data?.[0] || null;
  }

  // Helper: fetch account state
  async function getAccountState(accountId) {
    const res = await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${accountId}?fields=Account_Name,DER,DER_Name,DER_Phone,DER_Email,SAFER_Drivers,Last_Pool_Review`, {
      headers: { Authorization: 'Zoho-oauthtoken ' + token },
    });
    if (!res.ok) return { error: res.status };
    const data = await res.json();
    return data.data?.[0] || null;
  }

  // Lookup account
  const account = await lookupCustomerByDot(dotNumber, token);
  if (!account) return jsonResponse({ error: 'Account not found for DOT ' + dotNumber }, 404, request);

  // Fetch all drivers
  let drivers = [];
  const strategies = [
    { field: 'Customer_Name', value: account.id },
    { field: 'DOT_CA_Number', value: dotNumber },
  ];
  for (const { field, value } of strategies) {
    const url = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(${field}:equals:${value})`)}&fields=First_Name,Last_Name,Name,Pool_Status,Inactive_Date,CDL_Drivers_License,CDL_State_Issued,Email,Mobile,Date_of_Birth`;
    const res = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
    if (res.ok && res.status !== 204) {
      const data = await res.json();
      drivers = data.data || [];
      break;
    }
  }

  // Create a temporary session in KV for this test
  const testSessionToken = 'test-' + Date.now();
  await env.VAULT_TOKEN_CACHE.put(`session:${testSessionToken}`, JSON.stringify({
    dot_number: dotNumber,
    company_name: account.company_name,
    crm_id: account.id,
    email: account.email || 'sarahhopeaz@gmail.com',
  }), { expirationTtl: 300 });

  const results = { scenario, dot: dotNumber, account_id: account.id, before: {}, action: {}, after: {}, invoice: null, errors: [] };

  // ── SCENARIO: remove_driver ──
  if (scenario === 'remove_driver') {
    const driverId = body.driver_id;
    if (!driverId) return jsonResponse({ error: 'driver_id required' }, 400, request);

    results.before.driver = await getDriverState(driverId);

    // Call submit_review with this driver marked as not driving
    const submitBody = {
      action: 'submit_review',
      session_token: testSessionToken,
      driver_confirmations: [{ driver_id: driverId, still_driving: false, removal_date: body.removal_date || new Date().toISOString().split('T')[0] }],
      ghost_adds: [],
      der_choice: null,
      reactivations: [],
    };
    const submitRes = await handlePoolReview(submitBody, env, request);
    results.action = await submitRes.clone().json();
    results.after.driver = await getDriverState(driverId);
  }

  // ── SCENARIO: reactivate_driver ──
  else if (scenario === 'reactivate_driver') {
    const driverId = body.driver_id;
    if (!driverId) return jsonResponse({ error: 'driver_id required' }, 400, request);

    results.before.driver = await getDriverState(driverId);

    const submitBody = {
      action: 'submit_review',
      session_token: testSessionToken,
      driver_confirmations: [],
      ghost_adds: [],
      der_choice: null,
      reactivations: [driverId],
    };
    const submitRes = await handlePoolReview(submitBody, env, request);
    results.action = await submitRes.clone().json();
    results.after.driver = await getDriverState(driverId);
  }

  // ── SCENARIO: update_der ──
  else if (scenario === 'update_der') {
    results.before.account = await getAccountState(account.id);

    const submitBody = {
      action: 'submit_review',
      session_token: testSessionToken,
      driver_confirmations: [],
      ghost_adds: [],
      der_choice: body.der_choice || 'own_der',
      der_info: body.der_info || { name: 'Test DER Person', phone: '5551234567', email: 'testder@example.com' },
      reactivations: [],
    };
    const submitRes = await handlePoolReview(submitBody, env, request);
    results.action = await submitRes.clone().json();
    results.after.account = await getAccountState(account.id);
  }

  // ── SCENARIO: set_vi_der ──
  else if (scenario === 'set_vi_der') {
    results.before.account = await getAccountState(account.id);

    const submitBody = {
      action: 'submit_review',
      session_token: testSessionToken,
      driver_confirmations: [],
      ghost_adds: [],
      der_choice: 'vi_acts_as_der',
      reactivations: [],
    };
    const submitRes = await handlePoolReview(submitBody, env, request);
    results.action = await submitRes.clone().json();
    results.after.account = await getAccountState(account.id);
  }

  // ── SCENARIO: confirm_no_changes ──
  else if (scenario === 'confirm_no_changes') {
    const activeDrivers = drivers.filter(d => !d.Inactive_Date);
    results.before.account = await getAccountState(account.id);
    results.before.active_count = activeDrivers.length;

    const confirmations = activeDrivers.map(d => ({ driver_id: d.id, still_driving: true }));
    const submitBody = {
      action: 'submit_review',
      session_token: testSessionToken,
      driver_confirmations: confirmations,
      ghost_adds: [],
      der_choice: null,
      reactivations: [],
    };
    const submitRes = await handlePoolReview(submitBody, env, request);
    results.action = await submitRes.clone().json();
    results.after.account = await getAccountState(account.id);
  }

  // ── SCENARIO: full_state ── (just show current state, no changes)
  else if (scenario === 'full_state') {
    results.before.account = await getAccountState(account.id);
    results.before.drivers = [];
    for (const d of drivers) {
      results.before.drivers.push({
        id: d.id, name: d.Name, pool_status: d.Pool_Status, inactive_date: d.Inactive_Date,
        in_pool: !d.Inactive_Date, cdl: d.CDL_Drivers_License, cdl_state: d.CDL_State_Issued,
      });
    }
    const tracking = await env.VAULT_TOKEN_CACHE.get('pool_verification_tracking', 'json') || {};
    results.before.tracking = tracking[dotNumber] || null;
    return jsonResponse({ success: true, results }, 200, request);
  }

  // ── SCENARIO: test_driver_mobile — dump all fields on a driver record ──
  else if (scenario === 'test_driver_mobile') {
    // Fetch a known driver with ALL fields (no field filter)
    const driverId = body.driver_id || '2466160000287192082'; // William
    const readRes = await fetch(`https://www.zohoapis.com/crm/v7/Drivers/${driverId}`, {
      headers: { Authorization: 'Zoho-oauthtoken ' + token },
    });
    const readData = await readRes.json();
    const record = readData.data?.[0] || {};
    // Find all keys that might be phone/mobile related
    results.raw_status = readRes.status;
    results.raw_record = record;
    results.all_keys = Object.keys(record).sort();
    return jsonResponse({ success: true, results }, 200, request);
  }

  // ── SCENARIO: raw_crm_update — update CRM account fields directly for test setup ──
  else if (scenario === 'raw_crm_update' && body.fields) {
    const updateRes = await fetch(`https://www.zohoapis.com/crm/v7/Accounts/${account.id}`, {
      method: 'PUT',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [body.fields] }),
    });
    results.crm_update = { ok: updateRes.ok, status: updateRes.status };
    results.after.account = await getAccountState(account.id);
  }

  else {
    return jsonResponse({ error: 'Unknown scenario', scenarios: body }, 400, request);
  }

  // Check tracking KV
  const tracking = await env.VAULT_TOKEN_CACHE.get('pool_verification_tracking', 'json') || {};
  results.tracking = tracking[dotNumber] || null;

  // Cleanup test session
  await env.VAULT_TOKEN_CACHE.delete(`session:${testSessionToken}`);

  return jsonResponse({ success: true, results }, 200, request);
}

// ── Main Router ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Handle GET endpoints
    if (request.method === 'GET' && path === '/authnet-config') {
      try {
        const vault = await loadVault(env);
        return jsonResponse({
          apiLoginId: vault['Authorize.net/Authorize.net/AUTHNET_LOGIN_ID'],
          clientKey: vault['Authorize.net/Authorize.net/public_client_key'],
        }, 200, request);
      } catch (e) {
        console.log(`[authnet-config] vault load failed: ${e.message}`);
        return jsonResponse({ error: 'Configuration unavailable' }, 500, request);
      }
    }

    // Public pricing endpoint — single source of truth for all frontends
    if (request.method === 'GET' && path === '/prices') {
      return new Response(JSON.stringify({
        pre_employment:       { name: 'DOT Pre-Employment Drug Test', price: FLOW1_PRICING.pre_employment.amount },
        random:               { name: 'DOT Random Drug Test', price: FLOW1_PRICING.random.amount },
        post_accident:        { name: 'DOT Post-Accident Drug Test', price: FLOW1_PRICING.post_accident.amount },
        reasonable_suspicion:  { name: 'DOT Reasonable Suspicion Drug Test', price: FLOW1_PRICING.reasonable_suspicion.amount },
        return_to_duty:       { name: 'DOT Return-to-Duty Drug Test', price: FLOW1_PRICING.return_to_duty.amount },
        follow_up:            { name: 'DOT Follow-Up Drug Test', price: FLOW1_PRICING.follow_up.amount },
        dot_alcohol:          { name: 'DOT Breath Alcohol Test', price: FLOW1_PRICING.dot_alcohol.amount },
        dot_combo:            { name: 'DOT Drug and Breath Alcohol Test', price: FLOW1_PRICING.pre_employment.amount + FLOW1_PRICING.dot_alcohol.amount },
        plan_single:          { name: 'FMCSA Single Owner Operator', price: ENROLL_PLAN_PRICING.single.base },
        plan_fleet:           { name: 'FMCSA Fleet Plan', price: ENROLL_PLAN_PRICING.fleet_295.base },
        add_driver:           { name: 'Additional Driver', price: ENROLL_PLAN_PRICING.fleet.per_driver },
        add_driver_account:   { name: 'Add Driver to Consortium', price: ADD_DRIVER_PRICE },
        clearinghouse_setup:  { name: 'Clearinghouse Setup Assistance', price: 199 },
        fmcsa_policy:         { name: 'FMCSA Drug and Alcohol Policy', price: 39 },
        boc3:                 { name: 'FMCSA BOC-3', price: 59 },
        ucr:                  { name: 'UCR Filing', price: 129 },
        pedt_upsell:          { name: 'Pre-Employment Drug Test', price: PEDT_PRICE },
        chq_query:            { name: 'Clearinghouse Query Per Driver', price: FLOW4_PRICING.clearinghouse_query.amount },
        psp:                  { name: 'PSP Record', price: FLOW4_PRICING.psp_report.amount },
        background:           { name: 'Background Check', price: FLOW4_PRICING.background_check.amount },
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request), 'Cache-Control': 'public, max-age=300' },
      });
    }

    // DOT lookup via SaferWebAPI — auto-populate enrollment form
    if (request.method === 'GET' && path.startsWith('/dot-lookup/')) {
      const dotNumber = path.split('/dot-lookup/')[1]?.trim();
      if (!dotNumber || !/^\d{1,8}$/.test(dotNumber)) {
        return jsonResponse({ error: 'Invalid DOT number' }, 400, request);
      }
      try {
        const vault = await loadVault(env);
        // Try multiple possible vault key patterns
        const apiKey = vault['SaferWebAPI/api_key'] || vault['SaferWebAPI/API_Key'] || vault['SaferWebAPI/apikey'] || vault['SaferWebAPI/key'] || env.SAFER_WEB_API_KEY;
        if (!apiKey) {
          // Log available SaferWebAPI keys for debugging
          const saferKeys = Object.keys(vault).filter(k => k.toLowerCase().includes('safer'));
          console.log(`[dot-lookup] SaferWebAPI key not found. Vault keys matching 'safer': ${saferKeys.join(', ') || 'NONE'}`);
          return jsonResponse({ error: 'Lookup service unavailable' }, 503, request);
        }
        const saferRes = await fetch(`https://saferwebapi.com/v2/usdot/snapshot/${dotNumber}`, {
          headers: { 'x-api-key': apiKey },
        });
        if (!saferRes.ok) {
          if (saferRes.status === 404) {
            return jsonResponse({ found: false, message: 'No carrier found for that DOT number' }, 404, request);
          }
          console.log(`[dot-lookup] SaferWebAPI error: ${saferRes.status}`);
          return jsonResponse({ error: 'Lookup failed' }, 502, request);
        }
        const carrier = await saferRes.json();

        // Parse physical_address into components
        // FMCSA format: "STREET CITY, ST  ZIP" (e.g. "2039 S MILL AVE STE B TEMPE, AZ  85282")
        // The comma is between CITY and STATE — street+city are merged before the comma
        let street = '', city = '', state = '', zip = '';
        if (carrier.physical_address) {
          const addr = carrier.physical_address.trim();
          // Regex: capture everything before comma as street_city, state after comma, zip at end
          const m = addr.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
          if (m) {
            const streetCity = m[1].trim();
            state = m[2];
            zip = m[3];
            // FMCSA merges street + city with no separator. Use a heuristic:
            // Common street suffixes — split after the last one to get city
            const suffixPattern = /\b(ST|AVE|BLVD|DR|DRIVE|RD|ROAD|LN|LANE|CT|PL|WAY|CIR|CIRCLE|TRL|TRAIL|HWY|PKWY|PARKWAY|STE\s+\S+|SUITE\s+\S+|UNIT\s+\S+|#\S+|APT\s+\S+|FL\s+\d+)\b/gi;
            let lastSuffixEnd = 0;
            let match;
            while ((match = suffixPattern.exec(streetCity)) !== null) {
              lastSuffixEnd = match.index + match[0].length;
            }
            if (lastSuffixEnd > 0 && lastSuffixEnd < streetCity.length - 2) {
              street = streetCity.slice(0, lastSuffixEnd).trim();
              city = streetCity.slice(lastSuffixEnd).trim();
            } else {
              // Fallback: put everything in street, user can edit
              street = streetCity;
            }
          } else {
            // Non-standard format — put whole address in street
            street = addr;
          }
        }

        // Clean phone — SaferWebAPI returns "(334) 433-4999" format
        const phone = (carrier.phone || '').replace(/[^\d]/g, '');

        return jsonResponse({
          found: true,
          legal_name: carrier.legal_name || '',
          dba_name: carrier.dba_name || '',
          phone,
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          drivers: carrier.drivers || 0,
          power_units: carrier.power_units || 0,
          operating_status: carrier.operating_status || '',
          out_of_service_date: carrier.out_of_service_date || null,
          mc_number: carrier.mc_mx_ff_numbers || '',
          carrier_operation: carrier.carrier_operation || [],
          mailing_address: carrier.mailing_address || '',
        }, 200, request);
      } catch (e) {
        console.log(`[dot-lookup] error: ${e.message}`);
        return jsonResponse({ error: 'Lookup failed' }, 500, request);
      }
    }

    // Only accept POST for remaining routes
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, request);
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }

    // Load vault and patch env for all routes
    try {
      const vault = await loadVault(env);
      env = { ...env,
        ZOHO_CLIENT_ID: vault['Zoho/client_id'],
        ZOHO_CLIENT_SECRET: vault['Zoho/client_secret'],
        ZOHO_REFRESH_TOKEN: vault['Zoho/refresh_token'],
        ZOHO_BOOKS_ORG_ID: vault['Zoho Books/books_org_id'] || '671481277',
        TAZWORKS_TOKEN: vault['TazWorks/token'],
        PROXY_SECRET: vault['Digital Ocean/proxy_secret'],
        AUTHNET_API_LOGIN_ID: vault['Authorize.net/Authorize.net/AUTHNET_LOGIN_ID'],
        AUTHNET_TRANSACTION_KEY: vault['Authorize.net/Authorize.net/AUTHNET_TRANSACTION_KEY'],
        TWILIO_ACCOUNT_SID: vault['Twilio/account_sid'],
        TWILIO_AUTH_TOKEN: vault['Twilio/auth_token'],
        TWILIO_FROM_NUMBER: vault['Twilio/from_number'],
      };
    } catch (e) {
      console.log(`[vault] load failed: ${e.message}`);
      return jsonResponse({ error: 'Internal configuration error' }, 500, request);
    }

    // Route dispatch
    switch (path) {
      case '/flow1':
        return handleFlow1(body, env, request);
      case '/enroll':
        return handleEnroll(body, env, request);
      case '/account':
        return handleAccount(body, env, request);
      case '/order':
        return handleOrder(body, env, request);
      case '/pool-review':
        return handlePoolReview(body, env, request);
      case '/pool-debug':
        return handlePoolDebug(body, env, request);
      case '/pool-dashboard':
        return handlePoolDashboard(body, env, request);
      case '/pool-test':
        return handlePoolTest(body, env, request);
      default:
        return jsonResponse({ error: 'Not found', routes: ['/prices', '/authnet-config', '/flow1', '/enroll', '/account', '/order', '/pool-review'] }, 404, request);
    }
  },
};
