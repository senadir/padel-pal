-- Add is_blocked column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN players.is_blocked IS 'Whether the player is blocked by an organizer from joining matches';
