import en from '../locale/en/components.json';
import de from '../locale/de/components.json';
import fr from '../locale/fr/components.json';
import vi from '../locale/vi/components.json';

const BLOCKS = ['COMPOSER', 'THREAD', 'HEADER', 'DRAWER', 'TRANSLATE'];
// Words that are the same in the target language. Keep this list short.
const SAME = new Set([
  'Memo',
  'Messenger',
  'Actions',
  'Conversation',
  'Macros',
  'Total',
  'Contact',
  'Email',
]);

const leaves = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  );
const at = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

describe.each(BLOCKS)('GOTCHU.%s', block => {
  const enLeaves = leaves(en.GOTCHU[block]);
  it.each([
    ['de', de],
    ['fr', fr],
    ['vi', vi],
  ])('exists and is translated in %s', (_, locale) => {
    const untranslated = enLeaves.filter(([path, value]) => {
      const other = at(locale.GOTCHU[block], path);
      return other === undefined || (other === value && !SAME.has(value));
    });
    expect(untranslated).toEqual([]);
  });
});
