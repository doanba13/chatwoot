import { ref, nextTick } from 'vue';
import {
  setDraftMeta,
  useDraftMeta,
  clearDraftMeta,
} from '../helpers/draftMeta';

describe('draftMeta', () => {
  it('serves the meta of the conversation asked for, and follows a switch', async () => {
    setDraftMeta(1, { lang: 'de', channel: 'email', threadRoutes: true });
    setDraftMeta(2, { lang: 'fr', channel: 'web', threadRoutes: true });
    const id = ref(1);
    const meta = useDraftMeta(id);
    expect(meta.value.lang).toBe('de');
    id.value = 2;
    await nextTick();
    expect(meta.value.lang).toBe('fr');
  });

  it('answers null for a conversation never read', () => {
    expect(useDraftMeta(ref(999)).value).toBeNull();
  });

  it('forgets a cleared conversation', () => {
    setDraftMeta(3, { lang: 'en', channel: 'email', threadRoutes: false });
    clearDraftMeta(3);
    expect(useDraftMeta(ref(3)).value).toBeNull();
  });

  it('merges its two writers rather than letting one erase the other', () => {
    setDraftMeta(4, { threadAvailable: false });
    setDraftMeta(4, { lang: 'de', channel: 'email', threadRoutes: true });
    expect(useDraftMeta(ref(4)).value).toEqual({
      threadAvailable: false,
      lang: 'de',
      channel: 'email',
      threadRoutes: true,
    });
  });
});
