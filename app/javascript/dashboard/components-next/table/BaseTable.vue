<script setup>
import { computed } from 'vue';

const props = defineProps({
  // A header is a plain string, or `{ label, identifier }` — an identifier
  // column (id, endpoint, tracking number) renders its cells in mono.
  headers: {
    type: Array,
    default: () => [],
  },
  items: {
    type: Array,
    default: () => [],
  },
  noDataMessage: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  // The Agent boards' table: in its own card, which also scrolls the table
  // sideways on a narrow screen so the page never does, with headers in the
  // sentence case their strings are written in.
  boxed: {
    type: Boolean,
    default: false,
  },
});

const columns = computed(() =>
  props.headers.map(header =>
    header !== null && typeof header === 'object'
      ? { label: header.label, identifier: Boolean(header.identifier) }
      : { label: header, identifier: false }
  )
);

// 1-based positions of the identifier columns. Body cells arrive through the
// `row` slot, so their position is the only handle this component has on them;
// the scoped rules below read the list back off the table.
const identifierColumns = computed(() =>
  columns.value
    .map((column, index) => (column.identifier ? index + 1 : null))
    .filter(position => position !== null)
    .join(' ')
);

const hasHeaderSlot = computed(() => !!props.headers.length);
const showHeaders = computed(
  () => hasHeaderSlot.value && props.items.length > 0
);
</script>

<template>
  <div
    class="w-full"
    :class="{
      'overflow-x-auto bg-[var(--g-surface)] border border-[var(--g-border)] rounded-[var(--g-radius-card)]':
        boxed,
    }"
    :data-testid="boxed ? 'base-table-box' : undefined"
  >
    <table
      class="base-table min-w-full table-auto divide-y divide-[var(--g-border)]"
      :class="{ 'base-table--boxed': boxed }"
      :data-identifier-columns="identifierColumns"
    >
      <thead
        v-if="showHeaders"
        :class="boxed ? '' : 'border-t border-[var(--g-border)]'"
      >
        <tr>
          <th
            v-for="(column, index) in columns"
            :key="index"
            class="py-4 ltr:pr-4 rtl:pl-4 text-start text-xs font-medium text-n-slate-11"
            :class="boxed ? 'normal-case' : 'capitalize'"
          >
            <slot :name="`header-${index}`" :header="headers[index]">
              {{ column.label }}
            </slot>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[var(--g-border)] text-n-slate-11">
        <template v-if="items.length">
          <slot name="row" :items="items" />
        </template>
        <tr v-else-if="noDataMessage && !loading">
          <td
            :colspan="headers.length || 1"
            class="py-20 text-center text-body-main !text-base text-n-slate-11"
          >
            {{ noDataMessage }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
/* A boxed table keeps the card's inner gutter on its first column, and is
   wide enough to scroll inside its box rather than squeeze its columns. */
.base-table--boxed {
  min-width: 40rem;

  th:first-child,
  :deep(td:first-child) {
    padding-inline-start: 1rem;
  }
}

/* Identifier columns render in mono. CSS cannot take an nth-child index from a
   custom property, so the rules are enumerated and `data-identifier-columns`
   selects the ones that apply; eight covers every table in the dashboard.
   The no-data row is excluded — it spans the whole table. */
@for $column from 1 through 8 {
  .base-table[data-identifier-columns~='#{$column}']
    :deep(td:nth-child(#{$column}):not([colspan])) {
    font-family: var(--g-font-mono);
    font-size: 13px;
  }
}
</style>
