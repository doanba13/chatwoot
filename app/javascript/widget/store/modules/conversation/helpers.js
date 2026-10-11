import { MESSAGE_TYPE } from 'widget/helpers/constants';
import { isASubmittedFormMessage } from 'shared/helpers/MessageTypeHelper';

import getUuid from '../../../helpers/uuid';
export const createTemporaryMessage = ({ attachments, content, replyTo }) => {
  const timestamp = new Date().getTime() / 1000;
  return {
    id: getUuid(),
    content,
    attachments,
    status: 'in_progress',
    replyTo,
    created_at: timestamp,
    message_type: MESSAGE_TYPE.INCOMING,
  };
};

const getSenderName = message => (message.sender ? message.sender.name : '');

const shouldShowAvatar = (message, nextMessage) => {
  const currentSender = getSenderName(message);
  const nextSender = getSenderName(nextMessage);

  return (
    currentSender !== nextSender ||
    message.message_type !== nextMessage.message_type ||
    isASubmittedFormMessage(nextMessage)
  );
};

export const groupConversationBySender = conversationsForADate =>
  conversationsForADate.map((message, index) => {
    let showAvatar;
    const isLastMessage = index === conversationsForADate.length - 1;
    if (isASubmittedFormMessage(message)) {
      showAvatar = false;
    } else if (isLastMessage) {
      showAvatar = true;
    } else {
      const nextMessage = conversationsForADate[index + 1];
      showAvatar = shouldShowAvatar(message, nextMessage);
    }
    return { showAvatar, ...message };
  });

// The email-collect template posts two template messages back to back, "Give
// the team a way to reach you." and then the input_email prompt, in the
// account's language rather than the visitor's. Two bot bubbles in a row read
// as a form, so the widget drops the lead-in and lets the input_email bubble
// carry one message of its own, from the widget's strings.
const isEmailCollectLeadIn = (message, nextMessage) =>
  message.message_type === MESSAGE_TYPE.TEMPLATE &&
  (message.content_type || 'text') === 'text' &&
  nextMessage?.message_type === MESSAGE_TYPE.TEMPLATE &&
  nextMessage?.content_type === 'input_email';

export const withoutEmailCollectLeadIn = messages =>
  messages.filter(
    (message, index) => !isEmailCollectLeadIn(message, messages[index + 1])
  );

export const findUndeliveredMessage = (messageInbox, { content }) =>
  Object.values(messageInbox).filter(
    message => message.content === content && message.status === 'in_progress'
  );

export const getNonDeletedMessages = ({ messages }) => {
  return messages.filter(
    item => !(item.content_attributes && item.content_attributes.deleted)
  );
};
