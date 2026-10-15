import { describe, expect, it } from '@jest/globals';
import { paginateParagraphs } from './reader';

it('rejects an empty edition and invalid page sizes', () => {
  expect(() => paginateParagraphs([])).toThrow();
  expect(() => paginateParagraphs(['Texto'], 0)).toThrow();
});
describe('Wikisource text pagination', () => {
  it('keeps all words when paragraphs cross page boundaries', () => {
    const body = ['Primeira parte. '.repeat(1000), 'Segunda parte. '.repeat(500)];
    const pages = paginateParagraphs(body, 200);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap(page => page.paragraphs).join(' ').replace(/\s+/g, ' ').trim()).toBe(body.join(' ').replace(/\s+/g, ' ').trim());
  });
  it('preserves headings and the order of paragraphs without interpreting markup', () => {
    const pages = paginateParagraphs(['Capítulo I', '<script>literal text</script>', 'O começo da história.']);
    expect(pages[0].paragraphs).toEqual(['Capítulo I', '<script>literal text</script>', 'O começo da história.']);
  });
});
