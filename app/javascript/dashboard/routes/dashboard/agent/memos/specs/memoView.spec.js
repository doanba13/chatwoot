import { originLabel, kindLabel, memoBody, proposalStores } from '../memoView';

const agents = { 12: { name: 'Anna' }, 13: { name: 'Ben' } };
const t = key => key;
const memo = (origin, editedBy = null, expiresAt = null) => ({
  kind: 'standing_fact',
  origin,
  editedBy,
  expiresAt,
});

describe('originLabel', () => {
  it('names a person and the conversation they taught it in', () => {
    expect(
      originLabel(
        memo({
          source: 'instruction',
          author: 'chatwoot:12',
          conversationId: 4471,
        }),
        agents,
        t
      )
    ).toEqual({
      key: 'GOTCHU_AGENT.MEMO.FROM_CONVERSATION',
      params: { name: 'Anna' },
    });
  });
  it('names a nightly proposal and who confirmed it', () => {
    expect(
      originLabel(
        memo({
          source: 'proposal',
          author: 'chatwoot:12',
          conversationId: null,
        }),
        agents,
        t
      )
    ).toEqual({
      key: 'GOTCHU_AGENT.MEMO.FROM_PROPOSAL',
      params: { name: 'Anna' },
    });
  });
  it('says Added here for a screen memo', () => {
    expect(
      originLabel(
        memo({ source: 'screen', author: 'chatwoot:13', conversationId: null }),
        agents,
        t
      ).key
    ).toBe('GOTCHU_AGENT.MEMO.FROM_SCREEN');
  });
  it('keeps the origin and adds the editor after an edit', () => {
    expect(
      originLabel(
        memo(
          { source: 'instruction', author: 'chatwoot:12', conversationId: 1 },
          'chatwoot:13'
        ),
        agents,
        t
      )
    ).toEqual({
      key: 'GOTCHU_AGENT.MEMO.FROM_CONVERSATION_EDITED',
      params: { name: 'Anna', editor: 'Ben' },
    });
  });
  it('shows a Lark-era author as via Lark, never a raw id', () => {
    expect(
      originLabel(
        memo({ source: 'instruction', author: 'ou_7d1f', conversationId: 1 }),
        agents,
        t
      )
    ).toEqual({ key: 'GOTCHU_AGENT.MEMO.FROM_CONVERSATION_LARK', params: {} });
  });
  // The drive read "Proposed nightly, confirmed by via Lark": a Lark-era
  // confirmer has no name here, so the sentence must not need one.
  it('words a proposal confirmed in Lark without a name', () => {
    expect(
      originLabel(
        memo({ source: 'proposal', author: 'ou_7d1f', conversationId: null }),
        agents,
        t
      )
    ).toEqual({ key: 'GOTCHU_AGENT.MEMO.FROM_PROPOSAL_LARK', params: {} });
  });
  it('keeps a Lark origin nameless after an edit, and names the editor', () => {
    expect(
      originLabel(
        memo(
          { source: 'proposal', author: 'ou_7d1f', conversationId: null },
          'chatwoot:13'
        ),
        agents,
        t
      )
    ).toEqual({
      key: 'GOTCHU_AGENT.MEMO.FROM_PROPOSAL_LARK_EDITED',
      params: { editor: 'Ben' },
    });
  });
  it('names a command-line author by the name after cli:', () => {
    expect(
      originLabel(
        memo({ source: 'screen', author: 'cli:ops', conversationId: null }),
        agents,
        t
      ).params.name
    ).toBe('ops');
  });
  it('shows the nightly job as itself', () => {
    expect(
      originLabel(
        memo({
          source: 'proposal',
          author: 'system:propose-memos',
          conversationId: null,
        }),
        agents,
        t
      ).key
    ).toBe('GOTCHU_AGENT.MEMO.FROM_PROPOSAL_AUTO');
  });
});

describe('kindLabel', () => {
  it('adds the until date', () => {
    expect(
      kindLabel(memo({ source: 'screen' }, null, '2026-12-16T23:59:59.999Z'))
    ).toEqual({
      key: 'GOTCHU_AGENT.MEMO.KIND_UNTIL',
      params: { kind: 'GOTCHU_AGENT.MEMO.KIND.STANDING_FACT', date: '16 Dec' },
    });
  });
});

describe('memoBody', () => {
  it('sends until as the date the user picked', () => {
    expect(
      memoBody({
        text: ' x ',
        kind: 'style',
        scope: { storeKey: 'giftera', inboxId: 6 },
        until: '2026-12-16',
      })
    ).toEqual({
      text: 'x',
      kind: 'style',
      scope: { store_key: 'giftera', inbox_id: 6 },
      until: '2026-12-16',
    });
  });
});

describe('proposalStores', () => {
  it('words the empty store key as all stores, never a blank', () => {
    expect(proposalStores(['', 'giftera'], t)).toBe(
      'GOTCHU_AGENT.SCOPE.ALL_STORES, giftera'
    );
  });
});
