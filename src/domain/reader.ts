export interface ReadingPage { paragraphs: string[]; }

export function paginateParagraphs(paragraphs: string[], pageSize = 4500): ReadingPage[] {
  if (!Number.isInteger(pageSize) || pageSize < 100 || !paragraphs.length) throw new Error('Invalid reading content');
  const pages: ReadingPage[] = [];
  let page: string[] = [], length = 0;
  function flush() { if (page.length) pages.push({ paragraphs: page }); page = []; length = 0; }
  for (const paragraph of paragraphs) {
    let remaining = paragraph.trim();
    while (remaining.length > pageSize) {
      flush();
      const boundary = remaining.lastIndexOf(' ', pageSize);
      const cut = boundary > 0 ? boundary : pageSize;
      pages.push({ paragraphs: [remaining.slice(0, cut)] });
      remaining = remaining.slice(cut).trimStart();
    }
    if (length + remaining.length > pageSize) flush();
    if (remaining) { page.push(remaining); length += remaining.length; }
  }
  flush();
  if (!pages.length) throw new Error('Empty edition');
  return pages;
}
