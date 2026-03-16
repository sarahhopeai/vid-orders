import { loadVault } from './vault.js';

// ── Constants ────────────────────────────────────────────────────────────────
const ZOHO_CRM_CUSTOMERS = 'https://www.zohoapis.com/crm/v7/Customers/';
const TAZWORKS_PROXY_BASE = 'http://tazproxy.verticalidentity.com:3456';
const TAZWORKS_CLIENT_GUID = '3911d1df-6d66-449d-894c-235367c8dcd7';
const AUTHNET_ENDPOINT = 'https://api.authorize.net/xml/v1/request.api';
const ZOHO_MAIL_ACCOUNT_ID = '2638799000000008002';

// ── Flow 1 Pricing ───────────────────────────────────────────────────────────
const FLOW1_PRICING = {
  pre_employment:       { amount: 69, name: 'DOT Pre-Employment Drug Test' },
  reasonable_suspicion:  { amount: 69, name: 'DOT Reasonable Suspicion Drug Test' },
  return_to_duty:       { amount: 69, name: 'DOT Return to Duty Drug Test' },
  follow_up:            { amount: 69, name: 'DOT Follow-Up Drug Test' },
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
const ADD_DRIVER_PRICE = 35;
const FLOW3_SERVICE_PRICING = {
  pre_employment:       { amount: 69, name: 'DOT Pre-Employment Drug Test' },
  reasonable_suspicion:  { amount: 69, name: 'DOT Reasonable Suspicion Drug Test' },
  return_to_duty:       { amount: 69, name: 'DOT Return to Duty Drug Test' },
  follow_up:            { amount: 69, name: 'DOT Follow-Up Drug Test' },
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
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 300000) {
    return cachedAccessToken;
  }
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      refresh_token: env.ZOHO_REFRESH_TOKEN,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Zoho OAuth refresh failed: ' + JSON.stringify(data));
  }
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedAccessToken;
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

  for (const base of modules) {
    for (const criteria of strategies) {
      const url = `${base}search?criteria=${encodeURIComponent(criteria)}`;
      const res = await fetch(url, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (res.status === 204 || !res.ok) continue;
      const data = await res.json();
      if (data.data?.length > 0) {
        const r = data.data[0];
        return {
          id: r.id,
          company_name: r.Account_Name || '',
          dot_number: r.DOT_CA_Number || '',
          phone: r.Phone || r.Company_Phone || '',
          email: r.Primary_Contract_Email || r.Email || '',
          client_type: r.Client_Type || '',
          client_status: r.Client_Status || '',
          address: r.Mailing_Street || '',
          city: r.Mailing_City || '',
          state: r.Mailing_State || '',
          zip: r.Mailing_Zip || '',
        };
      }
    }
  }
  return null;
}

// ── Flow 3: Account Invoice ─────────────────────────────────────────────────
async function createAccountInvoice(account, lineItems, totalAmount, noteText, token, env) {
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

  // Record payment
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
    return jsonResponse({
      success: false, error: 'payment_declined',
      message: chargeResult.error,
    }, 402, request);
  }

  console.log(`[flow1] charge successful: txn=${chargeResult.transactionId}`);

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

  // 7. Return success — payment was charged, UI should show confirmation
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

  // 2. Calculate total
  let planAmount;
  if (plan === 'single') planAmount = planConfig.base;
  else if (plan === 'fleet') planAmount = planConfig.per_driver * drivers.length;
  else planAmount = planConfig.base; // fleet_295

  const pedtDrivers = drivers.filter(d => d.pedt === true);
  const pedtTotal = pedtDrivers.length * PEDT_PRICE;
  const totalAmount = planAmount + pedtTotal;

  console.log(`[enroll] plan=${plan} drivers=${drivers.length} pedt=${pedtDrivers.length} total=$${totalAmount}`);

  // 3. Charge Auth.net
  const chargeResult = await chargeAuthNet(
    body.authnet_nonce, totalAmount,
    `${planConfig.label} | ${body.company_name} | DOT#${body.dot_number}`,
    { email: body.der_email, first_name: body.der_first_name, last_name: body.der_last_name, zip_code: body.zip },
    env
  );

  // 4. If charge fails → stop
  if (!chargeResult.success) {
    return jsonResponse({ success: false, error: 'payment_declined',
      message: chargeResult.error }, 402, request);
  }
  console.log(`[enroll] charge successful: txn=${chargeResult.transactionId} amount=$${totalAmount}`);

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
        Phone: normalizePhone(body.der_phone),
        Primary_Contract_Email: body.der_email,
        Client_Type: 'Consortium Member',
        Client_Status: 'Active',
        Mailing_Street: body.address,
        Mailing_City: body.city,
        Mailing_State: body.state,
        Mailing_Zip: body.zip,
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
    } else {
      console.log(`[enroll] CRM customer create failed (${crmRes.status}): ${await crmRes.text()}`);
    }
  } catch (e) {
    console.log(`[enroll] CRM customer create error (non-blocking): ${e.message}`);
  }

  // 6. Zoho Books subscription — TODO: Requires ZohoSubscriptions scope (not yet in refresh token)
  // Will be wired in a separate session once OAuth scope is expanded.

  // 7. Create driver records in Zoho CRM (non-blocking)
  if (crmAccountId) {
    try {
      const driverRecords = drivers.map(d => ({
        First_Name: d.first_name.trim(),
        Last_Name: d.last_name.trim(),
        Name: `${d.first_name.trim()} ${d.last_name.trim()}`,
        Customer_Name: { id: crmAccountId },
        Date_of_Birth: d.dob,
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

  // 8. Create Zoho Books invoice with line items (non-blocking)
  try {
    invoiceResult = await createEnrollInvoice(body, plan, planConfig, planAmount, drivers, pedtDrivers, pedtTotal, totalAmount, token, env);
    console.log(`[enroll] invoice created: ${invoiceResult?.invoiceNumber}`);
  } catch (e) {
    console.log(`[enroll] invoice create error (non-blocking): ${e.message}`);
  }

  // 9. TazWorks PEDT orders — BLOCKING (return error if any fail)
  for (const driver of pedtDrivers) {
    try {
      // Create TazWorks applicant for the driver (use DER contact since driver email/phone not collected)
      const applicantGuid = await createTazWorksApplicant({
        first_name: driver.first_name.trim(),
        last_name: driver.last_name.trim(),
        email: body.der_email,
        phone: body.der_phone,
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
      return jsonResponse({
        success: false, error: 'pedt_order_failed',
        message: `Payment was charged but PEDT order failed for ${driver.first_name} ${driver.last_name}. Our team will follow up. Transaction ID: ${chargeResult.transactionId}`,
        transaction_id: chargeResult.transactionId,
        completed_orders: tazworksOrders,
      }, 500, request);
    }
  }

  // 10. Send welcome email (non-blocking)
  try {
    await sendWelcomeEmail(body, plan, planConfig, totalAmount, drivers, tazworksOrders, invoiceResult?.invoiceNumber, token);
  } catch (e) {
    console.log(`[enroll] welcome email error (non-blocking): ${e.message}`);
  }

  // TODO: Zoho Sign — enrollment agreement. Requires OAuth scope expansion. Will wire in separate session.

  // 11. Return success
  return jsonResponse({
    success: true,
    route: 'enroll',
    transaction_id: chargeResult.transactionId,
    ...(crmAccountId && { crm_account_id: crmAccountId }),
    ...(invoiceResult && { invoice_number: invoiceResult.invoiceNumber }),
    tazworks_orders: tazworksOrders,
    plan,
    drivers_enrolled: drivers.length,
    pedt_orders: pedtDrivers.length,
    amount_charged: totalAmount,
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
    // Mask phone for display: (***) ***-1234
    const digits = normalizePhone(account.phone);
    const maskedPhone = digits.length >= 4 ? `(***) ***-${digits.slice(-4)}` : '****';
    return jsonResponse({
      success: true, action: 'lookup',
      company_name: account.company_name,
      dot_number: account.dot_number,
      masked_phone: maskedPhone,
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
    const phone = normalizePhone(account.phone);
    if (phone.length < 10) {
      return jsonResponse({ success: false, error: 'no_phone',
        message: 'No valid phone number on file. Contact support at (888) 475-0078.' }, 400, request);
    }
    // Generate 6-digit OTP and store in KV
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const kvKey = `otp:${account.dot_number}`;
    await env.VAULT_TOKEN_CACHE.put(kvKey, JSON.stringify({ code: otp, phone, crm_id: account.id }), {
      expirationTtl: OTP_TTL_SECONDS,
    });
    await sendOtpSms(phone, otp, env);
    console.log(`[account] OTP sent to ***${phone.slice(-4)} for DOT#${account.dot_number}`);
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
      const driverUrl = `https://www.zohoapis.com/crm/v7/Drivers/search?criteria=${encodeURIComponent(`(Customer_Name:equals:${account.id})`)}`;
      const driverRes = await fetch(driverUrl, { headers: { Authorization: 'Zoho-oauthtoken ' + token } });
      if (driverRes.ok && driverRes.status !== 204) {
        const driverData = await driverRes.json();
        drivers = (driverData.data || []).map(d => ({
          id: d.id,
          first_name: d.First_Name || '',
          last_name: d.Last_Name || '',
          name: d.Name || `${d.First_Name || ''} ${d.Last_Name || ''}`.trim(),
          dob: d.Date_of_Birth || '',
        }));
      }
    } catch (e) {
      console.log(`[account] driver fetch error: ${e.message}`);
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

      // Charge $35
      const chargeResult = await chargeAuthNet(
        body.authnet_nonce, ADD_DRIVER_PRICE,
        `Add Driver | ${session.company_name} | DOT#${session.dot_number}`,
        { email: session.email, first_name: driver.first_name, last_name: driver.last_name, zip_code: '' },
        env
      );
      if (!chargeResult.success) {
        return jsonResponse({ success: false, error: 'payment_declined', message: chargeResult.error }, 402, request);
      }
      console.log(`[account] add_driver charge: txn=${chargeResult.transactionId}`);

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

      // Charge
      const chargeResult = await chargeAuthNet(
        body.authnet_nonce, pricing.amount,
        `${pricing.name} | ${session.company_name} | ${driver.first_name} ${driver.last_name}`,
        { email: session.email, first_name: driver.first_name, last_name: driver.last_name, zip_code: session.zip || '' },
        env
      );
      if (!chargeResult.success) {
        return jsonResponse({ success: false, error: 'payment_declined', message: chargeResult.error }, 402, request);
      }
      console.log(`[account] order_service charge: txn=${chargeResult.transactionId} service=${serviceType}`);

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

  // 2. Charge via Authorize.net
  console.log(`[order] charging $${pricing.amount} for ${pricing.name}`);
  const chargeResult = await chargeAuthNet(
    body.authnet_nonce, pricing.amount, pricing.name,
    { email: body.email, first_name: body.first_name, last_name: body.last_name, zip_code: body.zip_code || '' },
    env
  );

  if (!chargeResult.success) {
    return jsonResponse({
      success: false, error: 'payment_declined',
      message: chargeResult.error,
    }, 402, request);
  }

  console.log(`[order] charge successful: txn=${chargeResult.transactionId}`);

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

  // 7. Return success
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
      default:
        return jsonResponse({ error: 'Not found', routes: ['/prices', '/authnet-config', '/flow1', '/enroll', '/account', '/order'] }, 404, request);
    }
  },
};
