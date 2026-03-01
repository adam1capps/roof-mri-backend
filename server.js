const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const { Pool } = require('pg');
const crypto = require('crypto');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PDFDocument = require('pdfkit');
const path = require('path');
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── CORS – restrict to allowed frontend origins ─────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  }
}));

// Serve the admin dashboard at the root URL
app.use(express.static(path.join(__dirname, 'public')));

// Stripe webhook needs the raw body – mount BEFORE express.json()
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const proposalId = session.metadata?.proposal_id;
    if (proposalId) {
      try {
        await pool.query(
          `UPDATE proposals SET payment_status = 'paid', stripe_session_id = $1 WHERE id = $2`,
          [session.id, proposalId]
        );
        // Notify Adam of payment
        const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
        if (rows.length > 0) {
          const p = rows[0];
          const safeName = stripHtml(p.contact_name);
          const safeCompany = stripHtml(p.company);
          await sgMail.send({
            to: 'adam@re-dry.com',
            from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
            subject: `PAID: ${safeCompany} - ${safeName}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2A4A">
              <div style="background:#1B2A4A;padding:16px 20px;text-align:center">
                <span style="color:#fff;font-size:16px;font-weight:700">ROOF <span style="color:#00bd70">MRI</span></span>
              </div>
              <div style="padding:20px;background:#fff;border:1px solid #e2e8f0">
                <p style="font-size:14px;color:#374151"><strong>Payment received</strong> from ${safeName} at ${safeCompany}</p>
                <p style="font-size:13px;color:#64748b">${p.total_price ? '$' + Number(p.total_price).toLocaleString() : 'N/A'}</p>
              </div>
            </div>`
          });
        }
      } catch (webhookErr) {
        console.error('Webhook processing error:', webhookErr);
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '1mb' }));

// ── Admin auth middleware ────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  // Try JWT first (Bearer <jwt-token>)
  if (auth.startsWith('Bearer ') && process.env.JWT_SECRET) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.adminUser = { id: payload.sub, email: payload.email };
      return next();
    } catch (_jwtErr) {
      // Not a valid JWT – fall through to API key check
    }
  }

  // Fallback: legacy API key
  if (process.env.ADMIN_API_KEY) {
    const expected = `Bearer ${process.env.ADMIN_API_KEY}`;
    if (auth.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
      return next();
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ── Rate limiting ──────────────────────────────────────────────
const signLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
const proposalViewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Database ───────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      proposal_num TEXT,
      contact_name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      tier TEXT,
      tier_price NUMERIC,
      extra_trainees INTEGER DEFAULT 0,
      extra_kits INTEGER DEFAULT 0,
      tracks TEXT[] DEFAULT '{}',
      videography BOOLEAN DEFAULT false,
      on_roof_day BOOLEAN DEFAULT false,
      total_price NUMERIC,
      let_client_choose BOOLEAN DEFAULT false,
      vimeo_url TEXT,
      status TEXT DEFAULT 'sent',
      signature_name TEXT,
      signature_data TEXT,
      signed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      opened_at TIMESTAMPTZ,
      open_count INTEGER DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      stripe_session_id TEXT
    )
  `);
  // Add payment columns if upgrading from an older schema
  await pool.query(`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'`);
  await pool.query(`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS stripe_session_id TEXT`);

  // Admin users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('Database initialized');
}

// ── Generate short unique ID ───────────────────────────────────────
function generateId() {
  return crypto.randomBytes(6).toString('base64url');
}

// ── Build branded HTML email ───────────────────────────────────────
function buildEmail(data, proposalUrl) {
  const { contactName, company, tier, extraTrainees, extraKits, tracks,
    videography, onRoofDay, totalPrice, letClientChoose, vimeoUrl } = data;

  const firstName = contactName.split(' ')[0];

  // Build training summary rows
  let summaryRows = '';
  if (letClientChoose) {
    summaryRows = `
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;width:40%;">Package</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;font-weight:700;border-bottom:1px solid #e2e8f0;">See attached options</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;">Company</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;">${company}</td>
      </tr>`;
  } else {
    const tierNames = { professional: 'Professional', regional: 'Regional', enterprise: 'Enterprise' };
    const traineeCount = tier === 'professional' ? 3 : tier === 'regional' ? 10 : 25;
    const kitCount = tier === 'professional' ? 1 : tier === 'regional' ? 2 : 4;
    const totalTrainees = traineeCount + (extraTrainees || 0);
    const totalKits = kitCount + (extraKits || 0);

    summaryRows = `
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;width:40%;">Package</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;font-weight:700;border-bottom:1px solid #e2e8f0;">${tierNames[tier] || tier}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Company</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;border-bottom:1px solid #e2e8f0;">${company}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Trainees</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;border-bottom:1px solid #e2e8f0;">${totalTrainees}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Recon Kits</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;border-bottom:1px solid #e2e8f0;">${totalKits}</td>
      </tr>`;
    if (tracks && tracks.length > 0) {
      summaryRows += `
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Training Tracks</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;border-bottom:1px solid #e2e8f0;">${tracks.join(', ')}</td>
      </tr>`;
    }
    if (videography) {
      summaryRows += `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Videography</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;border-bottom:1px solid #e2e8f0;">Included</td>
      </tr>`;
    }
    if (onRoofDay) {
      summaryRows += `
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;">On-Roof Training Day</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;">Included</td>
      </tr>`;
    }
  }

  // Investment section
  let investmentSection = '';
  if (!letClientChoose && totalPrice) {
    const formatted = Number(totalPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    investmentSection = `
    <tr><td style="padding:0 28px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
    <tr><td style="padding:20px 28px 12px 28px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:1px;">Your Investment</p>
    </td></tr>
    <tr><td style="padding:0 28px 20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:12px 0;font-size:18px;color:#1B2A4A;font-weight:700;">Total</td>
          <td style="padding:12px 0;font-size:22px;color:#00bd70;text-align:right;font-weight:700;">${formatted}</td>
        </tr>
      </table>
    </td></tr>`;
  }

  // Video block
  let videoBlock = '';
  if (vimeoUrl) {
    const vimeoMatch = vimeoUrl.match(/vimeo\.com\/(\d+)/);
    const vimeoId = vimeoMatch ? vimeoMatch[1] : null;
    if (vimeoId) {
      videoBlock = `
      <tr><td style="padding:0 28px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
      <tr><td style="padding:20px 28px 12px 28px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:1px;">A Quick Intro From Our Team</p>
      </td></tr>
      <tr><td style="padding:0 28px 20px 28px;text-align:center;">
        <a href="${vimeoUrl}" style="text-decoration:none;display:block;">
          <img src="https://vumbnail.com/${vimeoId}.jpg" width="540" style="width:100%;max-width:540px;border-radius:8px;border:1px solid #e2e8f0;" alt="Watch intro video">
          <p style="margin:8px 0 0;font-size:13px;color:#00bd70;font-weight:600;">&#9654; Watch Video</p>
        </a>
      </td></tr>`;
    }
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:24px 12px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background:#1B2A4A;padding:24px 28px;text-align:center;">
  <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:1px;">ROOF </span><span style="color:#00bd70;font-size:24px;font-weight:700;letter-spacing:1px;">MRI</span>
  <br><span style="color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Training &amp; Certification</span>
</td></tr>

<!-- Greeting -->
<tr><td style="padding:28px 28px 8px 28px;">
  <p style="margin:0;font-size:17px;color:#1B2A4A;line-height:1.5;">Hi ${firstName},</p>
</td></tr>

<!-- Opening copy -->
<tr><td style="padding:8px 28px 20px 28px;">
  <p style="margin:0 0 14px 0;font-size:15px;color:#475569;line-height:1.7;">Great speaking with you about bringing Roof MRI to <strong style="color:#1B2A4A;">${company}</strong>. I put together a custom training proposal for your team, and I'm genuinely excited about the impact this will have on your business.</p>
  <p style="margin:0;font-size:15px;color:#475569;line-height:1.7;">Roof MRI certification doesn't just add a service to your lineup &mdash; it transforms how ${company} approaches every commercial roof. Your team will walk away with the skills, equipment, and confidence to offer clients something most contractors simply can't.</p>
</td></tr>

<!-- Why This Matters section -->
<tr><td style="padding:0 28px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
<tr><td style="padding:20px 28px 12px 28px;">
  <p style="margin:0;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:1px;">Why This Matters for ${company}</p>
</td></tr>
<tr><td style="padding:0 28px 20px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:28px;">
        <span style="display:inline-block;width:22px;height:22px;background:#00bd70;border-radius:50%;text-align:center;line-height:22px;color:#fff;font-size:13px;font-weight:700;">&#10003;</span>
      </td>
      <td style="padding:10px 0 10px 10px;">
        <p style="margin:0;font-size:14px;color:#1B2A4A;font-weight:600;">New Revenue Stream</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Offer moisture scanning as a standalone service or bundle it into existing bids. This pays for itself.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:28px;">
        <span style="display:inline-block;width:22px;height:22px;background:#00bd70;border-radius:50%;text-align:center;line-height:22px;color:#fff;font-size:13px;font-weight:700;">&#10003;</span>
      </td>
      <td style="padding:10px 0 10px 10px;">
        <p style="margin:0;font-size:14px;color:#1B2A4A;font-weight:600;">Win More Jobs</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Walk into every bid with objective, data-driven moisture intelligence that your competitors don't have.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:28px;">
        <span style="display:inline-block;width:22px;height:22px;background:#00bd70;border-radius:50%;text-align:center;line-height:22px;color:#fff;font-size:13px;font-weight:700;">&#10003;</span>
      </td>
      <td style="padding:10px 0 10px 10px;">
        <p style="margin:0;font-size:14px;color:#1B2A4A;font-weight:600;">Protect Your Reputation</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">Calibrated PHD Scale readings mean precise, repeatable results &mdash; no guesswork, no liability surprises.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:10px 0;vertical-align:top;width:28px;">
        <span style="display:inline-block;width:22px;height:22px;background:#00bd70;border-radius:50%;text-align:center;line-height:22px;color:#fff;font-size:13px;font-weight:700;">&#10003;</span>
      </td>
      <td style="padding:10px 0 10px 10px;">
        <p style="margin:0;font-size:14px;color:#1B2A4A;font-weight:600;">Skills That Compound</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b;line-height:1.5;">This isn't a one-time training. Your team gets certified, equipped, and supported with ongoing technical guidance for years to come.</p>
      </td>
    </tr>
  </table>
</td></tr>

<!-- ROI Teaser -->
<tr><td style="padding:0 28px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
<tr><td style="padding:20px 28px 12px 28px;">
  <p style="margin:0;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:1px;">See How Fast This Pays for Itself</p>
</td></tr>
<tr><td style="padding:0 28px 8px 28px;">
  <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">Your proposal page includes an <strong style="color:#1B2A4A;">ROI calculator</strong> where you can plug in your own numbers &mdash; scans per month, price per scan &mdash; and see exactly how quickly your training investment turns into profit.</p>
</td></tr>
<tr><td style="padding:4px 28px 20px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
    <tr>
      <td style="padding:16px 20px;text-align:center;">
        <p style="margin:0;font-size:13px;color:#15803d;font-weight:600;">Most contractors see a full return on their training investment within the first few months of scanning.</p>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Training Overview -->
<tr><td style="padding:0 28px;"><div style="border-top:1px solid #e2e8f0;"></div></td></tr>
<tr><td style="padding:20px 28px 12px 28px;">
  <p style="margin:0;font-size:13px;font-weight:700;color:#1B2A4A;text-transform:uppercase;letter-spacing:1px;">Training Overview</p>
</td></tr>
<tr><td style="padding:0 28px 20px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
    ${summaryRows}
  </table>
</td></tr>

${investmentSection}
${videoBlock}

<!-- CTA Button -->
<tr><td style="padding:24px 28px 12px 28px;text-align:center;">
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr><td style="background:#00bd70;border-radius:8px;padding:18px 56px;text-align:center;">
      <a href="${proposalUrl}" style="color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;display:block;">View Your Proposal</a>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:4px 28px 24px 28px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#94a3b8;">Review your options, calculate your ROI, and get started when you're ready.</p>
</td></tr>

<!-- PDF note for let-client-choose -->
${letClientChoose ? `
<tr><td style="padding:0 28px 20px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.5;"><strong style="color:#1B2A4A;">&#128206; Check the attached PDF</strong> for a side-by-side comparison of all training options to find the best fit for ${company}.</p>
    </td></tr>
  </table>
</td></tr>` : ''}

<!-- Closing -->
<tr><td style="padding:0 28px 24px 28px;">
  <p style="margin:0 0 12px 0;font-size:14px;color:#475569;line-height:1.6;">I'm looking forward to getting ${company} certified and scanning. Hit reply anytime &mdash; happy to answer questions or hop on a quick call.</p>
  <p style="margin:0;font-size:14px;color:#1B2A4A;font-weight:600;">Adam Capps</p>
  <p style="margin:0;font-size:13px;color:#64748b;">Founder, Roof MRI &amp; ReDry</p>
  <p style="margin:0;font-size:13px;color:#64748b;">adam@re-dry.com</p>
</td></tr>

<!-- Footer -->
<tr><td style="background:#1B2A4A;padding:16px 28px;text-align:center;">
  <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">Roof MRI | Advancing the Science of Roof Moisture Detection</p>
  <p style="margin:0;font-size:11px;color:#64748b;">roof-mri.com</p>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ── Generate proposal PDF (tier comparison) ─────────────────────
function buildProposalPdf(data, proposalUrl) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#1B2A4A';
    const green = '#00bd70';
    const gray = '#64748b';
    const lightGray = '#f1f5f9';
    const borderGray = '#e2e8f0';
    const pageW = doc.page.width - 100; // 512pt usable

    // ── Header bar ──
    doc.rect(0, 0, doc.page.width, 70).fill(navy);
    doc.fontSize(22).fill('#ffffff').text('ROOF ', 50, 24, { continued: true })
       .fill(green).text('MRI', { continued: false });
    doc.fontSize(9).fill('#94a3b8').text('TRAINING & CERTIFICATION', 50, 50);

    doc.moveDown(2);
    const startY = doc.y;

    // ── Title ──
    doc.fontSize(18).fill(navy).text(`Training Proposal for ${data.company}`, 50, startY);
    doc.moveDown(0.3);
    doc.fontSize(10).fill(gray).text(`Prepared for ${data.contactName}`, 50);
    doc.moveDown(1.5);

    // ── Tier comparison table ──
    const tiers = [
      { key: 'professional', name: 'Professional', trainees: 3, kits: 1,
        desc: 'Ideal for small teams getting started with moisture scanning.' },
      { key: 'regional', name: 'Regional', trainees: 10, kits: 2,
        desc: 'Built for companies covering a multi-city or statewide territory.' },
      { key: 'enterprise', name: 'Enterprise', trainees: 25, kits: 4,
        desc: 'Full-scale deployment for large organizations with multiple crews.' },
    ];

    doc.fontSize(12).fill(navy).text('TRAINING OPTIONS', 50, doc.y, { underline: false });
    doc.moveDown(0.3);
    doc.fontSize(9).fill(gray).text('Compare packages below to find the right fit for your team.', 50);
    doc.moveDown(1);

    const colW = Math.floor(pageW / 3);
    const tableX = 50;
    let tableY = doc.y;

    // Header row
    tiers.forEach((t, i) => {
      const x = tableX + i * colW;
      const isSelected = data.tier === t.key;
      doc.rect(x, tableY, colW, 32).fill(isSelected ? green : navy);
      doc.fontSize(11).fill('#ffffff').text(t.name, x + 8, tableY + 10, { width: colW - 16, align: 'center' });
    });
    tableY += 32;

    // Data rows
    const rows = [
      { label: 'Certified Trainees', values: tiers.map(t => String(t.trainees)) },
      { label: 'Recon Kits', values: tiers.map(t => String(t.kits)) },
      { label: 'PHD Scale Calibration', values: ['Included', 'Included', 'Included'] },
      { label: 'Tramex Equipment', values: ['Included', 'Included', 'Included'] },
      { label: 'Ongoing Support', values: ['Included', 'Included', 'Included'] },
      { label: 'Moisture Grid Reports', values: ['Included', 'Included', 'Included'] },
    ];

    rows.forEach((row, ri) => {
      const bg = ri % 2 === 0 ? lightGray : '#ffffff';
      const rowH = 24;

      // Label column background
      doc.rect(tableX, tableY, colW, rowH).fill(bg);
      doc.rect(tableX + colW, tableY, colW, rowH).fill(bg);
      doc.rect(tableX + 2 * colW, tableY, colW, rowH).fill(bg);

      // Borders
      doc.rect(tableX, tableY, pageW, rowH).lineWidth(0.5).stroke(borderGray);

      // Label in first part of each cell
      tiers.forEach((t, i) => {
        const x = tableX + i * colW;
        if (i === 0) {
          doc.fontSize(8).fill(gray).text(row.label, x + 8, tableY + 7, { width: colW - 16 });
        }
        doc.fontSize(9).fill(navy).text(row.values[i], x + 8, tableY + 7, { width: colW - 16, align: 'center' });
      });
      tableY += rowH;
    });

    // Descriptions
    tableY += 8;
    tiers.forEach((t, i) => {
      const x = tableX + i * colW;
      doc.fontSize(8).fill(gray).text(t.desc, x + 8, tableY, { width: colW - 16, lineGap: 2 });
    });

    // ── Benefits section ──
    doc.moveDown(5);
    const benefitsY = doc.y;
    doc.fontSize(12).fill(navy).text('WHAT YOUR TEAM GETS', 50, benefitsY);
    doc.moveDown(0.6);

    const benefits = [
      ['New Revenue Stream', 'Offer moisture scanning as a paid service on every project or as a standalone offering.'],
      ['Competitive Advantage', 'Deliver objective, PHD-calibrated moisture data that other contractors can\'t match.'],
      ['Reduced Liability', 'Precise, repeatable readings backed by calibrated science \u2014 not guesswork.'],
      ['Long-Term Value', 'Equipment, certification, and ongoing support your team will use for years.'],
    ];

    benefits.forEach(([title, desc]) => {
      const y = doc.y;
      doc.circle(58, y + 5, 4).fill(green);
      doc.fontSize(10).fill(navy).text(title, 70, y, { continued: false });
      doc.fontSize(9).fill(gray).text(desc, 70, doc.y, { width: pageW - 30 });
      doc.moveDown(0.5);
    });

    // ── CTA ──
    doc.moveDown(1);
    const ctaY = doc.y;
    doc.roundedRect(50, ctaY, pageW, 56, 8).fill(navy);
    doc.fontSize(13).fill('#ffffff').text('Ready to get started?', 50, ctaY + 12, { width: pageW, align: 'center' });
    doc.fontSize(10).fill(green).text(proposalUrl, 50, ctaY + 32, {
      width: pageW, align: 'center', link: proposalUrl, underline: true,
    });

    // ── Footer ──
    doc.fontSize(8).fill(gray).text(
      'Roof MRI | Advancing the Science of Roof Moisture Detection | roof-mri.com',
      50, doc.page.height - 40, { width: pageW, align: 'center' }
    );

    doc.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────
function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Admin login rate limiter ─────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/admin/setup ──────────────────────────────────────────
// One-time endpoint: creates the first admin user. Disabled once an admin exists.
app.post('/api/admin/setup', loginLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM admin_users');
    if (rows[0].count > 0) {
      return res.status(403).json({ error: 'Admin already configured. Use /api/admin/login.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows: created } = await pool.query(
      'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase().trim(), hash]
    );

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET env var is not set. Add it to your environment and restart.' });
    }

    const token = jwt.sign(
      { sub: created[0].id, email: created[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token, message: 'Admin account created' });
  } catch (err) {
    console.error('Admin setup error:', err);
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

// ── POST /api/admin/login ──────────────────────────────────────────
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET env var is not set' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM admin_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Prevent timing attacks: always hash even on miss
      await bcrypt.hash(password, 12);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ── GET /api/admin/me ──────────────────────────────────────────────
// Verify token validity and return current admin info
app.get('/api/admin/me', requireAdmin, (req, res) => {
  if (!req.adminUser) {
    return res.json({ authenticated: true, method: 'api_key' });
  }
  res.json({ authenticated: true, method: 'jwt', email: req.adminUser.email });
});

// ── POST /api/send-proposal ────────────────────────────────────────
app.post('/api/send-proposal', requireAdmin, async (req, res) => {
  try {
    const data = req.body;
    // Normalize field names (accept both snake_case and camelCase)
    // Use ?? so falsy values like 0 and false are preserved correctly
    data.contactName = data.contactName ?? data.contact_name;
    data.company = data.company ?? data.company_name;
    data.email = data.email ?? data.contact_email;
    data.contactPhone = data.contactPhone ?? data.contact_phone;
    data.letClientChoose = data.letClientChoose ?? data.let_client_choose;
    data.extraTrainees = data.extraTrainees ?? data.extra_trainees;
    data.extraKits = data.extraKits ?? data.extra_kits;
    data.onRoofDay = data.onRoofDay ?? data.on_roof_day;
    data.tierPrice = data.tierPrice ?? data.tier_price;
    data.totalPrice = data.totalPrice ?? data.total_price;
    data.proposalNum = data.proposalNum ?? data.proposal_num;
    data.vimeoUrl = data.vimeoUrl ?? data.vimeo_url;

    if (!data.email || !data.contactName || !data.company) {
      return res.status(400).json({ error: 'Missing required fields: email, contactName, and company are required' });
    }
    if (!isValidEmail(data.email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Sanitize user-supplied text to prevent HTML injection in emails
    data.contactName = stripHtml(data.contactName);
    data.company = stripHtml(data.company);
    data.email = stripHtml(data.email);
    if (Array.isArray(data.tracks)) {
      data.tracks = data.tracks.map(t => stripHtml(t));
    }

    // Generate unique proposal ID and store in DB
    const id = generateId();
    const baseUrl = process.env.PROPOSAL_BASE_URL || 'https://proposals.roof-mri.com';
    const proposalUrl = `${baseUrl}/p/${id}`;

    await pool.query(`
      INSERT INTO proposals (id, proposal_num, contact_name, company, email, tier, tier_price,
        extra_trainees, extra_kits, tracks, videography, on_roof_day, total_price,
        let_client_choose, vimeo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      id, data.proposalNum, data.contactName, data.company, data.email,
      data.tier ?? null, data.tierPrice ?? null,
      data.extraTrainees ?? 0, data.extraKits ?? 0,
      data.tracks ?? [], data.videography ?? false, data.onRoofDay ?? false,
      data.totalPrice ?? null, data.letClientChoose ?? false,
      data.vimeoUrl ?? null
    ]);

    // Build email and PDF
    const html = buildEmail(data, proposalUrl);
    const pdfBuffer = await buildProposalPdf(data, proposalUrl);

    const emailMsg = {
      to: data.email,
      from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
      replyTo: { email: 'adam@re-dry.com', name: 'Adam Capps' },
      subject: `Roof MRI Training Proposal for ${data.company}`,
      html,
      attachments: [{
        content: pdfBuffer.toString('base64'),
        filename: `Roof-MRI-Proposal-${data.company.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment',
      }],
    };
    await sgMail.send(emailMsg);

    // Internal notification
    await sgMail.send({
      to: 'adam@re-dry.com',
      from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
      subject: `Proposal Sent: ${data.company} - ${data.contactName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2A4A">
        <div style="background:#1B2A4A;padding:16px 20px;text-align:center">
          <span style="color:#fff;font-size:16px;font-weight:700">ROOF <span style="color:#00bd70">MRI</span></span>
        </div>
        <div style="padding:20px;background:#fff;border:1px solid #e2e8f0">
          <p style="font-size:14px;color:#374151"><strong>Proposal sent</strong> to ${data.email}</p>
          <p style="font-size:13px;color:#64748b">${data.company} | ${data.tier ? data.tier.charAt(0).toUpperCase() + data.tier.slice(1) : 'Client Choice'} | ${data.totalPrice ? '$' + Number(data.totalPrice).toLocaleString() : 'TBD'}</p>
          <p style="font-size:13px;color:#00bd70"><a href="${proposalUrl}" style="color:#00bd70;">View proposal</a></p>
        </div>
      </div>`
    });

    res.json({ success: true, proposal: { unique_id: id, proposalId: id, proposalUrl, proposal_url: proposalUrl }, message: `Proposal sent to ${data.email}` });
  } catch (err) {
    console.error('Error:', err.response ? err.response.body : err);
    res.status(500).json({ error: 'Failed to send proposal' });
  }
});

// ── GET /api/proposals/:id ─────────────────────────────────────────
// Returns proposal data (for the Netlify-hosted proposal page to fetch)
app.get('/api/proposals/:id', proposalViewLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    // Track opens (skip when ?track=false, e.g. payment-polling refetches)
    if (req.query.track !== 'false') {
      await pool.query(
        'UPDATE proposals SET opened_at = COALESCE(opened_at, NOW()), open_count = open_count + 1 WHERE id = $1',
        [req.params.id]
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching proposal:', err);
    res.status(500).json({ error: 'Failed to load proposal' });
  }
});

// ── POST /api/proposals/:id/sign ───────────────────────────────────
// Client signs the proposal
app.post('/api/proposals/:id/sign', signLimiter, async (req, res) => {
  try {
    const { signatureName, signatureData } = req.body;
    if (!signatureName || !signatureData) {
      return res.status(400).json({ error: 'Missing signature data' });
    }

    // Limit signature data size (base64 images can be large)
    if (signatureData.length > 500000) {
      return res.status(400).json({ error: 'Signature data too large' });
    }

    const safeSignatureName = stripHtml(signatureName);

    // Atomic update: prevents race condition where two concurrent sign requests
    // both pass a status check before either writes
    const { rows: updated } = await pool.query(
      `UPDATE proposals SET status = 'signed', signature_name = $1, signature_data = $2, signed_at = NOW()
       WHERE id = $3 AND status != 'signed'
       RETURNING *`,
      [safeSignatureName, signatureData, req.params.id]
    );

    if (updated.length === 0) {
      const { rows: check } = await pool.query('SELECT id, status FROM proposals WHERE id = $1', [req.params.id]);
      if (check.length === 0) return res.status(404).json({ error: 'Proposal not found' });
      return res.status(409).json({ error: 'This proposal has already been signed' });
    }

    // Notify Adam that a proposal was signed
    const p = updated[0];
    const safeName = stripHtml(p.contact_name);
    const safeCompany = stripHtml(p.company);
    await sgMail.send({
      to: 'adam@re-dry.com',
      from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
      subject: `SIGNED: ${safeCompany} - ${safeName}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2A4A">
        <div style="background:#00bd70;padding:16px 20px;text-align:center">
          <span style="color:#fff;font-size:16px;font-weight:700">PROPOSAL SIGNED</span>
        </div>
        <div style="padding:20px;background:#fff;border:1px solid #e2e8f0">
          <p style="font-size:14px;color:#374151"><strong>${safeName}</strong> at <strong>${safeCompany}</strong> just signed their proposal.</p>
          <p style="font-size:13px;color:#64748b">${p.tier ? p.tier.charAt(0).toUpperCase() + p.tier.slice(1) : 'Client Choice'} | ${p.total_price ? '$' + Number(p.total_price).toLocaleString() : 'TBD'}</p>
          <p style="font-size:13px;color:#64748b">Signed by: ${safeSignatureName}</p>
        </div>
      </div>`
    });

    res.json({ success: true, message: 'Proposal signed' });
  } catch (err) {
    console.error('Error signing proposal:', err);
    res.status(500).json({ error: 'Failed to sign proposal' });
  }
});

// ── POST /api/proposals/:id/checkout ──────────────────────────────
// Create a Stripe Checkout session so the client can pay after signing
app.post('/api/proposals/:id/checkout', checkoutLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = rows[0];
    if (proposal.status !== 'signed') {
      return res.status(400).json({ error: 'Proposal must be signed before payment' });
    }
    if (proposal.payment_status === 'paid') {
      return res.status(409).json({ error: 'This proposal has already been paid' });
    }
    if (!proposal.total_price || Number(proposal.total_price) <= 0) {
      return res.status(400).json({ error: 'No price set for this proposal' });
    }

    const baseUrl = process.env.PROPOSAL_BASE_URL || 'https://proposals.roof-mri.com';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Roof MRI Training – ${proposal.tier ? proposal.tier.charAt(0).toUpperCase() + proposal.tier.slice(1) : 'Custom'} Package`,
            description: `Training proposal for ${proposal.company}`,
          },
          unit_amount: Math.round(Number(proposal.total_price) * 100), // Stripe uses cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: proposal.email,
      metadata: { proposal_id: proposal.id },
      success_url: `${baseUrl}/p/${proposal.id}?payment=success`,
      cancel_url: `${baseUrl}/p/${proposal.id}?payment=cancelled`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ── GET /api/proposals/:id/payment-status ────────────────────────
app.get('/api/proposals/:id/payment-status', proposalViewLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT payment_status FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ payment_status: rows[0].payment_status });
  } catch (err) {
    console.error('Error checking payment status:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// ── GET /api/proposals ─────────────────────────────────────────────
// List all proposals (for your internal dashboard – admin only)
app.get('/api/proposals', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        'SELECT id, proposal_num, contact_name, company, email, tier, total_price, status, payment_status, created_at, opened_at, open_count, signed_at FROM proposals ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM proposals'),
    ]);

    res.json({ proposals: rows, total: countRows[0].total, limit, offset });
  } catch (err) {
    console.error('Error listing proposals:', err);
    res.status(500).json({ error: 'Failed to list proposals' });
  }
});

// ── Health ──────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
let server;
initDB().then(() => {
  server = app.listen(PORT, () => console.log(`Roof MRI backend on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────
function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);
  if (server) {
    server.close(() => {
      pool.end(() => {
        console.log('Pool closed. Exiting.');
        process.exit(0);
      });
    });
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
