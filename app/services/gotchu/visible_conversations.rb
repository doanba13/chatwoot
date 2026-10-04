# The gateway answers account-wide and never knows which user asked, so every
# conversation id it returns is narrowed here, before anything reaches the
# browser, to the conversations this user may open (the fix-wave contract).
#
# The permission logic is Chatwoot's own: Conversations::PermissionFilterService,
# the filter the conversation list uses, which also carries the enterprise
# custom-role narrowing. An administrator keeps every id the account holds.
class Gotchu::VisibleConversations
  def initialize(user:, account:)
    @user = user
    @account = account
  end

  # The display ids among `ids` this user may open, as a Set of Integers.
  def call(ids)
    wanted = Array(ids).filter_map { |id| Integer(id, exception: false) }.uniq
    return Set.new if wanted.empty? || !@user.is_a?(User)

    scope = @account.conversations.where(display_id: wanted)
    Conversations::PermissionFilterService.new(scope, @user, @account).perform.pluck(:display_id).to_set
  end

  # `ids` without the ones this user may not open, in their original order.
  def filter(ids)
    visible = call(ids)
    Array(ids).select { |id| visible.include?(Integer(id, exception: false)) }
  end
end
