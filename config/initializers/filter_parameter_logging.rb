# Be sure to restart your server when you modify this file.

# Configure sensitive parameters which will be filtered from the log file.
Rails.application.config.filter_parameters += [
  :password, :secret, :_key, :auth, :crypt, :salt, :certificate, :otp, :access, :private, :protected, :ssn,
  :otp_secret, :otp_code, :backup_code, :mfa_token, :otp_backup_codes
]

# Regex to filter all occurrences of 'token' in keys except for 'website_token'
filter_regex = /\A(?!.*\bwebsite_token\b).*token/i

# Apply the regex for filtering
Rails.application.config.filter_parameters += [filter_regex]

# Shopify's OAuth return (item 6.4) puts a one-time authorization code, its
# state and an HMAC in the query string -- on the stores page landing and again
# in the body of the proxy's `complete` call, as one `query` string. Anchored
# exact keys, so `country_code` and the like are left alone.
Rails.application.config.filter_parameters += [/\A(query|code|hmac|state|host)\z/]
