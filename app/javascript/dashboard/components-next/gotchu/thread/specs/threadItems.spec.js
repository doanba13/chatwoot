import { threadItems } from '../threadItems';

const at = (y, m, d, h, min) => new Date(y, m, d, h, min);
const msg = (id, date) => ({
  id,
  createdAt: Math.floor(date.getTime() / 1000),
});

describe('threadItems', () => {
  it('opens each day with a separator and interleaves Gotchu lines by time', () => {
    const items = threadItems({
      messages: [
        msg(1, at(2026, 8, 30, 9, 12)),
        msg(2, at(2026, 8, 30, 9, 31)),
        msg(3, at(2026, 9, 6, 10, 2)),
      ],
      timeline: [
        {
          at: at(2026, 8, 30, 9, 15).toISOString(),
          kind: 'drafted',
          version: 1,
        },
      ],
    });
    expect(
      items.map(i => (i.type === 'message' ? `m${i.message.id}` : i.type))
    ).toEqual(['day', 'm1', 'gotchu', 'm2', 'day', 'm3']);
  });
  it('puts a Gotchu line after a message in the same second', () => {
    const d = at(2026, 9, 6, 10, 2);
    const items = threadItems({
      messages: [msg(3, d)],
      timeline: [{ at: d.toISOString(), kind: 'drafted' }],
    });
    expect(items.map(i => i.type)).toEqual(['day', 'message', 'gotchu']);
  });
  it('drops a timeline item it cannot place in time', () => {
    expect(
      threadItems({
        messages: [],
        timeline: [{ at: 'yesterday', kind: 'drafted' }],
      })
    ).toEqual([]);
  });
  it('renders messages alone when there is no timeline', () => {
    expect(
      threadItems({
        messages: [msg(1, at(2026, 9, 6, 9, 0))],
        timeline: [],
      }).map(i => i.type)
    ).toEqual(['day', 'message']);
  });
  it('tolerates missing messages and timeline', () => {
    expect(threadItems({})).toEqual([]);
  });
  it('keys items as specified', () => {
    const d = at(2026, 9, 6, 9, 0);
    const items = threadItems({
      messages: [msg(7, d)],
      timeline: [{ at: d.toISOString(), kind: 'drafted', version: 1 }],
    });
    expect(items.map(i => i.key)).toEqual([
      'day-2026-10-06',
      'msg-7',
      `g-${d.toISOString()}-drafted-1`,
    ]);
  });
  it('gives every item a stable, unique key', () => {
    const d = at(2026, 9, 6, 9, 0).toISOString();
    const keys = threadItems({
      messages: [],
      timeline: [
        { at: d, kind: 'drafted', version: 1 },
        { at: d, kind: 'auto_scheduled', version: 1 },
      ],
    }).map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('skips a timeline kind it does not know, so no empty day opens', () => {
    expect(
      threadItems({
        messages: [],
        timeline: [{ at: at(2026, 9, 6, 9, 0).toISOString(), kind: 'future' }],
      })
    ).toEqual([]);
  });
  it('skips a timeline item with no time instead of dating it 1970', () => {
    expect(
      threadItems({ messages: [], timeline: [{ at: null, kind: 'drafted' }] })
    ).toEqual([]);
  });
  it('keeps a message with no usable time and still sorts the rest', () => {
    const items = threadItems({
      messages: [
        { id: 1, createdAt: undefined },
        msg(2, at(2026, 9, 6, 9, 0)),
        msg(3, at(2026, 9, 6, 8, 0)),
      ],
      timeline: [],
    });
    expect(
      items.filter(i => i.type === 'message').map(i => i.message.id)
    ).toEqual([3, 2, 1]);
  });
});
