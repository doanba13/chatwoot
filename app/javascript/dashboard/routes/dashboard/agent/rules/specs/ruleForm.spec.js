import {
  emptyForm,
  toBody,
  factOptions,
  localProblems,
  formFromRule,
} from '../ruleForm';

const facts = [
  {
    name: 'language',
    ops: ['in'],
    valueType: 'enum',
    values: ['de', 'fr', 'en'],
    origin: 'customer_text',
  },
  {
    name: 'channel',
    ops: ['in'],
    valueType: 'enum',
    values: ['email', 'messenger', 'web'],
    origin: 'chatwoot',
  },
  {
    name: 'order_age_days',
    ops: ['gt', 'lt'],
    valueType: 'number',
    min: 0,
    origin: 'shopify',
  },
  {
    name: 'customer_order_count',
    ops: ['gte'],
    valueType: 'number',
    min: 2,
    max: 10,
    origin: 'shopify',
  },
];

describe('ruleForm', () => {
  it('builds the gateway body with scope in camelCase and conditions under all', () => {
    const form = {
      ...emptyForm(),
      title: 'T',
      say: 'S',
      sending: 'no_change',
      conditions: [{ fact: 'channel', op: 'in', value: ['messenger'] }],
      scope: { storeKey: 'cadeauniq', inboxId: 3, exceptInboxIds: [] },
    };
    expect(toBody(form)).toEqual({
      title: 'T',
      say: 'S',
      sending: 'no_change',
      conditions: {
        v: 1,
        all: [{ fact: 'channel', op: 'in', value: ['messenger'] }],
      },
      scope: { store_key: 'cadeauniq', inbox_id: 3, except_inbox_ids: [] },
    });
  });

  it('sends a blank say as null, so a sending-only rule is a real rule', () => {
    expect(
      toBody({ ...emptyForm(), say: '   ', sending: 'hand_over' }).say
    ).toBeNull();
  });

  it('refuses language with a sending effect, before any request', () => {
    const form = {
      ...emptyForm(),
      title: 'T',
      sending: 'never_auto',
      conditions: [{ fact: 'language', op: 'in', value: ['fr'] }],
    };
    expect(localProblems(form, facts)).toContain(
      'GOTCHU_AGENT.RULE.PROBLEM_TEXT_DERIVED'
    );
  });

  it('disables the language fact while sending is not No change, with the reason', () => {
    const t = k => k;
    const te = () => true;
    const language = factOptions(facts, 'hand_over', t, te).find(
      o => o.value === 'language'
    );
    expect(language).toMatchObject({
      label: 'GOTCHU_AGENT.RULE.FACTS.LANGUAGE',
      disabled: true,
      reasonKey: 'GOTCHU_AGENT.RULE.LANGUAGE_NEEDS_NO_CHANGE',
    });
    expect(
      factOptions(facts, 'no_change', t, te).find(o => o.value === 'language')
        .disabled
    ).toBe(false);
  });

  // The drive saved a rule with an empty condition row and got the gateway's
  // raw "all.0.fact: unknown fact" back. A row with no fact, or a list with
  // no value, is named here and keeps Save disabled.
  it.each([
    [{ fact: '', op: '', value: [] }],
    [{ fact: 'channel', op: 'in', value: [] }],
  ])('refuses an unfinished condition %j', condition => {
    expect(
      localProblems(
        { ...emptyForm(), title: 'T', say: 'S', conditions: [condition] },
        facts
      )
    ).toContain('GOTCHU_AGENT.RULE.PROBLEM_INCOMPLETE_CONDITION');
  });

  it('accepts a finished condition, number and list alike', () => {
    expect(
      localProblems(
        {
          ...emptyForm(),
          title: 'T',
          say: 'S',
          conditions: [
            { fact: 'channel', op: 'in', value: ['email'] },
            { fact: 'order_age_days', op: 'gt', value: 0 },
          ],
        },
        facts
      )
    ).toEqual([]);
  });

  it('refuses a rule that does nothing', () => {
    expect(
      localProblems(
        { ...emptyForm(), title: 'T', say: '', sending: 'no_change' },
        facts
      )
    ).toContain('GOTCHU_AGENT.RULE.PROBLEM_DOES_NOTHING');
  });

  it('keeps customer order count inside the range the store can count', () => {
    const form = {
      ...emptyForm(),
      title: 'T',
      say: 'S',
      conditions: [{ fact: 'customer_order_count', op: 'gte', value: 12 }],
    };
    expect(localProblems(form, facts)).toContain(
      'GOTCHU_AGENT.RULE.PROBLEM_OUT_OF_RANGE'
    );
  });

  it('uses the same fact-neutral problem for any number out of range', () => {
    const form = {
      ...emptyForm(),
      title: 'T',
      say: 'S',
      conditions: [{ fact: 'order_age_days', op: 'gt', value: -1 }],
    };
    expect(localProblems(form, facts)).toContain(
      'GOTCHU_AGENT.RULE.PROBLEM_OUT_OF_RANGE'
    );
  });

  it('round-trips a rule from the gateway into the form', () => {
    const rule = {
      title: 'T',
      say: null,
      sending: 'hand_over',
      version: 3,
      conditions: {
        v: 1,
        all: [{ fact: 'channel', op: 'in', value: ['web'] }],
      },
      scope: { storeKey: null, inboxId: null, exceptInboxIds: [7] },
    };
    expect(formFromRule(rule)).toEqual({
      title: 'T',
      say: '',
      sending: 'hand_over',
      conditions: [{ fact: 'channel', op: 'in', value: ['web'] }],
      scope: { storeKey: null, inboxId: null, exceptInboxIds: [7] },
    });
  });
});
