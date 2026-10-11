import {
  findUndeliveredMessage,
  createTemporaryMessage,
  getNonDeletedMessages,
  withoutEmailCollectLeadIn,
} from '../../conversation/helpers';

describe('#findUndeliveredMessage', () => {
  it('returns message objects if exist', () => {
    const conversation = {
      1: {
        id: 1,
        content: 'Hello',
        status: 'in_progress',
      },
      2: {
        id: 2,
        content: 'Hello',
        status: 'sent',
      },
      3: {
        id: 3,
        content: 'How may I help you',
        status: 'sent',
      },
    };
    expect(
      findUndeliveredMessage(conversation, { content: 'Hello' })
    ).toStrictEqual([{ id: 1, content: 'Hello', status: 'in_progress' }]);
  });
});

describe('#createTemporaryMessage', () => {
  it('returns message object', () => {
    const message = createTemporaryMessage({ content: 'hello' });
    expect(message.content).toBe('hello');
    expect(message.status).toBe('in_progress');
  });
  it('returns message object with reply to', () => {
    const message = createTemporaryMessage({
      content: 'hello',
      replyTo: 124,
    });
    expect(message.content).toBe('hello');
    expect(message.status).toBe('in_progress');
    expect(message.replyTo).toBe(124);
  });
});

describe('#getNonDeletedMessages', () => {
  it('returns non-deleted messages', () => {
    const messages = [
      {
        id: 1,
        content: 'Hello',
        content_attributes: {},
      },
      {
        id: 2,
        content: 'Hey',
        content_attributes: { deleted: true },
      },
      {
        id: 3,
        content: 'How may I help you',
        content_attributes: {},
      },
    ];
    expect(getNonDeletedMessages({ messages })).toStrictEqual([
      {
        id: 1,
        content: 'Hello',
        content_attributes: {},
      },
      {
        id: 3,
        content: 'How may I help you',
        content_attributes: {},
      },
    ]);
  });
});

describe('#withoutEmailCollectLeadIn', () => {
  const greeting = { id: 1, message_type: 3, content: 'We reply in hours' };
  const leadIn = { id: 2, message_type: 3, content: 'Give the team a way' };
  const prompt = {
    id: 3,
    message_type: 3,
    content_type: 'input_email',
    content: 'Get notified by email',
  };

  it('drops the template text right before the email prompt', () => {
    expect(withoutEmailCollectLeadIn([greeting, leadIn, prompt])).toEqual([
      greeting,
      prompt,
    ]);
  });

  it('keeps a template text that is not followed by the email prompt', () => {
    const reply = { id: 4, message_type: 1, content: 'Hello' };
    expect(withoutEmailCollectLeadIn([greeting, reply])).toEqual([
      greeting,
      reply,
    ]);
  });

  it('keeps an agent message right before the email prompt', () => {
    const reply = { id: 4, message_type: 1, content: 'Hello' };
    expect(withoutEmailCollectLeadIn([reply, prompt])).toEqual([reply, prompt]);
  });
});
