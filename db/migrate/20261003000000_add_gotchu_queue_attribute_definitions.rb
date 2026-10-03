class AddGotchuQueueAttributeDefinitions < ActiveRecord::Migration[7.1]
  def up
    Account.find_each { |account| Gotchu::QueueAttributes.ensure!(account) }
  end

  def down; end
end
