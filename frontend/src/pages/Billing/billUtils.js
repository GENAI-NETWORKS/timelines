/**
 * billUtils.js
 * Helpers for departmental store bill generation, formatting, and number-to-words conversion.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

function convertLessThanThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ONES[n % 10] : '');
  } else if (n > 0) {
    str += ONES[n];
  }
  return str.trim();
}

/**
 * Converts a number to Indian Currency words:
 * e.g. 1430.50 -> "Rupees One Thousand Four Hundred Thirty and Fifty Paise Only"
 */
export function numberToWordsIndian(amount) {
  const num = Number(amount);
  if (isNaN(num) || num < 0) return '';
  if (num === 0) return 'Rupees Zero Only';

  const parts = num.toFixed(2).split('.');
  let integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);

  if (integerPart === 0 && decimalPart === 0) {
    return 'Rupees Zero Only';
  }

  let words = '';

  // Crores (10,000,000)
  const crores = Math.floor(integerPart / 10000000);
  integerPart %= 10000000;
  if (crores > 0) {
    words += convertLessThanThousand(crores) + ' Crore ';
  }

  // Lakhs (100,000)
  const lakhs = Math.floor(integerPart / 100000);
  integerPart %= 100000;
  if (lakhs > 0) {
    words += convertLessThanThousand(lakhs) + ' Lakh ';
  }

  // Thousands (1,000)
  const thousands = Math.floor(integerPart / 1000);
  integerPart %= 1000;
  if (thousands > 0) {
    words += convertLessThanThousand(thousands) + ' Thousand ';
  }

  // Hundreds & Remaining
  if (integerPart > 0) {
    words += convertLessThanThousand(integerPart) + ' ';
  }

  words = words.trim();
  let result = words ? `Rupees ${words}` : '';

  if (decimalPart > 0) {
    const paiseWords = convertLessThanThousand(decimalPart);
    result = result ? `${result} and ${paiseWords} Paise` : `${paiseWords} Paise`;
  }

  return (result + ' Only').replace(/\s+/g, ' ');
}

/**
 * Generate a fresh unique Bill / Invoice number
 */
export function generateBillNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `TL-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Formats a number to Indian currency format with 2 decimals
 */
export function formatINR(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Safe UTF-8 Base64 encode for browser
 */
export function safeBase64Encode(str) {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

/**
 * Safe UTF-8 Base64 decode for browser
 */
export function safeBase64Decode(b64) {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch {
    return decodeURIComponent(escape(atob(b64)));
  }
}

/**
 * Encodes a bill object into a super-compact Base64 string for QR code embedding
 */
export function encodeBillToPayload(bill) {
  const compact = {
    b: bill.billNo,
    d: bill.date,
    c: bill.customerName || '',
    p: bill.customerPhone || '',
    m: bill.paymentMode || 'CASH',
    i: (bill.items || []).map((it) => [it.name, Number(it.quantity) || 1, Number(it.price) || 0, it.barcode || '']),
    s: Number(bill.subtotal) || 0,
    ds: Number(bill.discountAmount) || 0,
    tx: Number(bill.taxRate) || 0,
    g: Number(bill.grandTotal) || 0,
  };
  return safeBase64Encode(JSON.stringify(compact));
}

/**
 * Decodes a compact or legacy Base64 string back into full bill object
 */
export function decodeBillFromPayload(encodedStr) {
  if (!encodedStr) return null;
  try {
    const jsonStr = safeBase64Decode(encodedStr);
    const parsed = JSON.parse(jsonStr);
    if (parsed.b) {
      return {
        billNo: parsed.b,
        date: parsed.d,
        customerName: parsed.c,
        customerPhone: parsed.p,
        paymentMode: parsed.m,
        items: (parsed.i || []).map((x) => ({
          name: x[0],
          quantity: x[1],
          price: x[2],
          barcode: x[3] || '',
        })),
        subtotal: parsed.s,
        discountAmount: parsed.ds || 0,
        taxRate: parsed.tx || 0,
        grandTotal: parsed.g,
      };
    }
    return parsed;
  } catch (e) {
    console.error('Failed to decode bill payload', e);
    return null;
  }
}


