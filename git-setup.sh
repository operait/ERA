#!/bin/bash

# ERA MVP - Safe Git Repository Setup Script

echo "🚀 Setting up ERA GitHub repository..."
echo "======================================="

# Initialize git if not already initialized
if [ ! -d .git ]; then
    echo "📦 Initializing git repository..."
    git init
else
    echo "✅ Git already initialized"
fi

# Verify .env is in gitignore
if grep -q "^.env" .gitignore; then
    echo "✅ .env is properly ignored"
else
    echo "⚠️  Adding .env to .gitignore"
    echo ".env" >> .gitignore
fi

# Check if .env exists and warn if it would be tracked
if [ -f .env ]; then
    git_check=$(git ls-files .env 2>/dev/null)
    if [ ! -z "$git_check" ]; then
        echo "⚠️  WARNING: .env is being tracked! Removing from git..."
        git rm --cached .env
    else
        echo "✅ .env file exists but is not tracked (good!)"
    fi
fi

# Add all files except those in .gitignore
echo "📝 Adding files to git..."
git add .

# Show what will be committed
echo ""
echo "📋 Files to be committed:"
git status --short

# Verify .env is NOT in the list
if git status --short | grep -q "\.env"; then
    echo ""
    echo "❌ ERROR: .env file would be committed!"
    echo "Please fix this before proceeding"
    exit 1
fi

echo ""
echo "✅ Ready to commit! Your secrets are safe."
echo ""
echo "Next steps:"
echo "1. Run: git commit -m \"Initial ERA MVP commit - HR Assistant Bot for Teams\""
echo "2. Run: git branch -M main"
echo "3. Run: git remote add origin https://github.com/operait/ERA.git"
echo "4. Run: git push -u origin main"
echo ""
echo "Or run all at once:"
echo "git commit -m \"Initial ERA MVP commit - HR Assistant Bot for Teams\" && git branch -M main && git remote add origin https://github.com/operait/ERA.git && git push -u origin main"