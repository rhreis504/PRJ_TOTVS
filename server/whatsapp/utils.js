function normalizePhoneBR(raw) {
  const digits = String(raw || '').replace(/\D/g, '');

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return {
      valid: true,
      phone_e164: digits
    };
  }

  if (digits.length === 10 || digits.length === 11) {
    return {
      valid: true,
      phone_e164: `55${digits}`
    };
  }

  return {
    valid: false,
    phone_e164: null
  };
}

function toWhatsAppChatId(phone_e164) {
  return `${phone_e164}@c.us`;
}

module.exports = {
  normalizePhoneBR,
  toWhatsAppChatId
};
