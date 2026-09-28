# The one place every Gotchu proxy resolves the secret it sends the
# gateway. Three classes call the gateway -- ProcedureService, DraftService,
# InstructService -- and each used to read `GOTCHU_GATEWAY_SECRET`
# independently. Now that the gateway derives its caller's account from the
# secret, all three need the SAME accountId -> secret lookup, so it lives
# here once rather than as three copies that could drift out of step with
# each other.
module Gotchu::GatewaySecret
  # `GOTCHU_GATEWAY_SECRETS` is `accountId:secret,accountId:secret,...` --
  # one gateway install may hold several Chatwoot accounts once a second
  # merchant is onboarded, each with its own credential, so a single shared
  # variable can no longer name all of them. A malformed entry (no colon, a
  # non-integer id, a blank secret) is skipped rather than raised: the whole
  # env var is boot-time config for every account and every gateway-calling
  # class on this install, so one typo must not take every other account's
  # credential down with it. The warning names the entry's INDEX only --
  # never the entry's own text, which is exactly where a secret typo'd into
  # the wrong slot would otherwise end up in the log.
  #
  # Read fresh on every call, never memoized at this module level -- the
  # same convention `ProcedureService.available?` already follows ("read at
  # call time, never memoized": turning the feature on is an env var and a
  # container restart, never a rebuild) -- and it is what makes this
  # testable at all, since every spec stubs `ENV` per example and a
  # module-level memo would leak between them.
  def self.parse(raw)
    raw.to_s.split(',').each_with_index.with_object({}) do |(entry, index), acc|
      account_id_part, secret_part = entry.split(':', 2)
      account_id = account_id_part.to_s.strip
      secret = secret_part.to_s.strip

      if account_id.match?(/\A\d+\z/) && secret.present?
        acc[account_id.to_i] = secret
      else
        Rails.logger.warn("GOTCHU_GATEWAY_SECRETS entry #{index} is malformed and was ignored")
      end
    end
  end

  # The given account's own secret when `GOTCHU_GATEWAY_SECRETS` names one,
  # falling back to the single, install-wide `GOTCHU_GATEWAY_SECRET` for any
  # account the map doesn't mention -- so today's one-account deployment
  # needs no new env var at all. `nil` when neither names the account: every
  # caller already has its own `ConfigurationError` with its own message, so
  # this resolver raises nothing itself.
  def self.for_account(account_id)
    parse(ENV.fetch('GOTCHU_GATEWAY_SECRETS', nil))[account_id] ||
      ENV.fetch('GOTCHU_GATEWAY_SECRET', nil).presence
  end
end
