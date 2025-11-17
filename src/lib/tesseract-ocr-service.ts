/**
 * Tesseract OCR Service
 * =====================
 * 
 * This service provides OCR functionality using Google Tesseract.js
 * as an alternative to the Google AI-based OCR system.
 */

import Tesseract from 'tesseract.js';
import { ReceiptDataItem } from '@/types';

const isDebugLoggingEnabled = process.env.NODE_ENV !== 'production';

const logDebug = (...args: unknown[]) => {
  if (!isDebugLoggingEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(...args);
};

const logError = (...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.error(...args);
};

export interface TesseractOCRResult {
  text: string;
  confidence: number;
  items: ReceiptDataItem[];
  processingTime: number;
  errorLog: string[];
}

/**
 * Extract text from an image using Tesseract OCR
 * @param imageDataUri - The image as a data URI
 * @returns Promise with OCR results
 */
export async function extractTextWithTesseract(imageDataUri: string): Promise<TesseractOCRResult> {
  const startTime = Date.now();
  const errorLog: string[] = [];
  
  try {
    logDebug('🔍 Starting Tesseract OCR analysis...');
    
    // Configure Tesseract worker
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logDebug(`📝 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    // Perform OCR
    const { data: { text, confidence } } = await worker.recognize(imageDataUri);
    
    // Terminate worker
    await worker.terminate();
    
    logDebug('✅ Tesseract OCR completed');
    logDebug('📊 OCR Confidence:', confidence);
    logDebug('📝 Extracted text length:', text.length);
    
    // Parse the extracted text into structured data
    const items = parseReceiptText(text);
    
    const processingTime = Date.now() - startTime;
    
    return {
      text,
      confidence: confidence / 100, // Convert to 0-1 scale
      items,
      processingTime,
      errorLog
    };
    
  } catch (error) {
    const errorMsg = `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errorLog.push(errorMsg);
    logError(errorMsg, error);
    
    return {
      text: '',
      confidence: 0,
      items: [],
      processingTime: Date.now() - startTime,
      errorLog
    };
  }
}

/**
 * Parse OCR text into structured receipt data
 * @param text - Raw OCR text
 * @returns Array of structured receipt items
 */
function parseReceiptText(text: string): ReceiptDataItem[] {
  const normalizedLines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  logDebug('📋 Parsing receipt text into structured data...');
  logDebug('📄 Total lines to process:', normalizedLines.length);

  const parsedItems: ReceiptDataItem[] = [];
  const seenSingleValueItems = new Set<string>();
  let itemIndex = 0;

  const addItem = (label: string, value: string, allowDuplicates = false) => {
    if (!value) {
      return;
    }

    const normalizedKey = `${label}:${value}`.toLowerCase();
    if (!allowDuplicates && seenSingleValueItems.has(normalizedKey)) {
      return;
    }

    if (!allowDuplicates) {
      seenSingleValueItems.add(normalizedKey);
    }

    parsedItems.push({
      id: `${label.toLowerCase().replace(/\s+/g, '-')}-${itemIndex++}`,
      label,
      value: value.trim()
    });
  };

  // Attempt to capture vendor information from the top of the receipt
  const vendorLine = normalizedLines.find((line, idx) => idx < 6 && isVendorLine(line));
  if (vendorLine) {
    addItem('Vendor', normalizeVendor(vendorLine));
  }

  let hasCapturedDate = false;

  normalizedLines.forEach((line, index) => {
    const lineForLogging = `[${index}] ${line}`;

    // Date extraction (capture only once to avoid duplicates)
    if (!hasCapturedDate) {
      const dateMatch = extractDate(line);
      if (dateMatch) {
        addItem('Date', dateMatch);
        hasCapturedDate = true;
        return;
      }
    }

    // Time extraction
    const timeMatch = extractTime(line);
    if (timeMatch) {
      addItem('Time', timeMatch);
      return;
    }

    // Totals, subtotal, tax, discounts, change, tendered amounts
    const totalLikeAmount = extractLabeledAmount(line);
    if (totalLikeAmount) {
      addItem(totalLikeAmount.label, totalLikeAmount.amount);
      return;
    }

    // Tip extraction
    const tipMatch = extractTip(line);
    if (tipMatch) {
      addItem('Tip', tipMatch);
      return;
    }

    // Payment method or card information
    const paymentMatch = extractPaymentMethod(line);
    if (paymentMatch) {
      addItem('Payment Method', paymentMatch);
      return;
    }

    const cardMethod = extractCardDetails(line);
    if (cardMethod) {
      addItem('Payment Method', cardMethod);
      return;
    }

    // Invoice / reference numbers
    const referenceMatch = extractReference(line);
    if (referenceMatch) {
      addItem(referenceMatch.label, referenceMatch.value);
      return;
    }

    // Itemized entries
    const itemMatch = extractItem(line);
    if (itemMatch) {
      const formattedValue = formatItemValue(itemMatch);
      addItem('Item', formattedValue, true);
      return;
    }

    // Capture standalone amounts near the bottom if no label is present
    if (isStandaloneAmountCandidate(line, index, normalizedLines.length)) {
      addItem('Total Amount', normalizeAmount(line.match(/(-?\$?\d+[.,]\d{2})/i)![1]));
      return;
    }

    // Capture potentially important text (avoid noise)
    if (!isLikelyNoise(line)) {
      addItem('Text', line, true);
      return;
    }

    logDebug('ℹ️ Ignored line during parsing:', lineForLogging);
  });

  logDebug('✅ Parsed receipt items:', parsedItems.length);
  return parsedItems;
}

/**
 * Check if a line is likely a vendor/store name
 */
function isVendorLine(line: string): boolean {
  const lowerLine = line.toLowerCase();
  if (lowerLine.length < 3 || lowerLine.length > 60) {
    return false;
  }

  if (/\d{3,}/.test(lowerLine)) {
    return false;
  }

  if (/(receipt|invoice|transaction|cashier|order|\bno\b|\bturn\b)/i.test(line)) {
    return false;
  }

  const vendorKeywords = [
    'store',
    'shop',
    'market',
    'restaurant',
    'cafe',
    'bar',
    'pharmacy',
    'fuel',
    'gas',
    'mart',
    'grill'
  ];

  if (vendorKeywords.some((keyword) => lowerLine.includes(keyword))) {
    return true;
  }

  const isMostlyUppercase = line === line.toUpperCase();
  const words = line.split(/\s+/);
  const avgWordLength = words.reduce((acc, word) => acc + word.length, 0) / Math.max(words.length, 1);

  return isMostlyUppercase || avgWordLength > 3;
}

/**
 * Extract date from text
 */
function extractDate(line: string): string | null {
  const datePatterns = [
    /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/,
    /(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\.?[\s-]+\d{1,2},?\s+\d{2,4}\b/i,
    /\b(\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{2,4})\b/i
  ];

  for (const pattern of datePatterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, ' ');
    }
  }

  return null;
}

function extractTime(line: string): string | null {
  const timePatterns = [
    /\b(\d{1,2}:\d{2}\s?(am|pm))\b/i,
    /\b(\d{1,2}:\d{2}:\d{2})\b/
  ];

  for (const pattern of timePatterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Extract total amount from text
 */
function extractLabeledAmount(line: string): { label: string; amount: string } | null {
  const normalizedLine = line.toLowerCase();
  const amountMatch = line.match(/(-?\$?\d+[.,]\d{2})/);

  if (!amountMatch) {
    return null;
  }

  const amount = normalizeAmount(amountMatch[1]);

  const amountMappings: Array<{ regex: RegExp; label: string }> = [
    { regex: /(grand\s*)?total( due| amount| balance)?/i, label: 'Total Amount' },
    { regex: /(amount\s+(due|paid|tendered|received))/i, label: 'Amount Tendered' },
    { regex: /balance\s+due/i, label: 'Balance Due' },
    { regex: /subtotal/i, label: 'Subtotal' },
    { regex: /(sales\s+)?tax|vat|gst|hst|pst/i, label: 'Tax' },
    { regex: /discount|coupon/i, label: 'Discount' },
    { regex: /change\s+(due|given)?/i, label: 'Change Due' },
    { regex: /cash\s+(tendered|received)?/i, label: 'Cash Tendered' }
  ];

  for (const mapping of amountMappings) {
    if (mapping.regex.test(line)) {
      return { label: mapping.label, amount };
    }
  }

  // If the line looks like a total (capitalized or near the bottom) but lacks a keyword,
  // treat it as a subtotal/total candidate depending on context.
  if (/^\$?\d+[.,]\d{2}$/.test(line.trim())) {
    return { label: 'Amount', amount };
  }

  if (normalizedLine.includes('total')) {
    return { label: 'Total Amount', amount };
  }

  return null;
}

/**
 * Extract tip amount from text
 */
function extractTip(line: string): string | null {
  const tipPatterns = [
    /tip[:\s]*\$?(-?\d+[.,]\d{2})/i,
    /gratuity[:\s]*\$?(-?\d+[.,]\d{2})/i,
    /(service\s+charge)[:\s]*\$?(-?\d+[.,]\d{2})/i
  ];

  for (const pattern of tipPatterns) {
    const match = line.match(pattern);
    if (match) {
      const value = match[2] ?? match[1];
      return normalizeAmount(value);
    }
  }

  return null;
}

/**
 * Extract payment method from text
 */
function extractPaymentMethod(line: string): string | null {
  const paymentMethods = [
    'cash',
    'credit',
    'debit',
    'card',
    'visa',
    'mastercard',
    'american express',
    'amex',
    'discover',
    'paypal',
    'apple pay',
    'google pay'
  ];

  const lowerLine = line.toLowerCase();

  for (const method of paymentMethods) {
    if (lowerLine.includes(method)) {
      return method
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  return null;
}

/**
 * Extract individual item with price
 */
function extractItem(line: string): { name: string; price: string; quantity?: string } | null {
  // Ignore lines that clearly indicate totals or other summary data
  if (/(total|tax|subtotal|balance|change|amount|tendered|due|payment|cashier|receipt)/i.test(line)) {
    return null;
  }

  const priceMatch = line.match(/(-?\$?\d+[.,]\d{2})\s*(ea)?$/i);
  if (!priceMatch) {
    return null;
  }

  const price = normalizeAmount(priceMatch[1]);
  const lineWithoutPrice = line.slice(0, priceMatch.index).trim();

  if (!lineWithoutPrice || lineWithoutPrice.length < 2) {
    return null;
  }

  // Attempt to pull out quantity information if present
  const quantityPatterns = [
    /(\d+)\s*(x|@)\s*(\$?\d+[.,]\d{2})/i,
    /^(\d+)\s+[a-z]/i,
    /\bqty[:\s]*(\d+)\b/i
  ];

  let itemName = lineWithoutPrice;
  let quantity: string | undefined;

  for (const pattern of quantityPatterns) {
    const quantityMatch = lineWithoutPrice.match(pattern);
    if (quantityMatch) {
      const parsedQuantity = quantityMatch[1];
      quantity = parsedQuantity;
      itemName = lineWithoutPrice.replace(pattern, '').trim();
      break;
    }
  }

  if (itemName.length < 2 || itemName.length > 60) {
    return null;
  }

  return {
    name: itemName.replace(/\s{2,}/g, ' ').trim(),
    price,
    quantity
  };
}

/**
 * Check if text is likely noise/irrelevant
 */
function isLikelyNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  const noisePatterns = [
    /^[^a-zA-Z]*$/, // Only numbers/symbols
    /^(receipt|invoice|transaction|cashier|terminal|register|subtotal|total|tax|tip|tender|balance)$/i,
    /^\d+$/, // Only numbers
    /^[^a-zA-Z0-9]*$/, // Only symbols
    /^(thank|you|visit|again|welcome|call|feedback|survey)$/i
  ];

  return noisePatterns.some((pattern) => pattern.test(trimmed));
}

function extractCardDetails(line: string): string | null {
  const lastFourMatch = line.match(/(visa|mc|mastercard|amex|discover|card|debit|credit)[^\d]*(\d{4})/i);
  if (lastFourMatch) {
    const brand = lastFourMatch[1].toUpperCase();
    const lastFour = lastFourMatch[2];
    return `${brand} ****${lastFour}`;
  }

  const maskedMatch = line.match(/(visa|mc|mastercard|amex|discover|card|debit|credit)[^\d]*(\*{2,}\d{2,4})/i);
  if (maskedMatch) {
    const brand = maskedMatch[1].toUpperCase();
    const masked = maskedMatch[2];
    return `${brand} ${masked}`;
  }

  return null;
}

function extractReference(line: string): { label: string; value: string } | null {
  const mapping: Array<{ regex: RegExp; label: string }> = [
    { regex: /(order|invoice|receipt)\s*(#|no\.?)\s*([a-z0-9-]+)/i, label: 'Reference Number' },
    { regex: /(transaction|auth|approval)\s*(#|no\.?)\s*([a-z0-9-]+)/i, label: 'Authorization Code' }
  ];

  for (const map of mapping) {
    const match = line.match(map.regex);
    if (match) {
      const value = match[3] ?? match[1];
      return { label: map.label, value: value.toUpperCase() };
    }
  }

  return null;
}

function isStandaloneAmountCandidate(line: string, index: number, totalLines: number): boolean {
  const trimmed = line.trim();

  if (!/(-?\$?\d+[.,]\d{2})/.test(trimmed)) {
    return false;
  }

  if (/(subtotal|tax|total|tip|balance|change|due|amount|cash|tendered|payment)/i.test(trimmed)) {
    return false;
  }

  // Prioritize standalone amounts towards the bottom third of the receipt
  const isNearBottom = index > totalLines * 0.6;
  return isNearBottom;
}

function normalizeVendor(line: string): string {
  const cleaned = line.replace(/\s{2,}/g, ' ').trim();
  if (!cleaned) {
    return line;
  }

  // Prefer title case for readability
  return cleaned
    .split(' ')
    .map((word) => {
      if (word.length === 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\t/g, '    ').replace(/\s{2,}/g, (match) => (match.length > 4 ? ' ' : match));
}

function normalizeAmount(amount: string): string {
  const cleaned = amount.replace(/[^\d.,-]/g, '').replace(',', '');
  if (!cleaned) {
    return amount;
  }

  const numeric = parseFloat(cleaned);
  if (Number.isNaN(numeric)) {
    return cleaned;
  }

  return numeric.toFixed(2);
}

function formatItemValue(item: { name: string; price: string; quantity?: string }): string {
  const price = normalizeAmount(item.price);
  if (item.quantity) {
    return `${item.name} (x${item.quantity}) - $${price}`;
  }

  return `${item.name} - $${price}`;
}

/**
 * Get OCR service information
 */
export function getTesseractOCRInfo() {
  return {
    name: 'Tesseract.js',
    version: '5.x',
    language: 'English',
    description: 'Google Tesseract OCR engine for text extraction from images'
  };
}
