# Supabase Project Credentials

## Project Information

**Project Name**: Era Fitness Connection
**Project URL**: `djrquyyppywxxqqdioih.supabase.co`
**Full URL**: `https://djrquyyppywxxqqdioih.supabase.co`
**Database Password**: `YLpm@MPFe8!EMdW`

## Getting Your API Keys

### Step 1: Access Project Settings

1. Go to https://supabase.com/dashboard
2. Select project: **Era Fitness Connection**
3. Click on ⚙️ **Settings** in the left sidebar
4. Click on **API** under Project Settings

### Step 2: Copy API Keys

You'll find two important keys on this page:

#### Anon (Public) Key
- Used for client-side operations
- Safe to expose in frontend code
- Copy the value under "anon public"

#### Service Role Key
- Used for backend operations (ERA bot uses this)
- **NEVER expose this key publicly**
- Has full database access
- Copy the value under "service_role"

### Step 3: Update .env File

Replace the placeholder values in your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://djrquyyppywxxqqdioih.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Copy from Supabase
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Copy from Supabase
```

## Security Notes

⚠️ **IMPORTANT**:
- ✅ `.env` is already in `.gitignore` (your keys won't be committed)
- ✅ Only use **SERVICE_ROLE_KEY** for backend operations
- ✅ Store database password securely (needed for SQL operations)
- ❌ Never commit real API keys to GitHub
- ❌ Don't share service role key publicly

## Database Access

**Connection String**: Available in Settings → Database → Connection string

**Direct Database Connection**:
- Host: `db.djrquyyppywxxqqdioih.supabase.co`
- Database: `postgres`
- Port: `5432`
- User: `postgres`
- Password: `YLpm@MPFe8!EMdW`

## Quick Actions

### Access SQL Editor
https://supabase.com/dashboard/project/djrquyyppywxxqqdioih/sql

### View Tables
https://supabase.com/dashboard/project/djrquyyppywxxqqdioih/editor

### Check Logs
https://supabase.com/dashboard/project/djrquyyppywxxqqdioih/logs

## Next Steps

1. ✅ Project created
2. ⏳ Copy API keys from Settings → API
3. ⏳ Update `.env` file with real keys
4. ⏳ Run database migrations (see SUPABASE_SETUP.md)
5. ⏳ Load Fitness Connection data
6. ⏳ Generate embeddings

---

**Ready to proceed with database setup!** See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the next steps.