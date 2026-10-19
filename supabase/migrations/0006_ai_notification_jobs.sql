GRANT SELECT, INSERT ON notifications TO ai_job;

CREATE POLICY ai_read_notifications
ON notifications
FOR SELECT
TO ai_job
USING (true);

CREATE POLICY ai_insert_notifications
ON notifications
FOR INSERT
TO ai_job
WITH CHECK (audience IN ('admin', 'mitra'));
