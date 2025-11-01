# Deployment Branch Mismatch Troubleshooting Guide

## Problem: Deployments not matching latest code from master

If your deployed application doesn't reflect the latest code you've pushed to master, check these potential issues:

## 🔍 Common Causes

### 1. **Manual Deploy Script Not Pulling Latest Code**
**Fixed**: The `deploy.sh` script now automatically pulls the latest code before building.

**If using the script manually:**
```bash
./deploy.sh
```
The script will now:
- Check if you're in a git repository
- Pull the latest code from your current branch
- Warn about uncommitted changes
- Build and deploy

### 2. **Firebase App Hosting Source Configuration**
Firebase App Hosting can be configured to automatically build from a GitHub repository. If this is configured with the wrong branch, it won't pick up your latest pushes.

**How to check and fix:**

1. **Go to Firebase Console:**
   - Navigate to: https://console.firebase.google.com
   - Select your project
   - Go to **App Hosting** section

2. **Check the source repository configuration:**
   - Look for "Source repository" or "GitHub connection"
   - Verify which branch it's configured to use
   - Should be set to: `master` (or `main` if that's your default branch)

3. **Update if needed:**
   - If it's pointing to a different branch, update it to `master`
   - If it's pointing to a specific commit, change it to track a branch instead

### 3. **GitHub Actions Workflow Configuration**
Your `.github/workflows/deploy.yml` is configured to deploy on pushes to both `main` and `master` branches.

**Check if GitHub Actions is working:**
- Go to: https://github.com/tonnguyen291/ReceiptShield-MVP/actions
- Verify that workflows are running on pushes to master
- Check if deployments are succeeding

**Potential issues:**
- Missing `FIREBASE_TOKEN` secret → Deployment will be skipped
- Missing `FIREBASE_PROJECT_ID` secret → Deployment will be skipped
- Workflow might be configured for `main` but you're pushing to `master`

### 4. **Local vs Remote Branch Mismatch**
If you're deploying manually, ensure your local `master` branch matches remote.

**Check your current branch:**
```bash
git branch --show-current
```

**Ensure you're on master:**
```bash
git checkout master
```

**Pull latest:**
```bash
git pull origin master
```

**Verify you're up to date:**
```bash
git status
```

### 5. **Build Cache Issues**
Next.js might be using cached builds. Clear the cache:

```bash
rm -rf .next
rm -rf node_modules/.cache
npm run build
```

## ✅ Quick Checklist

Before deploying, verify:

- [ ] You've pushed your latest code to `origin/master`
- [ ] Your local `master` branch is up to date: `git pull origin master`
- [ ] You're on the `master` branch: `git checkout master`
- [ ] Firebase App Hosting source is configured for `master` branch (in Firebase Console)
- [ ] GitHub Actions secrets are configured (`FIREBASE_TOKEN`, `FIREBASE_PROJECT_ID`)
- [ ] Build cache is cleared (if issues persist)

## 🚀 Deployment Methods

### Option 1: Use the updated deploy.sh script (Recommended for manual deploys)
```bash
./deploy.sh
```
This will automatically pull latest code before building.

### Option 2: Use GitHub Actions (Automatic)
- Push to `master` branch
- GitHub Actions will automatically build and deploy
- Check deployment status in GitHub Actions tab

### Option 3: Manual Firebase CLI
```bash
git pull origin master  # Pull latest first!
npm run build
firebase deploy --only apphosting
```

## 🔧 Debugging Steps

1. **Check what commit is deployed:**
   - Add a build timestamp/env var to your app
   - Check the deployed version vs your latest commit

2. **Verify Firebase App Hosting build logs:**
   - Firebase Console → App Hosting → Builds
   - Check which commit SHA the latest build used
   - Compare with your latest `git log`

3. **Check GitHub Actions logs:**
   - If using GitHub Actions, check the workflow logs
   - Verify it's building from the correct branch/commit

4. **Force a new deployment:**
   - In Firebase Console, manually trigger a new build
   - Or push a small change (like a comment) to force rebuild

## 📝 Important Notes

- **Firebase App Hosting** can have TWO different deployment methods:
  1. **Automatic builds from GitHub** (configured in Firebase Console)
  2. **Manual CLI deployments** (using `firebase deploy --only apphosting`)

- Make sure you know which method you're using, and that it's configured correctly!

- If you have automatic builds enabled in Firebase Console AND you're also deploying via CLI, you might have competing deployments.

