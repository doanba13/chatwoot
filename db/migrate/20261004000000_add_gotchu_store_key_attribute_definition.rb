# Declares store_key on every existing account, the way
# 20261003000000_add_gotchu_queue_attribute_definitions did for the queue
# attributes. ensure! is find_or_create_by!, so this adds only store_key.
class AddGotchuStoreKeyAttributeDefinition < ActiveRecord::Migration[7.1]
  def up
    Account.find_each { |account| Gotchu::QueueAttributes.ensure!(account) }
  end

  def down; end
end
