-- Add 'poll_closed' status to session_status enum
-- This intermediate status allows organizers to review matches and assign bookers
-- before opening the session to players

ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'poll_closed' AFTER 'voting';

-- Add comment for documentation
COMMENT ON TYPE public.session_status IS 'Session lifecycle: draft -> voting -> poll_closed -> open -> closed/cancelled';
