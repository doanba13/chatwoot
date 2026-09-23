/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Rails proxy in front of the gateway's procedure store
 * (`Gotchu::ProceduresController` / `Gotchu::ProcedureService`, task 10):
 *
 *   GET    /api/v1/accounts/:account_id/gotchu/procedures[?store=<key>]
 *   POST   /api/v1/accounts/:account_id/gotchu/procedures
 *   PATCH  /api/v1/accounts/:account_id/gotchu/procedures/:id
 *   POST   /api/v1/accounts/:account_id/gotchu/procedures/:id/status
 *   GET    /api/v1/accounts/:account_id/gotchu/procedures/:id/bindings
 *   PUT    /api/v1/accounts/:account_id/gotchu/procedures/:id/bindings/:channel
 *   POST   /api/v1/accounts/:account_id/gotchu/procedures/replay
 *
 * Administrators only -- the controller enforces it with its own
 * `before_action`, and the settings routes gate on `permissions:
 * ['administrator']` for the same reason `assemble.ts`'s comment gives
 * elsewhere in this project: the screen should not offer what the API will
 * refuse.
 *
 * There is no `show` route (task 10's `resources :procedures, only:
 * [:index, :create, :update]`), so a single procedure is read by listing and
 * finding by id -- see EditProcedure.vue.
 *
 * The actor never travels from here. Every write is attributed server-side
 * from the session (`Current.user`), the same rule `aiDraft.js`'s `instruct`
 * already follows; a body field claiming one would be ignored by the
 * controller regardless (procedures_controller_spec.rb's "takes the actor
 * from the session, never from the body").
 */
class ProceduresAPI extends ApiClient {
  constructor() {
    super('gotchu/procedures', { accountScoped: true });
  }

  // create(data) and update(id, data) are inherited from ApiClient -- POST
  // and PATCH respectively, matching the routes above. `update` sends no
  // `slug`: the controller ignores one if sent (the slug is identity and
  // cannot change on a revision), and offering the field on the edit form
  // would only invite a refusal nobody could explain.

  /**
   * `store` narrows the result to that store plus every global procedure --
   * the same scoping `?store=<key>` gives the controller. Omitted lists
   * every procedure, any store, which is what the settings screen's own
   * overview wants.
   */
  list(store) {
    return axios.get(this.url, { params: store ? { store } : {} });
  }

  /** testing | active | archived. */
  changeStatus(id, status) {
    return axios.post(`${this.url}/${id}/status`, { status });
  }

  /**
   * One row per channel currently bound -- a channel absent from the array
   * is off (there is no `off` tier value, see ChannelTiers.vue).
   */
  bindings(id) {
    return axios.get(`${this.url}/${id}/bindings`);
  }

  /**
   * `tier` is 'draft' | 'auto' | null -- null turns the channel off.
   * `expectedVersion` is the procedure revision the edit screen had loaded
   * when this row was changed; ChannelTiers.vue always sends the one it
   * loaded, so a write against a procedure someone else has since revised
   * is refused (409) rather than silently landing on top of it. Never
   * `version` or `authorisedVersion` -- the gateway derives and stamps the
   * authorised version itself when raising a channel to auto.
   */
  setBinding(id, channel, { tier, expectedVersion }) {
    return axios.put(`${this.url}/${id}/bindings/${channel}`, {
      tier,
      expected_version: expectedVersion,
    });
  }

  /**
   * Match counts over the last N days, scored over the whole procedure set.
   * `procedureId` narrows `byProcedure` to that one procedure's own count;
   * `byResolution` stays over the full set either way -- see
   * `apps/gateway/src/procedures.ts`'s own doc comment on `handleReplay` in
   * the sibling repo.
   */
  replay({ days, storeKey, procedureId } = {}) {
    return axios.post(`${this.url}/replay`, {
      days,
      store_key: storeKey,
      procedure_id: procedureId,
    });
  }
}

export default new ProceduresAPI();
