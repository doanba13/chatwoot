import { formatDistance } from 'date-fns';

// What the order drawer says, from the PanelContext the gateway's /api/context
// returns (the same body the order panel reads). Pure: no store, no network.
//
// Invariant 3: an ambiguous match shows the candidates and says none was
// picked; it never carries one order's details. A missing field says WHY
// (piiDenied, no tracking, degraded live read), never a blank. Shopify's
// FulfillmentStatus is never shown, only ShippingView.state.

// The fifth hand-maintained shipping-state table. The other four are
// SHIPPING_STATES in packages/core/src/context/views.ts, panel.js's
// SHIPPING_LABEL and SHIPPING_TONE, and the reply prompt's wording
// (CLAUDE.md gotcha: "ShippingState has four hand-maintained tables in three
// languages; add to SHIPPING_STATES first"). A state this table lacks words as
// STATE.UNKNOWN, as invariant 23 does for 17track.
const stateWord = (state, t, te) => {
  const key = `GOTCHU.DRAWER.STATE.${String(state ?? '').toUpperCase()}`;
  return te(key) ? t(key) : t('GOTCHU.DRAWER.STATE.UNKNOWN');
};

const LANG_WORDS = {
  de: t => t('GOTCHU.TRACE.LANG.DE'),
  fr: t => t('GOTCHU.TRACE.LANG.FR'),
  en: t => t('GOTCHU.TRACE.LANG.EN'),
};

const joined = parts => parts.filter(Boolean).join(' · ');

const money = (amount, currency) => {
  const n = Number(amount);
  if (amount == null || Number.isNaN(n)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(n);
  } catch {
    return String(amount);
  }
};

const day = (iso, locale) => {
  const ms = Date.parse(iso);
  if (!iso || Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(ms);
};

const maskTracking = number => {
  if (!number) return null;
  return number.length > 12
    ? `${number.slice(0, 6)}…${number.slice(-4)}`
    : number;
};

const initialsOf = name => {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return null;
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
};

const addressLine = a =>
  a
    ? joined([
        a.line1,
        a.line2,
        joined([a.zip, a.city]).replace(' · ', ' '),
        a.country || a.countryCode,
      ])
    : null;

const row = (k, v) => (v ? { k, v } : null);

const customerCard = (ctx, order, { t, lang }) => {
  const c = ctx.customer?.status === 'ok' ? ctx.customer.data : null;
  const name = c?.name ?? order.shippingAddress?.name ?? null;
  const language = LANG_WORDS[String(lang ?? '').toLowerCase()]?.(t) ?? null;
  const place = joined([order.displayCity, order.displayCountryCode]).replace(
    ' · ',
    ', '
  );
  const hidden = order.piiDenied === true;
  const rows = [
    hidden ? null : row(t('GOTCHU.DRAWER.EMAIL'), c?.email ?? order.email),
    hidden ? null : row(t('GOTCHU.DRAWER.PHONE'), c?.phone ?? order.phone),
    hidden
      ? null
      : row(t('GOTCHU.DRAWER.SHIP_TO'), addressLine(order.shippingAddress)),
    c
      ? row(
          t('GOTCHU.DRAWER.ORDERS'),
          t('GOTCHU.DRAWER.ORDERS_VALUE', {
            count: c.ordersCount,
            total: money(c.totalSpent, c.currency) ?? c.totalSpent,
          })
        )
      : null,
  ].filter(Boolean);
  return {
    name,
    initials: initialsOf(name),
    subline: joined([language, place]),
    rows,
    piiNotice: hidden ? t('GOTCHU.DRAWER.PII_HIDDEN') : null,
  };
};

// The fixed reasons the 17track provider renders (DEGRADED_REASON in
// seventeentrack/types.ts, plus 'no carrier data'); anything else, including
// token and error, gets the generic phrase.
const degradedWord = (reason, t) => {
  switch (reason) {
    case 'registering':
      return t('GOTCHU.DRAWER.DEGRADED_REGISTERING');
    case 'number not recognised':
      return t('GOTCHU.DRAWER.DEGRADED_NOT_RECOGNISED');
    case 'quota':
      return t('GOTCHU.DRAWER.DEGRADED_QUOTA');
    case 'no carrier data':
      return t('GOTCHU.DRAWER.DEGRADED_NO_DATA');
    default:
      return t('GOTCHU.DRAWER.DEGRADED');
  }
};

const shippingNotice = (s, t) => {
  if (s.degradedReason) return degradedWord(s.degradedReason, t);
  if (!s.shipped) return t('GOTCHU.DRAWER.NOT_SHIPPED');
  if (!s.trackingNumber) return t('GOTCHU.DRAWER.NO_TRACKING');
  return null;
};

const shippingCard = (s, order, { t, te, now, locale }) => {
  const steps = [
    {
      key: 'ordered',
      label: t('GOTCHU.DRAWER.ORDERED'),
      detail: day(order.createdAt, locale),
      done: true,
    },
    {
      key: 'shipped',
      label: s.carrier
        ? t('GOTCHU.DRAWER.SHIPPED_WITH', { carrier: s.carrier })
        : t('GOTCHU.DRAWER.SHIPPED'),
      detail:
        joined([day(s.shippedAt, locale), maskTracking(s.trackingNumber)]) ||
        null,
      done: !!s.shipped,
    },
    s.lastScanAt && {
      key: 'scan',
      label: s.lastScanLocation
        ? t('GOTCHU.DRAWER.LAST_SCAN_AT', { place: s.lastScanLocation })
        : t('GOTCHU.DRAWER.LAST_SCAN'),
      detail: day(s.lastScanAt, locale),
      done: true,
    },
    {
      key: 'delivered',
      label: t('GOTCHU.DRAWER.DELIVERED'),
      detail: day(s.deliveredAt, locale),
      done: !!s.deliveredAt,
    },
  ].filter(Boolean);
  const live = s.source === '17track' && s.syncedAt;
  return {
    stateWord: stateWord(s.state, t, te),
    steps,
    checked: live
      ? t('GOTCHU.DRAWER.CHECKED_AGO', {
          ago: formatDistance(Date.parse(s.syncedAt), now, { addSuffix: true }),
        })
      : t('GOTCHU.DRAWER.NOT_CHECKED_LIVE'),
    notice: shippingNotice(s, t),
  };
};

const FINANCIAL_KEYS = [
  'PAID',
  'PENDING',
  'AUTHORIZED',
  'PARTIALLY_PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'VOIDED',
];

const financialWord = (status, t) => {
  const key = String(status ?? '').toUpperCase();
  return FINANCIAL_KEYS.includes(key)
    ? t(`GOTCHU.DRAWER.FINANCIAL.${key}`)
    : String(status ?? '')
        .toLowerCase()
        .replace(/_/g, ' ');
};

const refundPhrase = (refund, order, t) => {
  if (refund?.status !== 'ok') return null;
  const r = refund.data;
  const amount = v => money(v, order.currency) ?? v;
  const none = Number(r.shopifyTotal) === 0;
  switch (r.state) {
    case 'match':
      return none
        ? t('GOTCHU.DRAWER.REFUND.NONE')
        : t('GOTCHU.DRAWER.REFUND.MATCH', { amount: amount(r.shopifyTotal) });
    case 'paypal_ahead':
      return t('GOTCHU.DRAWER.REFUND.PAYPAL_AHEAD', {
        paypal: amount(r.paypalTotal),
        shopify: amount(r.shopifyTotal),
      });
    case 'shopify_ahead':
      return t('GOTCHU.DRAWER.REFUND.SHOPIFY_AHEAD', {
        paypal: amount(r.paypalTotal),
        shopify: amount(r.shopifyTotal),
      });
    case 'no_paypal':
      return none
        ? t('GOTCHU.DRAWER.REFUND.NONE')
        : t('GOTCHU.DRAWER.REFUND.NO_PAYPAL', {
            amount: amount(r.shopifyTotal),
          });
    default:
      return null;
  }
};

const orderCard = (ctx, order, { t, te }) => {
  const lines = order.lineItems ?? [];
  const count = lines.reduce((n, l) => n + (l.quantity ?? 1), 0);
  const foundKey = `GOTCHU.TRACE.FOUND_BY.${String(ctx.selectedBy ?? '').toUpperCase()}`;
  const total = money(order.totalPrice, order.currency) ?? order.totalPrice;
  return {
    total,
    rows: [
      row(t('GOTCHU.DRAWER.TOTAL'), total),
      lines.length
        ? row(t('GOTCHU.DRAWER.ITEMS'), joined([count, lines[0].title]))
        : null,
      row(
        t('GOTCHU.DRAWER.PAID'),
        joined([
          financialWord(order.financialStatus, t),
          refundPhrase(ctx.refund, order, t),
        ])
      ),
      ctx.selectedBy && te(foundKey)
        ? row(t('GOTCHU.DRAWER.MATCHED_BY'), t(foundKey))
        : null,
    ].filter(Boolean),
  };
};

const NO_CARDS = { order: null, shipping: null, customer: null };

const sectionNotice = section =>
  section?.status === 'error' && section.message ? section.message : null;

// A customer section that is ok can still say who this is when the order
// section found nothing.
const customerOnly = (ctx, lang, t) => {
  if (ctx.customer?.status !== 'ok') return null;
  const c = ctx.customer.data;
  const language = LANG_WORDS[String(lang ?? '').toLowerCase()]?.(t) ?? null;
  const rows = [
    row(t('GOTCHU.DRAWER.EMAIL'), c.email),
    row(t('GOTCHU.DRAWER.PHONE'), c.phone),
    row(
      t('GOTCHU.DRAWER.ORDERS'),
      t('GOTCHU.DRAWER.ORDERS_VALUE', {
        count: c.ordersCount,
        total: money(c.totalSpent, c.currency) ?? c.totalSpent,
      })
    ),
  ].filter(Boolean);
  return {
    name: c.name ?? null,
    initials: initialsOf(c.name),
    subline: language ?? '',
    rows,
    piiNotice: null,
  };
};

export const drawerView = (
  context,
  { t, te, lang, locale, now = Date.now() }
) => {
  const base = { ...NO_CARDS, ambiguous: false, candidates: [], notice: null };
  // No context at all: the fetch failed.
  if (!context) {
    return {
      ...base,
      title: t('GOTCHU.DRAWER.NO_ORDER'),
      notice: t('GOTCHU.DRAWER.UNAVAILABLE'),
    };
  }
  if (context.ambiguous) {
    // Neutral title: "No order found" beside "Several orders match" would
    // contradict itself.
    return {
      ...base,
      title: t('GOTCHU.DRAWER.ORDER'),
      ambiguous: true,
      candidates: (context.candidates ?? []).map(c => ({
        orderName: c.orderName,
        storeKey: c.storeKey,
      })),
      notice: t('GOTCHU.DRAWER.AMBIGUOUS'),
    };
  }
  if (context.order?.status !== 'ok') {
    // 'unavailable' is the gateway's "searched, nothing matched": the title
    // says so and no notice is added. Only a gateway-authored error is shown.
    return {
      ...base,
      title: t('GOTCHU.DRAWER.NO_ORDER'),
      customer: customerOnly(context, lang, t),
      notice: sectionNotice(context.order),
    };
  }
  const order = context.order.data;
  const deps = { t, te, lang, locale, now };
  return {
    ...base,
    title: t('GOTCHU.DRAWER.ORDER_TITLE', { name: order.orderName }),
    customer: customerCard(context, order, deps),
    shipping:
      context.shipping?.status === 'ok'
        ? shippingCard(context.shipping.data, order, deps)
        : null,
    order: orderCard(context, order, deps),
    notice: sectionNotice(context.shipping),
  };
};
