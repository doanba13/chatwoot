# content_attributes.gotchu ({cycleId, draftVersion}) marks an agent reply as a
# sent Gotchu draft. The agent dashboard and the webhook (the gateway reads it
# there) need it; nothing a customer receives may carry it. Every
# customer-facing serializer of a message goes through here.
#
# A conversation's custom_attributes carry Gotchu's machine attributes
# (store_key, gotchu_tier, gotchu_state, gotchu_procedure); upstream sends the
# whole hash to the contact, so those are removed on the same path.
module Gotchu::CustomerPayload
  KEYS = ['gotchu', :gotchu].freeze
  ATTRIBUTE_KEY = /\A(gotchu_|store_key\z)/

  module_function

  def content_attributes(attrs)
    return attrs unless attrs.respond_to?(:except)

    attrs.except(*KEYS)
  end

  def custom_attributes(attrs)
    return attrs unless attrs.respond_to?(:reject)

    attrs.reject { |key, _| key.to_s.match?(ATTRIBUTE_KEY) }
  end

  # A push payload (Message#push_event_data, or a conversation's, whose
  # :messages carry the last message's) with the stamp removed. Returns the
  # same object when there was nothing to remove, so a caller can tell.
  def strip(data)
    return data unless stamped?(data)

    stripped = data.merge(strip_message(data))
    stripped[:custom_attributes] = custom_attributes(data[:custom_attributes]) if data.key?(:custom_attributes)
    stripped[:messages] = data[:messages].map { |m| m.merge(strip_message(m)) } if data[:messages].is_a?(Array)
    stripped
  end

  def strip_message(message)
    out = {}
    out[:content_attributes] = content_attributes(message[:content_attributes]) if message.key?(:content_attributes)
    changes = message[:previous_changes]
    if changes.respond_to?(:key?) && changes.key?('content_attributes')
      out[:previous_changes] = changes.merge('content_attributes' => Array(changes['content_attributes']).map { |a| content_attributes(a) })
    end
    out
  end

  def stamped?(data)
    payloads = [data, *Array(data[:messages])]
    payloads.any? { |p| stamp_in?(p[:content_attributes]) || stamp_in_changes?(p[:previous_changes]) } ||
      machine_attributes_in?(data[:custom_attributes])
  end

  def machine_attributes_in?(attrs)
    attrs.respond_to?(:keys) && attrs.keys.any? { |key| key.to_s.match?(ATTRIBUTE_KEY) }
  end

  def stamp_in?(attrs)
    attrs.respond_to?(:key?) && KEYS.any? { |k| attrs.key?(k) }
  end

  def stamp_in_changes?(changes)
    changes.respond_to?(:key?) && Array(changes['content_attributes']).any? { |a| stamp_in?(a) }
  end
end
