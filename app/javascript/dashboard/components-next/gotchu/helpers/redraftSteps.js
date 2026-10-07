/**
 * The three steps a redraft shows while the dock waits for it (spec §2.9).
 *
 * Client-side timings, not stages the backend reports: the worker says nothing
 * until it is done. So the re-read is "under way" for two seconds and then the
 * next version is "being written" for as long as the wait lasts. Writing never
 * turns done here — only the draft read ends the wait, and a step that ticked
 * itself done would claim a draft that does not exist yet.
 */
export const REREAD_MS = 2000;

export const redraftSteps = ({ elapsedMs, orderName, nextVersion }) => {
  const writing = elapsedMs >= REREAD_MS;
  const reread = writing ? 'done' : 'now';
  return [
    { key: 'received', label: 'STEP_RECEIVED', state: 'done', params: {} },
    orderName
      ? {
          key: 'reread',
          label: 'STEP_REREAD_ORDER',
          state: reread,
          params: { order: orderName },
        }
      : { key: 'reread', label: 'STEP_REREAD', state: reread, params: {} },
    {
      key: 'writing',
      label: 'STEP_WRITING',
      state: writing ? 'now' : 'todo',
      params: { version: nextVersion },
    },
  ];
};
