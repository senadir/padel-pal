-- Add place_id column to venues table
-- This stores the Google Place ID for each venue

ALTER TABLE public.venues
ADD COLUMN place_id TEXT;

-- Add index on place_id for fast lookups
CREATE INDEX venues_place_id_idx ON public.venues(place_id);

-- Add comment
COMMENT ON COLUMN public.venues.place_id IS 'Google Place ID for the venue (optional, used for deduplication)';
