import { writeFileSync, readFileSync } from 'fs';

const W = 760, H = 360;
const BG = '#182828', PANEL = '#1e2e2e', BORDER = '#253535';
const CORAL = '#ff6b4a', HEAD = '#eee', BODY = '#888', DIM = '#555';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function trunc(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function dots(pfx) {
  return `<pattern id="${pfx}dp" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="${BORDER}"/></pattern>`;
}
function bg(pfx) {
  return `<rect width="${W}" height="${H}" fill="${BG}"/><rect width="${W}" height="${H}" fill="url(#${pfx}dp)"/>`;
}
function header(label, title, sub) {
  return `<rect width="${W}" height="108" fill="${PANEL}"/><rect width="2" height="108" fill="${CORAL}"/>
  <text x="14" y="22" font-size="9" font-weight="700" fill="${CORAL}" letter-spacing="2">${esc(label.toUpperCase())}</text>
  <text x="14" y="52" font-size="19" font-weight="900" fill="${HEAD}">${esc(trunc(title, 52))}</text>
  <text x="14" y="76" font-size="11" fill="${BODY}">${esc(trunc(sub, 90))}</text>`;
}
function footer(label, text) {
  return `<rect y="310" width="${W}" height="50" fill="${PANEL}"/><rect y="310" width="2" height="50" fill="${CORAL}"/>
  <text x="14" y="331" font-size="9" font-weight="700" fill="${CORAL}" letter-spacing="2">${esc(label.toUpperCase())}</text>
  <text x="14" y="350" font-size="10.5" fill="${BODY}">${esc(trunc(text, 100))}</text>`;
}
function wrap(pfx, defs, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;font-family:'Inter',sans-serif">
  <defs>${dots(pfx)}${defs}</defs>
  ${bg(pfx)}${content}</svg>`;
}

// ── LAYOUT: FORK ─────────────────────────────────────────────────────────────
// Two opposing columns divided by a center line. Best for contrast/tension.
function layoutFork(pfx, ch, title, label) {
  const concepts = ch.concepts || [];
  const mid = 382;
  const half = Math.ceil(concepts.length / 2);
  const left = concepts.slice(0, half);
  const right = concepts.slice(half);
  const edges = ch.concept_edges || [];
  const contrastEdge = edges.find(e => /contrast|oppos|versus|vs|challeng|tension/i.test(e.label || ''));
  const leftLbl = contrastEdge ? 'ESTABLISHED' : 'FOUNDATION';
  const rightLbl = contrastEdge ? 'CHALLENGE' : 'IMPLICATION';

  const boxH = Math.min(52, Math.floor(180 / Math.max(left.length, 1)) - 6);
  const gap = Math.floor((188 - left.length * boxH) / Math.max(left.length - 1, 1));

  let rows = '';
  left.forEach((c, i) => {
    const y = 122 + i * (boxH + gap);
    if (y + boxH > 308) return;
    rows += `<rect x="18" y="${y}" width="338" height="${boxH}" fill="${PANEL}" stroke="${BORDER}"/>
    <text x="30" y="${y+15}" font-size="10" font-weight="700" fill="${BODY}">${esc(trunc(c.label, 34))}</text>
    <text x="30" y="${y+30}" font-size="8.5" fill="${DIM}">${esc(trunc(c.description, 50))}</text>`;
  });
  right.forEach((c, i) => {
    const y = 122 + i * (boxH + gap);
    if (y + boxH > 308) return;
    rows += `<rect x="${mid + 26}" y="${y}" width="316" height="${boxH}" fill="${PANEL}" stroke="${CORAL}" stroke-opacity="0.4"/>
    <text x="${mid + 38}" y="${y+15}" font-size="10" font-weight="700" fill="${HEAD}">${esc(trunc(c.label, 28))}</text>
    <text x="${mid + 38}" y="${y+30}" font-size="8.5" fill="${BODY}">${esc(trunc(c.description, 46))}</text>`;
  });

  const quote = ch.key_quotes?.[0] || ch.summary || '';
  const content = `
  ${header(label, title, trunc(ch.summary, 88))}
  <line x1="${mid}" y1="112" x2="${mid}" y2="308" stroke="${BORDER}" stroke-width="1" stroke-dasharray="4,3"/>
  <text x="${mid - 14}" y="120" text-anchor="end" font-size="8" font-weight="700" fill="${DIM}" letter-spacing="1">${leftLbl}</text>
  <text x="${mid + 14}" y="120" font-size="8" font-weight="700" fill="${CORAL}" letter-spacing="1">${rightLbl}</text>
  ${rows}
  ${footer('Key Tension', trunc(quote, 100))}`;
  return wrap(pfx, '', content);
}

// ── LAYOUT: HUB ──────────────────────────────────────────────────────────────
// Central concept with radiating spokes. Best for one dominant idea.
function layoutHub(pfx, ch, title, label) {
  const concepts = ch.concepts || [];
  const edges = ch.concept_edges || [];

  const counts = {};
  edges.forEach(e => {
    counts[e.from] = (counts[e.from] || 0) + 1;
    counts[e.to] = (counts[e.to] || 0) + 1;
  });
  const hubId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const hub = concepts.find(c => c.id === hubId) || concepts[0] || { label: 'Core', description: '' };
  const spokes = concepts.filter(c => c.id !== hub.id).slice(0, 5);

  const cx = 380, cy = 208, outerR = 72, hubR = 36, spokeR = 26;
  const nSpokes = spokes.length;
  const angles = spokes.map((_, i) => ((i * 360 / nSpokes) - 90) * Math.PI / 180);

  let lines = '', circles = '';
  spokes.forEach((c, i) => {
    const sx = Math.round(cx + outerR * Math.cos(angles[i]));
    const sy = Math.round(cy + outerR * Math.sin(angles[i]));
    lines += `<line x1="${cx}" y1="${cy}" x2="${sx}" y2="${sy}" stroke="${BORDER}" stroke-width="1.5"/>`;
    circles += `<circle cx="${sx}" cy="${sy}" r="${spokeR}" fill="${PANEL}" stroke="${CORAL}" stroke-opacity="0.35" stroke-width="1.5"/>
    <text x="${sx}" y="${sy - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="${HEAD}">${esc(trunc(c.label, 16))}</text>
    <text x="${sx}" y="${sy + 10}" text-anchor="middle" font-size="7" fill="${BODY}">${esc(trunc(c.description, 18))}</text>`;
  });

  const quote = ch.key_quotes?.[0] || hub.description || '';
  const content = `
  ${header(label, title, trunc(ch.summary, 88))}
  ${lines}
  <circle cx="${cx}" cy="${cy}" r="${hubR}" fill="${CORAL}" fill-opacity="0.12" stroke="${CORAL}" stroke-width="2"/>
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="9.5" font-weight="900" fill="${CORAL}">${esc(trunc(hub.label, 18))}</text>
  <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="7.5" fill="${BODY}">${esc(trunc(hub.description, 22))}</text>
  ${circles}
  ${footer('Central Concept', trunc(quote, 100))}`;
  return wrap(pfx, '', content);
}

// ── LAYOUT: CASCADE ───────────────────────────────────────────────────────────
// Vertical flow with arrows. Best for causal chains and process steps.
function layoutCascade(pfx, ch, title, label) {
  const concepts = ch.concepts || [];
  const shown = concepts.slice(0, 5);
  const boxH = 34;
  const gap = shown.length <= 4 ? 12 : 6;
  const totalH = shown.length * boxH + (shown.length - 1) * gap;
  const startY = 118 + Math.max(0, Math.floor((188 - totalH) / 2));

  let boxes = '', arrows = '';
  shown.forEach((c, i) => {
    const y = startY + i * (boxH + gap);
    const isFirst = i === 0;
    boxes += `<rect x="60" y="${y}" width="640" height="${boxH}" fill="${PANEL}" stroke="${isFirst ? CORAL : BORDER}" stroke-width="${isFirst ? 1.5 : 1}"/>
    <text x="74" y="${y + 13}" font-size="10" font-weight="700" fill="${isFirst ? CORAL : HEAD}">${esc(trunc(c.label, 32))}</text>
    <text x="74" y="${y + 27}" font-size="9" fill="${BODY}">${esc(trunc(c.description, 74))}</text>`;
    if (i < shown.length - 1) {
      const ay = y + boxH;
      arrows += `<line x1="380" y1="${ay}" x2="380" y2="${ay + gap}" stroke="${CORAL}" stroke-width="1.5" marker-end="url(#${pfx}arr)"/>`;
    }
  });

  const quote = ch.key_quotes?.[0] || ch.summary || '';
  const content = `
  ${header(label, title, trunc(ch.summary, 88))}
  ${boxes}${arrows}
  ${footer('The Chain', trunc(quote, 100))}`;
  return wrap(pfx, `<marker id="${pfx}arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${CORAL}"/></marker>`, content);
}

// ── LAYOUT: GRID ─────────────────────────────────────────────────────────────
// Concept cards in 2-col or 3-col grid. Best for 4-6 parallel concepts.
function layoutGrid(pfx, ch, title, label) {
  const concepts = ch.concepts || [];
  const shown = concepts.slice(0, 6);
  const cols = shown.length >= 5 ? 3 : 2;
  const rows = Math.ceil(shown.length / cols);
  const cellW = cols === 3 ? 224 : 352;
  const cellH = rows === 1 ? 120 : 82;
  const gapX = cols === 3 ? 14 : 18;
  const gapY = 10;
  const totalW = cols * cellW + (cols - 1) * gapX;
  const startX = Math.floor((W - totalW) / 2);
  const totalH = rows * cellH + (rows - 1) * gapY;
  const startY = 118 + Math.max(0, Math.floor((190 - totalH) / 2));

  let cells = '';
  shown.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cellW + gapX);
    const y = startY + row * (cellH + gapY);
    const isFirst = i === 0;
    const maxDesc = cols === 3 ? 34 : 56;
    cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${PANEL}" stroke="${isFirst ? CORAL : BORDER}" stroke-width="${isFirst ? 1.5 : 1}"/>
    <rect x="${x}" y="${y}" width="2" height="${cellH}" fill="${isFirst ? CORAL : BORDER}"/>
    <text x="${x + 12}" y="${y + 17}" font-size="9.5" font-weight="700" fill="${isFirst ? CORAL : HEAD}">${esc(trunc(c.label, cols === 3 ? 22 : 36))}</text>
    <text x="${x + 12}" y="${y + 33}" font-size="8.5" fill="${BODY}">${esc(trunc(c.description, maxDesc))}</text>
    ${cellH >= 70 ? `<text x="${x + 12}" y="${y + 48}" font-size="8.5" fill="${DIM}">${esc(trunc(c.description.slice(maxDesc), maxDesc))}</text>` : ''}`;
  });

  const quote = ch.key_quotes?.[0] || ch.summary || '';
  const content = `
  ${header(label, title, trunc(ch.summary, 88))}
  ${cells}
  ${footer('Key Concepts', trunc(quote, 100))}`;
  return wrap(pfx, '', content);
}

// ── LAYOUT: MINIMAL ───────────────────────────────────────────────────────────
// Text-focused with concept chips. Best for 1-3 concepts or narrative chapters.
function layoutMinimal(pfx, ch, title, label) {
  const concepts = ch.concepts || [];
  const shown = concepts.slice(0, 4);
  const summary = ch.summary || '';
  const line1 = trunc(summary, 90);
  const line2 = summary.length > 90 ? trunc(summary.slice(89), 88) : '';
  const line3 = summary.length > 178 ? trunc(summary.slice(177), 88) : '';

  const chipW = Math.floor((W - 36 - (shown.length - 1) * 10) / Math.max(shown.length, 1));
  let chips = '';
  shown.forEach((c, i) => {
    const x = 18 + i * (chipW + 10);
    chips += `<rect x="${x}" y="256" width="${chipW}" height="46" fill="${PANEL}" stroke="${i === 0 ? CORAL : BORDER}" stroke-width="${i === 0 ? 1.5 : 1}"/>
    <rect x="${x}" y="256" width="2" height="46" fill="${i === 0 ? CORAL : BORDER}"/>
    <text x="${x + 12}" y="272" font-size="9.5" font-weight="700" fill="${i === 0 ? CORAL : HEAD}">${esc(trunc(c.label, Math.floor(chipW / 6.5)))}</text>
    <text x="${x + 12}" y="288" font-size="8" fill="${BODY}">${esc(trunc(c.description, Math.floor(chipW / 5.5)))}</text>`;
  });

  const quote = ch.key_quotes?.[0] || '';
  const content = `
  ${header(label, title, trunc(summary, 88))}
  <text x="20" y="138" font-size="11" fill="${BODY}">${esc(line1)}</text>
  ${line2 ? `<text x="20" y="157" font-size="11" fill="${BODY}">${esc(line2)}</text>` : ''}
  ${line3 ? `<text x="20" y="176" font-size="11" fill="${DIM}">${esc(line3)}</text>` : ''}
  ${chips}
  ${footer('Key Idea', trunc(quote || summary, 100))}`;
  return wrap(pfx, '', content);
}

// ── LAYOUT SELECTOR ──────────────────────────────────────────────────────────
function selectLayout(ch, index, usedLayouts) {
  const concepts = ch.concepts || [];
  const edges = ch.concept_edges || [];
  const relations = edges.map(e => (e.label || '').toLowerCase());

  const counts = {};
  edges.forEach(e => {
    counts[e.from] = (counts[e.from] || 0) + 1;
    counts[e.to] = (counts[e.to] || 0) + 1;
  });
  const maxConn = Math.max(0, ...Object.values(counts).concat([0]));

  const hasContrast = relations.some(r => /contrast|oppos|versus|vs|challeng|tension|conflict/i.test(r));
  const hasCausal = relations.some(r => /enable|lead|cause|drive|trigger|result|produc|requir/i.test(r));
  const isHub = maxConn >= 3 && concepts.length >= 4;

  const scores = { fork: 0, hub: 0, cascade: 0, grid: 0, minimal: 0 };
  if (hasContrast) scores.fork += 3;
  if (isHub) scores.hub += 3;
  if (hasCausal && !isHub) scores.cascade += 2;
  if (concepts.length >= 4) { scores.grid += 1; }
  if (concepts.length >= 5) { scores.grid += 1; scores.hub += 1; }
  if (concepts.length <= 2) scores.minimal += 3;
  if (concepts.length === 3) scores.minimal += 1;

  // Variety: penalize the last 3 used layouts
  usedLayouts.slice(-3).forEach(l => { scores[l] -= 1.5; });

  // Tiebreak by round-robin index
  const ROTATION = ['cascade', 'grid', 'hub', 'fork', 'minimal'];
  const best = ROTATION[index % ROTATION.length];
  scores[best] += 0.1;

  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const books = [
  'an-inquiry-into-the-nature-and-causes-of-the-wealth-of-nations-adam-smith',
];

books.forEach(bookSlug => {
  const analyses = JSON.parse(readFileSync(`library/${bookSlug}/analyses.json`, 'utf8'));
  const chapRaw = JSON.parse(readFileSync(`library/${bookSlug}/chapters.json`, 'utf8'));
  const chapters = chapRaw.chapters || chapRaw;

  const usedLayouts = [];
  const svgs = analyses.map((analysis, i) => {
    const chInfo = chapters[i] || {};
    const title = chInfo.title || `Chapter ${i + 1}`;
    const chLabel = `Chapter ${i + 1} of ${analyses.length}`;
    const pfx = `${bookSlug.replace(/[^a-z0-9]/g, '').slice(0, 6)}${i}`;
    const layout = selectLayout(analysis, i, usedLayouts);
    usedLayouts.push(layout);

    switch (layout) {
      case 'fork': return layoutFork(pfx, analysis, title, chLabel);
      case 'hub': return layoutHub(pfx, analysis, title, chLabel);
      case 'cascade': return layoutCascade(pfx, analysis, title, chLabel);
      case 'grid': return layoutGrid(pfx, analysis, title, chLabel);
      default: return layoutMinimal(pfx, analysis, title, chLabel);
    }
  });

  writeFileSync(`library/${bookSlug}/svgs.json`, JSON.stringify(svgs));
  const layoutSummary = [...new Set(usedLayouts)].join(', ');
  console.log(`✓ ${bookSlug.slice(0, 42).padEnd(42)} ${svgs.length} SVGs  [${layoutSummary}]`);
});

console.log('\nDone. Run: node book.js explain <title> to re-render HTML.');
