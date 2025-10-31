# Supabase Migration Instructions

## Setting up Recording Time Tracking

To track user recording time in Supabase, you need to run the migration SQL file to create the necessary table and policies.

### Steps:

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire contents of `migration.sql` into the query editor
6. Click **Run** to execute the migration

### What this migration creates:

- **`user_recording_stats` table**: Stores total recording time and count for each user
- **Row Level Security (RLS) policies**: Ensures users can only access their own stats
- **Automatic timestamp updates**: `last_updated` field is automatically updated on changes
- **Index**: Optimized for fast user lookups

### Table Structure:

```sql
user_recording_stats
├── user_id (UUID, Primary Key) - References auth.users
├── total_time_recorded_ms (BIGINT) - Total time in milliseconds
├── recording_count (INTEGER) - Number of recordings
├── last_updated (TIMESTAMPTZ) - Last update timestamp
└── created_at (TIMESTAMPTZ) - Creation timestamp
```

### Security:

The RLS policies ensure that:
- Users can only view their own statistics
- Users can only insert/update their own statistics
- All operations require authentication

### Testing:

After running the migration, the app will automatically:
1. Create a new entry when a user saves their first recording
2. Update the total time and count each time a recording is saved
3. Display statistics in the Profile screen

No additional configuration needed!

