const express = require('express');
const router = express.Router();
const { sendMail } = require('../email');

router.post('/', async (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  if (String(message).length > 5000) {
    return res.status(400).json({ error: 'Le message est trop long.' });
  }

  try {
    const result = await sendMail({
      to: 'contact@bmak.finance',
      subject: `[Contact B_MAK] Message de ${name}`,
      text: `Nom : ${name}\nEmail : ${email}\n\nMessage :\n${message}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#8b5cf6;">Nouveau message via le formulaire de contact B_MAK</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px;font-weight:bold;width:100px;">Nom :</td>
              <td style="padding:8px;">${escapeHtml(name)}</td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:8px;font-weight:bold;">Email :</td>
              <td style="padding:8px;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
            </tr>
          </table>
          <div style="margin-top:16px;">
            <strong>Message :</strong>
            <div style="margin-top:8px;padding:16px;background:#f4f4f4;border-radius:8px;white-space:pre-wrap;">${escapeHtml(message)}</div>
          </div>
          <hr style="margin-top:24px;border:none;border-top:1px solid #eee;">
          <p style="color:#999;font-size:12px;">Ce message a été envoyé depuis le formulaire de contact du site bmak.finance.</p>
        </div>
      `,
    });

    if (result && result.skipped) {
      console.error('[Contact] SMTP not configured — email was not sent');
      return res.status(503).json({ error: 'Le service de messagerie n\'est pas configuré. Contactez-nous à contact@bmak.finance.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[Contact] Failed to send email:', err.message);
    return res.status(500).json({ error: 'Échec de l\'envoi. Veuillez réessayer.' });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = router;
