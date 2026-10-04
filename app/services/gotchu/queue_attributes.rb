# Ensures the conversation attributes Gotchu's queues filter on exist for an
# account. The reply worker writes the values; this only declares them so
# Chatwoot's filter knows their type. Idempotent.
module Gotchu
  module QueueAttributes
    DEFINITIONS = [
      {
        attribute_key: 'gotchu_state',
        attribute_display_name: 'Gotchu state',
        attribute_display_type: 'list',
        attribute_values: %w[drafted auto_holding handed_over sent]
      },
      {
        attribute_key: 'gotchu_procedure',
        attribute_display_name: 'Gotchu procedure',
        attribute_display_type: 'text',
        attribute_values: []
      },
      # Declared so the conversation filter can query it: the rail's store
      # entries are virtual folders over it. The webhook receiver writes it;
      # the resolver reads it, which is why the attributes panel hides it.
      {
        attribute_key: 'store_key',
        attribute_display_name: 'Store',
        attribute_display_type: 'text',
        attribute_values: []
      }
    ].freeze

    def self.ensure!(account)
      DEFINITIONS.each do |definition|
        account.custom_attribute_definitions.find_or_create_by!(
          attribute_key: definition[:attribute_key],
          attribute_model: 'conversation_attribute'
        ) do |row|
          row.attribute_display_name = definition[:attribute_display_name]
          row.attribute_display_type = definition[:attribute_display_type]
          row.attribute_values = definition[:attribute_values]
        end
      end
    end
  end
end
