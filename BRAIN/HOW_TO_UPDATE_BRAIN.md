#  Brain Update Process - How It Works

**Purpose:** Document the process for maintaining an AI Agent Brain system  
**Use Case:** When you have a complex project and want new AI agents to get up to speed quickly

---

## What is a Brain?

A **Brain** is a set of markdown files that provide temporal context for new AI agents:
- What's happening RIGHT NOW vs. what's completed
- What's been tried and failed (save new agents time)
- Active bugs and workarounds
- Recent decisions and why they were made
- Critical gotchas and conventions

**Key Insight:** Codebase retrieval can find code, but can't tell you:
- "We tried X approach 5 times, it doesn't work"
- "This looks broken but it's intentional"
- "We just renamed everything 2 hours ago"

---

## Brain File Structure

``
BRAIN_FOLDER/
 NEW_AGENT_PROMPT.md    # Main onboarding (copy-paste to new agents)
 DECISION_LOG.md        # Why things are the way they are
 UPDATE_LOG.md          # Update history and statistics
 README.md              # How to use the brain
``

### File Purposes

**NEW_AGENT_PROMPT.md** (Most Important)
- Copy-paste onboarding for new agents
- Current focus (what's done, what's in progress)
- Tech stack and architecture overview
- Critical gotchas and conventions
- Known issues to avoid
- Recent major changes
- Quick start commands

**DECISION_LOG.md**
- Historical architectural decisions
- Problem  Decision  Rationale  Impact format
- Why things are the way they are
- What was tried and rejected

**UPDATE_LOG.md**
- Track when brain was last updated
- List commits analyzed in each update
- Brain statistics (total updates, commits analyzed, date range)
- Update triggers and frequency

**README.md**
- How to use the brain
- When to update
- How to onboard new agents

---

## When User Says "Update Brain"

### Step 1: Check Git History
``bash
git log --oneline -30
git log --since="[TIME_SINCE_LAST_UPDATE]" --pretty=format:"%h|%ad|%s" --date=short
``

**What to look for:**
- How many commits since last update
- Commit message patterns (FEAT, FIX, RENAME, REFACTOR, etc.)
- Time range of changes

### Step 2: Check Working Directory Status
``bash
git status --short
``

**What to note:**
- Uncommitted changes (work in progress)
- Clean working directory (ready to deploy)

### Step 3: Analyze What Changed

**Read through commits and identify:**
-  New features completed
-  Bug fixes
-  Architectural changes
-  Naming/convention changes
-  Refactoring work
-  Documentation updates

**Categorize by importance:**
-  CRITICAL - Breaking changes, naming conventions, must-know info
-  MAJOR - New features, significant improvements
-  MINOR - Bug fixes, polish, small improvements

### Step 4: Update Brain Files

#### Update NEW_AGENT_PROMPT.md

**Sections to update:**
1. **"Just Completed"** - Move active work here, add new completions
2. **"Active Work"** - Update with current status
3. **"Next Up"** - Update priorities based on what's done
4. **"Critical Gotchas"** - Add any new gotchas discovered
5. **"What NOT to Do"** - Add failed approaches
6. **"Recent Major Changes"** - Add timeline of recent work
7. **"Key Learnings"** - Add lessons learned

**Example update:**
``markdown
###  Just Completed (Last 6 Hours)
-  **CRITICAL: Naming Convention Change**
  - OLD: ATTACK, SPECIAL
  - NEW: POWER, WEAPON
  - All future code must use new naming
  
-  **Animation System Fixes** (5 commits)
  - Animations now appear in correct battle
  - Use local coordinates for multi-battle support
``

#### Update DECISION_LOG.md (if applicable)

**Add new architectural decisions:**
``markdown
### YYYY-MM-DD: [Decision Title]
**Problem:** [What problem were we trying to solve?]
**Decision:** [What did we decide to do?]
**Rationale:**
- [Why this approach?]
- [What alternatives were considered?]
- [What are the tradeoffs?]

**Impact:**
- [What files/systems changed?]
- [What does this mean for future development?]

**Lesson Learned:** [Key takeaway]
``

#### Update UPDATE_LOG.md

**Add new update entry:**
``markdown
### YYYY-MM-DD (Update #X) - [Brief Title]
**Trigger:** User requested "brain update"
**Files Updated:**
- NEW_AGENT_PROMPT.md - [what changed]
- DECISION_LOG.md - [what changed]
- UPDATE_LOG.md - This file

**Commits Analyzed:** X new commits (hash1  hash2)
**Date Range:** YYYY-MM-DD to YYYY-MM-DD

**Key Findings:**
-  **CRITICAL:** [Most important finding]
-  [Other findings]
-  [Status notes]

**Changes to Brain:**
-  [What was updated]
-  [What was added]
``

**Update statistics:**
``markdown
##  Brain Statistics
- **Total Updates:** X
- **Commits Analyzed:** Y total
- **Date Range:** Start to End
- **Last Commit:** [hash] ([message])
- **Uncommitted Changes:** None / [description]
``

### Step 5: Show Summary to User

**Format:**
``markdown
#  Brain Updated Successfully! [Emoji for type]

##  Update Summary
**Update #X** - YYYY-MM-DD - [Brief Title]
**Commits Analyzed:** X new commits (hash1  hash2)
**Time Range:** [description]

##  CRITICAL FINDINGS (if any)
[Highlight most important changes]

##  What Changed Since Last Update
[Categorized list of changes]

##  Brain Files Updated
1. **NEW_AGENT_PROMPT.md** - [changes]
2. **DECISION_LOG.md** - [changes]
3. **UPDATE_LOG.md** - [changes]

##  Brain Status
 **READY FOR NEW AGENT**
**Last Updated:** [timestamp]
**Next Recommended Update:** [date or trigger]
``

---

## Update Frequency

**Update when:**
-  User says "update brain" or "brain update"
-  Major feature completed
-  Architectural decision made
-  Naming/convention changes
-  Every 2-3 days (keep brain fresh)
-  **Before spawning new AI agent** (MOST IMPORTANT!)

**Don't update for:**
-  Single small bug fixes
-  Typo corrections
-  Minor refactoring
-  Work still in progress (wait until complete)

---

## Onboarding New Agents

**Simple copy-paste message:**
``
Read this brain file to get caught up on the [PROJECT NAME] project:

[PATH_TO_BRAIN]/NEW_AGENT_PROMPT.md

This file contains:
- Current project status (what's done, what's in progress)
- Tech stack and architecture
- Critical gotchas and conventions
- Recent changes
- Known issues to avoid
- Code patterns to follow

After reading, let me know you're ready and ask what I want you to work on.
``

---

## Tips for Maintaining a Good Brain

### 1. Be Concise But Complete
- New agents should read the brain in 2-3 minutes
- Include only what's essential
- Link to detailed docs for deep dives

### 2. Emphasize Temporal Context
- Focus on "what's happening NOW"
- Document recent changes prominently
- Archive old information to DECISION_LOG

### 3. Highlight Critical Information
- Use  CRITICAL for must-know info
- Use  WARNING for gotchas
- Use  for completed work

### 4. Document Failed Approaches
- "We tried X, it didn't work because Y"
- Saves new agents hours of debugging
- Include in "What NOT to Do" section

### 5. Keep It Fresh
- Update every 2-3 days minimum
- Always update before spawning new agent
- Remove outdated information

### 6. Use Examples
- Show code examples for conventions
- Include before/after for changes
- Demonstrate patterns to follow

---

## Brain Maintenance Checklist

**Before updating:**
- [ ] Check git log for new commits
- [ ] Check git status for uncommitted work
- [ ] Identify critical vs. minor changes

**During update:**
- [ ] Update "Just Completed" section
- [ ] Update "Active Work" section
- [ ] Add new gotchas if discovered
- [ ] Add architectural decisions if made
- [ ] Update statistics in UPDATE_LOG

**After update:**
- [ ] Verify all critical info is highlighted
- [ ] Check that examples are clear
- [ ] Confirm brain is ready for new agents
- [ ] Show summary to user

---

## Example Brain Statistics

``markdown
##  Brain Statistics
- **Total Updates:** 6
- **Files Tracked:** 4
- **Commits Analyzed:** 73 total
- **Date Range:** 2025-11-18 to 2025-11-25 (8 days)
- **Last Commit:** abc1234 (Feature X completed)
- **Uncommitted Changes:** None (clean working directory)
- **Critical Updates:** 1 (Naming convention change)
``

---

## Success Metrics

**A good brain should:**
-  Get new agents productive in <5 minutes
-  Prevent re-doing failed approaches
-  Highlight critical conventions immediately
-  Reduce "why is this broken?" questions
-  Document temporal context (not just code)

**Signs your brain needs updating:**
-  New agents ask about recent changes
-  "Just Completed" section is >3 days old
-  Active work doesn't match reality
-  Critical gotchas are missing

---

**Remember:** The brain's value is TEMPORAL CONTEXT that codebase retrieval can't provide!
