# Installation configs are rows (serialized_value = { value: ... }, locked by default).
# The model's after_commit clears GlobalConfig's Redis cache on save, so no explicit
# clear is needed. The super-admin UI edits the same rows; this task makes it repeatable.
namespace :gotchu do
  desc 'Point installation branding at Gotchu (idempotent)'
  task branding: :environment do
    {
      'INSTALLATION_NAME' => 'Gotchu',
      'BRAND_NAME' => 'Gotchu',
      'LOGO_THUMBNAIL' => '/brand-assets/gotchu-mark.svg',
      'LOGO' => '/brand-assets/gotchu-mark.svg',
      'LOGO_DARK' => '/brand-assets/gotchu-mark.svg'
    }.each do |name, value|
      config = InstallationConfig.find_or_initialize_by(name: name)
      config.value = value
      config.save!
    end
    GlobalConfig.clear_cache
  end
end
