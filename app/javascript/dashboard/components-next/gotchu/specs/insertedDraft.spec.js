import {
  forgetInsertedDraft,
  insertedDraftFor,
  rememberInsertedDraft,
  stampSendPayload,
} from '../helpers/insertedDraft';

// The module holds a plain, module-level Map, so every test cleans up the
// ids it touches rather than relying on any reset the module itself
// provides — there isn't one, and there should not be: a "clear everything"
// export would exist only for tests, not for anything Insert or Send needs.
afterEach(() => {
  [1, 2, 3580, 4471, 9999].forEach(forgetInsertedDraft);
});

describe('insertedDraft', () => {
  describe('remember / forget / read', () => {
    it('returns null for a conversation nothing was ever remembered for', () => {
      expect(insertedDraftFor(9999)).toBeNull();
    });

    it('returns exactly what was remembered', () => {
      rememberInsertedDraft(3580, { cycleId: 10, draftVersion: 2 });

      expect(insertedDraftFor(3580)).toEqual({ cycleId: 10, draftVersion: 2 });
    });

    it('keeps conversations isolated from one another', () => {
      rememberInsertedDraft(1, { cycleId: 10, draftVersion: 1 });
      rememberInsertedDraft(2, { cycleId: 20, draftVersion: 5 });

      expect(insertedDraftFor(1)).toEqual({ cycleId: 10, draftVersion: 1 });
      expect(insertedDraftFor(2)).toEqual({ cycleId: 20, draftVersion: 5 });
      expect(insertedDraftFor(3)).toBeNull();
    });

    it('forgetting one conversation does not touch another', () => {
      rememberInsertedDraft(1, { cycleId: 10, draftVersion: 1 });
      rememberInsertedDraft(2, { cycleId: 20, draftVersion: 5 });

      forgetInsertedDraft(1);

      expect(insertedDraftFor(1)).toBeNull();
      expect(insertedDraftFor(2)).toEqual({ cycleId: 20, draftVersion: 5 });
    });

    it('forgetting a conversation nothing was remembered for is a no-op', () => {
      expect(() => forgetInsertedDraft(9999)).not.toThrow();
      expect(insertedDraftFor(9999)).toBeNull();
    });

    it('a later remember replaces the earlier one, it does not merge with it', () => {
      rememberInsertedDraft(3580, { cycleId: 10, draftVersion: 1 });
      rememberInsertedDraft(3580, { cycleId: 10, draftVersion: 2 });

      expect(insertedDraftFor(3580)).toEqual({ cycleId: 10, draftVersion: 2 });
    });
  });

  describe('stampSendPayload', () => {
    it('returns the payload unchanged when nothing is remembered', () => {
      const payload = { conversationId: 4471, message: 'hi', private: false };

      const result = stampSendPayload(4471, payload);

      expect(result).toBe(payload); // same reference, not just equal
      expect(result.contentAttributes).toBeUndefined();
    });

    it('stamps content_attributes.gotchu when a draft is remembered', () => {
      rememberInsertedDraft(4471, { cycleId: 55, draftVersion: 2 });
      const payload = {
        conversationId: 4471,
        message: 'edited draft text',
        private: false,
      };

      const result = stampSendPayload(4471, payload);

      expect(result.contentAttributes).toEqual({
        gotchu: { cycleId: 55, draftVersion: 2 },
      });
      // The rest of the payload is preserved.
      expect(result.message).toBe('edited draft text');
    });

    it('merges into an existing contentAttributes rather than clobbering it', () => {
      rememberInsertedDraft(4471, { cycleId: 9, draftVersion: 1 });
      const payload = {
        conversationId: 4471,
        message: 'a reply',
        private: false,
        contentAttributes: { in_reply_to: 123 },
      };

      const result = stampSendPayload(4471, payload);

      expect(result.contentAttributes).toEqual({
        in_reply_to: 123,
        gotchu: { cycleId: 9, draftVersion: 1 },
      });
    });

    it('stamps only the conversation a draft is remembered for', () => {
      rememberInsertedDraft(4471, { cycleId: 9, draftVersion: 1 });
      const payloadForAnotherConversation = {
        conversationId: 9999,
        message: 'unrelated',
        private: false,
      };

      const result = stampSendPayload(9999, payloadForAnotherConversation);

      expect(result.contentAttributes).toBeUndefined();
    });

    it('does not mutate the payload it was given', () => {
      rememberInsertedDraft(4471, { cycleId: 9, draftVersion: 1 });
      const payload = { conversationId: 4471, message: 'hi', private: false };

      stampSendPayload(4471, payload);

      expect(payload.contentAttributes).toBeUndefined();
    });
  });
});
