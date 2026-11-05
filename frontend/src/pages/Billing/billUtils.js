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

