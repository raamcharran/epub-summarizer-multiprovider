// Markdown rendering helpers

export function buildMarkdown(meta, chapters, analyses) {
  const lines = [`# ${meta.title}`, `**Author:** ${meta.author}\n`];
  lines.push(`## Central Claim\n\n${meta.central_claim || ''}\n`);
  lines.push(`## Book Summary\n\n${meta.book_summary || ''}\n`);
  lines.push(`---\n\n## Chapter Summaries\n`);
  chapters.forEach((ch, i) => {
    const r = analyses[i] || {};
    lines.push(`### ${ch.title}`);
    lines.push(`*Coverage: ${r.coverage_type || 'unknown'}*\n`);
    lines.push(`${r.summary || ''}\n`);
    if (r.key_quotes?.length) {
      lines.push(`**Key Quotes:**\n`);
      r.key_quotes.forEach(q => lines.push(`> ${q}\n`));
    }
    lines.push('');
  });
  return lines.join('\n');
}
