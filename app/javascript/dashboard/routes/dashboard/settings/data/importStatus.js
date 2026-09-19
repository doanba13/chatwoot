export const POLL_INTERVAL_MS = 5000;

export const ACTIVE_IMPORT_STATUSES = ['pending', 'processing'];

export const isActiveImport = dataImport =>
  ACTIVE_IMPORT_STATUSES.includes(dataImport?.status);

export const isIntercomImport = dataImport =>
  dataImport?.data_type === 'intercom' &&
  dataImport?.source_provider === 'intercom';

export const isIntegrationImport = dataImport =>
  ['freshdesk', 'intercom'].includes(dataImport?.data_type) &&
  dataImport?.data_type === dataImport?.source_provider;

export const isActiveIntercomImport = dataImport =>
  isIntercomImport(dataImport) && isActiveImport(dataImport);

export const isActiveIntegrationImport = dataImport =>
  isIntegrationImport(dataImport) && isActiveImport(dataImport);

export const isAbandonableImport = dataImport =>
  isActiveIntegrationImport(dataImport);

export const importedCount = dataImport => {
  if (!isIntegrationImport(dataImport)) {
    return Number(dataImport?.processed_records || 0);
  }

  return ['contacts', 'conversations', 'messages'].reduce(
    (total, key) => total + Number(dataImport?.stats?.[key]?.imported || 0),
    0
  );
};

export const importStageKey = dataImport => {
  if (!dataImport) return 'unknown';

  if (dataImport.status === 'completed') return 'completed';
  if (dataImport.status === 'completed_with_errors') {
    return 'completed_with_errors';
  }
  if (dataImport.status === 'failed') return 'failed';
  if (dataImport.status === 'abandoned') return 'abandoned';
  if (dataImport.status === 'pending') return 'queued';

  const importTypes = dataImport.import_types?.length
    ? dataImport.import_types
    : [dataImport.data_type];
  const cursor = dataImport.cursor || {};

  if (importTypes.includes('contacts') && !cursor.contacts?.completed) {
    return 'contacts';
  }

  if (
    importTypes.includes('conversations') &&
    !cursor.conversations?.completed
  ) {
    return 'conversations';
  }

  return 'finalizing';
};

export const formatStatus = value => value?.replaceAll('_', ' ') || '-';

export const sourceObjectLabel = record =>
  [record.source_object_type, record.source_object_id]
    .filter(Boolean)
    .join(': ') || '-';

export const formatDate = value => {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

// `pending` and `completed_with_errors` were both amber, which Gotchu retired.
// They do NOT go ink, which is the rule everywhere else: the Gotchu compat block
// remaps `--blue-9` onto ink, so `processing` is already an ink dot, and several
// imports are listed at once — ink here would collapse three of the six states
// into one colour on screen. They take the palette's slate instead, which stays
// apart from `abandoned`'s lighter `slate-9` in both themes.
//
// They remain indistinguishable from EACH OTHER, exactly as they were when both
// were amber: this map has six states and, after the blue→ink remap, five
// distinguishable values to spend. The dot sits beside `formatStatus(status)`,
// so the state is still readable — but splitting them needs a sixth value the
// palette does not have, not a different class here.
const STATUS_DOT_CLASS = {
  pending: 'bg-n-slate-11',
  processing: 'bg-n-blue-9',
  completed: 'bg-n-teal-9',
  completed_with_errors: 'bg-n-slate-11',
  failed: 'bg-n-ruby-9',
  abandoned: 'bg-n-slate-9',
};

export const statusDotClass = status =>
  STATUS_DOT_CLASS[status] || 'bg-n-slate-9';
