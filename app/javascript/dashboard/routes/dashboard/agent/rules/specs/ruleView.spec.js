import { withFullI18n } from 'test-i18n';
import { usedLabel, sendingKey, demotedTitle, channelWord } from '../ruleView';

const { t, te } = withFullI18n().global;

describe('ruleView', () => {
  it('names a demoted procedure by its title, and by id only when the title is missing', () => {
    expect(
      demotedTitle({
        procedureId: 7,
        title: 'Where is my order',
        channel: 'email',
      })
    ).toBe('Where is my order');
    expect(demotedTitle({ procedureId: 7, title: '', channel: 'email' })).toBe(
      '#7'
    );
  });
  // The drive's toast read "moved back to Draft on email".
  it.each([
    ['email', 'Email'],
    ['web', 'Web chat'],
    ['sms', 'sms'],
  ])('names the channel %s in words', (channel, word) => {
    expect(channelWord(channel, t, te)).toBe(word);
  });
  it('says "would apply" for a testing rule', () => {
    expect(usedLabel({ status: 'testing', usedLast7d: 4 })).toEqual({
      key: 'GOTCHU_AGENT.RULE.WOULD_APPLY',
      n: 4,
    });
  });
  it('says the plain count for an active rule', () => {
    expect(usedLabel({ status: 'active', usedLast7d: 23 })).toEqual({
      key: 'GOTCHU_AGENT.RULE.USED',
      n: 23,
    });
  });
  it.each([
    ['no_change', 'NO_CHANGE'],
    ['never_auto', 'NEVER_AUTO'],
    ['hand_over', 'HAND_OVER'],
  ])('names %s', (s, k) =>
    expect(sendingKey(s)).toBe(`GOTCHU_AGENT.RULE.SENDING.${k}`)
  );
});
