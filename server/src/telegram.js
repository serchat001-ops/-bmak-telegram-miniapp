const crypto = require('crypto');

function validateTelegramWebAppData(initData) {
  if (!initData) return null;
  
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    const dataCheckArr = [];
    for (const [key, value] of [...params.entries()].sort()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN || '')
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return null;

    const userParam = params.get('user');
    if (!userParam) return null;

    return JSON.parse(userParam);
  } catch (e) {
    console.error('[Telegram] Validation error:', e.message);
    return null;
  }
}

function generateReferralCode(telegramId) {
  return `BMAK${telegramId.toString(36).toUpperCase()}`;
}

module.exports = { validateTelegramWebAppData, generateReferralCode };
