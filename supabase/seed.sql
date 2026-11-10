-- Local development seed data goes here.
-- Use synthetic data only.

-- Local development and CI skip the PDPA consent screen (D016) so test users
-- can sign in directly. Production keeps the migration default (required).
update public.privacy_settings set consent_required = false;
