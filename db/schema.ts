import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const playerProfiles = sqliteTable("player_profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  playerStateJson: text("player_state_json").notNull(),
  pvpStateJson: text("pvp_state_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
