import { draftViewFrom } from '../helpers/draftView';

const base = {
  cycle: { id: 12, state: 'awaiting_review', tier: 'draft', lang: 'de' },
  draft: { version: 1, body: 'Hallo' },
  conversation: { channel: 'email' },
  trace: [
    {
      kind: 'procedure',
      title: 'Where is my order',
      version: 4,
      procedureId: 7,
    },
  ],
};

describe('draftViewFrom §3.1', () => {
  it('reads language, channel and the procedure id', () => {
    expect(draftViewFrom(base)).toMatchObject({
      lang: 'de',
      channel: 'email',
      procedureId: 7,
      threadRoutes: true,
    });
  });

  it('prefers the detected language from the read step over the reply language', () => {
    expect(
      draftViewFrom({
        ...base,
        trace: [...base.trace, { kind: 'read', lang: 'fr' }],
      }).lang
    ).toBe('fr');
  });

  it('shows no draft once a person answered and the cycle is superseded', () => {
    expect(
      draftViewFrom({ ...base, cycle: { ...base.cycle, state: 'superseded' } })
    ).toMatchObject({ state: 'none', text: '' });
  });

  it('reads an older gateway as no language, no channel and no thread routes', () => {
    const { conversation, ...old } = base;
    expect(
      draftViewFrom({
        ...old,
        cycle: { id: 12, state: 'awaiting_review' },
        trace: [{ kind: 'procedure', title: 'X' }],
      })
    ).toMatchObject({
      lang: null,
      channel: null,
      procedureId: null,
      threadRoutes: false,
    });
  });

  it('drops values outside the contract rather than showing them', () => {
    expect(
      draftViewFrom({
        ...base,
        cycle: { ...base.cycle, lang: 'es' },
        conversation: { channel: 'sms' },
      })
    ).toMatchObject({ lang: null, channel: null, threadRoutes: true });
  });

  it('says the gateway has thread routes even when there is no cycle', () => {
    expect(
      draftViewFrom({
        cycle: null,
        draft: null,
        trace: [],
        conversation: { channel: 'web' },
      })
    ).toMatchObject({ channel: 'web', threadRoutes: true, lang: null });
  });
});
