const express = require('express');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
      open_count INTEGER DEFAULT 0
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

  let summaryRows = '';
  if (letClientChoose) {
    summaryRows = `
      <tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;width:40%;">Package</td>
        <td style="padding:10px 14px;font-size:14px;color:#1B2A4A;font-weight:700;border-bottom:1px solid #e2e8f0;">Your choice of training tier</td>
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
<tr><td style="background:#1B2A4A;padding:20px 28px;text-align:center;">
  <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">ROOF </span><span style="color:#00bd70;font-size:22px;font-weight:700;letter-spacing:1px;">MRI</span>
  <br><span style="color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Training &amp; Certification</span>
</td></tr>
<tr><td style="padding:28px 28px 8px 28px;">
  <p style="margin:0;font-size:16px;color:#1B2A4A;line-height:1.5;">Hi ${firstName},</p>
</td></tr>
<tr><td style="padding:8px 28px 20px 28px;">
  <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">Thanks for taking the time to talk with us about Roof MRI training for <strong style="color:#1B2A4A;">${company}</strong>. We've put together a custom training proposal based on our conversation. Everything you need is in the link below.</p>
</td></tr>
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
<tr><td style="padding:24px 28px 28px 28px;text-align:center;">
  <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
    <tr><td style="background:#00bd70;border-radius:8px;padding:16px 48px;text-align:center;">
      <a href="${proposalUrl}" style="color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;display:block;">Get Started Here</a>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:0 28px 24px 28px;">
  <p style="margin:0 0 8px 0;font-size:14px;color:#475569;line-height:1.6;">If you have any questions, just hit reply. We're here to help.</p>
  <p style="margin:0;font-size:14px;color:#1B2A4A;font-weight:600;">Adam Capps</p>
  <p style="margin:0;font-size:13px;color:#64748b;">Roof MRI</p>
</td></tr>
<tr><td style="background:#1B2A4A;padding:16px 28px;text-align:center;">
  <p style="margin:0 0 4px 0;font-size:12px;color:#94a3b8;">Roof MRI | Advancing the Science of Roof Moisture Detection</p>
  <p style="margin:0;font-size:11px;color:#64748b;">roof-mri.com</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── POST /api/send-proposal ────────────────────────────────────────
app.post('/api/send-proposal', async (req, res) => {
  try {
    const data = req.body;
        // Normalize field names (accept both snake_case and camelCase)
        data.contactName = data.contactName || data.contact_name;
        data.company = data.company || data.company_name;
        data.email = data.email || data.contact_email;
        data.contactPhone = data.contactPhone || data.contact_phone;
        data.letClientChoose = data.letClientChoose || data.let_client_choose;
        data.extraTrainees = data.extraTrainees || data.extra_trainees;
        data.extraKits = data.extraKits || data.extra_kits;
        data.onRoofDay = data.onRoofDay || data.on_roof_day;
        data.tierPrice = data.tierPrice || data.tier_price;
        data.totalPrice = data.totalPrice || data.total_price;
        data.proposalNum = data.proposalNum || data.proposal_num;
        data.vimeoUrl = data.vimeoUrl || data.vimeo_url;
    if (!data.email || !data.contactName || !data.company) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate unique proposal ID and store in DB
    const id = generateId();
    const baseUrl = process.env.PROPOSAL_BASE_URL || 'https://roof-mri.com';
    const proposalUrl = `${baseUrl}/p/${id}`;

    await pool.query(`
      INSERT INTO proposals (id, proposal_num, contact_name, company, email, tier, tier_price,
        extra_trainees, extra_kits, tracks, videography, on_roof_day, total_price,
        let_client_choose, vimeo_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `, [
      id, data.proposalNum, data.contactName, data.company, data.email,
      data.tier || null, data.tierPrice || null,
      data.extraTrainees || 0, data.extraKits || 0,
      data.tracks || [], data.videography || false, data.onRoofDay || false,
      data.totalPrice || null, data.letClientChoose || false,
      data.vimeoUrl || 'https://vimeo.com/1165967889'
    ]);

    // Build and send client email
    const html = buildEmail(data, proposalUrl);
    await sgMail.send({
      to: data.email,
      from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
      replyTo: { email: 'adam@re-dry.com', name: 'Adam Capps' },
      subject: `Roof MRI Training Proposal for ${data.company}`,
      html
    });

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
    res.status(500).json({ error: 'Failed to send proposal', details: err.message });
  }
});

// ── GET /api/proposals/:id ─────────────────────────────────────────
// Returns proposal data (for the Netlify-hosted proposal page to fetch)
app.get('/api/proposals/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    // Track opens
    await pool.query(
      'UPDATE proposals SET opened_at = COALESCE(opened_at, NOW()), open_count = open_count + 1 WHERE id = $1',
      [req.params.id]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/proposals/:id/sign ───────────────────────────────────
// Client signs the proposal
app.post('/api/proposals/:id/sign', async (req, res) => {
  try {
    const { signatureName, signatureData } = req.body;
    if (!signatureName || !signatureData) {
      return res.status(400).json({ error: 'Missing signature data' });
    }

    await pool.query(
      `UPDATE proposals SET status = 'signed', signature_name = $1, signature_data = $2, signed_at = NOW() WHERE id = $3`,
      [signatureName, signatureData, req.params.id]
    );

    // Notify Adam that a proposal was signed
    const { rows } = await pool.query('SELECT * FROM proposals WHERE id = $1', [req.params.id]);
    if (rows.length > 0) {
      const p = rows[0];
      await sgMail.send({
        to: 'adam@re-dry.com',
        from: { email: 'proposals@roof-mri.com', name: 'Roof MRI' },
        subject: `SIGNED: ${p.company} - ${p.contact_name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1B2A4A">
          <div style="background:#00bd70;padding:16px 20px;text-align:center">
            <span style="color:#fff;font-size:16px;font-weight:700">PROPOSAL SIGNED</span>
          </div>
          <div style="padding:20px;background:#fff;border:1px solid #e2e8f0">
            <p style="font-size:14px;color:#374151"><strong>${p.contact_name}</strong> at <strong>${p.company}</strong> just signed their proposal.</p>
            <p style="font-size:13px;color:#64748b">${p.tier ? p.tier.charAt(0).toUpperCase() + p.tier.slice(1) : 'Client Choice'} | ${p.total_price ? '$' + Number(p.total_price).toLocaleString() : 'TBD'}</p>
            <p style="font-size:13px;color:#64748b">Signed by: ${signatureName}</p>
          </div>
        </div>`
      });
    }

    res.json({ success: true, message: 'Proposal signed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/proposals ─────────────────────────────────────────────
// List all proposals (for your internal dashboard)
app.get('/api/proposals', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, proposal_num, contact_name, company, email, tier, total_price, status, created_at, opened_at, open_count, signed_at FROM proposals ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log(`Roof MRI backend on port ${PORT}`));
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
