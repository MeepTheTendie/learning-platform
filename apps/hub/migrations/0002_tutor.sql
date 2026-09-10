CREATE TABLE IF NOT EXISTS tutor_usage (
  app_id TEXT NOT NULL,
  day TEXT NOT NULL,
  messages INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, day)
);
