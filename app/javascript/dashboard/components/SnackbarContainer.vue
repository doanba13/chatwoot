<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { AnimatePresence, motion } from 'motion-v';
import WootSnackbar from './Snackbar.vue';
import { emitter } from 'shared/helpers/mitt';
import { useI18n } from 'vue-i18n';
import { ARRIVE } from 'dashboard/helper/motion';

const props = defineProps({
  duration: {
    type: Number,
    default: 2500,
  },
});

const { t } = useI18n();

const snackMessages = ref([]);
const snackbarContainer = ref(null);

const showPopover = () => {
  try {
    const el = snackbarContainer.value;
    if (el?.matches(':popover-open')) {
      el.hidePopover();
    }
    el?.showPopover();
  } catch (e) {
    // ignore
  }
};

const onNewToastMessage = ({ message: originalMessage, action }) => {
  const message = action?.usei18n ? t(originalMessage) : originalMessage;
  const duration = action?.duration || props.duration;

  snackMessages.value.push({
    key: Date.now(),
    message,
    action,
  });

  nextTick(showPopover);

  setTimeout(() => {
    snackMessages.value.shift();
  }, duration);
};

onMounted(() => {
  emitter.on('newToastMessage', onNewToastMessage);
});

onUnmounted(() => {
  emitter.off('newToastMessage', onNewToastMessage);
});
</script>

<template>
  <div
    ref="snackbarContainer"
    popover="manual"
    class="fixed top-4 left-1/2 -translate-x-1/2 max-w-[25rem] w-[calc(100%-2rem)] text-center bg-transparent border-0 p-0 m-0 outline-none overflow-visible"
  >
    <!--
      This was a <transition-group name="toast-fade">, and `toast-fade` is
      defined nowhere in the repo — so toasts have never animated, and a toast
      expiring made the ones below it jump up.

      `popLayout` is what earns motion-v its place here: messages are removed
      from the FRONT of the list while later ones are still on screen, so an
      exiting toast has to leave the layout flow before the survivors move, or
      they animate from a position that no longer exists. `layout` on each item
      is what carries them up smoothly once it has.
    -->
    <AnimatePresence mode="popLayout">
      <motion.div
        v-for="snackMessage in snackMessages"
        :key="snackMessage.key"
        layout
        :initial="ARRIVE.initial"
        :animate="ARRIVE.animate"
        :exit="ARRIVE.exit"
        :transition="ARRIVE.transition"
      >
        <WootSnackbar
          :message="snackMessage.message"
          :action="snackMessage.action"
        />
      </motion.div>
    </AnimatePresence>
  </div>
</template>
