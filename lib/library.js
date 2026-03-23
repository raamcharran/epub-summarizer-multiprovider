// Library management — persistent book store
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LIBRARY_DIR = path.join(__dirname, '..', 'library');

function slugPart(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugify(...parts) {
  const slug = parts
    .map(slugPart)
    .filter(Boolean)
    .join('-');
  return slug || 'book';
}

export function bookDir(slug) {
  return path.join(LIBRARY_DIR, slug);
}

export function resolveBookSlug(title, author) {
  const preferred = slugify(title, author);
  const legacy = slugify(title);
  const aliases = preferred === legacy ? [preferred] : [preferred, legacy];

  for (const candidate of aliases) {
    if (!exists(candidate, 'meta')) continue;
    const meta = load(candidate, 'meta');
    if (meta?.title === title && meta?.author === author) return candidate;
  }

  if (!exists(preferred, 'meta')) return preferred;

  let counter = 2;
  while (exists(`${preferred}-${counter}`, 'meta')) counter++;
  return `${preferred}-${counter}`;
}

export function save(slug, key, data) {
  const dir = bookDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'output'), { recursive: true });
  fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(data, null, 2), 'utf8');
}

export function load(slug, key) {
  const p = path.join(bookDir(slug), `${key}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function exists(slug, key) {
  return fs.existsSync(path.join(bookDir(slug), `${key}.json`));
}

export function saveOutput(slug, filename, content) {
  const outDir = path.join(bookDir(slug), 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  fs.writeFileSync(outPath, content, 'utf8');
  return outPath;
}

export function listBooks() {
  if (!fs.existsSync(LIBRARY_DIR)) return [];
  return fs.readdirSync(LIBRARY_DIR)
    .filter(d => {
      try { return fs.statSync(path.join(LIBRARY_DIR, d)).isDirectory(); } catch { return false; }
    })
    .map(slug => load(slug, 'meta'))
    .filter(Boolean);
}

export function findBook(query) {
  const q = query.toLowerCase().trim();
  const books = listBooks();
  // exact slug match first, then title substring
  return books.find(b => b.slug === q) ||
         books.find(b => b.slug.includes(q.replace(/\s+/g, '-'))) ||
         books.find(b => b.title?.toLowerCase().includes(q));
}
