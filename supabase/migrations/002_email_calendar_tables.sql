-- Migration: Email and Calendar Integration Tables
-- Description: Add tables for tracking sent emails and calendar bookings

-- Email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  template_id UUID REFERENCES templates(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Calendar bookings table
CREATE TABLE IF NOT EXISTS calendar_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_phone TEXT,
  event_id TEXT NOT NULL, -- Outlook event ID
  scheduled_time TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  topic TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for common queries
CREATE INDEX idx_email_logs_manager_id ON email_logs(manager_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at DESC);

CREATE INDEX idx_calendar_bookings_manager_id ON calendar_bookings(manager_id);
CREATE INDEX idx_calendar_bookings_status ON calendar_bookings(status);
CREATE INDEX idx_calendar_bookings_scheduled_time ON calendar_bookings(scheduled_time);

-- Extend templates table for email metadata
ALTER TABLE templates ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS email_recipient_field TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_type TEXT DEFAULT 'response' CHECK (template_type IN ('response', 'email', 'both'));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_bookings_updated_at
  BEFORE UPDATE ON calendar_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE email_logs IS 'Audit log for all emails sent through ERA';
COMMENT ON TABLE calendar_bookings IS 'Tracking for all calendar events created by ERA';
COMMENT ON COLUMN email_logs.metadata IS 'Additional metadata (conversation_id, policy_references, etc.)';
COMMENT ON COLUMN calendar_bookings.metadata IS 'Additional metadata (conversation_id, policy_context, etc.)';
