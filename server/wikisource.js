import { load } from 'cheerio';

const API = 'https://pt.wikisource.org/w/api.php';
const SOURCE = 'https://pt.wikisource.org';
const cache = new Map();
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const isWikiId = id => typeof id === 'string' && /^WS[1-9]\d{0,11}$/.test(id);
const clean = text => text.replace(/\u00a0/g, ' ').replace(/[\t ]+/g, ' ').trim();

async function wiki(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params, ...(params.action === 'parse' ? { parser: 'legacy' } : {}) })}`;
  const saved = cache.get(url);
  if (saved && saved.expires > Date.now()) return saved.data;
  const response = await fetch(url, { headers: { 'User-Agent': 'LaCervo/1.0 (https://github.com/Lucas-caia/LaCervo)' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new HttpError(503, 'A Wikisource está indisponível. Tente novamente em instantes.');
  const data = await response.json();
  if (data.error) throw new HttpError(['missingtitle', 'nosuchpageid', 'missingpage'].includes(data.error.code) ? 404 : 503, 'Não foi possível consultar esta edição na Wikisource.');
  if (cache.size >= 80) cache.delete(cache.keys().next().value);
  cache.set(url, { data, expires: Date.now() + 5 * 60 * 1000 });
  return data;
}

export function parseEdition(parsed) {
  if (!parsed || !Number.isSafeInteger(parsed.pageid) || parsed.pageid <= 0 || typeof parsed.text !== 'string' || typeof parsed.title !== 'string') throw new HttpError(404, 'Edição não encontrada.');
  const $ = load(parsed.text);
  const pageTitle = parsed.title;
  const title = clean($('#ws-title').text() || $('#header_title_text').text() || pageTitle).slice(0, 300);
  const author = clean($('#ws-author').text() || $('#header_author_text').text());
  const year = Number(clean($('#ws-year').text()));
  const categories = (parsed.categories || []).filter(row => !row.hidden).map(row => String(row.category || '').replace(/_/g, ' '));
  const allowed = new Set((parsed.links || []).filter(row => row.ns === 0 && row.exists && row.title?.startsWith(`${pageTitle}/`)).map(row => row.title));
  const chapters = [], seen = new Set();
  // Preserve the edition's table-of-contents order, rather than sorting Roman chapter numbers.
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href?.startsWith('/wiki/')) return;
    let target;
    try { target = decodeURIComponent(href.slice(6).split('#')[0]).replace(/_/g, ' '); } catch { return; }
    if (!allowed.has(target) || seen.has(target)) return;
    seen.add(target); chapters.push({ title: target, label: clean($(element).text()) || target.slice(pageTitle.length + 1) });
  });
  const root = $('.mw-parser-output').first();
  root.find('script,style,iframe,object,embed,form,.ws-noexport,.noprint,.mw-editsection,.toc,#toc,#navigationHeader,#navigationNotes,#ws-data,.catlinks,.printfooter').remove();
  root.find('br').replaceWith('\n');
  const blocks = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,.poem,.tiInherit,dd';
  const paragraphs = [];
  root.find(blocks).each((_, element) => {
    if ($(element).find(blocks).length) return;
    const text = clean($(element).text());
    if (text) paragraphs.push(text);
  });
  if (!paragraphs.length) { const text = clean(root.text()); if (text) paragraphs.push(text); }
  const readable = !/\//.test(pageTitle) && !categories.some(value => /incomplet|desambigua|sem transcri/i.test(value)) && (paragraphs.join(' ').length >= 80 || chapters.length > 0);
  const book = { id: `WS${parsed.pageid}`, title, authors: author ? [author.slice(0, 150)] : [], coverId: null,
    publicationYear: year >= 1 && year <= new Date().getFullYear() ? year : null,
    subjects: categories.slice(0, 6), source: 'wikisource', readable,
    sourceUrl: `${SOURCE}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
    description: readable ? 'Edição online da Wikisource em português. Faça um empréstimo para ler a obra dentro do LaCervo.' : 'O texto desta edição ainda não está disponível para leitura no LaCervo.' };
  return { book, pageTitle, revision: parsed.revid || null, paragraphs, parts: [{ title: pageTitle, label: chapters.length ? 'Apresentação e índice' : 'Texto da obra' }, ...chapters] };
}

export async function getEdition(workId) {
  if (!isWikiId(workId)) throw new HttpError(400, 'Livro inválido.');
  const data = await wiki({ action: 'parse', pageid: workId.slice(2), prop: 'text|links|categories|revid' });
  const edition = parseEdition(data.parse);
  if (edition.book.id !== workId || edition.pageTitle.includes('/')) throw new HttpError(400, 'Escolha a obra principal, em vez de um capítulo isolado.');
  return edition;
}

export async function getBook(workId) {
  const edition = await getEdition(workId);
  return { ...edition.book, chapters: edition.parts.map((part, index) => ({ index, label: part.label })), revision: edition.revision };
}

export async function getReadingPart(workId, chapter) {
  const edition = await getEdition(workId);
  if (!edition.book.readable) throw new HttpError(404, 'Esta edição não possui texto disponível.');
  if (!Number.isInteger(chapter) || chapter < 0 || chapter >= edition.parts.length) throw new HttpError(400, 'Parte do livro inválida.');
  const selected = edition.parts[chapter];
  const part = chapter === 0 ? edition : parseEdition((await wiki({ action: 'parse', page: selected.title, prop: 'text|links|categories|revid' })).parse);
  if (!part.paragraphs.length) throw new HttpError(404, 'Esta parte ainda não possui texto disponível.');
  return { book: edition.book, chapter, chapterLabel: selected.label, chapters: edition.parts.map((item, index) => ({ index, label: item.label })),
    paragraphs: part.paragraphs, revision: part.revision, sourceUrl: `${SOURCE}/wiki/${encodeURIComponent(selected.title.replace(/ /g, '_'))}` };
}
