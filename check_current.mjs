import { normalizeContent } from './lib/content.js';
import fs from 'fs';
const raw = JSON.parse(fs.readFileSync('/tmp/fl4.json', 'utf-8'));
try {
  normalizeContent(raw);
  console.log('✓ Hợp lệ với content.js HIỆN TẠI');
} catch (e) {
  console.log('✗ LỖI với content.js hiện tại:', e.message);
}
