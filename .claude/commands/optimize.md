---
description: Optimize MASTER_PROMPT.md based on testing CSV data
---

# Optimize Master Prompt

Run the prompt optimizer script to analyze testing feedback and improve MASTER_PROMPT.md.

## What I'll Do

1. Parse the CSV data you paste
2. Identify patterns in the improvement feedback
3. Use Claude to analyze and suggest specific prompt changes
4. Generate an updated MASTER_PROMPT.md with:
   - Version bump (e.g., v3.1.3 → v3.1.4)
   - Changelog entry
   - Improved prompt text based on feedback
5. Create a GitHub Pull Request with the changes
6. You can review and merge the PR in GitHub

## Usage

```
/optimize
[paste your CSV from ERA's !print command]
```

## What You Need to Provide

Paste the CSV output from ERA's `!print` command. It should look like this:

```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
1,"My employee didn't show up","Got it — that's...","Should ask clarifying questions first","content","2025-10-24 10:00:00"
...
```

## What Happens Next

After the optimization:
1. I'll show you a summary of changes
2. I'll create a GitHub Pull Request
3. You can review the diff in GitHub
4. Merge the PR when satisfied
5. Render will auto-deploy the updated prompt

Ready to optimize? Paste your CSV below!
