-- Add booker_id column to matches table
-- This references a match_participant who should be the booker for the match
ALTER TABLE public.matches
ADD COLUMN booker_id BIGINT REFERENCES public.match_participants(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.matches.booker_id IS 'Reference to the match_participant who is designated as the booker for this match';;
