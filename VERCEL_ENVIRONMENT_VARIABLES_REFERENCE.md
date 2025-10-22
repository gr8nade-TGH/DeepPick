# Vercel Environment Variables Reference

## Current Environment Variables (as of 2025-10-22)

### Supabase Configuration
- **`NEXT_PUBLIC_SUPABASE_URL`**: `https://xckbsyeaywrfzvcahhtk.supabase.co`
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere
  - **Action Taken**: Added as new variable (2025-10-22)

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja2JzeWVheXdyZnp2Y2FoaHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2OTk5OTQsImV4cCI6MjA3NjI3NTk5NH0.X_FRhkUhefhTeiGRRNBckxusVFurEJ_bZMy1BImaCpI`
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere
  - **Action Taken**: Added as new variable (2025-10-22)

- **`SUPABASE_URL`**: `https://xckbsyeaywrfzvcahhtk.supabase.co`
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

- **`SUPABASE_ANON_KEY`**: (masked)
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

- **`SUPABASE_SERVICE_ROLE_KEY`**: (masked)
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere

### SHIVA Feature Flags
- **`SHIVA_V1_API_ENABLED`**: (masked)
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

- **`SHIVA_V1_WRITE_ENABLED`**: (masked)
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

- **`NEXT_PUBLIC_SHIVA_V1_API_ENABLED`**: (masked)
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

- **`NEXT_PUBLIC_SHIVA_V1_UI_ENABLED`**: (masked)
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

- **`NEXT_PUBLIC_SHIVA_V1_WRITE_ENABLED`**: (masked)
  - **Current Environment**: Preview, feature/shiva-management-v1
  - **Status**: ⚠️ Limited to preview branch only

### API Keys (All Environments)
- **`OPENAI_API_KEY`**: (masked)
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere

- **`PERPLEXITY_API_KEY`**: (masked)
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere

- **`THE_ODDS_API_KEY`**: (masked)
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere

- **`CRON_SECRET`**: (masked)
  - **Current Environment**: All Environments
  - **Status**: ✅ Available everywhere

## Issues Identified

### ✅ RESOLVED: Supabase Variables Added
The main Supabase configuration variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) have been added and are now available on all environments. This should resolve:
- 500 errors when trying to save factor configurations
- "Missing" environment variables in debug reports
- Database connection failures on production deployments

### Remaining Considerations

1. **Optional**: Moving other Supabase variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) to "All Environments" as well
2. **Feature Flags**: Decide if SHIVA feature flags should be available on production or remain preview-only

## Environment Variable Naming Convention

- **`NEXT_PUBLIC_*`**: Available in browser/client-side code
- **`*`** (no prefix): Server-side only, not exposed to browser
- **Feature Flags**: Use `NEXT_PUBLIC_*` for client-side feature toggles

## Last Updated
2025-10-22 - Initial documentation based on current Vercel configuration
- Updated: Added NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to All Environments
