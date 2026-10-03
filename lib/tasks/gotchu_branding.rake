# Installation configs are rows (serialized_value = { value: ... }, locked by default).
# The model's after_commit clears GlobalConfig's Redis cache on save, so no explicit
# clear is needed. The super-admin UI edits the same rows; this task makes it repeatable.
namespace :gotchu do
  desc 'Point installation branding at Gotchu (idempotent)'
  task branding: :environment do
    # "Powered by" in the customer-facing widget and in emails links here.
    # No Gotchu marketing site exists yet, so the desk's own host stands in;
    # set GOTCHU_BRAND_URL once there is one. A blank value leaves the row alone
    # rather than writing an empty link.
    brand_url = ENV['GOTCHU_BRAND_URL'].presence || ENV['FRONTEND_URL'].presence
    {
      'INSTALLATION_NAME' => 'Gotchu',
      'BRAND_NAME' => 'Gotchu',
      'LOGO_THUMBNAIL' => '/brand-assets/gotchu-mark.svg',
      'LOGO' => '/brand-assets/gotchu-mark.svg',
      'LOGO_DARK' => '/brand-assets/gotchu-mark.svg',
      'BRAND_URL' => brand_url,
      'WIDGET_BRAND_URL' => brand_url
    }.each do |name, value|
      next if value.blank?

      config = InstallationConfig.find_or_initialize_by(name: name)
      config.value = value
      config.save!
    end
    GlobalConfig.clear_cache
  end
end
