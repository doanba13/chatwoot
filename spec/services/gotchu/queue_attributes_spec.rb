require 'rails_helper'

RSpec.describe Gotchu::QueueAttributes do
  it 'declares store_key so a store can be filtered on, beside the queue attributes' do
    account = create(:account)
    keys = account.custom_attribute_definitions.where(attribute_model: 'conversation_attribute').pluck(:attribute_key)
    expect(keys).to include('store_key', 'gotchu_state', 'gotchu_procedure')
  end
end
