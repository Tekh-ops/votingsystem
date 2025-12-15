/**
 * CSV-based Storage Module
 * Handles persistence using CSV files
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

export async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  // Add last field
  values.push(current);
  
  return values;
}

export async function loadCSV(filename) {
  await ensureDataDir();
  const filepath = join(DATA_DIR, filename);
  if (!existsSync(filepath)) {
    return [];
  }
  const content = await readFile(filepath, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((header, idx) => {
      let value = values[idx] || '';
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      obj[header.trim()] = value.trim();
    });
    data.push(obj);
  }
  return data;
}

export async function saveCSV(filename, headers, data) {
  await ensureDataDir();
  const filepath = join(DATA_DIR, filename);
  const lines = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(h => {
      let val = String(row[h] || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = val.replace(/"/g, '""'); // Escape quotes
        val = `"${val}"`; // Wrap in quotes
      }
      return val;
    });
    lines.push(values.join(','));
  }
  await writeFile(filepath, lines.join('\n'), 'utf-8');
}

