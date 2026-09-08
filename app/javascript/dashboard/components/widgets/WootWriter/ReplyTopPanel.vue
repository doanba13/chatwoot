<script>
import { ref } from 'vue';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import { useCaptain } from 'dashboard/composables/useCaptain';
import { useTrack } from 'dashboard/composables';
import { vOnClickOutside } from '@vueuse/components';
import { REPLY_EDITOR_MODES, CHAR_LENGTH_WARNING } from './constants';
import { CAPTAIN_EVENTS } from 'dashboard/helper/AnalyticsHelper/events';
import NextButton from 'dashboard/components-next/button/Button.vue';
import CopilotMenuBar from './CopilotMenuBar.vue';

export default {
  name: 'ReplyTopPanel',
  components: {
    NextButton,
    CopilotMenuBar,
  },
  directives: {
    OnClickOutside: vOnClickOutside,
  },
  props: {
    mode: {
      type: String,
      default: REPLY_EDITOR_MODES.REPLY,
    },
    isReplyRestricted: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    isEditorDisabled: {
      type: Boolean,
      default: false,
    },
    conversationId: {
      type: Number,
      default: null,
    },
    isMessageLengthReachingThreshold: {
      type: Boolean,
      default: () => false,
    },
    charactersRemaining: {
      type: Number,
      default: () => 0,
    },
    editorContent: {
      type: String,
      default: undefined,
    },
    hasContent: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['setReplyMode', 'toggleEditorSize', 'executeCopilotAction'],
  setup(props, { emit }) {
    const setReplyMode = mode => {
      emit('setReplyMode', mode);
    };
    const handleReplyClick = () => {
      if (props.isReplyRestricted) return;
      setReplyMode(REPLY_EDITOR_MODES.REPLY);
    };
    const handleNoteClick = () => {
      setReplyMode(REPLY_EDITOR_MODES.NOTE);
    };

    const { captainTasksEnabled } = useCaptain();
    const showCopilotMenu = ref(false);
    const copilotToggleRef = ref(null);

    const handleCopilotAction = (actionKey, data) => {
      emit('executeCopilotAction', actionKey, data || props.editorContent);
      showCopilotMenu.value = false;
    };

    const toggleCopilotMenu = () => {
      const isOpening = !showCopilotMenu.value;
      if (isOpening) {
        useTrack(CAPTAIN_EVENTS.EDITOR_AI_MENU_OPENED, {
          conversationId: props.conversationId,
          entryPoint: 'top_panel',
        });
      }
      showCopilotMenu.value = isOpening;
    };

    const handleClickOutside = () => {
      showCopilotMenu.value = false;
    };

    // Key hints shown on the toggles. `⌥` is how the shortcuts modal writes
    // Alt; these are the two bindings registered just below.
    const replyKeyHint = '⌥L';
    const noteKeyHint = '⌥P';

    const keyboardEvents = {
      'Alt+KeyP': {
        action: () => handleNoteClick(),
        allowOnFocusedInput: false,
      },
      'Alt+KeyL': {
        action: () => handleReplyClick(),
        allowOnFocusedInput: false,
      },
    };
    useKeyboardEvents(keyboardEvents);

    return {
      handleReplyClick,
      handleNoteClick,
      REPLY_EDITOR_MODES,
      captainTasksEnabled,
      handleCopilotAction,
      showCopilotMenu,
      copilotToggleRef,
      toggleCopilotMenu,
      handleClickOutside,
      replyKeyHint,
      noteKeyHint,
    };
  },
  computed: {
    isOnNote() {
      // A restricted reply forces note mode, as the previous toggle component did.
      return this.isReplyRestricted || this.mode === REPLY_EDITOR_MODES.NOTE;
    },
    replyButtonClass() {
      return {
        'is-active': !this.isOnNote,
      };
    },
    noteButtonClass() {
      return {
        'is-active': this.isOnNote,
      };
    },
    charLengthClass() {
      return this.charactersRemaining < 0 ? 'text-n-ruby-9' : 'text-n-slate-11';
    },
    characterLengthWarning() {
      return this.charactersRemaining < 0
        ? `${-this.charactersRemaining} ${CHAR_LENGTH_WARNING.NEGATIVE}`
        : `${this.charactersRemaining} ${CHAR_LENGTH_WARNING.UNDER_50}`;
    },
  },
};
</script>

<template>
  <div
    class="flex justify-between gap-2 h-[3.25rem] items-center ltr:pl-3 ltr:pr-2 rtl:pr-3 rtl:pl-2"
  >
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="mode-toggle"
        :class="replyButtonClass"
        :disabled="disabled || isReplyRestricted"
        :aria-pressed="!isOnNote"
        @click="handleReplyClick"
      >
        {{ $t('CONVERSATION.REPLYBOX.REPLY') }}
        <kbd class="mode-toggle__key">{{ replyKeyHint }}</kbd>
      </button>
      <button
        type="button"
        class="mode-toggle"
        :class="noteButtonClass"
        :disabled="disabled"
        :aria-pressed="isOnNote"
        @click="handleNoteClick"
      >
        {{ $t('CONVERSATION.REPLYBOX.PRIVATE_NOTE') }}
        <kbd class="mode-toggle__key">{{ noteKeyHint }}</kbd>
      </button>
    </div>
    <div class="flex items-center mx-4 my-0">
      <div v-if="isMessageLengthReachingThreshold" class="text-xs">
        <span :class="charLengthClass">
          {{ characterLengthWarning }}
        </span>
      </div>
    </div>
    <div v-if="captainTasksEnabled" class="flex items-center gap-2">
      <div class="relative">
        <NextButton
          ref="copilotToggleRef"
          ghost
          :disabled="disabled || isEditorDisabled"
          :class="{
            'text-n-violet-9 hover:enabled:!bg-n-violet-3': !showCopilotMenu,
            'text-n-violet-9 bg-n-violet-3': showCopilotMenu,
          }"
          sm
          icon="i-ph-sparkle-fill"
          @click="toggleCopilotMenu"
        />
        <CopilotMenuBar
          v-if="showCopilotMenu"
          v-on-click-outside="[
            handleClickOutside,
            { ignore: [copilotToggleRef] },
          ]"
          :has-selection="false"
          :has-content="hasContent"
          :conversation-id="conversationId"
          class="ltr:right-0 rtl:left-0 bottom-full mb-2"
          @execute-copilot-action="handleCopilotAction"
        />
      </div>
      <NextButton
        ghost
        class="text-n-slate-11"
        sm
        icon="i-lucide-maximize-2"
        @click="$emit('toggleEditorSize')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Reply / Private note are two bordered toggles rather than one sliding pill:
// 4px 10px, control radius, weight 500, active taking the tank ground.
.mode-toggle {
  @apply inline-flex items-center gap-1.5 py-1 px-2.5 text-sm font-medium border rounded-[var(--g-radius-control)] border-[var(--g-border)] text-[var(--g-text-muted)] transition-colors duration-[var(--g-dur-hover)] ease-[var(--g-ease-out)];

  &:hover:not(:disabled) {
    @apply bg-[var(--g-surface-tank)];
  }

  &.is-active {
    @apply bg-[var(--g-surface-tank)] border-[var(--g-border-strong)] text-[var(--g-text)];
  }

  &:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
}

// The design draws `R` and `N` here. Those shortcuts do not exist; the ones
// that do are Alt+L and Alt+P, registered in this component's setup and listed
// in the shortcuts modal as SWITCH_TO_REPLY / SWITCH_TO_PRIVATE_NOTE. The hint
// names the real binding rather than the drawn one.
.mode-toggle__key {
  font: var(--g-text-key);
  @apply px-1 border rounded border-[var(--g-border)] opacity-60;
}
</style>
