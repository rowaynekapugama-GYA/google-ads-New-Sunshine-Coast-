/**
 * SCOFIS landing page enquiry handler
 * -----------------------------------------------------------------------------
 * Receives the landing page form, normalises it, and posts it into SmileOx by
 * emailing a JSON payload to the CRM intake address over TLS.
 *
 * Required environment variables (set these in Vercel > Settings > Environment
 * Variables, for Production, Preview and Development):
 *
 *   SMTP_HOST   e.g. smtp.smtp2go.com
 *   SMTP_PORT   465 (recommended) or 587
 *   SMTP_USER   your SMTP username
 *   SMTP_PASS   your SMTP password
 *   MAIL_FROM   e.g. no-reply@sunshinecoastofis.com.au
 *   LEAD_INTAKE optional override of the SmileOx intake address
 *   NOTIFY_TO   optional extra address to copy each enquiry to (the practice)
 *
 * Port 465 uses implicit TLS. Port 587 upgrades with STARTTLS and is forced
 * here with requireTLS, so a downgrade is rejected rather than sent in clear.
 * -----------------------------------------------------------------------------
 */

const nodemailer = require('nodemailer');

const INTAKE =
  process.env.LEAD_INTAKE ||
  'contact-submissions+50d8ee08-b736-4740-a84b-ae94788ca250@intake.smileox.com.au';

/** Trim, collapse whitespace and cap length so nothing silly reaches the CRM. */
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max || 500);
}

/** Normalise an Australian mobile or landline to +61 E.164 where we can. */
function normalisePhone(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('61') && digits.length >= 11) return '+' + digits;
  if (digits.startsWith('0') && digits.length >= 9) return '+61' + digits.slice(1);
  return digits;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  // Honeypot. Real people never fill this in, bots almost always do.
  // Return a success shape so the bot does not learn anything, but send nothing.
  if (clean(body.company)) {
    return res.status(200).json({ ok: true });
  }

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 160).toLowerCase();
  const phoneNumber = normalisePhone(body.phoneNumber);

  if (!firstName || !lastName) {
    return res.status(400).json({ ok: false, message: 'Please enter your first and last name.' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }
  if (phoneNumber.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid contact number.' });
  }

  // The payload SmileOx stores. firstName / lastName / email / phoneNumber are
  // the recognised fields; everything else is kept as lead detail.
  const payload = {
    firstName,
    lastName,
    email,
    phoneNumber,
    enquiryType: clean(body.enquiryType, 120),
    hasReferral: clean(body.hasReferral, 20),
    message: clean(body.message, 1500),
    source: 'Google Ads landing page',
    pageType: clean(body.pageType, 60),
    pageUrl: clean(body.pageUrl, 400),
    gclid: clean(body.gclid, 200),
    utmSource: clean(body.utm_source, 120),
    utmMedium: clean(body.utm_medium, 120),
    utmCampaign: clean(body.utm_campaign, 160),
    utmTerm: clean(body.utm_term, 160),
    utmContent: clean(body.utm_content, 160),
    submittedAt: new Date().toISOString()
  };

  // Drop empty keys so the CRM record stays tidy.
  Object.keys(payload).forEach((k) => { if (payload[k] === '') delete payload[k]; });

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,      // implicit TLS on 465
    requireTLS: port !== 465,  // force STARTTLS on 587, never fall back to plain
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const subject = `Website enquiry: ${firstName} ${lastName}${
    payload.enquiryType ? ' (' + payload.enquiryType + ')' : ''
  }`;

  try {
    await transporter.sendMail({
      to: INTAKE,
      from: process.env.MAIL_FROM || 'no-reply@sunshinecoastofis.com.au',
      replyTo: email,
      subject,
      text: JSON.stringify(payload)
    });

    // Optional plain-English copy to the practice so reception sees it straight away.
    if (process.env.NOTIFY_TO) {
      const lines = [
        `New enquiry from the ${payload.pageType || 'landing'} page`,
        '',
        `Name:     ${firstName} ${lastName}`,
        `Phone:    ${phoneNumber}`,
        `Email:    ${email}`,
        payload.enquiryType ? `About:    ${payload.enquiryType}` : null,
        payload.hasReferral ? `Referral: ${payload.hasReferral}` : null,
        payload.message ? `\nMessage:\n${payload.message}` : null,
        '',
        payload.gclid ? `Google click ID: ${payload.gclid}` : null,
        payload.utmCampaign ? `Campaign: ${payload.utmCampaign}` : null,
        `Page: ${payload.pageUrl || ''}`
      ].filter(Boolean);

      await transporter.sendMail({
        to: process.env.NOTIFY_TO,
        from: process.env.MAIL_FROM || 'no-reply@sunshinecoastofis.com.au',
        replyTo: email,
        subject,
        text: lines.join('\n')
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    // Log for Vercel's function logs, but never leak SMTP detail to the browser.
    console.error('[lead] send failed:', err && err.message ? err.message : err);
    return res.status(502).json({
      ok: false,
      message: 'We could not send your enquiry just now. Please call us on (07) 5406 0586.'
    });
  }
};
