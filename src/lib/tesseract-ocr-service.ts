/**
 * Tesseract OCR Service
 * =====================
 *
 * Simplified OCR utility that wraps Tesseract.js and converts the raw text
 * output into a list of structured receipt items.
 */

import Tesseract from 'tesseract.js';
import { ReceiptDataItem } from '@/types';

export interface TesseractOCRResult {
  text: string;
  confidence: number;
  items: ReceiptDataItem[];
  processingTime: number;
  errorLog: string[];
}

/**
 * Extract text from an image using Tesseract OCR
 */
export async function extractTextWithTesseract(imageDataUri: string): Promise<TesseractOCRResult> {
  const startTime = Date.now();
  const errorLog: string[] = [];

  try {
    console.log('🔍 Starting Tesseract OCR analysis...');

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`📝 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const { data: { text, confidence } } = await worker.recognize(imageDataUri);
    await worker.terminate();

    console.log('✅ Tesseract OCR completed');
    console.log('📊 OCR Confidence:', confidence);
    console.log('📝 Extracted text length:', text.length);

    const items = parseReceiptText(text);
    const processingTime = Date.now() - startTime;

    return {
      text,
      confidence: confidence / 100,
      items,
      processingTime,
      errorLog
    };
  } catch (error) {
    const errorMsg = `Tesseract OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errorLog.push(errorMsg);
    console.error(errorMsg, error);

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
 */
function parseReceiptText(text: string): ReceiptDataItem[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  console.log('📋 Parsing receipt text into structured data...');
  console.log('📄 Total lines to process:', lines.length);

  let vendor: string | null = null;
  const itemNames: string[] = [];
  const itemPrices: string[] = [];
  let subtotal: string | null = null;
  let tax: string | null = null;
  let total: string | null = null;

  for (const line of lines) {
    if (!vendor && isVendorLine(line)) {
      vendor = line;
      continue;
    }

    if (!subtotal) {
      const maybeSubtotal = extractSubtotal(line);
      if (maybeSubtotal) {
        subtotal = maybeSubtotal;
        continue;
      }
    }

    if (!tax) {
      const maybeTax = extractTax(line);
      if (maybeTax) {
        tax = maybeTax;
        continue;
      }
    }

    if (!total) {
      const maybeTotal = extractTotal(line);
      if (maybeTotal) {
        total = maybeTotal;
        continue;
      }
    }

    const itemMatch = extractItem(line);
    if (itemMatch) {
      itemNames.push(itemMatch.name);
      itemPrices.push(itemMatch.price);
    }
  }

  const results: ReceiptDataItem[] = [];
  let itemIndex = 0;
  const pushItem = (label: string, value: string) => {
    results.push({
      id: `${label.toLowerCase().replace(/\s+/g, '-')}-${itemIndex++}`,
      label,
      value
    });
  };

  if (vendor) {
    pushItem('Vendor', vendor);
  }

  if (itemNames.length > 0) {
    pushItem('Items', itemNames.join(' | '));
  }

  if (itemPrices.length > 0) {
    pushItem('Prices', itemPrices.join(' | '));
  }

  if (subtotal) {
    pushItem('Subtotal', subtotal);
  }

  if (tax) {
    pushItem('Tax', tax);
  }

  if (total) {
    pushItem('Total', total);
  }

  console.log('✅ Parsed receipt items:', results.length);
  return results;
}

function isVendorLine(line: string): boolean {
  const vendorKeywords = ['store', 'shop', 'market', 'restaurant', 'cafe', 'bar', 'pharmacy', 'gas', 'station'];
  const lowerLine = line.toLowerCase();

  if (vendorKeywords.some((keyword) => lowerLine.includes(keyword))) {
    return true;
  }

  if (line.length > 5 && line.length < 50 && !/\d/.test(line)) {
    return true;
  }

  return false;
}

function extractDate(line: string): string | null {
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    /(\d{1,2}-\d{1,2}-\d{2,4})/,
    /(\d{1,2}\.\d{1,2}\.\d{2,4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{2,4}/i,
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
  ];

  for (const pattern of datePatterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractItem(line: string): { name: string; price: string } | null {
  if (/(subtotal|total|tax|change|balance|due|tender|cash|visa|mastercard|amex|discover|phone|tel|zipcode|zip)/i.test(line)) {
    return null;
  }

  const itemPattern = /^(.+?)\s+\$?(-?\d{1,4}\.\d{2})(?:\s?[A-Za-z]{0,2})?$/;
  const match = line.match(itemPattern);

  if (match) {
    const name = match[1].trim();
    const priceString = normalizeAmount(match[2]);
    const numericPrice = parseFloat(priceString);

    if (
      /[a-zA-Z]/.test(name) &&
      name.length > 2 &&
      name.length < 60 &&
      Number.isFinite(numericPrice) &&
      numericPrice > 0 &&
      numericPrice <= 2000
    ) {
      return { name, price: numericPrice.toFixed(2) };
    }
  }

  return null;
}

function isLikelyNoise(text: string): boolean {
  const noisePatterns = [
    /^[^a-zA-Z]*$/,
    /^(receipt|invoice|bill|total|subtotal|tax|tip)$/i,
    /^\d+$/,
    /^[^a-zA-Z0-9]*$/,
    /^(thank|you|visit|again|welcome)$/i
  ];

  return noisePatterns.some((pattern) => pattern.test(text));
}

function normalizeAmount(amount: string): string {
  const cleaned = amount.replace(/[^0-9.\-]/g, '');
  if (!cleaned) {
    return amount.trim();
  }
  return cleaned;
}

function extractSubtotal(line: string): string | null {
  const match = line.match(/sub\s*total[^\d-]*(-?\d{1,4}[.,]\d{2})/i);
  if (match) {
    return normalizeAmount(match[1]);
  }
  return null;
}

function extractTax(line: string): string | null {
  const match = line.match(/(sales\s*)?tax[^\d-]*(-?\d{1,4}[.,]\d{2})/i);
  if (match) {
    return normalizeAmount(match[2] ?? match[1]);
  }
  return null;
}

function extractTotal(line: string): string | null {
  if (/sub\s*total/i.test(line)) {
    return null;
  }

  const match = line.match(/(grand\s*)?total(?:\s*(amount|due|balance|to\s*pay)?)?[^\d-]*(-?\d{1,5}[.,]\d{2})/i);
  if (match) {
    return normalizeAmount(match[3] ?? match[2]);
  }

  return null;
}

export function getTesseractOCRInfo() {
  return {
    name: 'Tesseract.js',
    version: '5.x',
    language: 'English',
    description: 'Google Tesseract OCR engine for text extraction from images'
  };
}
