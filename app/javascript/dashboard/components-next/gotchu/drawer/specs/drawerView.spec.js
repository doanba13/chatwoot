import { withFullI18n } from 'test-i18n';
import { drawerView } from '../drawerView';
import { persoliebe, cadeauniq } from './fixtures';

const { t, te } = withFullI18n().global;
const now = Date.parse('2026-10-06T10:06:00Z');
const view = (ctx, lang = 'de') => drawerView(ctx, { t, te, lang, now });

describe('drawerView', () => {
  it('shows the order, its shipping steps and the refund state', () => {
    const v = view(persoliebe);
    expect(v.title).toBe('Order PL-5713');
    expect(v.shipping.steps.map(s => [s.key, s.done])).toEqual([
      ['ordered', true],
      ['shipped', true],
      ['scan', true],
      ['delivered', false],
    ]);
    expect(v.shipping.steps[2].label).toBe('Last scan, Leipzig hub');
    expect(v.shipping.stateWord).toBe('In transit');
    expect(v.shipping.steps[1].detail).toContain('YWBZ12…7890');
    expect(v.shipping.checked).toBe('Carrier checked about 1 hour ago');
    expect(v.order.rows.find(r => r.k === 'Paid').v).toBe('paid · no refund');
    expect(v.order.rows.find(r => r.k === 'Matched by').v).toBe(
      'found by the sender’s email'
    );
    expect(v.order.rows.find(r => r.k === 'Items').v).toBe('2 · Name necklace');
  });

  it('shows the customer from the customer section when it is ok', () => {
    const v = view(persoliebe);
    expect(v.customer.name).toBe('Anna Becker');
    expect(v.customer.piiNotice).toBeNull();
    expect(v.customer.rows.map(r => r.k)).toEqual(
      expect.arrayContaining(['Email', 'Phone', 'Ship to', 'Orders'])
    );
    expect(v.customer.subline).toBe('German · Leipzig, DE');
  });

  it('says why customer fields are missing on a plan that hides them, and keeps the city', () => {
    const v = view(cadeauniq, 'fr');
    expect(v.customer.piiNotice).toContain(
      'Shopify plan hides customer details'
    );
    expect(v.customer.rows.map(r => r.k)).not.toEqual(
      expect.arrayContaining(['Email', 'Phone', 'Ship to'])
    );
    expect(v.customer.subline).toBe('French · Lyon, FR');
    expect(v.customer.name).toBeNull();
  });

  it('never picks an order when the match is ambiguous', () => {
    const v = view({
      ...persoliebe,
      ambiguous: true,
      candidates: [
        {
          storeKey: 'persoliebe',
          orderName: 'PL-5713',
          confidence: 'likely',
          via: 'x',
        },
        {
          storeKey: 'persoliebe',
          orderName: 'PL-5714',
          confidence: 'likely',
          via: 'x',
        },
      ],
    });
    expect(v.order).toBeNull();
    expect(v.shipping).toBeNull();
    expect(v.customer).toBeNull();
    expect(v.notice).toContain('Several orders match');
    expect(v.candidates.map(c => c.orderName)).toEqual(['PL-5713', 'PL-5714']);
    expect(v.title).toBe('No order found');
  });

  it('says a third of shipments carry no tracking, rather than showing a blank', () => {
    const ctx = {
      ...persoliebe,
      shipping: {
        status: 'ok',
        data: {
          ...persoliebe.shipping.data,
          trackingNumber: null,
          source: 'shopify',
          lastScanAt: null,
        },
      },
    };
    const v = view(ctx);
    expect(v.shipping.notice).toBe('Shipped without a tracking number');
    expect(v.shipping.checked).toBe(
      'Carrier not checked live; status from the shop'
    );
    expect(v.shipping.steps.map(s => s.key)).toEqual([
      'ordered',
      'shipped',
      'delivered',
    ]);
  });

  it('says when it is not shipped, and when live tracking is degraded', () => {
    const base = persoliebe.shipping.data;
    const notShipped = view({
      ...persoliebe,
      shipping: {
        status: 'ok',
        data: { ...base, shipped: false, trackingNumber: null },
      },
    });
    expect(notShipped.shipping.notice).toBe('Not shipped yet');
    const degraded = view({
      ...persoliebe,
      shipping: { status: 'ok', data: { ...base, degradedReason: 'quota' } },
    });
    expect(degraded.shipping.notice).toBe('Live tracking unavailable');
  });

  it('words a state it does not know as unknown, never raw', () => {
    const ctx = {
      ...persoliebe,
      shipping: {
        status: 'ok',
        data: { ...persoliebe.shipping.data, state: 'teleported' },
      },
    };
    expect(view(ctx).shipping.stateWord).toBe('Status unknown');
  });

  it('leaves out a matched-by strategy it has no words for', () => {
    expect(
      view({ ...persoliebe, selectedBy: 'fuzzy_address' }).order.rows.map(
        r => r.k
      )
    ).not.toContain('Matched by');
  });

  it('says PayPal and Shopify disagree when they do', () => {
    const ctx = {
      ...persoliebe,
      refund: {
        status: 'ok',
        data: {
          state: 'paypal_ahead',
          shopifyTotal: '0.00',
          paypalTotal: '39.90',
          warning: null,
        },
      },
    };
    expect(view(ctx).order.rows.find(r => r.k === 'Paid').v).toContain(
      'PayPal refunded'
    );
  });

  it('words a refund match with its amount, and leaves the phrase out when the section failed', () => {
    const matched = {
      ...persoliebe,
      refund: {
        status: 'ok',
        data: {
          state: 'match',
          shopifyTotal: '10.00',
          paypalTotal: '10.00',
          warning: null,
        },
      },
    };
    expect(view(matched).order.rows.find(r => r.k === 'Paid').v).toContain(
      'refunded'
    );
    const failed = {
      ...persoliebe,
      refund: { status: 'error', message: 'PayPal did not answer' },
    };
    expect(view(failed).order.rows.find(r => r.k === 'Paid').v).toBe('paid');
  });

  it('says the lookup is unavailable when the order section errored', () => {
    const v = view({
      ...persoliebe,
      order: { status: 'error', message: 'Shopify did not answer' },
    });
    expect(v.notice).toBe('Shopify did not answer');
    expect(v.order).toBeNull();
    expect(
      view({ ...persoliebe, order: { status: 'unavailable' } }).notice
    ).toBe('The order lookup is not available right now.');
  });
});
