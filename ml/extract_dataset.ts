/**
 * extract_dataset.ts – v3
 *
 * Enhanced features for comprehensive fraud detection:
 * ──────────────────────────────────────────────────────────────────────────────
 *  • image_hash      →  perceptual hash for DUPLICATE_RECEIPT / SAME_VENDOR_MULTIPLE_USERS
 *  • blur_score      →  Laplacian‑variance metric for IMAGE_BLURRY
 *  • ocr_text        →  full OCR dump  (PERSONAL_ITEM_KEYWORD, CATEGORY_MISMATCH)
 *  • user_category   →  the label your UI supplies (category mismatch detection)
 *  • vendor_name     →  normalized vendor  (GHOST_VENDOR, SAME_VENDOR_MULTIPLE_USERS)
 *  • extracted_total →  total auto‑detected from OCR for MANUAL_TOTAL_EDIT
 *  • tip_percent     →  tip / (total − tax)  (EXCESSIVE_TIP)
 *  • user_id         →  taken from folder name or metadata (SAME_VENDOR_MULTIPLE_USERS)
 *  • location_data   →  GPS coordinates for GEO_LOCATION_OFF_ROUTE
 *  • timestamp       →  receipt timestamp for temporal analysis
 *  • card_last_4     →  last 4 digits for CARD_DECLINE_RETRY tracking
 *  • tax_amount      →  tax amount for tip percentage calculations
 *  • items_list      →  detailed items for category analysis
 *  • receipt_id      →  unique identifier for duplicate detection
 *  • confidence_score → AI extraction confidence for MANUAL_TOTAL_EDIT
 *
 *  Columns left for downstream joins (not produced here):
 *     • trip itinerary (for GEO_LOCATION_OFF_ROUTE)
 *     • decline / approval history (for CARD_DECLINE_RETRY)
 *
 * External deps (add with npm i -D …):
 *     sharp               – image processing / blur metric
 *     tesseract.js        – lightweight OCR
 *     csv-writer, dotenv  – already present in your repo
 */

import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import sharp from 'sharp';
import { promisify } from 'util';
import { summarizeReceipt } from '../src/ai/flows/summarize-receipt';
import { createObjectCsvWriter } from 'csv-writer';
import { extractTextWithTesseract } from '../src/lib/tesseract-ocr-service';
import type { ReceiptDataItem } from '../src/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const imageHashCallback = require('image-hash');
const imageHash = promisify(
  (imagePath: string, bits: number, greedy: boolean, callback: (error: Error | null, hash?: string) => void) =>
    imageHashCallback(imagePath, bits, greedy, callback)
);

const RECEIPTS_DIR = path.resolve(__dirname, './receipts');
const OUTPUT_CSV   = path.resolve(__dirname, './receipts_dataset.csv');

// Enhanced keyword lists for better fraud detection
const PERSONAL_ITEM_KEYWORDS = [
  'clothing', 'gift card', 'electronics', 'jewelry', 'toy', 'souvenir',
  'apparel', 'shoes', 'accessories', 'cosmetics', 'perfume', 'watch',
  'handbag', 'purse', 'wallet', 'sunglasses', 'hat', 'scarf'
];

const SUSPICIOUS_VENDORS = [
  'amazon', 'ebay', 'walmart', 'target', 'best buy', 'home depot',
  'lowes', 'costco', 'sam\'s club', 'cvs', 'walgreens', 'rite aid'
];

const CATEGORY_KEYWORDS = {
  'food': ['restaurant', 'cafe', 'diner', 'pizza', 'burger', 'sandwich', 'coffee', 'food'],
  'transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'parking', 'toll'],
  'lodging': ['hotel', 'motel', 'inn', 'resort', 'accommodation'],
  'entertainment': ['movie', 'theater', 'concert', 'show', 'ticket', 'amusement'],
  'office': ['office', 'supplies', 'stationery', 'paper', 'ink', 'toner'],
  'medical': ['pharmacy', 'medical', 'doctor', 'hospital', 'clinic', 'prescription']
};

const BLUR_THRESHOLD = 100;   // tweak later − smaller ⇒ blurrier
const EXCESSIVE_TIP_THRESHOLD = 25; // percentage threshold for excessive tips
const DUPLICATE_HASH_THRESHOLD = 5; // hamming distance for duplicate detection

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ──────────────────────────────────────────────────────────────────────────────
//  Utility helpers
// ──────────────────────────────────────────────────────────────────────────────
async function imageToDataURI(filePath: string): Promise<string> {
  const ext  = path.extname(filePath).slice(1);
  const data = await fs.readFile(filePath);
  return `data:image/${ext};base64,${data.toString('base64')}`;
}

function extractFlatFeatures(items: { label: string; value: string }[]) {
  const map: Record<string, string> = {};
  items.forEach(item => map[item.label.toLowerCase().replace(/\s+/g, '_')] = item.value);

  return {
    vendor_name    : map.vendor || '',
    extracted_total: parseFloat(map.total_amount?.replace(/[^0-9.]/g, '') || '0'),
    date           : map.date || '',
    item_count     : Object.keys(map).filter(k => k.startsWith('item_')).length,
    tip            : parseFloat(map.tip?.replace(/[^0-9.]/g, '') || '0'),
    payment_method : map.payment_method || '',
    user_category  : map.category || '',       // requires your UI / filename to supply
    tax_amount     : parseFloat(map.tax?.replace(/[^0-9.]/g, '') || '0'),
    card_last_4    : map.card_number?.slice(-4) || '',
    items_list     : Object.keys(map).filter(k => k.startsWith('item_')).map(k => map[k]).join('|'),
  };
}

async function getPerceptualHash(filePath: string): Promise<string> {
  try {
    const hash = await imageHash(filePath, 16, true);
    if (typeof hash === 'string' && hash.length > 0) {
      return hash.toLowerCase();
    }
  } catch (error) {
    console.warn(`⚠️ image-hash failed for ${filePath}, falling back to simple hash`, error);
  }

  const stats = await fs.stat(filePath);
  const fileName = path.basename(filePath);
  return Buffer.from(`${fileName}_${stats.size}`).toString('hex').slice(0, 16);
}

const NIBBLE_BIT_COUNTS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4] as const;

/** Calculate Hamming distance between two hexadecimal hashes */
function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) {
    return Number.POSITIVE_INFINITY;
  }

  const normalized1 = hash1.trim().toLowerCase();
  const normalized2 = hash2.trim().toLowerCase();

  const maxLength = Math.min(normalized1.length, normalized2.length);
  let distance = Math.abs(normalized1.length - normalized2.length) * 4; // each missing nibble adds 4 bits

  for (let i = 0; i < maxLength; i += 1) {
    const nibbleA = parseInt(normalized1[i], 16);
    const nibbleB = parseInt(normalized2[i], 16);

    if (Number.isNaN(nibbleA) || Number.isNaN(nibbleB)) {
      if (normalized1[i] !== normalized2[i]) {
        distance += 1;
      }
      continue;
    }

    distance += NIBBLE_BIT_COUNTS[nibbleA ^ nibbleB];
  }

  return distance;
}

/** simple blur metric: variance of Laplacian */
async function blurScore(filePath: string): Promise<number> {
  const { data, info } = await sharp(filePath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // compute Laplacian variance cheaply in JS
  let sum = 0, sumSq = 0;
  const w = info.width, h = info.height;
  const idx = (x: number, y: number) => y * w + x;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        4 * data[idx(x, y)] -
        data[idx(x - 1, y)] -
        data[idx(x + 1, y)] -
        data[idx(x, y - 1)] -
        data[idx(x, y + 1)];
      sum   += lap;
      sumSq += lap * lap;
    }
  }
  const n = (w - 2) * (h - 2);
  const mean    = sum / n;
  const variance = sumSq / n - mean * mean;
  return variance;
}

function findPersonalKeyword(text: string): boolean {
  return PERSONAL_ITEM_KEYWORDS.some(k => text.includes(k));
}

function isSuspiciousVendor(vendor: string): boolean {
  return SUSPICIOUS_VENDORS.some(v => vendor.toLowerCase().includes(v));
}

function detectCategoryMismatch(userCategory: string, ocrText: string): boolean {
  if (!userCategory) return false;
  
  const userCat = userCategory.toLowerCase();
  const ocr = ocrText.toLowerCase();
  
  // Check if user category matches any detected keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (userCat.includes(category)) {
      return !keywords.some(k => ocr.includes(k));
    }
  }
  
  return false;
}

function calculateTipPercentage(tip: number, total: number, tax: number): number {
  const subtotal = total - tax;
  return subtotal > 0 ? (tip / subtotal) * 100 : 0;
}

function isExcessiveTip(tipPercent: number): boolean {
  return tipPercent > EXCESSIVE_TIP_THRESHOLD;
}

function isImageBlurry(blurScore: number): boolean {
  return blurScore < BLUR_THRESHOLD;
}

function generateReceiptId(filePath: string, userId: string): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  return `${userId}_${fileName}`;
}

// Extract location data from filename or metadata
function extractLocationData(filePath: string): { latitude?: number; longitude?: number; location_name?: string } {
  // This would typically come from image EXIF data or filename
  // For now, returning empty object - implement based on your data structure
  return {};
}

// Extract timestamp from filename or OCR
function extractTimestamp(filePath: string, ocrText: string): string {
  // Try to extract date from filename first
  const fileName = path.basename(filePath);
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }
  
  // Fallback to OCR text date extraction
  const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{4}-\d{2}-\d{2})/;
  const match = ocrText.match(datePattern);
  return match ? match[0] : '';
}

// ──────────────────────────────────────────────────────────────────────────────
//  Dataset generation
// ──────────────────────────────────────────────────────────────────────────────
interface EntryMeta { path: string; isFraud: boolean; userId: string }

async function getAllImagePaths(): Promise<EntryMeta[]> {
  const entries: EntryMeta[] = [];

  const subfolders = await fs.readdir(RECEIPTS_DIR);    // e.g. real/, fake/
  for (const flagFolder of subfolders) {
    const flagPath = path.join(RECEIPTS_DIR, flagFolder);
    const files    = await fs.readdir(flagPath);        // Image files directly in fake/ and real/
    for (const file of files) {
      if (!/\.(jpe?g|png)$/i.test(file)) continue;
      entries.push({
        path    : path.join(flagPath, file),
        isFraud : flagFolder === 'fake',
        userId  : flagFolder, // Use folder name as userId for now
      });
    }
  }
  return entries;
}

function mergeReceiptItems(primary: ReceiptDataItem[], fallback: ReceiptDataItem[]): ReceiptDataItem[] {
  if (!primary.length) {
    return fallback;
  }

  if (!fallback.length) {
    return primary;
  }

  const merged = [...primary];
  const labelIndexMap = new Map<string, number>();

  merged.forEach((item, index) => {
    labelIndexMap.set(item.label.toLowerCase(), index);
  });

  fallback.forEach((item) => {
    const normalizedLabel = item.label.toLowerCase();
    const value = item.value?.trim();
    if (!value) {
      return;
    }

    if (!labelIndexMap.has(normalizedLabel)) {
      merged.push(item);
      labelIndexMap.set(normalizedLabel, merged.length - 1);
      return;
    }

    const existingIndex = labelIndexMap.get(normalizedLabel)!;
    if (!merged[existingIndex].value?.trim()) {
      merged[existingIndex] = item;
    }
  });

  return merged;
}

async function run() {
  const imageEntries = await getAllImagePaths();
  const perceptualHashes: Array<{ receiptId: string; hash: string }> = [];

  const csvWriter = createObjectCsvWriter({
    path: OUTPUT_CSV,
    header: [
      // Core receipt data
      { id: 'receipt_id',      title: 'receipt_id' },
      { id: 'vendor_name',     title: 'vendor_name' },
      { id: 'extracted_total', title: 'extracted_total' },
      { id: 'date',            title: 'date' },
      { id: 'timestamp',       title: 'timestamp' },
      { id: 'item_count',      title: 'item_count' },
      { id: 'items_list',      title: 'items_list' },
      { id: 'tip',             title: 'tip' },
      { id: 'tax_amount',      title: 'tax_amount' },
      { id: 'payment_method',  title: 'payment_method' },
      { id: 'card_last_4',     title: 'card_last_4' },
      
      // User and category data
      { id: 'user_id',         title: 'user_id' },
      { id: 'user_category',   title: 'user_category' },
      
      // Image analysis
      { id: 'image_hash',      title: 'image_hash' },
      { id: 'blur_score',      title: 'blur_score' },
      { id: 'ocr_text',        title: 'ocr_text' },
      { id: 'confidence_score', title: 'confidence_score' },
      
      // Location data
      { id: 'latitude',        title: 'latitude' },
      { id: 'longitude',       title: 'longitude' },
      { id: 'location_name',   title: 'location_name' },
      
      // Fraud detection flags
      { id: 'personal_item',           title: 'personal_item' },
      { id: 'tip_percent',             title: 'tip_percent' },
      { id: 'excessive_tip',           title: 'excessive_tip' },
      { id: 'image_blurry',            title: 'image_blurry' },
      { id: 'suspicious_vendor',       title: 'suspicious_vendor' },
      { id: 'category_mismatch',       title: 'category_mismatch' },
      { id: 'duplicate_receipt',       title: 'duplicate_receipt' },
      { id: 'same_vendor_multiple_users', title: 'same_vendor_multiple_users' },
      
      // Metadata
      { id: 'is_fraud',        title: 'is_fraud' },
    ],
    append: false,
  });

  const records = [];
  const vendorUserMap = new Map<string, Set<string>>(); // For same vendor multiple users

  for (const { path: filePath, isFraud, userId } of imageEntries) {
    try {
      // 1️⃣ computer‑vision & OCR
      const [hash, blur] = await Promise.all([
        getPerceptualHash(filePath),
        blurScore(filePath),
      ]);

      const photoDataUri = await imageToDataURI(filePath);

      const [tesseractResult, aiSummary] = await Promise.all([
        extractTextWithTesseract(photoDataUri),
        summarizeReceipt({ photoDataUri }),
      ]);

      let combinedItems: ReceiptDataItem[] = aiSummary.items;
      if (!combinedItems.length && tesseractResult.items.length) {
        combinedItems = tesseractResult.items;
      } else if (combinedItems.length && tesseractResult.items.length) {
        combinedItems = mergeReceiptItems(aiSummary.items, tesseractResult.items);
      }

      const flat = extractFlatFeatures(combinedItems);
      const ocr = (tesseractResult.text || '').toLowerCase();
      const confidenceScore = Number.isFinite(tesseractResult.confidence)
        ? +Math.max(0, Math.min(1, tesseractResult.confidence)).toFixed(4)
        : 0;

      // 3️⃣ derived fields and fraud detection
      const personal_item = findPersonalKeyword(ocr);
      const tipPercent    = calculateTipPercentage(flat.tip, flat.extracted_total, flat.tax_amount);
      const excessive_tip = isExcessiveTip(tipPercent);
      const image_blurry  = isImageBlurry(blur);
      const suspicious_vendor = isSuspiciousVendor(flat.vendor_name);
      const category_mismatch = detectCategoryMismatch(flat.user_category, ocr);
      const receipt_id = generateReceiptId(filePath, userId);
      const timestamp = extractTimestamp(filePath, ocr);
      const location_data = extractLocationData(filePath);
      
      perceptualHashes.push({ receiptId: receipt_id, hash });
      
      // Same vendor multiple users detection
      if (flat.vendor_name) {
        if (!vendorUserMap.has(flat.vendor_name)) {
          vendorUserMap.set(flat.vendor_name, new Set());
        }
        vendorUserMap.get(flat.vendor_name)!.add(userId);
      }

      records.push({
        receipt_id: receipt_id,
        ...flat,
        timestamp: timestamp,
        image_hash: hash,
        blur_score: +blur.toFixed(2),
        ocr_text: ocr.replace(/\s+/g, ' ').slice(0, 5000), // keep CSV small
        confidence_score: confidenceScore,
        latitude: location_data.latitude || null,
        longitude: location_data.longitude || null,
        location_name: location_data.location_name || '',
        personal_item: personal_item ? 1 : 0,
        tip_percent: +tipPercent.toFixed(2),
        excessive_tip: excessive_tip ? 1 : 0,
        image_blurry: image_blurry ? 1 : 0,
        suspicious_vendor: suspicious_vendor ? 1 : 0,
        category_mismatch: category_mismatch ? 1 : 0,
        duplicate_receipt: 0, // Will be updated after processing all records
        same_vendor_multiple_users: 0, // Will be updated after processing all records
        is_fraud: isFraud ? 1 : 0,
      });

      console.log(`✔ Processed: ${filePath}`);
      await sleep(1000);        // you can reduce now; OCR already slow
    } catch (err) {
      console.error(`❌ Failed: ${filePath}`, err);
    }
  }

  // Post-process for duplicate and same vendor detection
  for (const record of records) {
    // Check for duplicates using perceptual hash Hamming distance
    const hashEntry = perceptualHashes.find((entry) => entry.receiptId === record.receipt_id);
    if (hashEntry) {
      const isDuplicate = perceptualHashes.some((other) => {
        if (other.receiptId === record.receipt_id) {
          return false;
        }
        return hammingDistance(hashEntry.hash, other.hash) <= DUPLICATE_HASH_THRESHOLD;
      });

      if (isDuplicate) {
        record.duplicate_receipt = 1;
      }
    }
    
    // Check for same vendor multiple users
    if (record.vendor_name && vendorUserMap.has(record.vendor_name)) {
      const usersForVendor = vendorUserMap.get(record.vendor_name)!;
      if (usersForVendor.size > 1) {
        record.same_vendor_multiple_users = 1;
      }
    }
  }

  await csvWriter.writeRecords(records);
  console.log('✅ Dataset saved →', OUTPUT_CSV);
  console.log(`📊 Processed ${records.length} receipts`);
  console.log(`🔍 Found ${records.filter(r => r.duplicate_receipt).length} potential duplicates`);
  console.log(`🏪 Found ${records.filter(r => r.same_vendor_multiple_users).length} same vendor multiple users`);
  console.log(`💰 Found ${records.filter(r => r.excessive_tip).length} excessive tips`);
  console.log(`📱 Found ${records.filter(r => r.personal_item).length} personal items`);
  console.log(`📷 Found ${records.filter(r => r.image_blurry).length} blurry images`);
}

run().catch(console.error);
