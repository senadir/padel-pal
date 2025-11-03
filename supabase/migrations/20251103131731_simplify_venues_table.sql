-- Simplified venues table storing only essential venue information
-- This migration creates the venues table from scratch with minimal fields

-- Create venues table with simplified schema
CREATE TABLE IF NOT EXISTS public.venues (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  maps_url TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add RLS policies
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "venues_public_select" ON public.venues
  FOR SELECT
  TO public
  USING (true);

-- Organizers can manage venues
CREATE POLICY "venues_organizer_insert" ON public.venues
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');

CREATE POLICY "venues_organizer_update" ON public.venues
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');

CREATE POLICY "venues_organizer_delete" ON public.venues
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'user_role')::public.app_role = 'organizer');

-- Add comments
COMMENT ON TABLE public.venues IS 'Simplified venues table storing only essential venue information (label and maps URL)';
COMMENT ON COLUMN public.venues.label IS 'Display name of the venue';
COMMENT ON COLUMN public.venues.maps_url IS 'Google Maps URL for the venue (unique identifier)';
