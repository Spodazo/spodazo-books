/** Coordinates are PDF.js viewport coordinates at scale 1: origin top left. */
export function detectStoryLayout(items, width, height, mode = 'auto') {
  if (mode === 'page') return null;
  const text = items.filter(i => i.text.trim());
  const right = text.filter(i => i.x >= width * .67 && i.y > height * .12 && i.y < height * .9 && i.size >= height * .018);
  // Only the known square/near-square image-left, text-right template is inferred.
  const main = text.filter(i => i.size >= height * .018);
  if (right.length < 2 || (mode === 'auto' && (width / height < .85 || width / height > 1.15 || right.length / Math.max(main.length, 1) < .9))) return null;
  const max = Math.max(...right.map(i => i.size));
  const titleItems = right.filter(i => i.size >= max * .88);
  const bodyItems = right.filter(i => i.size < max * .88);
  if (!titleItems.length || !bodyItems.length) return null;
  const lines = list => {
    const groups = [];
    for (const item of [...list].sort((a,b) => a.y - b.y || a.x - b.x)) {
      let row = groups.find(r => Math.abs(r.y - item.y) < item.size * .25);
      if (!row) { row = {y:item.y, items:[]}; groups.push(row); }
      row.items.push(item);
    }
    return groups.sort((a,b)=>a.y-b.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ').trim());
  };
  const paragraphs=[];let pending='';
  for(const line of lines(bodyItems)) {
    if(pending && /^[“"]/.test(line)) {paragraphs.push(pending);pending='';}
    pending += (pending?' ':'')+line;
    if(/[.!?][”"]?$/.test(line)){paragraphs.push(pending);pending='';}
  }
  if(pending)paragraphs.push(pending);
  return {title:lines(titleItems).join(' '), paragraphs, imageFraction:2/3};
}
export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function safeURL(value, base = 'https://example.invalid/') {
  const url = new URL(value, base);
  if (!['https:','http:','blob:'].includes(url.protocol) && !/^data:image\/(png|jpeg|webp);base64,/i.test(value)) throw new Error('Unsupported asset URL');
  return url.href;
}
