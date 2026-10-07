<script setup>
import { computed, watch, onMounted } from 'vue';
import {
  useMapGetter,
  useFunctionGetter,
  useStore,
} from 'dashboard/composables/store';
import { useAccount } from 'dashboard/composables/useAccount';
import { useUISettings } from 'dashboard/composables/useUISettings';
import { FEATURE_FLAGS } from 'dashboard/featureFlags';

import OrderDrawer from 'dashboard/components-next/gotchu/drawer/OrderDrawer.vue';
import DrawerCard from 'dashboard/components-next/gotchu/drawer/DrawerCard.vue';
import { useDraftMeta } from 'dashboard/components-next/gotchu/helpers/draftMeta';
import LabelBox from './labels/LabelBox.vue';
import ContactConversations from './ContactConversations.vue';
import ConversationAction from './ConversationAction.vue';
import ConversationParticipant from './ConversationParticipant.vue';
import ContactInfo from './contact/ContactInfo.vue';
import ContactNotes from './contact/ContactNotes.vue';
import ConversationInfo from './ConversationInfo.vue';
import CustomAttributes from './customAttributes/CustomAttributes.vue';
import SharedFiles from './SharedFiles.vue';
import MacrosList from './Macros/List.vue';
import ShopifyOrdersList from 'dashboard/components/widgets/conversation/ShopifyOrdersList.vue';
import SidebarActionsHeader from 'dashboard/components-next/SidebarActionsHeader.vue';
import LinearIssuesList from 'dashboard/components/widgets/conversation/linear/IssuesList.vue';
import LinearSetupCTA from 'dashboard/components/widgets/conversation/linear/LinearSetupCTA.vue';

const props = defineProps({
  conversationId: {
    type: [Number, String],
    required: true,
  },
  inboxId: {
    type: Number,
    default: undefined,
  },
});

const { updateUISettings, isContactSidebarItemOpen, toggleSidebarUIState } =
  useUISettings();

const shopifyIntegration = useFunctionGetter(
  'integrations/getIntegration',
  'shopify'
);

const isShopifyFeatureEnabled = computed(
  () => shopifyIntegration.value.enabled
);

const { isCloudFeatureEnabled } = useAccount();

const isLinearFeatureEnabled = computed(() =>
  isCloudFeatureEnabled(FEATURE_FLAGS.LINEAR)
);

const linearIntegration = useFunctionGetter(
  'integrations/getIntegration',
  'linear'
);

const isLinearClientIdConfigured = computed(() => {
  return !!linearIntegration.value?.id;
});

const isLinearConnected = computed(
  () => linearIntegration.value?.enabled || false
);

const store = useStore();
const currentChat = useMapGetter('getSelectedChat');
const conversationId = computed(() => props.conversationId);
const conversationMetadataGetter = useMapGetter(
  'conversationMetadata/getConversationMetadata'
);
const currentConversationMetaData = computed(() =>
  conversationMetadataGetter.value(conversationId.value)
);
const conversationAdditionalAttributes = computed(
  () => currentConversationMetaData.value.additional_attributes || {}
);

const draftMeta = useDraftMeta(conversationId);

const channelType = computed(() => currentChat.value.meta?.channel);

const contactGetter = useMapGetter('contacts/getContact');
const contactId = computed(() => currentChat.value.meta?.sender?.id);
const contact = computed(() => contactGetter.value(contactId.value));
const contactAdditionalAttributes = computed(
  () => contact.value.additional_attributes || {}
);

const getContactDetails = () => {
  if (contactId.value) {
    store.dispatch('contacts/show', { id: contactId.value });
  }
};

watch(contactId, (newContactId, prevContactId) => {
  if (newContactId && newContactId !== prevContactId) {
    getContactDetails();
  }
});

const closeContactPanel = () => {
  updateUISettings({
    is_contact_sidebar_open: false,
    is_copilot_panel_open: false,
  });
};

onMounted(() => {
  getContactDetails();
  store.dispatch('attributes/get', 0);
  // Load integrations to ensure linear integration state is available
  store.dispatch('integrations/get', 'linear');
});
</script>

<template>
  <div class="w-full">
    <SidebarActionsHeader
      :title="$t('CONVERSATION.SIDEBAR.CONTACT')"
      @close="closeContactPanel"
    />
    <OrderDrawer
      :conversation-id="conversationId"
      :contact="contact"
      :lang="draftMeta?.lang"
    />
    <div class="cwh" />
    <div class="px-4 pb-8 list-group">
      <DrawerCard
        :title="$t('GOTCHU.DRAWER.CONVERSATION')"
        :open="isContactSidebarItemOpen('is_conv_actions_open')"
        @toggle="toggleSidebarUIState('is_conv_actions_open')"
      >
        <ConversationAction :inbox-id="inboxId" />
      </DrawerCard>
      <DrawerCard
        :title="$t('GOTCHU.DRAWER.LABELS')"
        :open="isContactSidebarItemOpen('is_labels_open')"
        @toggle="toggleSidebarUIState('is_labels_open')"
      >
        <LabelBox :conversation-id="conversationId" />
      </DrawerCard>
      <DrawerCard
        v-if="contact.id"
        :title="$t('GOTCHU.DRAWER.PREVIOUS')"
        :open="isContactSidebarItemOpen('is_previous_conv_open')"
        @toggle="toggleSidebarUIState('is_previous_conv_open')"
      >
        <ContactConversations
          :contact-id="contact.id"
          :conversation-id="conversationId"
        />
      </DrawerCard>
      <woot-feature-toggle feature-key="macros">
        <DrawerCard
          :title="$t('GOTCHU.DRAWER.MACROS')"
          :open="isContactSidebarItemOpen('is_macro_open')"
          @toggle="toggleSidebarUIState('is_macro_open')"
        >
          <MacrosList :conversation-id="conversationId" />
        </DrawerCard>
      </woot-feature-toggle>

      <!-- Everything below stays reachable but collapsed: ContactInfo is the
           only place that edits, merges, deletes or calls a contact. -->
      <DrawerCard
        :title="$t('GOTCHU.DRAWER.CONTACT')"
        :open="isContactSidebarItemOpen('is_contact_info_open')"
        @toggle="toggleSidebarUIState('is_contact_info_open')"
      >
        <ContactInfo :contact="contact" :channel-type="channelType" />
      </DrawerCard>
      <DrawerCard
        :title="$t('CONVERSATION_PARTICIPANTS.SIDEBAR_TITLE')"
        :open="isContactSidebarItemOpen('is_conv_participants_open')"
        @toggle="toggleSidebarUIState('is_conv_participants_open')"
      >
        <ConversationParticipant
          :conversation-id="conversationId"
          :inbox-id="inboxId"
        />
      </DrawerCard>
      <DrawerCard
        :title="$t('CONVERSATION_SIDEBAR.ACCORDION.CONVERSATION_INFO')"
        :open="isContactSidebarItemOpen('is_conv_details_open')"
        @toggle="toggleSidebarUIState('is_conv_details_open')"
      >
        <ConversationInfo
          :conversation-attributes="conversationAdditionalAttributes"
          :contact-attributes="contactAdditionalAttributes"
        />
      </DrawerCard>
      <DrawerCard
        :title="$t('CONVERSATION_SIDEBAR.ACCORDION.CONTACT_ATTRIBUTES')"
        :open="isContactSidebarItemOpen('is_contact_attributes_open')"
        @toggle="toggleSidebarUIState('is_contact_attributes_open')"
      >
        <CustomAttributes
          attribute-type="contact_attribute"
          attribute-from="conversation_contact_panel"
          :contact-id="contact.id"
          :empty-state-message="
            $t('CONVERSATION_CUSTOM_ATTRIBUTES.NO_RECORDS_FOUND')
          "
        />
      </DrawerCard>
      <DrawerCard
        :title="$t('CONVERSATION_SIDEBAR.ACCORDION.CONTACT_NOTES')"
        :open="isContactSidebarItemOpen('is_contact_notes_open')"
        @toggle="toggleSidebarUIState('is_contact_notes_open')"
      >
        <ContactNotes :contact-id="contactId" />
      </DrawerCard>
      <DrawerCard
        v-if="isLinearFeatureEnabled && isLinearClientIdConfigured"
        :title="$t('CONVERSATION_SIDEBAR.ACCORDION.LINEAR_ISSUES')"
        :open="isContactSidebarItemOpen('is_linear_issues_open')"
        @toggle="toggleSidebarUIState('is_linear_issues_open')"
      >
        <LinearSetupCTA v-if="!isLinearConnected" />
        <LinearIssuesList v-else :conversation-id="conversationId" />
      </DrawerCard>
      <DrawerCard
        v-if="isShopifyFeatureEnabled"
        :title="$t('CONVERSATION_SIDEBAR.ACCORDION.SHOPIFY_ORDERS')"
        :open="isContactSidebarItemOpen('is_shopify_orders_open')"
        @toggle="toggleSidebarUIState('is_shopify_orders_open')"
      >
        <ShopifyOrdersList :contact-id="contactId" />
      </DrawerCard>
      <DrawerCard
        :title="$t('CONVERSATION_SIDEBAR.ACCORDION.SHARED_FILES')"
        :open="isContactSidebarItemOpen('is_shared_files_open')"
        @toggle="toggleSidebarUIState('is_shared_files_open')"
      >
        <SharedFiles />
      </DrawerCard>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cwh {
  @apply mx-4 mb-3 border-t border-solid;
  border-color: var(--g-border);
}
</style>
