// Same trim, font, safe text box and widow rule as design.py's dedication.
const ptPerMm = 72 / 25.4;
const widthMm = 160.9;
const heightMm = 49;
const trimMm = 220;
const lineHeight = 1.31;
const maxLines = 4;

export function fitDedication(dedication, measureMm) {
  const plain = dedication.trim().replace(/["“”]/g, '״').replace(/([א-ת])'(?=[א-ת])/g, '$1׳');
  if (!plain) return null;
  const words = plain.split(/\s+/);
  for (let points = 26; points >= 20; points--) {
    const widths = new Map();
    const line = (start, stop) => {
      const key = `${start}:${stop}`;
      if (!widths.has(key)) {
        const text = words.slice(start, stop).join(' ');
        widths.set(key, { text, width: measureMm(text, points) });
      }
      return widths.get(key);
    };
    for (let count = 1; count <= maxLines; count++) {
      if (points / ptPerMm * lineHeight * count > heightMm) continue;
      let best = { cost: Infinity, lines: [] };
      const search = (start, remaining, selected) => {
        const end = remaining === 1 ? words.length : words.length - 2 * (remaining - 1);
        const begin = remaining === 1 ? end : start + (start ? 2 : 1);
        for (let stop = begin; stop <= end; stop++) {
          if (stop - start < (start ? 2 : 1)) continue;
          const candidate = line(start, stop);
          if (candidate.width > widthMm) break;
          const lines = [...selected, candidate];
          if (remaining > 1) {
            search(stop, remaining - 1, lines);
            continue;
          }
          const measures = lines.map(item => item.width);
          const penalty = count > 1 && !lines[0].text.includes(' ') ? widthMm : 0;
          const cost = penalty + Math.max(...measures) - Math.min(...measures);
          if (cost < best.cost) best = { cost, lines };
        }
      };
      search(0, count, []);
      if (best.lines.length) return {
        size: points / ptPerMm / trimMm * 100,
        text: best.lines.map(item => item.text).join('\n'),
      };
    }
  }
  return null;
}
