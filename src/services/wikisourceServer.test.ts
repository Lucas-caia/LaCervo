/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';
import { parseEdition, getBook, getReadingPart } from '../../server/wikisource';

const parsed = { pageid: 42, title: 'Uma obra', revid: 321, categories: [], links: [{ ns: 0, title: 'Uma obra/I', exists: true }, { ns: 0, title: 'Uma obra/II', exists: true }],
  text: '<div class="mw-parser-output"><div id="ws-data"><span id="ws-title">Uma obra</span><span id="ws-author">Uma autora</span><span id="ws-year">1900</span></div><script>danger()</script><div class="ws-noexport">Navigation</div><p>Uma apresentação com texto suficiente para descrever esta edição da Wikisource sem misturar menus.</p><a href="/wiki/Uma_obra/II">II</a><a href="/wiki/Uma_obra/I">I</a><a href="https://example.com">Outside</a></div>' };
describe('Wikisource extraction', () => {
  it('extracts live metadata and text without executing or returning HTML', () => {
    const edition = parseEdition(parsed);
    expect(edition.book).toMatchObject({ id: 'WS42', title: 'Uma obra', authors: ['Uma autora'], publicationYear: 1900, source: 'wikisource', readable: true });
    expect(edition.paragraphs.join(' ')).not.toMatch(/danger|Navigation|<script>/);
    expect(edition.parts.map(part => part.label)).toEqual(['Apresentação e índice', 'II', 'I']);
  });
  it('marks empty or incomplete editions unavailable and rejects malformed responses', () => {
    expect(parseEdition({ ...parsed, categories: [{ category: 'Textos_incompletos' }] }).book.readable).toBe(false);
    expect(parseEdition({ ...parsed, text: '<div class="mw-parser-output"></div>', links: [] }).book.readable).toBe(false);
    expect(() => parseEdition({})).toThrow();
  });
});

it('requests the supported legacy parser consistently for the edition and its chapters', async () => {
  const fetchMock = jest.mocked(fetch); fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ parse: { ...parsed, pageid: 901 } })));
  const book = await getBook('WS901');
  expect(book.chapters).toHaveLength(3);
  expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('parser')).toBe('legacy');
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ parse: { ...parsed, title: 'Uma obra/II', pageid: 902, links: [], text: '<div class="mw-parser-output"><p>Texto do segundo capítulo.</p></div>' } })));
  const chapter = await getReadingPart('WS901', 1);
  expect(chapter.paragraphs).toEqual(['Texto do segundo capítulo.']);
  expect(new URL(fetchMock.mock.calls[1][0] as string).searchParams.get('parser')).toBe('legacy');
});