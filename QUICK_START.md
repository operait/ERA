# Quick Start: Email & Calendar Features

## 🚀 5-Minute Setup (Development)

### 1. Install Dependencies (Already Done ✅)
```bash
npm install
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Microsoft Graph API Configuration
MICROSOFT_CLIENT_ID=your-client-id-here
MICROSOFT_CLIENT_SECRET=your-client-secret-here
MICROSOFT_TENANT_ID=your-tenant-id-here
GRAPH_API_SCOPES=Mail.Send,Calendars.ReadWrite
```

### 3. Run Database Migration

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual (copy SQL from file and run in Supabase dashboard)
# File: supabase/migrations/002_email_calendar_tables.sql
```

### 4. Build & Start

```bash
npm run build
npm start
```

### 5. Test in Teams

**Test Email Flow:**
```
You: "Employee missed 3 shifts, what should I do?"
ERA: [provides guidance + starts email flow]
```

**Test Calendar Flow:**
```
You: "Need to discuss performance with employee"
ERA: [provides guidance + starts calendar booking]
```

---

## 🔑 Azure AD Setup (Required for Production)

### Quick Setup Steps:

1. **Go to Azure Portal** → App Registrations → Your ERA App

2. **Add API Permissions:**
   - Microsoft Graph → Application permissions
   - Add: `Mail.Send`, `Calendars.ReadWrite`, `User.Read.All`
   - Click "Grant admin consent"

3. **Create Client Secret:**
   - Certificates & secrets → New client secret
   - Copy the value (only shown once!)

4. **Copy IDs:**
   - Application (client) ID
   - Directory (tenant) ID

5. **Update `.env`** with the values from step 3 & 4

---

## 📋 Verification Checklist

- [ ] Microsoft Graph dependencies installed
- [ ] Environment variables configured
- [ ] Database migration applied
- [ ] Build successful (`npm run build`)
- [ ] Azure AD permissions granted
- [ ] Email flow works in Teams
- [ ] Calendar flow works in Teams

---

## 🧪 Testing Commands

### Test Email Detection
```
"Employee needs a written warning via email"
```
Should trigger email flow.

### Test Calendar Detection
```
"I should call the employee to discuss this"
```
Should trigger calendar booking flow.

### Test Multi-turn Conversation
The bot will ask follow-up questions. Answer each one:
- Employee name
- Employee email
- Any template variables
- Confirmation (yes/no)

---

## 🆘 Troubleshooting

### "Insufficient privileges"
→ Ensure admin consent granted in Azure AD

### "Email not sending"
→ Check `email_logs` table for error messages

### "Calendar not loading"
→ Verify manager has Exchange Online mailbox

### Build errors
```bash
npm run typecheck  # Check for type errors
npm run build      # Rebuild
```

---

## 📚 Full Documentation

- **Setup Guide**: [EMAIL_CALENDAR_SETUP.md](EMAIL_CALENDAR_SETUP.md)
- **Feature Details**: [FEATURE_SUMMARY.md](FEATURE_SUMMARY.md)
- **Implementation**: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

---

## ⚡ Quick Commands Reference

```bash
# Development
npm run dev          # Start with hot reload
npm run build        # Compile TypeScript
npm run typecheck    # Check types only
npm start            # Production start

# Database
supabase db push     # Apply migrations
supabase db reset    # Reset database (dev only)

# Debugging
npm run lint         # Check code quality
```

---

## 🎯 Next Steps

1. ✅ Basic setup complete
2. 🧪 Test both email and calendar flows
3. 📝 Review and customize email templates
4. 🔐 Review security settings
5. 👥 Pilot test with 3-5 managers
6. 🚀 Full rollout

---

**Need Help?** See troubleshooting section in [EMAIL_CALENDAR_SETUP.md](EMAIL_CALENDAR_SETUP.md)
