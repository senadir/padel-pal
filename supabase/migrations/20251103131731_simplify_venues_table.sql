-- Simplify venues table to only essential fields
-- Keep: id (PK), label (venue name), maps_url (Google Maps link)

-- Drop unused columns
ALTER TABLE public.venues
DROP COLUMN IF EXISTS formatted_address,
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS google_place_id,
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude,
DROP COLUMN IF EXISTS usage_count,
DROP COLUMN IF EXISTS last_used_at;

-- Rename 'name' to 'label' for clarity
ALTER TABLE public.venues
RENAME COLUMN name TO label;

-- Rename 'google_maps_url' to 'maps_url' for simplicity
ALTER TABLE public.venues
RENAME COLUMN google_maps_url TO maps_url;

-- Ensure maps_url is required (can't be null)
ALTER TABLE public.venues
ALTER COLUMN maps_url SET NOT NULL;

-- Add unique constraint on maps_url to prevent duplicates
ALTER TABLE public.venues
ADD CONSTRAINT venues_maps_url_unique UNIQUE (maps_url);

-- Update RLS policies to match new schema (no changes needed, they work with any columns)

-- Add comment to table
COMMENT ON TABLE public.venues IS 'Simplified venues table storing only essential venue information (label and maps URL)';
COMMENT ON COLUMN public.venues.label IS 'Display name of the venue';
COMMENT ON COLUMN public.venues.maps_url IS 'Google Maps URL for the venue (unique identifier)';
