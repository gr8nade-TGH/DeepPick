# Git & Deployment Guide for New Agents

**Last Updated:** 2025-11-30  
**Repository:** https://github.com/gr8nade-TGH/DeepPick.git  
**Branch Strategy:** Single branch (main)

---

## ?? Repository Information

- **Local Path:** `C:\Users\Tucke\OneDrive\Desktop\DeepPick App`
- **Remote:** `origin` ? https://github.com/gr8nade-TGH/DeepPick.git
- **Default Branch:** `main`
- **Current Branch:** `main`
- **Git User:** YOUR_EMAIL@example.com (configured locally)
- **GitHub User:** gr8nade-TGH
- **GitHub Email:** tucker.harris@gmail.com

---

## ?? Standard Git Workflow

### 1. Check Status Before Starting Work
```powershell
git status
git log --oneline -5
```

### 2. Make Changes
- Edit files as needed
- Test locally with `npm run dev`

### 3. Stage Changes
```powershell
# Stage specific files
git add src/path/to/file.ts

# Stage all changes
git add .

# Check what's staged
git status
```

### 4. Commit Changes
```powershell
# Use conventional commit format
git commit -m "feat: Add new feature description"
git commit -m "fix: Fix bug description"
git commit -m "refactor: Refactor description"
git commit -m "docs: Update documentation"
git commit -m "style: Style changes"
git commit -m "chore: Maintenance tasks"
```

### 5. Push to Remote
```powershell
# Push to main branch
git push origin main

# Or simply
git push
```

**?? IMPORTANT:** Always ask user permission before pushing to remote!

---

## ??? Git Tags (Checkpoints)

### Create a Tag
```powershell
# Lightweight tag
git tag checkpoint-feature-name

# Annotated tag (preferred)
git tag -a v1.0-feature-name -m "Description of checkpoint"

# Push tag to remote
git push origin checkpoint-feature-name
```

### List Tags
```powershell
git tag --list
```

### View Tag Details
```powershell
git show checkpoint-feature-name
```

---

## ?? Common Git Commands

### View History
```powershell
# Last 10 commits
git log --oneline -10

# Commits between two points
git log commit1..commit2 --oneline

# Current commit hash
git log -1 --format="%H|%h|%ai|%s"
```

### Undo Changes
```powershell
# Discard unstaged changes to a file
git checkout -- src/path/to/file.ts

# Unstage a file (keep changes)
git reset HEAD src/path/to/file.ts

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes) - DANGEROUS
git reset --hard HEAD~1
```

### View Differences
```powershell
# See unstaged changes
git diff

# See staged changes
git diff --cached

# Compare branches
git diff main..other-branch
```

---

## ?? Vercel Deployment

### Automatic Deployment
- **Trigger:** Every push to `main` branch
- **Platform:** Vercel
- **URL:** Auto-generated preview URL + production URL
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

### Manual Deployment (if needed)
```powershell
# Install Vercel CLI (if not installed)
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Check Deployment Status
- Visit: https://vercel.com/gr8nade-tgh/deeppick
- Or use Vercel CLI: `vercel ls`

---

## ?? Backup System

### Create Backup
```powershell
npm run backup
```

This will:
- Create ZIP backup excluding node_modules, .next, dist, build, .turbo, .vercel
- Name: `DeepPick_[gitTag]_[gitCommit]_[timestamp].zip`
- Store in: `C:\Users\Tucke\Documents\DeepPick_Backups`
- Show: location, size, confirmation

### List Backups
```powershell
npm run backup:list
```

---

## ?? Important Rules

### ALWAYS Ask Permission Before:
1. **Pushing to remote** (`git push`)
2. **Creating tags** (`git tag`)
3. **Deploying** (`vercel --prod`)
4. **Force pushing** (`git push --force`) - NEVER DO THIS
5. **Rebasing** (`git rebase`) - Ask first
6. **Merging branches** - Ask first

### Safe Operations (No Permission Needed):
1. Checking status (`git status`)
2. Viewing logs (`git log`)
3. Staging files (`git add`)
4. Committing locally (`git commit`)
5. Creating backups (`npm run backup`)
6. Running tests (`npm test`)
7. Local development (`npm run dev`)

---

##  Common Issues & Solutions

### Issue: "Your branch is behind 'origin/main'"
```powershell
# Pull latest changes
git pull origin main
```

### Issue: Merge conflicts
```powershell
# 1. Pull latest
git pull origin main

# 2. Resolve conflicts in files (look for <<<<<<, ======, >>>>>>)

# 3. Stage resolved files
git add .

# 4. Commit merge
git commit -m "fix: Resolve merge conflicts"
```

### Issue: Accidentally committed to wrong branch
```powershell
# Ask user before doing this!
# 1. Create new branch from current commit
git branch correct-branch-name

# 2. Reset current branch
git reset --hard HEAD~1

# 3. Switch to correct branch
git checkout correct-branch-name
```

### Issue: Need to undo last commit
```powershell
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes AND commit (DANGEROUS - ask first!)
git reset --hard HEAD~1
```

---

##  Workflow Example

```powershell
# 1. Start work
git status
git pull origin main

# 2. Make changes
# ... edit files ...

# 3. Test locally
npm run dev
# ... test in browser ...

# 4. Stage and commit
git add .
git status
git commit -m "feat: Add new feature"

# 5. Ask user: "Ready to push to remote?"
# If yes:
git push origin main

# 6. Verify deployment on Vercel
# Check https://vercel.com/gr8nade-tgh/deeppick

# 7. Create checkpoint tag (if major milestone)
# Ask user: "Should I create a checkpoint tag?"
# If yes:
git tag -a checkpoint-feature-name -m "Description"
git push origin checkpoint-feature-name

# 8. Create backup (if risky changes ahead)
npm run backup
```

---

##  Quick Reference

| Task | Command |
|------|---------|
| Check status | `git status` |
| View recent commits | `git log --oneline -10` |
| Stage all changes | `git add .` |
| Commit | `git commit -m "type: message"` |
| Push to remote | `git push origin main` |
| Pull latest | `git pull origin main` |
| Create tag | `git tag -a tag-name -m "msg"` |
| Push tag | `git push origin tag-name` |
| Create backup | `npm run backup` |
| Run dev server | `npm run dev` |
| Build for production | `npm run build` |

---

##  Remember

1. **Always check `git status` before and after operations**
2. **Always ask permission before pushing**
3. **Use conventional commit messages** (feat:, fix:, refactor:, etc.)
4. **Test locally before committing**
5. **Create backups before risky changes**
6. **Never force push without explicit permission**
7. **Pull before push to avoid conflicts**
8. **Vercel auto-deploys on every push to main**

