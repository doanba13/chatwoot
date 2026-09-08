<script setup>
import { ref, computed } from 'vue';
import { OnClickOutside } from '@vueuse/components';
import { useI18n } from 'vue-i18n';

import Button from 'dashboard/components-next/button/Button.vue';
import TeleportWithDirection from 'dashboard/components-next/TeleportWithDirection.vue';

const props = defineProps({
  type: {
    type: String,
    default: 'edit',
    validator: value => ['alert', 'edit'].includes(value),
  },
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  cancelButtonLabel: {
    type: String,
    default: '',
  },
  confirmButtonLabel: {
    type: String,
    default: '',
  },
  disableConfirmButton: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  showCancelButton: {
    type: Boolean,
    default: true,
  },
  showConfirmButton: {
    type: Boolean,
    default: true,
  },
  overflowYAuto: {
    type: Boolean,
    default: false,
  },
  width: {
    type: String,
    default: 'lg',
    validator: value => ['3xl', '2xl', 'xl', 'lg', 'md', 'sm'].includes(value),
  },
  position: {
    type: String,
    default: 'center',
    validator: value => ['center', 'top'].includes(value),
  },
});

const emit = defineEmits(['confirm', 'close']);

const { t } = useI18n();

const dialogRef = ref(null);
const dialogContentRef = ref(null);
const isOpen = ref(false);

const maxWidthClass = computed(() => {
  const classesMap = {
    '3xl': 'max-w-3xl',
    '2xl': 'max-w-2xl',
    xl: 'max-w-xl',
    lg: 'max-w-lg',
    md: 'max-w-md',
    sm: 'max-w-sm',
  };

  return classesMap[props.width] ?? 'max-w-md';
});

const positionClass = computed(() =>
  props.position === 'top' ? 'dialog-position-top' : ''
);

const open = () => {
  isOpen.value = true;
  dialogRef.value?.showModal();
};

const close = () => {
  emit('close');
  dialogRef.value?.close();
  isOpen.value = false;
};

// Only close if the close event originated from this dialog,
// not from a child dialog (e.g. ProseMirror prompt) bubbling up.
const handleDialogClose = e => e.target === dialogRef.value && close();

// Only close on click-outside if this dialog is the topmost one.
// If another dialog (e.g. ProseMirror prompt) is open on top, ignore.
const handleClickOutside = () => {
  const dialogs = document.querySelectorAll('dialog[open]');
  if (dialogs[dialogs.length - 1] === dialogRef.value) close();
};

const confirm = () => {
  emit('confirm');
};

defineExpose({ open, close });
</script>

<template>
  <TeleportWithDirection to="body">
    <dialog
      ref="dialogRef"
      class="w-full bg-transparent rounded-[var(--g-radius-modal)]"
      :class="[
        maxWidthClass,
        positionClass,
        overflowYAuto ? 'overflow-y-auto' : 'overflow-visible',
      ]"
      @close.prevent="handleDialogClose"
    >
      <OnClickOutside @trigger="handleClickOutside">
        <form
          ref="dialogContentRef"
          class="flex flex-col w-full h-auto gap-6 p-5 overflow-visible text-start align-middle bg-[var(--g-bg)] shadow-[shadow:var(--g-shadow-modal)] rounded-[var(--g-radius-modal)]"
          @submit.prevent="confirm"
          @click.stop
        >
          <div v-if="title || description" class="flex flex-col gap-2">
            <h3 class="text-base font-medium leading-6 text-n-slate-12">
              {{ title }}
            </h3>
            <slot name="description">
              <p v-if="description" class="mb-0 text-sm text-n-slate-11">
                {{ description }}
              </p>
            </slot>
          </div>
          <slot v-if="isOpen" />
          <!-- Dialog content will be injected here -->
          <slot name="footer">
            <div
              v-if="showCancelButton || showConfirmButton"
              class="flex items-center justify-between w-full gap-3"
            >
              <Button
                v-if="showCancelButton"
                variant="faded"
                color="slate"
                :label="cancelButtonLabel || t('DIALOG.BUTTONS.CANCEL')"
                class="w-full"
                type="button"
                @click="close"
              />
              <Button
                v-if="showConfirmButton"
                :color="type === 'edit' ? 'blue' : 'ruby'"
                :label="confirmButtonLabel || t('DIALOG.BUTTONS.CONFIRM')"
                class="w-full"
                :is-loading="isLoading"
                :disabled="disableConfirmButton || isLoading"
                type="submit"
              />
            </div>
          </slot>
        </form>
      </OnClickOutside>
    </dialog>
  </TeleportWithDirection>
</template>

<style scoped>
/*
 * Flat scrim, no blur.
 *
 * Neither half of this is motion-v, and both are enters only. `::backdrop` is
 * a pseudo-element rather than a DOM node, so there is nothing for motion-v to
 * attach to; and the panel has no exit to hold, because `close()` calls the
 * native `dialog.close()`, which drops the element out of the top layer in the
 * same tick — an `AnimatePresence` exit would run inside a `display: none`
 * subtree. So the SCRIM and MODAL presets are spelled out here in CSS, keyed
 * off `[open]` so they replay on every open rather than once on mount.
 */
dialog::backdrop {
  background-color: var(--g-scrim);
}

dialog[open]::backdrop {
  animation: dialog-scrim-in var(--g-dur-hover) var(--g-ease-out);
}

dialog[open] form {
  animation: dialog-panel-in var(--g-dur-arrive) var(--g-ease-out);
}

@keyframes dialog-scrim-in {
  from {
    opacity: 0;
  }
}

@keyframes dialog-panel-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

.dialog-position-top {
  margin-top: clamp(2rem, 5vh, 5rem);
  margin-bottom: auto;
}
</style>
