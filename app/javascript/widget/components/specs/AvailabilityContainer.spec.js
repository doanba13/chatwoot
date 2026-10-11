import { ref } from 'vue';
import { mount } from '@vue/test-utils';
import AvailabilityContainer from '../Availability/AvailabilityContainer.vue';

const mockIsInWorkingHours = vi.fn();
const unavailableMessage = ref('');

vi.mock('widget/helpers/availabilityHelpers', () => ({
  isOnline: () => false,
  isInWorkingHours: (...args) => mockIsInWorkingHours(...args),
}));

vi.mock('dashboard/composables/store.js', () => ({
  useMapGetter: () => unavailableMessage,
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: key => key }),
}));

const MERCHANT_TEXT = "We're away, back Monday";

const render = ({ workingHoursEnabled, inWorkingHours, message }) => {
  window.chatwootWebChannel = { workingHours: [], workingHoursEnabled };
  mockIsInWorkingHours.mockReturnValue(inWorkingHours);
  unavailableMessage.value = message;
  return mount(AvailabilityContainer).text();
};

describe('AvailabilityContainer', () => {
  const originalChannel = window.chatwootWebChannel;

  afterEach(() => {
    window.chatwootWebChannel = originalChannel;
  });

  it('shows the merchant message outside enabled working hours', () => {
    const text = render({
      workingHoursEnabled: true,
      inWorkingHours: false,
      message: MERCHANT_TEXT,
    });
    expect(text).toContain(MERCHANT_TEXT);
    expect(text).not.toContain('TEAM_AVAILABILITY.ASYNC_TITLE');
  });

  it('shows the async copy inside working hours', () => {
    const text = render({
      workingHoursEnabled: true,
      inWorkingHours: true,
      message: MERCHANT_TEXT,
    });
    expect(text).not.toContain(MERCHANT_TEXT);
    expect(text).toContain('TEAM_AVAILABILITY.ASYNC_TITLE');
    expect(text).toContain('TEAM_AVAILABILITY.ASYNC_REPLY');
  });

  it('shows the async copy when working hours are disabled', () => {
    const text = render({
      workingHoursEnabled: false,
      inWorkingHours: false,
      message: MERCHANT_TEXT,
    });
    expect(text).not.toContain(MERCHANT_TEXT);
    expect(text).toContain('TEAM_AVAILABILITY.ASYNC_TITLE');
    expect(text).toContain('TEAM_AVAILABILITY.ASYNC_REPLY');
  });

  it('shows the async copy outside hours when no merchant message is set', () => {
    const text = render({
      workingHoursEnabled: true,
      inWorkingHours: false,
      message: '',
    });
    expect(text).toContain('TEAM_AVAILABILITY.ASYNC_TITLE');
    expect(text).toContain('TEAM_AVAILABILITY.ASYNC_REPLY');
  });
});
