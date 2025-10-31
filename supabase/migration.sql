-- Create table to track user recording statistics
CREATE TABLE IF NOT EXISTS user_recording_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_time_recorded_ms BIGINT NOT NULL DEFAULT 0,
  recording_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_recording_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own stats
CREATE POLICY "Users can view their own stats"
  ON user_recording_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own stats
CREATE POLICY "Users can insert their own stats"
  ON user_recording_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own stats
CREATE POLICY "Users can update their own stats"
  ON user_recording_stats
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_recording_stats_user_id ON user_recording_stats(user_id);

-- Create function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update last_updated on row update
CREATE TRIGGER update_user_recording_stats_last_updated
  BEFORE UPDATE ON user_recording_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated_column();

