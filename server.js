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

  // Handle both immediate (card) and async (ACH bank transfer) payments
  const paymentEvents = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'];
  if (paymentEvents.includes(event.type)) {
    const session = event.data.object;
    const proposalId = session.metadata?.proposal_id;

    // For checkout.session.completed with async payment (ACH), payment isn't final yet
    if (event.type === 'checkout.session.completed' && session.payment_status === 'unpaid') {
      // ACH initiated but not yet settled – update status to pending
      if (proposalId) {
        try {
          await pool.query(
            `UPDATE proposals SET payment_status = 'processing', stripe_session_id = $1 WHERE id = $2`,
            [session.id, proposalId]
          );
        } catch (err) {
          console.error('Error updating to processing:', err);
        }
      }
      return res.json({ received: true });
    }

    if (proposalId) {
      try {
        await pool.query(
          `UPDATE proposals SET payment_status = 'paid', stripe_session_id = $1 WHERE id = $2`,
          [session.id, proposalId]
        );
        const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [proposalId]);
        if (rows.length > 0) {
          const p = rows[0];
          const safeName = stripHtml(p.contact_name);
          const safeCompany = stripHtml(p.company);
          const totalFormatted = p.total_price ? '$' + Number(p.total_price).toLocaleString() : 'N/A';
          const tierLabel = p.tier ? p.tier.charAt(0).toUpperCase() + p.tier.slice(1) : 'Custom';

          // Notify Adam of payment
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
                <p style="font-size:13px;color:#64748b">${tierLabel} Package | ${totalFormatted}</p>
              </div>
            </div>`
          });

          // Send payment confirmation to client
          try {
            await sgMail.send({
              to: p.email,
              from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
              subject: `Payment Confirmed - Roof MRI Training`,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2A4A">
                <div style="background:#1B2A4A;padding:16px 20px;text-align:center">
                  <span style="color:#fff;font-size:18px;font-weight:700">ROOF <span style="color:#00bd70">MRI</span></span>
                </div>
                <div style="padding:24px;background:#fff;border:1px solid #e2e8f0">
                  <div style="text-align:center;margin-bottom:20px">
                    <div style="display:inline-block;background:#ecfdf5;border-radius:50%;padding:12px;margin-bottom:8px">
                      <span style="color:#00bd70;font-size:24px;font-weight:bold">\u2713</span>
                    </div>
                    <h2 style="color:#1B2A4A;margin:8px 0 0 0;font-size:20px">Payment Confirmed</h2>
                  </div>
                  <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px">Hi ${safeName},</p>
                  <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px">We\u2019ve received your payment. Thank you for choosing Roof MRI! Here\u2019s your receipt summary:</p>
                  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:16px">
                    <table style="width:100%;border-collapse:collapse">
                      <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Package</td><td style="padding:6px 0;font-size:13px;color:#1B2A4A;text-align:right;font-weight:600">${tierLabel}</td></tr>
                      <tr><td style="padding:6px 0;font-size:13px;color:#64748b">Company</td><td style="padding:6px 0;font-size:13px;color:#1B2A4A;text-align:right">${safeCompany}</td></tr>
                      <tr style="border-top:1px solid #e2e8f0"><td style="padding:10px 0 6px;font-size:14px;color:#1B2A4A;font-weight:700">Total Paid</td><td style="padding:10px 0 6px;font-size:14px;color:#00bd70;text-align:right;font-weight:700">${totalFormatted}</td></tr>
                    </table>
                  </div>
                  <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:8px"><strong>What\u2019s next?</strong></p>
                  <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px">We\u2019ll be in touch within 1\u20132 business days to coordinate your training dates and logistics. If you have questions in the meantime, just reply to this email.</p>
                  <p style="font-size:14px;color:#1B2A4A;font-weight:600;margin:0">Adam Capps</p>
                  <p style="font-size:13px;color:#64748b;margin:2px 0 0 0">Founder, Roof MRI & ReDry</p>
                  <p style="font-size:13px;color:#64748b;margin:2px 0 0 0">adam@re-dry.com</p>
                </div>
                <div style="background:#1B2A4A;padding:12px 20px;text-align:center">
                  <p style="margin:0;font-size:11px;color:#94a3b8">Roof MRI | Advancing the Science of Roof Moisture Detection</p>
                </div>
              </div>`
            });
          } catch (clientEmailErr) {
            console.error('Failed to send payment confirmation to client:', clientEmailErr);
          }
        }
      } catch (webhookErr) {
        console.error('Webhook processing error:', webhookErr);
        return res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  }

  // Handle failed async payments (ACH failures)
  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object;
    const proposalId = session.metadata?.proposal_id;
    if (proposalId) {
      try {
        await pool.query(
          `UPDATE proposals SET payment_status = 'failed' WHERE id = $1`,
          [proposalId]
        );
      } catch (err) {
        console.error('Error updating failed payment:', err);
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

  // Add per-tier pricing columns for "let client choose" proposals
  await pool.query(`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS professional_price NUMERIC`);
  await pool.query(`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS regional_price NUMERIC`);
  await pool.query(`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS enterprise_price NUMERIC`);
  await pool.query(`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS selected_tier TEXT`);

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

// ── Generate signed contract PDF ─────────────────────────────────
const TERMS_SECTIONS = [
  {
    title: 'Acknowledgment of Roofing Industry Knowledge',
    content: [
      'Client represents that each trainee participating in the Roof MRI training has a basic working knowledge of roofing systems and job site safety procedures.',
    ],
  },
  {
    title: 'Certification, Continuing Education, and Transferability',
    content: [
      'Certification is issued to individual participants only and cannot be transferred to other persons or companies.',
      'A company may represent itself as having \u201cRoof MRI certified staff\u201d only if at least one of its current employees holds an active certification. If a certified employee leaves the company, the company may no longer claim to have certified staff unless others are certified.',
    ],
    subsections: [
      {
        label: '(a) Continuing Education Requirement',
        text: 'Each certified individual must complete a minimum of two (2) continuing training education (CTE) credits per calendar year to maintain active certification status. CTE credit opportunities will be made available by ReDry. Failure to complete the required credits by December 31 of each calendar year will result in suspension of certification until credits are fulfilled.',
      },
      {
        label: '(b) Company Association',
        text: 'Each certified individual\u2019s certification is associated with the company under which they were trained. The individual may only represent themselves as a Roof MRI Certified Technician while employed by or actively contracted with that company.',
      },
      {
        label: '(c) Non-Transferability',
        text: 'Certification does not transfer to a new employer. If a certified individual leaves the company under which they were trained, their certification becomes inactive with respect to any new employer unless both of the following conditions are met: (i) the original certifying company provides explicit written permission authorizing the transfer, and (ii) the new employer is also a certified Roof MRI contractor in good standing. Without both conditions satisfied, the new employer must complete its own certification engagement to utilize Roof MRI services.',
      },
    ],
  },
  {
    title: 'Training Requirements and Equipment',
    subsections: [
      {
        label: '(a) Pre-Field Training Roof List',
        text: 'No later than three (3) business days prior to field training, Client must provide a list of commercial flat or low-slope roofs for use in training. No shingle, metal, or steep-slope roofs will be accepted. Client is responsible for securing roof access and ensuring the roofs are safe for training. Failure to provide the roof list on time may result in cancellation or rescheduling of training.',
      },
      {
        label: '(b) Equipment',
        text: 'Each trainee must bring a qualifying moisture detection device. ReDry will provide equipment specifications beforehand. Limited loaner devices may be available but are not guaranteed. Any borrowed equipment must be returned in original condition or will be billed to Client.',
      },
    ],
  },
  {
    title: 'Payment, Cancellation, and Rescheduling',
    subsections: [
      {
        label: '(a) Professional Tier Payment',
        text: 'Professional packages require payment in full at the time of booking. Training will not be scheduled until full payment has been received.',
      },
      {
        label: '(b) Regional Tier Payment',
        text: 'Regional packages require a non-refundable deposit of fifty percent (50%) of the total package price at the time of booking. The remaining balance is due no later than five (5) business days prior to the scheduled training date.',
      },
      {
        label: '(c) Enterprise Tier Payment',
        text: 'Enterprise engagements are scoped and priced through a consultative process. Enterprise pricing is not finalized through the online configurator. A custom statement of work will be issued following consultation, and payment terms will be defined therein.',
      },
      {
        label: '(d) Non-Performance for Non-Payment',
        text: 'Training will not commence until all outstanding balances have been received in full. ReDry reserves the right to postpone or cancel any scheduled training for which payment has not been received by the required due date, without liability to Client.',
      },
      {
        label: '(e) Client Cancellation',
        text: 'All deposits are non-refundable. If Client cancels for any reason after the deposit has been paid, no portion of the deposit or any payments made shall be returned.',
      },
      {
        label: '(f) Client Rescheduling (Non-Weather)',
        text: 'Client may reschedule training one (1) time without forfeiting their deposit, provided that (i) written notice is given at least seven (7) business days prior to the scheduled training date, and (ii) a $500 rescheduling fee is paid prior to confirming the new date. Any additional reschedule requests shall be treated as a cancellation.',
      },
      {
        label: '(g) Weather-Related Rescheduling',
        text: 'If field training cannot proceed due to weather conditions, Client may reschedule at no additional cost provided written notice is given at least forty-eight (48) hours prior to the scheduled start of training (8:00 AM local time on the first training day). Weather-related reschedules do not count toward the one-time reschedule allowance described in subsection (f).',
      },
      {
        label: '(h) ReDry Rescheduling',
        text: 'ReDry reserves the right to reschedule training at any time due to trainer illness, travel disruption, safety concerns, or other operational reasons, at no cost or penalty to Client. ReDry will make reasonable efforts to provide advance notice and to reschedule within thirty (30) days of the original date.',
      },
    ],
  },
  {
    title: 'Unlimited MRI Package Subscription',
    content: [
      'Access to the full suite of scanning grids and MRI tools requires an active \u201cUnlimited MRI Package\u201d subscription.',
      'If Client opts not to maintain the subscription, they must acknowledge limited access and scanning ability.',
      'A 30-day complimentary trial is available for new trainees.',
    ],
  },
  {
    title: 'Safety Requirements and Liability Waiver',
    subsections: [
      {
        label: '(a) Liability Waiver',
        text: 'All participants must sign a waiver acknowledging the risks of rooftop training, including potential injury or death. ReDry is not liable for accidents or injuries except in cases of gross negligence.',
      },
      {
        label: '(b) Participant Fitness and Conduct',
        text: 'Participants confirm they are medically fit for rooftop activity. Trainers may exclude any individual who appears unfit or unsafe to participate.',
      },
      {
        label: '(c) Required Personal Protective Equipment (PPE)',
        text: 'Participants must wear appropriate PPE, including non-slip footwear. Fall protection gear must be used where required by OSHA, local law, or trainer instruction.',
      },
      {
        label: '(d) On-Site Safety Procedures',
        text: 'Client must provide a safe roof access method. ReDry may delay or cancel field activities due to unsafe conditions, including inclement weather.',
      },
      {
        label: '(e) Age Requirement',
        text: 'Participants must be 18 years of age or older.',
      },
    ],
  },
  {
    title: 'Intellectual Property and Confidentiality',
    content: [
      'All training materials, methods, and the Roof MRI process are proprietary and patent-pending.',
      'No reproduction, external teaching, sublicensing, or redistribution is allowed.',
      'Materials must be handled as confidential and may not be recorded or shared without ReDry\u2019s written permission.',
      'Unauthorized use may result in legal action and revocation of certification.',
      'The confidentiality obligations set forth in this Section shall survive the expiration or termination of this Agreement and shall remain in effect indefinitely.',
    ],
    subsections: [
      {
        label: 'Irreparable Harm and Injunctive Relief',
        text: 'Client acknowledges that any breach of this Section would cause irreparable harm to ReDry for which monetary damages alone would be inadequate. In the event of any actual or threatened breach, ReDry shall be entitled to seek immediate injunctive relief, specific performance, and any other equitable remedies available under law, without the necessity of posting bond or proving actual damages.',
      },
      {
        label: 'Presumption of Liability',
        text: 'Client agrees that ReDry\u2019s demonstration of a breach of any obligation under this Section shall constitute sufficient evidence of liability, and Client shall bear the burden of proving that no damages resulted from such breach. Client further agrees that ReDry shall be entitled to pursue all remedies to the fullest extent permitted by applicable law, including recovery of attorneys\u2019 fees, costs, and consequential damages arising from any such breach.',
      },
      {
        label: 'Liquidated Damages',
        text: 'Client acknowledges that the precise amount of damages resulting from a breach of this Section would be difficult or impossible to determine. Accordingly, in the event of a proven breach, Client agrees to pay liquidated damages in an amount equal to three (3) times the total fees paid under this Agreement, in addition to any other remedies available to ReDry. This liquidated damages provision reflects the parties\u2019 reasonable estimate of anticipated harm and shall not be construed as a penalty.',
      },
    ],
  },
  {
    title: 'Liability, Indemnification, and Remedies',
    subsections: [
      {
        label: '(a) Limitation of Liability',
        text: 'To the maximum extent permitted by applicable law, ReDry\u2019s total aggregate liability arising out of or related to this Agreement, whether in contract, tort, or otherwise, shall not exceed the total fees actually paid by Client under this Agreement. In no event shall ReDry be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of revenue, loss of profits, or loss of business opportunity, regardless of whether such damages were foreseeable or whether ReDry was advised of the possibility thereof.',
      },
      {
        label: '(b) Indemnification',
        text: 'Client agrees to indemnify, defend, and hold harmless ReDry LLC, its officers, employees, trainers, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys\u2019 fees) arising out of or related to: (i) the condition, safety, or accessibility of any roofs or job sites provided by Client for training purposes; (ii) the acts, omissions, or negligence of Client\u2019s employees, agents, or trainees during or in connection with training activities; (iii) Client\u2019s misuse, misrepresentation, or unauthorized application of the Roof MRI certification, methodology, or materials; or (iv) any breach of this Agreement by Client.',
      },
    ],
  },
  {
    title: 'General Terms',
    subsections: [
      {
        label: '(a) Governing Law',
        text: 'This Agreement will be governed by the laws of the state in which ReDry is headquartered, without regard to conflicts of law principles.',
      },
      {
        label: '(b) Force Majeure',
        text: 'Neither party shall be liable for any delay or failure to perform its obligations under this Agreement if such delay or failure results from circumstances beyond the party\u2019s reasonable control, including but not limited to: acts of God, natural disasters, severe weather, fire, flood, epidemic or pandemic, government actions or orders, civil unrest, war or terrorism, labor disputes, utility or telecommunications failures, travel disruptions, or trainer illness or medical emergency. The affected party shall provide prompt written notice and shall use reasonable efforts to mitigate the impact and resume performance as soon as practicable. If a force majeure event continues for more than sixty (60) days, either party may terminate this Agreement upon written notice, and Client shall be entitled to a pro-rata refund of fees paid for services not yet rendered, less any non-refundable deposits.',
      },
      {
        label: '(c) Entire Agreement',
        text: 'This document represents the full understanding between the parties and supersedes all prior agreements regarding training.',
      },
      {
        label: '(d) Amendments',
        text: 'This Agreement may be modified only in writing signed by both parties.',
      },
      {
        label: '(e) Survival',
        text: 'Sections 2 (Certification), 7 (Intellectual Property and Confidentiality), and 8 (Liability, Indemnification, and Remedies) shall survive the expiration or termination of this Agreement.',
      },
    ],
  },
  {
    title: 'Acknowledgment and Execution',
    content: [
      'By signing below, the undersigned certifies that they are authorized to enter into this Agreement on behalf of the Client and to enroll the listed individuals in the Roof MRI Certification Training.',
    ],
  },
];

const TIER_NAMES = { professional: 'Professional', regional: 'Regional', enterprise: 'Enterprise' };
const TIER_BASE_INFO = {
  professional: { trainees: 3, kits: 1, days: '1 Day' },
  regional: { trainees: 10, kits: 2, days: '2 Days' },
  enterprise: { trainees: 25, kits: 4, days: '4 Days' },
};

function buildContractPdf(proposal) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 55, right: 55 } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#1B2A4A';
    const green = '#00bd70';
    const gray = '#64748b';
    const lightBg = '#f8fafc';
    const borderGray = '#e2e8f0';
    const pageW = doc.page.width - 110; // usable width
    const leftM = 55;

    const tierKey = proposal.selected_tier || proposal.tier || 'professional';
    const tierName = TIER_NAMES[tierKey] || tierKey;
    const tierInfo = TIER_BASE_INFO[tierKey] || TIER_BASE_INFO.professional;
    const totalPrice = Number(proposal.total_price) || 0;
    const signedDate = proposal.signed_at
      ? new Date(proposal.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    function fmt(n) { return '$' + Number(n).toLocaleString('en-US'); }

    function checkPage(needed) {
      if (doc.y + needed > doc.page.height - 60) {
        doc.addPage();
      }
    }

    // ── Page 1: Header ──
    doc.rect(0, 0, doc.page.width, 70).fill(navy);
    doc.fontSize(22).fill('#ffffff').text('ROOF ', leftM, 24, { continued: true })
       .fill(green).text('MRI', { continued: false });
    doc.fontSize(9).fill('#94a3b8').text('TRAINING & CERTIFICATION AGREEMENT', leftM, 50);

    doc.moveDown(2);

    // ── Agreement intro ──
    doc.fontSize(16).fill(navy).text('Training Agreement', leftM, doc.y);
    doc.moveDown(0.5);
    doc.fontSize(9.5).fill('#374151').text(
      `This Training Agreement (\u201CAgreement\u201D) is entered into by and between ReDry LLC (\u201CReDry\u201D) and ${proposal.company} (\u201CClient\u201D), effective as of ${signedDate} (\u201CEffective Date\u201D), and governs the participation of the Client and its individual trainees in the Roof MRI Certification Training Program provided by ReDry.`,
      leftM, doc.y, { width: pageW, lineGap: 2 }
    );
    doc.moveDown(1);

    // ── Package Summary Box ──
    checkPage(140);
    const boxY = doc.y;
    doc.rect(leftM, boxY, pageW, 24).fill(navy);
    doc.fontSize(11).fill('#ffffff').text('SELECTED PACKAGE', leftM + 12, boxY + 7);

    let detailY = boxY + 24;
    doc.rect(leftM, detailY, pageW, 100).fill(lightBg).stroke(borderGray);

    const col1X = leftM + 12;
    const col2X = leftM + pageW / 2 + 12;

    detailY += 10;
    doc.fontSize(9).fill(gray).text('Package:', col1X, detailY);
    doc.fontSize(9).fill(navy).text(`${tierName}`, col1X + 70, detailY);

    detailY += 16;
    doc.fontSize(9).fill(gray).text('Company:', col1X, detailY);
    doc.fontSize(9).fill(navy).text(proposal.company, col1X + 70, detailY);
    doc.fontSize(9).fill(gray).text('Contact:', col2X, detailY);
    doc.fontSize(9).fill(navy).text(proposal.contact_name, col2X + 70, detailY);

    detailY += 16;
    doc.fontSize(9).fill(gray).text('Trainees:', col1X, detailY);
    const totalTrainees = tierInfo.trainees + (proposal.extra_trainees || 0);
    doc.fontSize(9).fill(navy).text(`${totalTrainees} (${tierInfo.trainees} base${proposal.extra_trainees > 0 ? ` + ${proposal.extra_trainees} additional` : ''})`, col1X + 70, detailY);
    doc.fontSize(9).fill(gray).text('Recon Kits:', col2X, detailY);
    const totalKits = tierInfo.kits + (proposal.extra_kits || 0);
    doc.fontSize(9).fill(navy).text(`${totalKits} (${tierInfo.kits} base${proposal.extra_kits > 0 ? ` + ${proposal.extra_kits} additional` : ''})`, col2X + 70, detailY);

    detailY += 16;
    doc.fontSize(9).fill(gray).text('Duration:', col1X, detailY);
    doc.fontSize(9).fill(navy).text(tierInfo.days, col1X + 70, detailY);
    if (proposal.tracks && proposal.tracks.length > 0) {
      doc.fontSize(9).fill(gray).text('Tracks:', col2X, detailY);
      doc.fontSize(9).fill(navy).text(proposal.tracks.join(', '), col2X + 70, detailY);
    }

    detailY += 16;
    doc.fontSize(9).fill(gray).text('Total Price:', col1X, detailY);
    doc.fontSize(10).fill(navy).font('Helvetica-Bold').text(fmt(totalPrice), col1X + 70, detailY);
    doc.font('Helvetica');

    doc.y = boxY + 134;
    doc.moveDown(1);

    // ── Terms & Conditions ──
    doc.fontSize(13).fill(navy).text('Terms & Conditions', leftM, doc.y);
    doc.moveDown(0.5);

    TERMS_SECTIONS.forEach((section, idx) => {
      checkPage(40);
      doc.fontSize(10).fill(navy).text(`${idx + 1}. ${section.title}`, leftM, doc.y, { width: pageW });
      doc.moveDown(0.3);

      if (section.content) {
        section.content.forEach(p => {
          checkPage(30);
          doc.fontSize(8.5).fill('#374151').text(p, leftM + 14, doc.y, { width: pageW - 14, lineGap: 1.5 });
          doc.moveDown(0.2);
        });
      }

      if (section.subsections) {
        section.subsections.forEach(sub => {
          checkPage(30);
          doc.fontSize(8.5).fill(navy).text(sub.label, leftM + 14, doc.y, { width: pageW - 14 });
          doc.moveDown(0.1);
          doc.fontSize(8.5).fill('#374151').text(sub.text, leftM + 14, doc.y, { width: pageW - 14, lineGap: 1.5 });
          doc.moveDown(0.2);
        });
      }

      doc.moveDown(0.4);
    });

    // ── Signature Block ──
    checkPage(120);
    doc.moveDown(0.5);
    const sigBlockY = doc.y;
    doc.rect(leftM, sigBlockY, pageW, 24).fill(navy);
    doc.fontSize(11).fill('#ffffff').text('EXECUTION', leftM + 12, sigBlockY + 7);

    let sigY = sigBlockY + 34;
    doc.fontSize(9).fill(gray).text('Signed by:', leftM, sigY);
    doc.fontSize(10).fill(navy).text(proposal.signature_name || 'N/A', leftM + 70, sigY);

    sigY += 18;
    doc.fontSize(9).fill(gray).text('Company:', leftM, sigY);
    doc.fontSize(10).fill(navy).text(proposal.company, leftM + 70, sigY);

    sigY += 18;
    doc.fontSize(9).fill(gray).text('Date:', leftM, sigY);
    doc.fontSize(10).fill(navy).text(signedDate, leftM + 70, sigY);

    // Render the actual signature image if available
    sigY += 24;
    if (proposal.signature_data) {
      try {
        // signature_data is a base64 data URL from the canvas
        const sigImgData = proposal.signature_data.replace(/^data:image\/\w+;base64,/, '');
        const sigBuffer = Buffer.from(sigImgData, 'base64');
        doc.image(sigBuffer, leftM, sigY, { width: 200, height: 60 });
        sigY += 65;
      } catch (sigErr) {
        // If signature image fails, show a line instead
        doc.moveTo(leftM, sigY + 30).lineTo(leftM + 200, sigY + 30).lineWidth(0.5).stroke(borderGray);
        sigY += 40;
      }
    } else {
      doc.moveTo(leftM, sigY + 30).lineTo(leftM + 200, sigY + 30).lineWidth(0.5).stroke(borderGray);
      sigY += 40;
    }

    // ── Footer ──
    doc.fontSize(8).fill(gray).text(
      'Roof MRI | Advancing the Science of Roof Moisture Detection | roof-mri.com',
      leftM, doc.page.height - 40, { width: pageW, align: 'center' }
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
    if (!email.toLowerCase().trim().endsWith('@re-dry.com')) {
      return res.status(403).json({ error: 'Only @re-dry.com email addresses are allowed' });
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
      { expiresIn: '90d' }
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
    if (!email.toLowerCase().trim().endsWith('@re-dry.com')) {
      return res.status(403).json({ error: 'Only @re-dry.com email addresses are allowed' });
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
      { expiresIn: '90d' }
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
    data.professionalPrice = data.professionalPrice ?? data.professional_price;
    data.regionalPrice = data.regionalPrice ?? data.regional_price;
    data.enterprisePrice = data.enterprisePrice ?? data.enterprise_price;

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
        let_client_choose, vimeo_url, professional_price, regional_price, enterprise_price)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      id, data.proposalNum, data.contactName, data.company, data.email,
      data.tier ?? null, data.tierPrice ?? null,
      data.extraTrainees ?? 0, data.extraKits ?? 0,
      data.tracks ?? [], data.videography ?? false, data.onRoofDay ?? false,
      data.totalPrice ?? null, data.letClientChoose ?? false,
      data.vimeoUrl ?? null,
      data.professionalPrice ?? null, data.regionalPrice ?? null, data.enterprisePrice ?? null
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

    // Generate signed contract PDF
    const p = updated[0];
    const safeName = stripHtml(p.contact_name);
    const safeCompany = stripHtml(p.company);
    let contractPdfBuffer;
    try {
      contractPdfBuffer = await buildContractPdf(p);
    } catch (pdfErr) {
      console.error('Contract PDF generation failed:', pdfErr);
      // Continue without PDF – signing still succeeded
    }

    const pdfAttachment = contractPdfBuffer ? [{
      content: contractPdfBuffer.toString('base64'),
      filename: `Roof-MRI-Contract-${safeCompany.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }] : [];

    // Send contract PDF to client
    try {
      await sgMail.send({
        to: p.email,
        from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
        subject: `Your Signed Agreement - Roof MRI Training`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2A4A">
          <div style="background:#1B2A4A;padding:16px 20px;text-align:center">
            <span style="color:#fff;font-size:18px;font-weight:700">ROOF <span style="color:#00bd70">MRI</span></span>
          </div>
          <div style="padding:24px;background:#fff;border:1px solid #e2e8f0">
            <p style="font-size:15px;color:#374151;margin-bottom:16px">Hi ${safeName},</p>
            <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px">Thank you for signing your Roof MRI Training Agreement! Your signed contract is attached to this email for your records.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:16px">
              <p style="font-size:13px;color:#64748b;margin:0 0 4px 0">Package: <strong style="color:#1B2A4A">${p.tier ? p.tier.charAt(0).toUpperCase() + p.tier.slice(1) : 'Custom'}</strong></p>
              <p style="font-size:13px;color:#64748b;margin:0 0 4px 0">Company: <strong style="color:#1B2A4A">${safeCompany}</strong></p>
              <p style="font-size:13px;color:#64748b;margin:0">Total: <strong style="color:#1B2A4A">${p.total_price ? '$' + Number(p.total_price).toLocaleString() : 'TBD'}</strong></p>
            </div>
            <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:12px">Next step: complete your payment to lock in your training dates. You can pay directly from your proposal page.</p>
            <p style="font-size:14px;color:#374151;line-height:1.6">Questions? Reply to this email or reach out to adam@re-dry.com.</p>
          </div>
          <div style="background:#1B2A4A;padding:12px 20px;text-align:center">
            <p style="margin:0;font-size:11px;color:#94a3b8">Roof MRI | Advancing the Science of Roof Moisture Detection</p>
          </div>
        </div>`,
        attachments: pdfAttachment,
      });
    } catch (clientEmailErr) {
      console.error('Failed to send contract to client:', clientEmailErr);
    }

    // Notify Adam that a proposal was signed (with contract attached)
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
      </div>`,
      attachments: pdfAttachment,
    });

    res.json({ success: true, message: 'Proposal signed' });
  } catch (err) {
    console.error('Error signing proposal:', err);
    res.status(500).json({ error: 'Failed to sign proposal' });
  }
});

// ── POST /api/proposals/:id/select-tier ──────────────────────────
// Client selects a tier on a "let client choose" proposal
app.post('/api/proposals/:id/select-tier', proposalViewLimiter, async (req, res) => {
  try {
    const { tier } = req.body;
    const validTiers = ['professional', 'regional', 'enterprise'];
    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier selection' });
    }

    const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = rows[0];
    if (!proposal.let_client_choose) {
      return res.status(400).json({ error: 'This proposal does not allow tier selection' });
    }
    if (proposal.status === 'signed') {
      return res.status(409).json({ error: 'This proposal has already been signed' });
    }

    // Look up the price for the selected tier
    const priceColumn = `${tier}_price`;
    const tierPrice = proposal[priceColumn];
    if (!tierPrice || Number(tierPrice) <= 0) {
      return res.status(400).json({ error: 'No price available for this tier' });
    }

    const { rows: updated } = await pool.query(
      `UPDATE proposals SET selected_tier = $1, tier = $1, total_price = $2
       WHERE id = $3 RETURNING *`,
      [tier, tierPrice, req.params.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('Error selecting tier:', err);
    res.status(500).json({ error: 'Failed to select tier' });
  }
});

// ── Tier add-on rates for package pricing ──────────────────────────
const TIER_ADDON_RATES = {
  professional: { baseTrainees: 3, baseKits: 1, baseTracks: 0, traineeRate: 2000, kitRate: 4000, trackRate: 5000, videoRate: 2000, onRoofRate: 5000 },
  regional: { baseTrainees: 10, baseKits: 2, baseTracks: 2, traineeRate: 1600, kitRate: 4000, trackRate: 5000, videoRate: 0, onRoofRate: 5000 },
  enterprise: { baseTrainees: 25, baseKits: 4, baseTracks: 4, traineeRate: 0, kitRate: 4000, trackRate: 0, videoRate: 0, onRoofRate: 0 },
};

// ── POST /api/proposals/:id/configure ────────────────────────────
// Full package configuration for "let client choose" proposals
app.post('/api/proposals/:id/configure', proposalViewLimiter, async (req, res) => {
  try {
    const { tier, extraTrainees, extraKits, tracks, videography, onRoofDay } = req.body;
    const validTiers = ['professional', 'regional', 'enterprise'];
    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier selection' });
    }

    const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = rows[0];

    if (!proposal.let_client_choose) {
      return res.status(400).json({ error: 'This proposal does not allow package configuration' });
    }
    if (proposal.status === 'signed') {
      return res.status(409).json({ error: 'This proposal has already been signed' });
    }

    const basePrice = Number(proposal[`${tier}_price`]) || 0;
    if (basePrice <= 0) {
      return res.status(400).json({ error: 'No base price available for this tier' });
    }

    const rates = TIER_ADDON_RATES[tier];
    const extraTraineeCount = Math.max(0, parseInt(extraTrainees) || 0);
    const extraKitCount = Math.max(0, parseInt(extraKits) || 0);
    const validTrackNames = ['Sales', 'Service', 'Production', 'Marketing'];
    const trackList = Array.isArray(tracks) ? tracks.filter(t => validTrackNames.includes(t)) : [];
    const extraTrackCount = Math.max(0, trackList.length - rates.baseTracks);
    const hasVideo = !!videography;
    const hasOnRoof = !!onRoofDay;

    let totalPrice = basePrice;
    totalPrice += extraTraineeCount * rates.traineeRate;
    totalPrice += extraKitCount * rates.kitRate;
    if (extraTrackCount > 0) totalPrice += extraTrackCount * rates.trackRate;
    if (hasVideo) totalPrice += rates.videoRate;
    if (hasOnRoof) totalPrice += rates.onRoofRate;

    const { rows: updated } = await pool.query(
      `UPDATE proposals SET
        selected_tier = $1, tier = $1, total_price = $2,
        extra_trainees = $3, extra_kits = $4, tracks = $5,
        videography = $6, on_roof_day = $7
       WHERE id = $8 RETURNING *`,
      [tier, totalPrice, extraTraineeCount, extraKitCount, trackList, hasVideo, hasOnRoof, req.params.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error('Error configuring proposal:', err);
    res.status(500).json({ error: 'Failed to configure proposal' });
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
    if (proposal.payment_status === 'processing') {
      return res.status(409).json({ error: 'A bank transfer is currently being processed. Please wait for it to clear.' });
    }
    if (!proposal.total_price || Number(proposal.total_price) <= 0) {
      return res.status(400).json({ error: 'No price set for this proposal' });
    }

    // Enterprise tier requires a phone consultation – no online checkout
    const proposalTier = proposal.selected_tier || proposal.tier;
    if (proposalTier === 'enterprise') {
      return res.status(400).json({ error: 'Enterprise packages require a consultation call. Please contact adam@re-dry.com or call to finalize payment.' });
    }

    const baseUrl = process.env.PROPOSAL_BASE_URL || 'https://proposals.roof-mri.com';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: { permissions: ['payment_method'] },
        },
      },
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Roof MRI Training \u2013 ${proposal.tier ? proposal.tier.charAt(0).toUpperCase() + proposal.tier.slice(1) : 'Custom'} Package`,
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
