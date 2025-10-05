@echo off
REM ERA MVP - Safe Git Repository Setup Script for Windows

echo Setting up ERA GitHub repository...
echo =====================================

REM Initialize git if not already initialized
if not exist .git (
    echo Initializing git repository...
    git init
) else (
    echo Git already initialized
)

REM Check if .env is being tracked
git ls-files .env >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: .env is being tracked! Removing from git...
    git rm --cached .env
) else (
    echo .env file is not tracked - good!
)

REM Add all files except those in .gitignore
echo Adding files to git...
git add .

REM Show what will be committed
echo.
echo Files to be committed:
git status --short

REM Check if .env would be committed
git status --short | findstr /C:".env" >nul
if %errorlevel% equ 0 (
    echo.
    echo ERROR: .env file would be committed!
    echo Please fix this before proceeding
    exit /b 1
)

echo.
echo Ready to commit! Your secrets are safe.
echo.
echo Next steps:
echo 1. Run: git commit -m "Initial ERA MVP commit - HR Assistant Bot for Teams"
echo 2. Run: git branch -M main
echo 3. Run: git remote add origin https://github.com/operait/ERA.git
echo 4. Run: git push -u origin main