// HTML assembly — rich interactive output with D3.js knowledge graph
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { escapeHtml } from './util.js';
import { prepareChapterSvgs, fallbackSvg, coverageBadge } from './svg.js';
import { buildMarkdown } from './markdown.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const D3_INLINE = readFileSync(join(__dirname, 'd3.v7.min.js'), 'utf8');

function wordCount(t) { return t.split(/\s+/).filter(Boolean).length; }

function estimateReadTime(w) {
  const m = Math.round(w / 238);
  return m < 60 ? `${m} min read` : `${Math.floor(m / 60)}h ${m % 60}m read`;
}

export async function renderHtml(meta, chapters, analyses, synthesis, options = {}) {
  const totalWords = chapters.reduce((s, c) => s + wordCount(c.text), 0);
  const centralClaim = synthesis.central_claim || meta.central_claim || '';
  const bookSummary = synthesis.book_summary || meta.book_summary || '';
  const svgs = await prepareChapterSvgs(chapters, analyses, options);

  return assembleHtml(meta, chapters, analyses, synthesis, totalWords, centralClaim, bookSummary, svgs);
}

// Recolor cached AI-generated SVG infographics from the original dark teal +
// coral palette to the parchment + Pompeian red scheme, and strip the banned
// 2px coral side-stripe rects (impeccable absolute ban: side-stripes > 1px).
const SVG_COLOR_REMAP = [
  [/#182828/gi, '#f5ede0'], [/#1e2e2e/gi, '#faf6ee'], [/#253535/gi, '#d8cab8'],
  [/#ff6b4a/gi, '#a0352b'], [/#ff8c75/gi, '#7a2820'], [/#2a4a4a/gi, '#d8cab8'],
  // Context-free hex remaps (catches fill, stroke, stop-color, style="...", etc.)
  [/#eeeeee\b/gi, '#2a2118'], [/#dddddd\b/gi, '#2a2118'], [/#cccccc\b/gi, '#3a2f25'],
  [/#aaaaaa\b/gi, '#5e4f43'], [/#888888\b/gi, '#5e4f43'], [/#777777\b/gi, '#7a6a5a'],
  [/#666666\b/gi, '#8a7868'], [/#333333\b/gi, '#7a6a5a'],
  [/#eee\b/gi, '#2a2118'], [/#ddd\b/gi, '#2a2118'], [/#ccc\b/gi, '#3a2f25'],
  [/#aaa\b/gi, '#5e4f43'], [/#888\b/gi, '#5e4f43'], [/#777\b/gi, '#7a6a5a'],
  [/#666\b/gi, '#8a7868'], [/#333\b/gi, '#7a6a5a'],
  [/#ffffff\b/gi, '#faf6ee'], [/#fff\b/gi, '#faf6ee'],
  [/#000000\b/gi, '#2a2118'], [/#000\b/gi, '#2a2118'],
];
function recolorSvg(svg) {
  if (!svg) return svg;
  let out = svg;
  for (const [re, to] of SVG_COLOR_REMAP) out = out.replace(re, to);
  // Nuke 2px coral side-stripe rects (now red after remap) — banned accent stripe
  out = out.replace(/<rect\s+(?:y="[^"]*"\s+)?width="2"\s+height="[^"]*"\s+fill="#a0352b"[^/]*\/>/gi, '');
  return out;
}

export function assembleHtml(meta, chapters, analyses, synthesis, totalWords, centralClaim, bookSummary, svgs) {
  const navLinks = chapters.map(ch => {
    const short = ch.title.replace(/^(Chapter\s*\d+:\s*|Rule\s*#?\d+:\s*)/i, '').slice(0, 22);
    return `<a href="#${ch.id}">${escapeHtml(short)}</a>`;
  }).join('\n');

  const chapterListItems = chapters.map((ch, i) => {
    const num = String(i + 1).padStart(2, '0');
    const summary = (analyses[i] || {}).summary || '';
    const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] || '';
    const subtitle = firstSentence.length > 110 ? firstSentence.slice(0, 107) + '…' : firstSentence;
    return `<li><a href="#${ch.id}" class="ch-list-link"><span class="ch-list-num">${num}</span><span class="ch-list-body"><span class="ch-list-title">${escapeHtml(ch.title)}</span>${subtitle ? `<span class="ch-list-sub">${escapeHtml(subtitle)}</span>` : ''}</span></a></li>`;
  }).join('\n');

  const chSections = chapters.map((ch, i) => {
    const r = analyses[i] || {};
    const partNum = String(i + 1).padStart(2, '0');
    const quotes = (r.key_quotes || []).map(q => `<blockquote>${escapeHtml(q)}</blockquote>`).join('');
    const summaryHtml = (r.summary || '').split('\n').filter(Boolean).slice(0, 5)
      .map(p => `<p>${escapeHtml(p)}</p>`).join('');
    const svg = recolorSvg(svgs[i] || fallbackSvg(ch, r));
    return `
<section id="${ch.id}" data-concepts="${escapeHtml((r.concepts || []).map(c => c.id).join(','))}" class="ch-section">
  <span class="part-label">Part [ ${partNum} ]</span>
  <div class="ch-header">
    <h2>${escapeHtml(ch.title)}</h2>
    <span class="coverage-label">${escapeHtml(coverageBadge(r.coverage_type))}</span>
  </div>
  <div class="svg-wrap">${svg}</div>
  <div class="ch-summary">${summaryHtml}</div>
  ${quotes ? `<div class="quotes">${quotes}</div>` : ''}
</section>`;
  }).join('');

  const graphData = JSON.stringify({ nodes: synthesis.nodes || [], edges: synthesis.edges || [] });
  const markdownStr = JSON.stringify(buildMarkdown({ ...meta, central_claim: centralClaim, book_summary: bookSummary }, chapters, analyses));
  const bookSummaryHtml = bookSummary.split('\n').filter(Boolean).slice(0, 7).map(p => `<p>${escapeHtml(p)}</p>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(meta.title)} — Deep Summary</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box}
body{font-family:'Inter',sans-serif;background-color:#f5ede0;color:#5e4f43;margin:0;padding:0;line-height:1.8}
.wrap{max-width:960px;margin:0 auto;padding:0 40px 140px}
h1,h2,h3,h4{font-family:'Inter',sans-serif;line-height:1.15;margin:0;font-weight:900}
a{color:#a0352b;text-decoration:none}
a:hover{color:#7a2820}
.top-nav{position:sticky;top:0;z-index:100;background:#f5ede0;border-bottom:1px solid #d8cab8;padding:0 40px;display:flex;align-items:center;gap:16px;height:52px}
.top-nav .book-label{flex-shrink:0;color:#2a2118;font-weight:800;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
.top-nav .book-label .sep{color:#a0352b;margin:0 8px}
.top-nav .nav-links{display:flex;overflow-x:auto;scrollbar-width:none;flex:1;gap:0}
.top-nav .nav-links::-webkit-scrollbar{display:none}
.top-nav .nav-links a{flex-shrink:0;padding:0 14px;height:52px;display:flex;align-items:center;font-size:.68rem;font-weight:700;color:#7a6a5a;white-space:nowrap;text-transform:uppercase;letter-spacing:.1em;transition:color .15s}
.top-nav .nav-links a:hover,.top-nav .nav-links a.active{color:#a0352b;text-decoration:none}
.hero{padding:120px 0 100px;border-bottom:1px solid #d8cab8}
.hero .author{color:#7a6a5a;font-size:.78rem;font-weight:700;margin:0 0 20px;text-transform:uppercase;letter-spacing:.14em}
.hero h1{font-size:clamp(2.8rem,6vw,5.2rem);font-weight:900;color:#a0352b;line-height:1.0;margin:0 0 24px;letter-spacing:-.03em;max-width:860px}
.hero .meta-line{color:#7a6a5a;font-size:.82rem;margin:0}
.part-label{display:block;font-size:.65rem;font-weight:700;color:#a0352b;text-transform:uppercase;letter-spacing:.2em;margin:0 0 18px}
.claim-box{padding:80px 0;border-bottom:1px solid #d8cab8}
.claim-box p{margin:0;font-size:1.35rem;line-height:1.65;color:#2a2118;font-weight:500;max-width:800px}
.book-summary{padding:80px 0;border-bottom:1px solid #d8cab8}
.book-summary h2{font-size:2.8rem;color:#2a2118;margin-bottom:36px}
.book-summary p{margin:0 0 18px;color:#5e4f43;font-size:1rem;line-height:1.85}
.chapters-intro{padding:80px 0 0}
.section-title{font-size:2.8rem;color:#2a2118;margin:0}
.ch-section{padding:60px 0;border-bottom:1px solid #d8cab8;opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease}
.ch-section.visible{opacity:1;transform:none}
.ch-section.highlight .ch-header h2{color:#a0352b}
.ch-header{margin-bottom:20px}
.ch-header h2{font-size:1.9rem;color:#2a2118;font-weight:900;margin-bottom:8px;line-height:1.2}
.coverage-label{font-size:.63rem;font-weight:700;color:#7a6a5a;text-transform:uppercase;letter-spacing:.14em}
.svg-wrap{margin:32px 0;overflow:hidden}
.ch-summary p{margin:0 0 14px;color:#5e4f43;font-size:1rem;line-height:1.85}
.quotes{margin-top:36px}
blockquote{border-left:2px solid #a0352b;margin:20px 0;padding:8px 0 8px 24px;background:none;color:#3a2f25;font-size:1.1rem;font-style:italic;line-height:1.7}
#kg-wrap{padding:80px 0;border-bottom:1px solid #d8cab8}
.kg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:32px}
.kg-copy h2{font-size:2.8rem;color:#2a2118;margin-bottom:8px}
.kg-copy p{color:#7a6a5a;font-size:.85rem;margin:0}
.kg-controls{display:flex;align-items:center;gap:16px}
.kg-btn{background:none;color:#7a6a5a;border:none;padding:0;font-size:.75rem;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.14em;transition:color .15s;font-family:'Inter',sans-serif}
.kg-btn:hover{color:#a0352b}
.kg-frame{position:relative;height:min(82vh,820px);min-height:500px;background-color:#faf6ee;border:1px solid #d8cab8;overflow:hidden}
#kg-svg{width:100%;height:100%;display:block}
.node circle{cursor:pointer}.node circle:hover{filter:brightness(1.15)}
.node text{pointer-events:none;font-size:11px;font-weight:700;fill:#2a2118;font-family:'Inter',sans-serif}
.link line{stroke-opacity:.35}
.edge-label{font-size:9px;fill:#8a7868;pointer-events:none}
.tooltip{position:fixed;background:#faf6ee;color:#2a2118;border:1px solid #d8cab8;padding:10px 14px;font-size:13px;pointer-events:none;max-width:260px;line-height:1.5;z-index:999;display:none;box-shadow:0 4px 20px rgba(0,0,0,.6)}
.chapter-list{padding:80px 0;border-bottom:1px solid #d8cab8}
.chapter-list ul{list-style:none;margin:32px 0 0;padding:0;columns:2;column-gap:40px}
@media(max-width:600px){.chapter-list ul{columns:1}}
.ch-list-link{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-bottom:1px solid #faf6ee;color:#5e4f43;text-decoration:none;transition:color .15s}
.ch-list-link:hover{color:#a0352b;text-decoration:none}
.ch-list-link:hover .ch-list-sub{color:#7a2820}
.ch-list-num{flex-shrink:0;font-size:.65rem;font-weight:700;color:#a0352b;letter-spacing:.12em;min-width:22px;padding-top:3px}
.ch-list-body{display:flex;flex-direction:column;gap:3px}
.ch-list-title{font-size:.9rem;font-weight:600;color:#2a2118;line-height:1.3}
.ch-list-link:hover .ch-list-title{color:#a0352b}
.ch-list-sub{font-size:.78rem;font-weight:400;color:#8a7868;line-height:1.45}
.kg-list-link{display:flex;align-items:flex-start;gap:16px;padding:12px 0;margin-top:8px;border-top:1px solid #a0352b;color:#5e4f43;text-decoration:none;transition:color .15s}
.kg-list-link:hover{color:#a0352b;text-decoration:none}
.kg-list-link:hover .ch-list-sub{color:#7a2820}
.kg-list-link .ch-list-title{color:#a0352b}
.kg-list-link .ch-list-num{color:#a0352b}
.export-wrap{padding:80px 0 0;text-align:left}
.export-btn{background:transparent;color:#a0352b;border:1px solid #a0352b;padding:12px 28px;font-size:.72rem;cursor:pointer;font-weight:700;letter-spacing:.16em;text-transform:uppercase;transition:all .2s;font-family:'Inter',sans-serif}
.export-btn:hover{background:#a0352b;color:#f5ede0}
.scroll-progress{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#a0352b,#7a2820);z-index:200;width:0;pointer-events:none;transition:none;will-change:width}
.top-nav{top:3px}
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.ch-section{opacity:1;transform:none;transition:none}}
a:focus-visible,.kg-btn:focus-visible,.export-btn:focus-visible{outline:2px solid #a0352b;outline-offset:2px;border-radius:2px}
.top-nav .nav-links a.active{color:#a0352b;box-shadow:inset 0 -2px 0 #a0352b}
.kg-btn{padding:8px 12px;min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}
@media(max-width:680px){
.top-nav{padding:0 12px;height:44px;gap:8px}
.top-nav .book-label{display:none}
.top-nav .nav-links a{padding:0 10px;height:44px;font-size:.62rem;min-width:36px;justify-content:center}
.wrap{padding:0 16px 100px}
.hero{padding:64px 0 48px}
.hero h1{font-size:clamp(1.8rem,8vw,3rem)}
.hero .author{font-size:.7rem;margin-bottom:14px}
.claim-box{padding:40px 0}
.claim-box p{font-size:1.05rem;line-height:1.75}
.book-summary{padding:40px 0}
.book-summary h2,.section-title,.kg-copy h2{font-size:1.8rem}
.book-summary p{font-size:.92rem}
.ch-section{padding:36px 0}
.ch-header h2{font-size:1.35rem}
.ch-summary p{font-size:.92rem;line-height:1.8}
.svg-wrap{margin:20px -16px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:0 16px}
.svg-wrap svg{min-width:520px}
#kg-wrap{padding:40px 0}
.kg-frame{min-height:350px;height:60vh}
.kg-head{flex-direction:column;gap:12px}
.chapter-list{padding:40px 0}
blockquote{font-size:.9rem;padding-left:14px;margin:16px 0}
.export-btn{width:100%;text-align:center;padding:14px 20px}
.tooltip{max-width:200px;font-size:12px}
}
</style>
<noscript><style>.ch-section{opacity:1!important;transform:none!important}</style></noscript>
</head>
<body>
<div class="scroll-progress"></div>
<nav class="top-nav">
  <div class="book-label">${escapeHtml(meta.title)}<span class="sep">/</span>Deep Summary</div>
  <div class="nav-links">
    ${navLinks}
    <a href="#kg-wrap">Knowledge Graph</a>
  </div>

</nav>

<div class="wrap">

<header class="hero">
  <p class="author">${escapeHtml(meta.author)}</p>
  <h1>${escapeHtml(meta.title)}</h1>
  <p class="meta-line">${totalWords.toLocaleString()} words &middot; ${estimateReadTime(totalWords)} &middot; ${chapters.length} chapters</p>
</header>

<div class="chapter-list">
  <span class="part-label">Contents</span>
  <h2 class="section-title">Chapters</h2>
  <ul>
    ${chapterListItems}
  </ul>
  <a href="#kg-wrap" class="kg-list-link">
    <span class="ch-list-num">—</span>
    <span class="ch-list-body"><span class="ch-list-title">Knowledge Graph</span><span class="ch-list-sub">Interactive concept map linking key ideas across all chapters</span></span>
  </a>
</div>

<div class="claim-box">
  <span class="part-label">Part [ 00 ] — Central Claim</span>
  <p>${escapeHtml(centralClaim)}</p>
</div>

<div class="book-summary">
  <span class="part-label">Part [ 01 ] — Book Summary</span>
  <h2>Overview</h2>
  <div>${bookSummaryHtml}</div>
</div>

<div class="chapters-intro">
  <span class="part-label">Part [ 02 ] — Chapter Summaries</span>
  <h2 class="section-title">Chapter Summaries</h2>
</div>
${chSections}

<div id="kg-wrap">
  <span class="part-label">Part [ 03 ] — Concept Map</span>
  <div class="kg-head">
    <div class="kg-copy">
      <h2>Knowledge Graph</h2>
      <p>Click a node to highlight chapters. Drag to pan, scroll to zoom, or use the controls.</p>
    </div>
    <div class="kg-controls">
      <button class="kg-btn" id="kg-zoom-out" type="button">−</button>
      <button class="kg-btn" id="kg-reset" type="button">Reset</button>
      <button class="kg-btn" id="kg-zoom-in" type="button">+</button>
    </div>
  </div>
  <div class="kg-frame">
    <svg id="kg-svg"></svg>
  </div>
</div>

<div class="export-wrap">
  <button class="export-btn" id="export-btn">Download summary.md</button>
</div>

</div>
<div class="tooltip" id="tooltip"></div>
<script>document.addEventListener("touchstart",e=>{if(!e.target.closest(".node"))document.getElementById("tooltip").style.display="none";},{passive:true});</script>

<script>${D3_INLINE}</script>
<script>
// Intersection observer for chapter fade-in (with fallback for iPad Safari / file:// quirks)
const _chSections = document.querySelectorAll('.ch-section');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.06 });
  _chSections.forEach(el => io.observe(el));
  // Fallback: if no section became visible within 2s, force-show all (iPad file:// bug)
  setTimeout(() => {
    const anyVisible = document.querySelector('.ch-section.visible');
    if (!anyVisible) _chSections.forEach(el => el.classList.add('visible'));
  }, 2000);
} else {
  _chSections.forEach(el => el.classList.add('visible'));
}

const MD = ${markdownStr};
document.getElementById('export-btn').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([MD],{type:'text/markdown'})),
    download:'summary.md'
  });
  a.click();
});

window.addEventListener('load', function(){
  const data = ${graphData};
  const frame = document.querySelector('.kg-frame');
  if (!data.nodes?.length) {
    frame.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#7a6a5a;font-size:.95rem;padding:24px;text-align:center">No knowledge graph was generated for this summary.</div>';
    return;
  }

  // Double rAF ensures the browser has committed final layout before we read dimensions
  requestAnimationFrame(() => requestAnimationFrame(() => {

  const W = frame.clientWidth;
  const H = frame.clientHeight;
  const svg = d3.select('#kg-svg')
    .attr('width', W).attr('height', H)
    .attr('viewBox',\`0 0 \${W} \${H}\`)
    .attr('preserveAspectRatio','xMidYMid meet');

  const maxCh = d3.max(data.nodes, n => (n.chapters || []).length) || 1;
  const color = d3.scaleSequential().domain([0, maxCh]).interpolator(d3.interpolate('#d8cab8','#a0352b'));

  const nodes = data.nodes.map(d => ({ ...d }));
  // Filter edges: drop self-loops and references to non-existent node IDs (would produce NaN positions)
  const nodeIds = new Set(nodes.map(n => n.id));
  const links = (data.edges || [])
    .filter(e => e.from !== e.to && nodeIds.has(e.from) && nodeIds.has(e.to))
    .map(e => ({ source: e.from, target: e.to, label: e.label || '' }));

  const defs = svg.append('defs');
  defs.append('marker').attr('id','arr').attr('markerWidth',8).attr('markerHeight',8)
    .attr('refX',34).attr('refY',3).attr('orient','auto')
    .append('path').attr('d','M0,0 L0,6 L8,3 z').attr('fill','#d8cab8');

  const zoomLayer = svg.append('g');
  const linkG = zoomLayer.append('g').selectAll('g').data(links).join('g');
  const nodeG = zoomLayer.append('g').selectAll('g').data(nodes).join('g').attr('class','node');

  const nodeCount = nodes.length;
  const linkDist = nodeCount > 20 ? 110 : 140;
  const chargeStr = nodeCount > 20 ? -300 : -420;
  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(linkDist))
    .force('charge', d3.forceManyBody().strength(chargeStr))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(52));

  linkG.append('line').attr('stroke','#d8cab8').attr('stroke-width',1.5).attr('marker-end','url(#arr)');
  const edgeLbl = linkG.append('text').attr('class','edge-label').attr('text-anchor','middle')
    .text(d => d.label).style('opacity',0);
  linkG.on('mouseenter', function(){ d3.select(this).select('text').style('opacity',1); })
       .on('mouseleave', function(){ d3.select(this).select('text').style('opacity',0); });

  const tooltip = document.getElementById('tooltip');
  const zoom = d3.zoom()
    .scaleExtent([0.08, 4])
    .on('zoom', e => { zoomLayer.attr('transform', e.transform); });

  svg.call(zoom).on('dblclick.zoom', null);

  nodeG.call(d3.drag()
      .on('start', (e, d) => { if (!e.active) sim.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }))
    .on('click', (e, d) => {
      document.querySelectorAll('.ch-section').forEach(el => el.classList.remove('highlight'));
      let first = null;
      document.querySelectorAll('.ch-section[data-concepts]').forEach(el => {
        if (el.dataset.concepts.split(',').includes(d.id)) { el.classList.add('highlight'); if (!first) first = el; }
      });
      if (first) first.scrollIntoView({ behavior:'smooth', block:'center' });
    })
    .on('mouseover', (e, d) => { tooltip.style.display='block'; tooltip.innerHTML=\`<strong>\${d.label}</strong><br>\${d.description||''}\`; })
    .on('mousemove', e => { tooltip.style.left=(e.clientX+14)+'px'; tooltip.style.top=(e.clientY-10)+'px'; })
    .on('mouseleave', () => { tooltip.style.display='none'; })
    .on('touchstart', (e, d) => { e.preventDefault(); const t=e.touches[0]; tooltip.innerHTML=\`<strong>\${d.label}</strong><br>\${d.description||''}\`; tooltip.style.display='block'; tooltip.style.left=(t.clientX+14)+'px'; tooltip.style.top=(t.clientY-10)+'px'; }, {passive:false});

  nodeG.append('circle').attr('r',30)
    .attr('fill', d => color((d.chapters || []).length))
    .attr('stroke','#f5ede0').attr('stroke-width',2);
  // Two-line word-wrapped labels — split at a space near the midpoint
  nodeG.append('text').attr('text-anchor','middle').each(function(d) {
    const sel = d3.select(this);
    const words = d.label.split(/\\s+/);
    if (words.length <= 1 || d.label.length <= 11) {
      const lbl = d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label;
      sel.append('tspan').attr('x', 0).attr('dy', '4px').attr('font-size', '10px').attr('font-weight', '700').attr('fill', '#2a2118').text(lbl);
    } else {
      const mid = Math.ceil(words.length / 2);
      const l1 = words.slice(0, mid).join(' ');
      const l2 = words.slice(mid).join(' ');
      sel.append('tspan').attr('x', 0).attr('dy', '-5px').attr('font-size', '10px').attr('font-weight', '700').attr('fill', '#2a2118').text(l1.length > 14 ? l1.slice(0, 13) + '…' : l1);
      sel.append('tspan').attr('x', 0).attr('dy', '13px').attr('font-size', '10px').attr('font-weight', '700').attr('fill', '#2a2118').text(l2.length > 14 ? l2.slice(0, 13) + '…' : l2);
    }
  });

  function graphBounds() {
    const points = [];
    nodes.forEach(node => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      points.push([node.x - 54, node.y - 54], [node.x + 54, node.y + 54]);
    });
    links.forEach(link => {
      const sx = link.source?.x, sy = link.source?.y, tx = link.target?.x, ty = link.target?.y;
      if ([sx, sy, tx, ty].every(Number.isFinite)) {
        points.push([sx, sy], [tx, ty]);
      }
    });
    if (!points.length) return null;
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  function fitGraph(animated) {
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    if (!fw || !fh) return;
    const bounds = graphBounds();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

    const pad = 56;
    const scale = Math.max(0.08, Math.min(1.6, Math.min((fw - pad * 2) / bounds.width, (fh - pad * 2) / bounds.height)));
    const tx = (fw / 2) - scale * (bounds.x + bounds.width / 2);
    const ty = (fh / 2) - scale * (bounds.y + bounds.height / 2);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

    const selection = animated ? svg.transition().duration(280) : svg;
    selection.call(zoom.transform, transform);
  }

  document.getElementById('kg-zoom-in').addEventListener('click', () => {
    svg.transition().duration(180).call(zoom.scaleBy, 1.2);
  });
  document.getElementById('kg-zoom-out').addEventListener('click', () => {
    svg.transition().duration(180).call(zoom.scaleBy, 1 / 1.2);
  });
  document.getElementById('kg-reset').addEventListener('click', () => fitGraph(true));

  // Pre-run simulation synchronously so all node positions are final before
  // touching the DOM. This eliminates the async race between tick/end/setTimeout
  // that caused nodes to render clustered in a corner before fitGraph could act.
  sim.stop();
  for (let i = 0; i < 300; ++i) sim.tick();

  // Guard: replace any NaN positions (e.g. orphaned nodes) with a spread near center
  const cx = frame.clientWidth / 2, cy = frame.clientHeight / 2;
  nodes.forEach(n => {
    if (!Number.isFinite(n.x)) n.x = cx + (Math.random() - 0.5) * 180;
    if (!Number.isFinite(n.y)) n.y = cy + (Math.random() - 0.5) * 180;
  });

  function updatePositions() {
    linkG.select('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    edgeLbl.attr('x', d => (d.source.x + d.target.x) / 2).attr('y', d => (d.source.y + d.target.y) / 2 - 6);
    nodeG.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
  }
  updatePositions();
  fitGraph(false);

  // Tick handler only fires during user-initiated drags
  sim.on('tick', updatePositions);

  new ResizeObserver(() => {
    const nw = frame.clientWidth, nh = frame.clientHeight;
    if (!nw || !nh) return;
    svg.attr('width', nw).attr('height', nh).attr('viewBox', \`0 0 \${nw} \${nh}\`);
    fitGraph(false);
  }).observe(frame);

  })); // end double rAF
});
</script>
<script>
(function(){
  const bar = document.querySelector('.scroll-progress');
  function updateProgress(){
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + '%' : '0%';
  }
  window.addEventListener('scroll', updateProgress, {passive:true});
  updateProgress();
})();
</script>
</body>
</html>`;
}
