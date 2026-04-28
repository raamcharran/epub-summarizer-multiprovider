// Patches specific SVGs in svgs.json without touching the others
import { writeFileSync, readFileSync } from 'fs';

const svgsPath = 'library/closing-of-the-american-mind-allan-bloom/svgs.json';
const svgs = JSON.parse(readFileSync(svgsPath, 'utf8'));

const W = 760, H = 360;
const BG = '#182828', PANEL = '#1e2e2e', BORDER = '#253535';
const CORAL = '#ff6b4a', HEAD = '#eee', BODY = '#888', DIM = '#555';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dots(pfx) {
  return `<pattern id="${pfx}d" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="${BORDER}"/></pattern>`;
}
function hdr(label, title, sub) {
  return `<rect width="${W}" height="108" fill="${PANEL}"/><rect width="2" height="108" fill="${CORAL}"/>
  <text x="14" y="22" font-size="9" font-weight="700" fill="${CORAL}" letter-spacing="2">${esc(label.toUpperCase())}</text>
  <text x="14" y="52" font-size="19" font-weight="900" fill="${HEAD}">${esc(title)}</text>
  <text x="14" y="76" font-size="11" fill="${BODY}">${esc(sub)}</text>`;
}
function ftr(label, text) {
  return `<rect y="310" width="${W}" height="50" fill="${PANEL}"/><rect y="310" width="2" height="50" fill="${CORAL}"/>
  <text x="14" y="331" font-size="9" font-weight="700" fill="${CORAL}" letter-spacing="2">${esc(label.toUpperCase())}</text>
  <text x="14" y="350" font-size="10.5" fill="${BODY}">${esc(text)}</text>`;
}
function wrap(pfx, defs, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;font-family:'Inter',sans-serif">
  <defs>${dots(pfx)}${defs}</defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#${pfx}d)"/>
  ${content}</svg>`;
}

// ─── CH6: Music — Fixed scale (rock presses DOWN = left side lower on page) ───
svgs[6] = (() => {
  const pfx = 'c6';
  // Beam tilted: left end y=284 (lower/heavier), right end y=258 (higher/lighter)
  const lx = 200, rx = 560;
  const beamLY = 284, beamRY = 258;
  const fulcrumX = 380, fulcrumY = beamLY + (beamRY - beamLY) * ((fulcrumX - lx) / (rx - lx));
  // Left pan (rock, heavy) – arm goes up short distance → pan is lower on page
  const lPanY = 148, lArmTopY = lPanY + 28;
  // Right pan (classical, light) – arm goes up long distance → pan is higher on page
  const rPanY = 120, rArmTopY = rPanY + 28;

  const content = `
  ${hdr('Music', 'The Soul Out of Balance', 'Rock gives the passions free rein. Plato warned us 2,400 years ago.')}
  <!-- Fulcrum -->
  <polygon points="${fulcrumX},${fulcrumY} ${fulcrumX - 22},${305} ${fulcrumX + 22},${305}" fill="${PANEL}" stroke="${BORDER}" stroke-width="1.5"/>
  <rect x="${lx - 20}" y="${303}" width="${rx - lx + 40}" height="5" fill="${BORDER}" rx="2"/>
  <!-- Tilted beam -->
  <line x1="${lx}" y1="${beamLY}" x2="${rx}" y2="${beamRY}" stroke="${BORDER}" stroke-width="3" stroke-linecap="round"/>
  <!-- Left arm (rock, pressed down) -->
  <line x1="${lx}" y1="${beamLY}" x2="${lx}" y2="${lArmTopY}" stroke="${BORDER}" stroke-width="1.5"/>
  <!-- Left pan header -->
  <rect x="${lx - 110}" y="${lPanY - 28}" width="220" height="28" fill="${PANEL}" stroke="${CORAL}" stroke-width="1.5"/>
  <text x="${lx}" y="${lPanY - 11}" text-anchor="middle" font-size="10" font-weight="800" fill="${CORAL}">↓ ROCK MUSIC (dominant)</text>
  <!-- Left content box -->
  <rect x="${lx - 110}" y="${lPanY}" width="220" height="130" fill="#221515" stroke="${CORAL}" stroke-opacity="0.3"/>
  <text x="${lx - 96}" y="${lPanY + 18}" font-size="10" fill="${BODY}">• Instant gratification</text>
  <text x="${lx - 96}" y="${lPanY + 34}" font-size="10" fill="${BODY}">• Pre-rational, sexual passion</text>
  <text x="${lx - 96}" y="${lPanY + 50}" font-size="10" fill="${BODY}">• Everywhere, inescapable</text>
  <text x="${lx - 96}" y="${lPanY + 66}" font-size="10" fill="${BODY}">• Conquers the forming soul</text>
  <text x="${lx - 96}" y="${lPanY + 84}" font-size="10" fill="${CORAL}">• Plato's nightmare realized</text>
  <text x="${lx - 96}" y="${lPanY + 102}" font-size="10" fill="${CORAL}">• Students: addicted, not moved</text>
  <!-- Right arm (classical, floated up) -->
  <line x1="${rx}" y1="${beamRY}" x2="${rx}" y2="${rArmTopY}" stroke="${BORDER}" stroke-width="1.5"/>
  <!-- Right pan header -->
  <rect x="${rx - 110}" y="${rPanY - 28}" width="220" height="28" fill="${PANEL}" stroke="${BORDER}"/>
  <text x="${rx}" y="${rPanY - 11}" text-anchor="middle" font-size="10" font-weight="800" fill="${DIM}">↑ CLASSICAL REASON (suppressed)</text>
  <!-- Right content box -->
  <rect x="${rx - 110}" y="${rPanY}" width="220" height="130" fill="${PANEL}" stroke="${BORDER}" opacity="0.7"/>
  <text x="${rx - 96}" y="${rPanY + 18}" font-size="10" fill="${DIM}">• Delayed reward</text>
  <text x="${rx - 96}" y="${rPanY + 34}" font-size="10" fill="${DIM}">• Rational harmony</text>
  <text x="${rx - 96}" y="${rPanY + 50}" font-size="10" fill="${DIM}">• Requires effort to love</text>
  <text x="${rx - 96}" y="${rPanY + 66}" font-size="10" fill="${DIM}">• No longer a shared tongue</text>
  <text x="${rx - 96}" y="${rPanY + 84}" font-size="10" fill="${DIM}">• Governs the formed soul</text>
  <text x="${rx - 96}" y="${rPanY + 102}" font-size="10" fill="${DIM}">• Requires quiet and attention</text>
  ${ftr('Plato\'s Prescription', '"Music is the soul\'s food in youth. Feed it badly and you corrupt the soil before the seed."')}`;
  return wrap(pfx, '', content);
})();

// ─── CH11: Creativity — Fixed y positions (no overlap) ───
svgs[11] = (() => {
  const pfx = 'c11';
  // 5 steps filling y=118 to y=306 (content area before footer at 310)
  // Each step: boxH=36px, gap=2px → slot=38px. 5×38=190. Start at 118, end at 308.
  const steps = [
    { y: 118, label: 'GOD', desc: 'Creates ex nihilo · True creation · Beyond causality', col: CORAL, fill: '#2a1a12', border: CORAL },
    { y: 158, label: 'RENAISSANCE GENIUS', desc: 'Michelangelo · Shakespeare · Godlike artists', col: HEAD, fill: '#1a2820', border: HEAD },
    { y: 198, label: 'ROMANTIC ARTIST', desc: 'Self-expression as creation · Originality as virtue', col: BODY, fill: PANEL, border: BORDER },
    { y: 238, label: 'SCIENTIST / INVENTOR', desc: '"Creative research" — self-contradicting', col: DIM, fill: PANEL, border: BORDER },
    { y: 278, label: 'EVERYONE', desc: 'Creative parenting · Creative accounting · Empty word', col: BORDER, fill: '#12181a', border: BORDER },
  ];
  const arrows = steps.slice(0, 4).map((s, i) =>
    `<line x1="380" y1="${s.y + 36}" x2="380" y2="${steps[i + 1].y}" stroke="${s.col}" stroke-width="1" stroke-opacity="0.4" marker-end="url(#${pfx}a)"/>`
  ).join('');
  const boxes = steps.map((s, i) => {
    const opacity = 1 - i * 0.12;
    return `<rect x="40" y="${s.y}" width="680" height="36" fill="${s.fill}" stroke="${s.border}" stroke-opacity="${opacity * 0.8}" stroke-width="${i === 0 ? 1.5 : 1}"/>
    <text x="56" y="${s.y + 15}" font-size="${12 - i * 0.3}" font-weight="800" fill="${s.col}" opacity="${opacity}">${esc(s.label)}</text>
    <text x="56" y="${s.y + 29}" font-size="10" fill="${s.col}" opacity="${opacity * 0.8}">${esc(s.desc)}</text>`;
  }).join('');

  const content = `
  ${hdr('Creativity', 'How a Divine Attribute Became a Buzzword', 'God alone was a creator. Now everyone is — and the word means nothing.')}
  ${arrows}
  ${boxes}
  <text x="740" y="136" text-anchor="end" font-size="9" fill="${CORAL}" opacity="0.5">ORIGINAL</text>
  <text x="740" y="314" text-anchor="end" font-size="9" fill="${DIM}" opacity="0.5">DILUTED</text>
  ${ftr('Bloom\'s Diagnosis', '"God alone had been called a creator — this was the miracle of miracles, beyond causality."')}`;
  return wrap(pfx,
    `<marker id="${pfx}a" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><path d="M0,0 L0,5 L6,2.5 z" fill="${BORDER}"/></marker>`,
    content);
})();

// ─── CH13: Values — Dominoes with proper short text (no truncation) ───
svgs[13] = (() => {
  const pfx = 'c13';
  const dominoes = [
    {
      top: 'GOD IS DEAD',
      lines: ['Nietzsche, 1882', 'Faith collapses', 'No cosmic order']
    },
    {
      top: 'REASON FAILS',
      lines: ['Science cannot say', 'what is good', 'or worth living for']
    },
    {
      top: 'CREATE VALUES',
      lines: ['Will must choose', 'No rational ground', 'remains']
    },
    {
      top: 'ALL CULTURES EQUAL',
      lines: ['Your values vs mine', 'No shared arbiter', 'No higher court']
    },
    {
      top: 'RELATIVISM',
      lines: ['No shared truth', 'Nothing is higher', 'Nihilism in practice']
    },
  ];
  const boxW = 120, boxH = 128, gap = 10, startX = 20;
  const boxes = dominoes.map((d, i) => {
    const x = startX + i * (boxW + gap);
    const tiltDeg = i < 4 ? 5 - i * 1.5 : 0;
    const opacity = 1 - i * 0.1;
    const cx = x + boxW / 2;
    return `<g transform="rotate(${tiltDeg} ${cx} 200)" opacity="${opacity}">
      <rect x="${x}" y="122" width="${boxW}" height="${boxH}" fill="${i === 0 ? '#2a1a12' : PANEL}" stroke="${i === 0 ? CORAL : BORDER}" stroke-width="${i === 0 ? 2 : 1}"/>
      <rect x="${x}" y="122" width="${boxW}" height="32" fill="${i === 0 ? '#3a2010' : '#1a2020'}"/>
      <text x="${cx}" y="139" text-anchor="middle" font-size="${i < 2 ? 9.5 : 9}" font-weight="900" fill="${i === 0 ? CORAL : HEAD}">${esc(d.top.split(' ').slice(0, 2).join(' '))}</text>
      ${d.top.split(' ').length > 2 ? `<text x="${cx}" y="152" text-anchor="middle" font-size="${i < 2 ? 9.5 : 9}" font-weight="900" fill="${i === 0 ? CORAL : HEAD}">${esc(d.top.split(' ').slice(2).join(' '))}</text>` : ''}
      <line x1="${x + 8}" y1="158" x2="${x + boxW - 8}" y2="158" stroke="${BORDER}" stroke-width="0.5"/>
      ${d.lines.map((t, j) => `<text x="${x + 10}" y="${168 + j * 15}" font-size="9" fill="${BODY}">${esc(t)}</text>`).join('')}
    </g>
    ${i < 4 ? `<text x="${x + boxW + 3}" y="190" font-size="16" fill="${CORAL}" opacity="0.35">→</text>` : ''}`;
  }).join('');

  // Wave of collapse arc
  const content = `
  ${hdr('Values', 'The Nihilism Cascade', 'Nietzsche pushed the first domino. The rest fell on their own.')}
  ${boxes}
  <path d="M22,260 Q200,245 380,255 Q560,265 738,252" fill="none" stroke="${CORAL}" stroke-width="1.5" stroke-opacity="0.2" stroke-dasharray="5,4"/>
  <text x="380" y="278" text-anchor="middle" font-size="9" fill="${DIM}" letter-spacing="1">— each collapse causes the next —</text>
  ${ftr('Max Weber', '"Reason cannot establish values, and its belief that it can is the stupidest and most pernicious illusion."')}`;
  return wrap(pfx, '', content);
})();

// ─── CH15: Our Ignorance — Permanent questions diagram ───
svgs[15] = (() => {
  const pfx = 'c15';
  const pairs = [
    ['Reason', 'Revelation'],
    ['Freedom', 'Necessity'],
    ['Democracy', 'Aristocracy'],
    ['Good', 'Evil'],
    ['Body', 'Soul'],
    ['Eternity', 'Time'],
  ];
  const cols = 3, rows = 2;
  const cellW = 220, cellH = 68, startX = 30, startY = 122, gapX = 15, gapY = 10;

  const cells = pairs.map((pair, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (cellW + gapX);
    const y = startY + row * (cellH + gapY);
    const midX = x + cellW / 2;
    return `
    <rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${PANEL}" stroke="${BORDER}"/>
    <text x="${x + cellW * 0.27}" y="${y + 24}" text-anchor="middle" font-size="13" font-weight="900" fill="${HEAD}">${esc(pair[0])}</text>
    <text x="${midX}" y="${y + 24}" text-anchor="middle" font-size="11" fill="${CORAL}">vs</text>
    <text x="${x + cellW * 0.73}" y="${y + 24}" text-anchor="middle" font-size="13" font-weight="900" fill="${HEAD}">${esc(pair[1])}</text>
    <line x1="${x + 14}" y1="${y + 32}" x2="${x + cellW - 14}" y2="${y + 32}" stroke="${BORDER}" stroke-width="0.5"/>
    <text x="${midX}" y="${y + 50}" text-anchor="middle" font-size="9.5" fill="${DIM}">unresolved tension</text>
    <text x="${midX}" y="${y + 63}" text-anchor="middle" font-size="9" fill="${DIM}">every serious life must face this</text>`;
  }).join('');

  const content = `
  ${hdr('Our Ignorance', 'The Permanent Questions', 'We have forgotten to ask what any serious life must face.')}
  ${cells}
  <rect x="30" y="274" width="700" height="32" fill="${PANEL}" stroke="${CORAL}" stroke-opacity="0.3"/>
  <text x="380" y="286" text-anchor="middle" font-size="10" font-weight="700" fill="${CORAL}">THE PROBLEM:</text>
  <text x="380" y="300" text-anchor="middle" font-size="10" fill="${BODY}">Modern students lack the vocabulary to even formulate these questions — let alone feel their urgency.</text>
  ${ftr('Bloom\'s Diagnosis', '"Our condition of doubt makes us aware of alternatives but not the means to choose between them."')}`;
  return wrap(pfx, '', content);
})();

writeFileSync(svgsPath, JSON.stringify(svgs));
console.log('Patched SVGs 6, 11, 13, 15.');
