-- Add RLS policy for organizers to insert votes for any player
CREATE POLICY "session_votes_organizer_insert" ON "public"."session_votes"
FOR INSERT TO "authenticated"
WITH CHECK (
  (auth.jwt() ->> 'user_role')::public.app_role = 'organizer'::public.app_role
);

-- Add comment for documentation
COMMENT ON POLICY "session_votes_organizer_insert" ON "public"."session_votes"
IS 'Organizers can add votes on behalf of any player';
