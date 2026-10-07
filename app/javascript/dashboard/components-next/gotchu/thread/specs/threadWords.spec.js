import { withFullI18n } from 'test-i18n';
import {
  bylineFor,
  timelineSentence,
  dayLabel,
  isGotchuNote,
  channelWord,
} from '../threadWords';

const { t } = withFullI18n().global;
const out = { messageType: 1, private: false, sender: { name: 'Anna' } };

describe('bylineFor', () => {
  it.each([
    [
      { sentBy: 'agent', edited: false, version: 1, author: 'model' },
      'Anna · sent Gotchu’s draft v1 unedited',
    ],
    [
      { sentBy: 'agent', edited: true, version: 1, author: 'human' },
      'Anna · sent Gotchu’s draft v1, edited',
    ],
    [
      { sentBy: 'auto', edited: false, version: 2, author: 'model' },
      'Gotchu · sent draft v2 on its own',
    ],
    [
      { auto: true, edited: false, version: 2 },
      'Gotchu · sent draft v2 on its own',
    ],
    [
      { auto: false, edited: true, version: 3 },
      'Anna · sent Gotchu’s draft v3, edited',
    ],
  ])('words a sent draft from edited and auto: %j', (sentDraft, text) => {
    expect(
      bylineFor({ message: out, sentDraft, channelWord: 'Email', t }).text
    ).toBe(text);
  });
  it('never reads author as edited', () => {
    expect(
      bylineFor({
        message: out,
        sentDraft: {
          sentBy: 'agent',
          edited: false,
          version: 1,
          author: 'human',
        },
        channelWord: 'Email',
        t,
      }).text
    ).toBe('Anna · sent Gotchu’s draft v1 unedited');
  });
  it('names a plain outgoing reply by its sender only', () => {
    expect(
      bylineFor({ message: out, sentDraft: null, channelWord: 'Email', t }).text
    ).toBe('Anna');
  });
  it('leaves the channel out when there is none to name', () => {
    expect(
      bylineFor({
        message: { messageType: 0, sender: { name: 'Sabine K.' } },
        sentDraft: null,
        channelWord: null,
        t,
      }).text
    ).toBe('Sabine K. · customer');
  });
  it('words a customer message with the channel', () => {
    expect(
      bylineFor({
        message: { messageType: 0, sender: { name: 'Sabine K.' } },
        sentDraft: null,
        channelWord: 'Email',
        t,
      }).text
    ).toBe('Sabine K. · customer · Email');
  });
  it('locks a private note', () => {
    expect(
      bylineFor({
        message: { ...out, private: true },
        sentDraft: null,
        channelWord: 'Email',
        t,
      })
    ).toEqual({ text: 'Anna · private note', lock: true });
  });
  it('says someone when the sender has no name', () => {
    expect(
      bylineFor({
        message: { messageType: 1, private: false },
        sentDraft: null,
        channelWord: null,
        t,
      }).text
    ).toBe('Someone');
  });
});

describe('timelineSentence', () => {
  it.each([
    [
      { kind: 'drafted', version: 1, procedureTitle: 'Where is my order' },
      'Gotchu matched “Where is my order” and drafted a reply',
    ],
    [
      { kind: 'drafted', version: 1, procedureTitle: null },
      'Gotchu drafted a reply',
    ],
    [{ kind: 'redrafted', version: 2 }, 'Gotchu redrafted the reply as v2'],
    [{ kind: 'redrafted' }, 'Gotchu redrafted the reply'],
    [
      { kind: 'auto_scheduled', version: 1 },
      'Gotchu scheduled v1 to send on its own',
    ],
    [
      { kind: 'auto_scheduled' },
      'Gotchu scheduled the draft to send on its own',
    ],
    [{ kind: 'auto_sent', version: 1 }, 'Gotchu sent v1 on its own'],
    [{ kind: 'auto_sent' }, 'Gotchu sent the draft on its own'],
    [{ kind: 'auto_stopped' }, 'Sending on its own was stopped'],
    [
      { kind: 'handed_over', procedureTitle: 'Refund request' },
      '“Refund request” hands this over to a person',
    ],
    [
      { kind: 'handed_over', procedureTitle: null },
      'Gotchu handed this over to a person',
    ],
    [{ kind: 'memo_added' }, 'A memo was added for Gotchu'],
  ])('words %j', (item, sentence) => {
    expect(timelineSentence(item, t)).toBe(sentence);
  });
  it('drops a kind this build does not know', () => {
    expect(timelineSentence({ kind: 'future_thing' }, t)).toBeNull();
  });
});

describe('dayLabel', () => {
  const now = new Date(2026, 9, 6, 15, 0);
  it('says today and yesterday', () => {
    expect(dayLabel(new Date(2026, 9, 6, 9, 0), now, t, 'en-GB')).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 5, 23, 0), now, t, 'en-GB')).toBe(
      'Yesterday'
    );
  });
  it('names an older day by weekday and date', () => {
    // 2026-09-30 is a Wednesday.
    expect(dayLabel(new Date(2026, 8, 30), now, t, 'en-GB')).toMatch(
      /^Wed 30 Sept?$/
    );
    expect(dayLabel(new Date(2026, 8, 30), now, t, 'de')).toMatch(
      /^Mi\., 30\. Sept?\.$/
    );
    expect(dayLabel(new Date(2026, 8, 30), now, t, 'fr')).toMatch(
      /^mer\. 30 sept?\.$/
    );
  });
});

describe('isGotchuNote', () => {
  it('is true only for a note the gateway marked', () => {
    expect(
      isGotchuNote({ private: true, contentAttributes: { gotchuNote: true } })
    ).toBe(true);
    expect(isGotchuNote({ private: true, sender: { name: 'Gotchu' } })).toBe(
      false
    );
    expect(
      isGotchuNote({ private: false, contentAttributes: { gotchuNote: true } })
    ).toBe(false);
  });
});

describe('channelWord', () => {
  it.each([
    ['email', 'Email'],
    ['messenger', 'Messenger'],
    ['web', 'Web chat'],
    ['other', null],
    [null, null],
    [undefined, null],
  ])('words %j as %j', (channel, word) => {
    expect(channelWord(channel, t)).toBe(word);
  });
});
