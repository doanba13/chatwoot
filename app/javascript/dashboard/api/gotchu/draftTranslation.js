/* global axios */

import ApiClient from '../ApiClient';

/**
 * The supporter-facing translation of the current draft version.
 *
 *   GET /api/v1/accounts/:account_id/conversations/:conversation_id/ai_draft_translation
 *
 * Answers 409 `stale` when the version asked for is no longer the latest. The
 * translation is for reading only; nothing that sends reads it.
 */
class DraftTranslationAPI extends ApiClient {
  constructor() {
    super('conversations', { accountScoped: true });
  }

  getTranslation(conversationId, { cycleId, version, target }) {
    return axios.get(`${this.url}/${conversationId}/ai_draft_translation`, {
      params: { cycle_id: cycleId, version, target_language: target },
    });
  }
}

export default new DraftTranslationAPI();
