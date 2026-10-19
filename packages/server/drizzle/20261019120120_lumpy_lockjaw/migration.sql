CREATE TABLE "daily_completions" (
	"player_id" text,
	"day_key" text,
	"game_id" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_completions_pkey" PRIMARY KEY("player_id","day_key","game_id")
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"game_id" text,
	"stream_id" bigint,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"actor" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_events_pkey" PRIMARY KEY("game_id","stream_id")
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"game_id" text,
	"player_id" text NOT NULL,
	"seat" integer,
	"status" text DEFAULT 'joined' NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"rating_at_create" integer DEFAULT 1200 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"incorrect" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "game_players_pkey" PRIMARY KEY("game_id","seat")
);
--> statement-breakpoint
CREATE TABLE "game_results" (
	"game_id" text PRIMARY KEY,
	"winner_id" text,
	"is_tie" boolean DEFAULT false NOT NULL,
	"leaderboard" jsonb DEFAULT '[]' NOT NULL,
	"rating_changes" jsonb DEFAULT '[]' NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY,
	"game_id" text NOT NULL,
	"category" text NOT NULL,
	"mode" text NOT NULL,
	"type" text DEFAULT 'duel' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"created_by" text,
	"config" jsonb NOT NULL,
	"rated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "player_stats" (
	"player_id" text PRIMARY KEY,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_solved" integer DEFAULT 0 NOT NULL,
	"total_time_ms" bigint DEFAULT 0 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"league_points" integer DEFAULT 0 NOT NULL,
	"perfect_runs" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY,
	"handle" text NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"avatar_seed" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'IN' NOT NULL,
	"college" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"is_pro" boolean DEFAULT false NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"bot_skill" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"id" bigserial PRIMARY KEY,
	"player_id" text NOT NULL,
	"game_id" text NOT NULL,
	"score" integer NOT NULL,
	"solved" boolean NOT NULL,
	"accuracy" real NOT NULL,
	"duration_ms" integer NOT NULL,
	"mistakes" integer DEFAULT 0 NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"is_daily" boolean DEFAULT false NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_state" (
	"player_id" text,
	"day_key" text,
	"counters" jsonb DEFAULT '{"totalGames":0,"duels":0,"puzzles":0,"dailyPuzzles":0,"perfectRuns":0}' NOT NULL,
	"claimed" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "quest_state_pkey" PRIMARY KEY("player_id","day_key")
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"player_id" text,
	"game_id" text,
	"rating" integer DEFAULT 1200 NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ratings_pkey" PRIMARY KEY("player_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "search_tickets" (
	"ticket_id" text PRIMARY KEY,
	"player_id" text NOT NULL,
	"game_id" text NOT NULL,
	"category" text DEFAULT 'classical' NOT NULL,
	"rated" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'searching' NOT NULL,
	"ticket_rating" integer DEFAULT 1200 NOT NULL,
	"game_id_assigned" text,
	"bot_eligible_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"player_id" text PRIMARY KEY,
	"current" integer DEFAULT 0 NOT NULL,
	"best" integer DEFAULT 0 NOT NULL,
	"last_played_day" text,
	"claimed_days" text[] DEFAULT '{}'::text[] NOT NULL,
	"shields" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"player_id" text PRIMARY KEY,
	"pies" integer DEFAULT 500 NOT NULL,
	"skips" integer DEFAULT 3 NOT NULL,
	"skips_reset_at" text NOT NULL,
	"xp_booster_until" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "game_players_by_player" ON "game_players" ("player_id");--> statement-breakpoint
CREATE INDEX "games_recent" ON "games" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plays_player_recent" ON "plays" ("player_id","played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "plays_game_score" ON "plays" ("game_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "search_open" ON "search_tickets" ("game_id","status","ticket_rating");--> statement-breakpoint
ALTER TABLE "daily_completions" ADD CONSTRAINT "daily_completions_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_game_id_games_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_players_id_fkey" FOREIGN KEY ("created_by") REFERENCES "players"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "quest_state" ADD CONSTRAINT "quest_state_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "search_tickets" ADD CONSTRAINT "search_tickets_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_player_id_players_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE;