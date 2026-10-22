ALTER TABLE DemoRun ADD COLUMN active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1));
ALTER TABLE DemoRun ADD COLUMN realmId TEXT;
ALTER TABLE DemoRun ADD COLUMN clientId TEXT;
ALTER TABLE DemoRun ADD COLUMN issuer TEXT;
CREATE UNIQUE INDEX single_active_run ON DemoRun(active) WHERE active=1;
ALTER TABLE Exam ADD COLUMN authorAlias TEXT NOT NULL DEFAULT 'Authenticated author';
ALTER TABLE ActivityEvent ADD COLUMN actorAlias TEXT NOT NULL DEFAULT 'Authenticated participant';
CREATE INDEX activity_run_time ON ActivityEvent(runId,observedAt,id);
