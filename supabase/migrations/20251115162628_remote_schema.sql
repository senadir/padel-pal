SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
COMMENT ON SCHEMA "public" IS 'standard public schema';
CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
CREATE TYPE "public"."Levels" AS ENUM (
    'beginner',
    'improver',
    'intermediate',
    'advanced'
);
ALTER TYPE "public"."Levels" OWNER TO "postgres";
COMMENT ON TYPE "public"."Levels" IS 'Possible games level';
CREATE TYPE "public"."app_role" AS ENUM (
    'player',
    'organizer'
);
ALTER TYPE "public"."app_role" OWNER TO "postgres";
CREATE TYPE "public"."session_status" AS ENUM (
    'draft',
    'voting',
    'open',
    'cancelled',
    'closed'
);
ALTER TYPE "public"."session_status" OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."broadcast_changes_for_sessions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'sessions:' || COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION "public"."broadcast_changes_for_sessions"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."check_match_time_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check if player is already in a match with overlapping time
  IF EXISTS (
    SELECT 1
    FROM match_participants mp
    JOIN matches m1 ON mp.match_id = m1.id
    JOIN matches m2 ON m2.id = NEW.match_id
    WHERE mp.player_id = NEW.player_id
      AND mp.match_id != NEW.match_id
      AND m1.session_id = m2.session_id
      AND (
        -- Check if time ranges overlap
        (m1.start_time, m1.end_time) OVERLAPS (m2.start_time, m2.end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Player is already in a match during this time slot';
  END IF;
  
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."check_match_time_overlap"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  claims JSONB;
  user_role public.app_role;
BEGIN
  -- Fetch the user's role from user_roles table
  -- Note: Users can have multiple roles, but we'll select the highest privilege role
  -- organizer > player
  SELECT role INTO user_role 
  FROM public.user_roles 
  WHERE user_id = (event->>'user_id')::UUID
  ORDER BY 
    CASE role
      WHEN 'organizer' THEN 1
      WHEN 'player' THEN 2
    END
  LIMIT 1;
  
  -- Get existing claims from the event
  claims := event->'claims';
  
  -- Set the user_role claim
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    -- Default to 'player' if no role found
    claims := jsonb_set(claims, '{user_role}', to_jsonb('player'::public.app_role));
  END IF;
  
  -- Update the event with new claims
  event := jsonb_set(event, '{claims}', claims);
  
  RETURN event;
END;
$$;
ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") IS 'Adds user_role claim to JWT tokens from user_roles table';
CREATE OR REPLACE FUNCTION "public"."update_session_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."update_session_templates_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";
SET default_tablespace = '';
SET default_table_access_method = "heap";
CREATE TABLE IF NOT EXISTS "public"."match_participants" (
    "id" bigint NOT NULL,
    "match_id" bigint NOT NULL,
    "player_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."match_participants" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."match_participants_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE "public"."match_participants_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."match_participants_id_seq" OWNED BY "public"."match_participants"."id";
CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" bigint NOT NULL,
    "session_id" bigint NOT NULL,
    "public_id" "text" NOT NULL,
    "time_slot_id" "text" NOT NULL,
    "level" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "max_players" integer DEFAULT 4 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "playtomic_match_id" bigint
);
ALTER TABLE "public"."matches" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."matches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE "public"."matches_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."matches_id_seq" OWNED BY "public"."matches"."id";
CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "playtomic_id" integer,
    "level" real,
    "avatar" "text",
    "status" "text",
    "name" "text",
    "phone" "text"
);
ALTER TABLE "public"."players" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."playtomic_matches" (
    "id" bigint NOT NULL,
    "playtomic_match_id" "text" NOT NULL,
    "match_url" "text" NOT NULL,
    "club_name" "text" NOT NULL,
    "court_name" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "playtomic_players" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "match_status" "text",
    "score" "jsonb",
    "last_synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "playtomic_matches_match_status_check" CHECK (("match_status" = ANY (ARRAY['scheduled'::"text", 'played'::"text", 'cancelled'::"text"])))
);
ALTER TABLE "public"."playtomic_matches" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."playtomic_matches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE "public"."playtomic_matches_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."playtomic_matches_id_seq" OWNED BY "public"."playtomic_matches"."id";
CREATE TABLE IF NOT EXISTS "public"."session_templates" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "template_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."session_templates" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."session_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE "public"."session_templates_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."session_templates_id_seq" OWNED BY "public"."session_templates"."id";
CREATE TABLE IF NOT EXISTS "public"."session_votes" (
    "id" bigint NOT NULL,
    "player_id" "uuid" NOT NULL,
    "session_id" bigint NOT NULL,
    "option_id" "text" NOT NULL,
    "voted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."session_votes" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."session_votes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE "public"."session_votes_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."session_votes_id_seq" OWNED BY "public"."session_votes"."id";
CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" integer NOT NULL,
    "venue_name" "text",
    "time_slots" "jsonb",
    "venue_location" "text",
    "date" timestamp with time zone,
    "levels" "text"[] NOT NULL,
    "time_blocks" smallint DEFAULT '60'::smallint,
    "limit_players" boolean DEFAULT false,
    "players_per_slot" smallint DEFAULT '4'::smallint,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "public_id" "text" NOT NULL,
    "status" "public"."session_status" DEFAULT 'draft'::"public"."session_status" NOT NULL,
    "voting_closes_at" timestamp with time zone,
    "venues" "jsonb" DEFAULT '[]'::"jsonb"
);
ALTER TABLE "public"."sessions" OWNER TO "postgres";
COMMENT ON TABLE "public"."sessions" IS 'Sessions are a collection of games to be organised in a given week.';
COMMENT ON COLUMN "public"."sessions"."status" IS 'Session lifecycle: draft -> voting -> open -> closed (or cancelled at any point)';
COMMENT ON COLUMN "public"."sessions"."voting_closes_at" IS 'Deadline for voting; NULL means no deadline set';
COMMENT ON COLUMN "public"."sessions"."venues" IS 'Array of venue objects with structure: [{name: string, location: string, placeId?: string, isPrimary: boolean}]';
ALTER TABLE "public"."sessions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."user_roles" OWNER TO "postgres";
COMMENT ON TABLE "public"."user_roles" IS 'Maps users to their roles for RBAC system. Users can have multiple roles.';
ALTER TABLE "public"."user_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" bigint NOT NULL,
    "label" "text" DEFAULT ''::"text",
    "maps_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "place_id" "text" NOT NULL,
    "playtomic_id" "text"
);
ALTER TABLE "public"."venues" OWNER TO "postgres";
CREATE SEQUENCE IF NOT EXISTS "public"."venues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE "public"."venues_id_seq" OWNER TO "postgres";
ALTER SEQUENCE "public"."venues_id_seq" OWNED BY "public"."venues"."id";
ALTER TABLE ONLY "public"."match_participants" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."match_participants_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."matches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."matches_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."playtomic_matches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."playtomic_matches_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."session_templates" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."session_templates_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."session_votes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."session_votes_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."venues" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."venues_id_seq"'::"regclass");
ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_match_id_player_id_key" UNIQUE ("match_id", "player_id");
ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_public_id_key" UNIQUE ("public_id");
ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_playtomic_id_key" UNIQUE ("playtomic_id");
ALTER TABLE ONLY "public"."playtomic_matches"
    ADD CONSTRAINT "playtomic_matches_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."playtomic_matches"
    ADD CONSTRAINT "playtomic_matches_playtomic_match_id_key" UNIQUE ("playtomic_match_id");
ALTER TABLE ONLY "public"."session_templates"
    ADD CONSTRAINT "session_templates_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."session_votes"
    ADD CONSTRAINT "session_votes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."session_votes"
    ADD CONSTRAINT "session_votes_player_id_session_id_option_id_key" UNIQUE ("player_id", "session_id", "option_id");
ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_id_key" UNIQUE ("id");
ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id", "public_id");
ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_public_id_key" UNIQUE ("public_id");
ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");
ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_place_id_key" UNIQUE ("place_id");
ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_playtomic_id_key" UNIQUE ("playtomic_id");
CREATE INDEX "idx_match_participants_match_id" ON "public"."match_participants" USING "btree" ("match_id");
CREATE INDEX "idx_match_participants_player_id" ON "public"."match_participants" USING "btree" ("player_id");
CREATE INDEX "idx_matches_playtomic_match_id" ON "public"."matches" USING "btree" ("playtomic_match_id");
CREATE INDEX "idx_matches_public_id" ON "public"."matches" USING "btree" ("public_id");
CREATE INDEX "idx_matches_session_id" ON "public"."matches" USING "btree" ("session_id");
CREATE INDEX "idx_playtomic_matches_match_id" ON "public"."playtomic_matches" USING "btree" ("playtomic_match_id");
CREATE INDEX "idx_session_templates_created_by" ON "public"."session_templates" USING "btree" ("created_by");
CREATE INDEX "idx_session_votes_player_id" ON "public"."session_votes" USING "btree" ("player_id");
CREATE INDEX "idx_session_votes_session_id" ON "public"."session_votes" USING "btree" ("session_id");
CREATE INDEX "idx_sessions_status" ON "public"."sessions" USING "btree" ("status");
CREATE INDEX "idx_sessions_voting_closes_at" ON "public"."sessions" USING "btree" ("voting_closes_at");
CREATE OR REPLACE TRIGGER "check_match_time_overlap_trigger" BEFORE INSERT ON "public"."match_participants" FOR EACH ROW EXECUTE FUNCTION "public"."check_match_time_overlap"();
CREATE OR REPLACE TRIGGER "match_participants_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."match_participants" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_changes_for_sessions"();
CREATE OR REPLACE TRIGGER "matches_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_changes_for_sessions"();
CREATE OR REPLACE TRIGGER "session_templates_updated_at" BEFORE UPDATE ON "public"."session_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_templates_updated_at"();
CREATE OR REPLACE TRIGGER "session_votes_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."session_votes" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_changes_for_sessions"();
CREATE OR REPLACE TRIGGER "sessions_broadcast_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."sessions" FOR EACH ROW EXECUTE FUNCTION "public"."broadcast_changes_for_sessions"();
CREATE OR REPLACE TRIGGER "update_matches_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
CREATE OR REPLACE TRIGGER "update_venues_updated_at" BEFORE UPDATE ON "public"."venues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."match_participants"
    ADD CONSTRAINT "match_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_playtomic_match_id_fkey" FOREIGN KEY ("playtomic_match_id") REFERENCES "public"."playtomic_matches"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY "public"."session_templates"
    ADD CONSTRAINT "session_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."session_votes"
    ADD CONSTRAINT "session_votes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."session_votes"
    ADD CONSTRAINT "session_votes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
CREATE POLICY "Organizers can delete own templates" ON "public"."session_templates" FOR DELETE USING ((((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role") AND ("created_by" = "auth"."uid"())));
CREATE POLICY "Organizers can insert templates" ON "public"."session_templates" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "Organizers can update own templates" ON "public"."session_templates" FOR UPDATE USING ((((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role") AND ("created_by" = "auth"."uid"())));
CREATE POLICY "Templates are viewable by everyone" ON "public"."session_templates" FOR SELECT USING (true);
ALTER TABLE "public"."match_participants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_participants_delete_own" ON "public"."match_participants" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "player_id"));
CREATE POLICY "match_participants_insert_own" ON "public"."match_participants" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "player_id"));
CREATE POLICY "match_participants_organizer_delete" ON "public"."match_participants" FOR DELETE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "match_participants_organizer_insert" ON "public"."match_participants" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "match_participants_organizer_update" ON "public"."match_participants" FOR UPDATE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role")) WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "match_participants_public_select" ON "public"."match_participants" FOR SELECT USING (true);
ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_organizer_delete" ON "public"."matches" FOR DELETE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "matches_organizer_insert" ON "public"."matches" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "matches_organizer_update" ON "public"."matches" FOR UPDATE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role")) WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "matches_public_select" ON "public"."matches" FOR SELECT USING (true);
ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_delete_own" ON "public"."players" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));
CREATE POLICY "players_insert_own" ON "public"."players" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));
CREATE POLICY "players_select_anon" ON "public"."players" FOR SELECT TO "anon" USING (true);
CREATE POLICY "players_select_authenticated" ON "public"."players" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "players_update_own" ON "public"."players" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));
ALTER TABLE "public"."playtomic_matches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playtomic_matches_delete_organizer" ON "public"."playtomic_matches" FOR DELETE USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "playtomic_matches_insert_organizer" ON "public"."playtomic_matches" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "playtomic_matches_select_public" ON "public"."playtomic_matches" FOR SELECT USING (true);
CREATE POLICY "playtomic_matches_update_organizer" ON "public"."playtomic_matches" FOR UPDATE USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
ALTER TABLE "public"."session_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."session_votes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_votes_delete_own" ON "public"."session_votes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "player_id"));
CREATE POLICY "session_votes_insert_own" ON "public"."session_votes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "player_id"));
CREATE POLICY "session_votes_organizer_delete" ON "public"."session_votes" FOR DELETE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "session_votes_public_select" ON "public"."session_votes" FOR SELECT USING (true);
ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_organizer_delete" ON "public"."sessions" FOR DELETE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "sessions_organizer_insert" ON "public"."sessions" FOR INSERT TO "authenticated" WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "sessions_organizer_update" ON "public"."sessions" FOR UPDATE TO "authenticated" USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role")) WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "sessions_public_select" ON "public"."sessions" FOR SELECT USING (true);
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_organizer_delete" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) = 'organizer'::"public"."app_role"));
CREATE POLICY "user_roles_organizer_insert" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) = 'organizer'::"public"."app_role"));
CREATE POLICY "user_roles_organizer_update" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ((( SELECT "user_roles_1"."role"
   FROM "public"."user_roles" "user_roles_1"
  WHERE ("user_roles_1"."user_id" = "auth"."uid"())) = 'organizer'::"public"."app_role"));
CREATE POLICY "user_roles_select_all" ON "public"."user_roles" FOR SELECT USING (true);
ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_delete_organizer" ON "public"."venues" FOR DELETE USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "venues_insert_organizer" ON "public"."venues" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "venues_insert_organizers" ON "public"."venues" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "venues_select_public" ON "public"."venues" FOR SELECT USING (true);
CREATE POLICY "venues_update_organizer" ON "public"."venues" FOR UPDATE USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role")) WITH CHECK (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
CREATE POLICY "venues_update_organizers" ON "public"."venues" FOR UPDATE USING (((("auth"."jwt"() ->> 'user_role'::"text"))::"public"."app_role" = 'organizer'::"public"."app_role"));
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";
GRANT ALL ON FUNCTION "public"."broadcast_changes_for_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."broadcast_changes_for_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."broadcast_changes_for_sessions"() TO "service_role";
GRANT ALL ON FUNCTION "public"."check_match_time_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_match_time_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_match_time_overlap"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";
GRANT ALL ON FUNCTION "public"."update_session_templates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_templates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_templates_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
GRANT ALL ON TABLE "public"."match_participants" TO "anon";
GRANT ALL ON TABLE "public"."match_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."match_participants" TO "service_role";
GRANT ALL ON SEQUENCE "public"."match_participants_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."match_participants_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."match_participants_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";
GRANT SELECT ON TABLE "public"."players" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."playtomic_matches" TO "anon";
GRANT ALL ON TABLE "public"."playtomic_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."playtomic_matches" TO "service_role";
GRANT ALL ON SEQUENCE "public"."playtomic_matches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."playtomic_matches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."playtomic_matches_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."session_templates" TO "anon";
GRANT ALL ON TABLE "public"."session_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."session_templates" TO "service_role";
GRANT ALL ON SEQUENCE "public"."session_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."session_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."session_templates_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."session_votes" TO "anon";
GRANT ALL ON TABLE "public"."session_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."session_votes" TO "service_role";
GRANT ALL ON SEQUENCE "public"."session_votes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."session_votes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."session_votes_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";
GRANT ALL ON SEQUENCE "public"."sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sessions_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."venues_id_seq" TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
