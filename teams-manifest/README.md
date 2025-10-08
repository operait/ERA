# ERA Teams App Manifest

This directory contains the Microsoft Teams app manifest and icons for the ERA HR Assistant bot.

## Setup Instructions

1. **Update manifest.json**:
   - Replace both instances of `YOUR_MICROSOFT_APP_ID_HERE` with your actual Microsoft App ID from Azure Portal
   - The App ID can be found in Azure Portal > Your Bot > Configuration > Microsoft App ID

2. **Create the app package**:
   - Zip the following 3 files together:
     - manifest.json
     - color.png
     - outline.png
   - Name the zip file: `era-teams-app.zip`
   - **IMPORTANT**: The files must be at the root of the zip (not in a folder)

3. **Upload to Teams**:
   - Open Microsoft Teams
   - Click **Apps** in the left sidebar
   - Click **Manage your apps** (bottom left)
   - Click **Upload an app** > **Upload a custom app**
   - Select your `era-teams-app.zip` file
   - Click **Add** to install for yourself, or **Add to a team** to install for a team

4. **Start using ERA**:
   - Once installed, open the ERA bot
   - Start asking HR policy questions!

## Example Questions

- "Employee missed 3 shifts without calling in, what do I do?"
- "What's the process for issuing a written warning?"
- "How do I handle tardiness issues?"
- "What's our policy on personal phone use during work?"

## Troubleshooting

If you get permission errors:
- You may need Teams admin approval to upload custom apps
- Contact your IT admin or enable "Upload custom apps" in Teams admin center
- Alternatively, your admin can upload the app to your organization's app catalog
