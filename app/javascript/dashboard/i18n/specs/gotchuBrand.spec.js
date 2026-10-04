import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Gotchu-owned locale files, whole. Core files are rebranded at runtime by
// the branding task; ours are literal text and must not need it.
const GOTCHU_FILES = [
  'gotchuAgent.json',
  'gotchuStores.json',
  'gotchuShopify.json',
  'proceduresMgmt.json',
];
// The blocks of core files that this plan writes Gotchu strings into. Every
// file the plan adds a string to is walked, or a later task can ship the name
// past the guard. None of these blocks names the product today, in any locale.
const CORE_BLOCKS = [
  ['components.json', ['GOTCHU']],
  ['settings.json', ['SIDEBAR']],
  ['conversation.json', ['CONVERSATION', 'REPLYBOX']],
  ['conversation.json', ['CONVERSATION', 'GOTCHU_QUEUE']],
];
const LOCALES = ['en', 'de', 'fr'];
const root = join(__dirname, '..', 'locale');

const walk = (node, path, out) => {
  if (typeof node === 'string') {
    if (/chatwoot/i.test(node)) out.push(path);
    return;
  }
  Object.entries(node ?? {}).forEach(([k, v]) => walk(v, `${path}.${k}`, out));
};

describe('Gotchu strings never name the base product', () => {
  it.each(LOCALES)('holds for %s', locale => {
    const hits = [];
    GOTCHU_FILES.filter(f =>
      readdirSync(join(root, locale)).includes(f)
    ).forEach(file => {
      walk(
        JSON.parse(readFileSync(join(root, locale, file), 'utf8')),
        file,
        hits
      );
    });
    CORE_BLOCKS.forEach(([file, path]) => {
      const json = JSON.parse(readFileSync(join(root, locale, file), 'utf8'));
      walk(
        path.reduce((node, key) => node?.[key], json),
        `${file}.${path.join('.')}`,
        hits
      );
    });
    expect(hits).toEqual([]);
  });
});
