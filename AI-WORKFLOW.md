# 🤖 AI Assistant Workflow (MUST FOLLOW)

## ⚠️ CRITICAL RULE: Always Check Before Pushing!

**Before ANY `git push` command, I MUST run:**

```bash
npm run type-check
```

**If errors found → FIX THEM FIRST → Then push**

---

## 📋 Standard Git Workflow:

### **When Making Code Changes:**

```bash
# 1. Make code edits
# 2. RUN TYPE CHECK (MANDATORY!)
npm run type-check

# 3. If errors found:
#    - Read the errors carefully
#    - Fix all errors in src/ folder
#    - Ignore errors in checkpoints/ folder
#    - Run type-check again until 0 errors

# 4. Check linter (optional but recommended)
npm run lint

# 5. Stage changes
git add <files>

# 6. Commit
git commit -m "message"

# 7. ONE MORE CHECK BEFORE PUSH (MANDATORY!)
npm run type-check

# 8. Push only if no errors
git push origin feature/oracle-ai-capper
```

---

## 🎯 Alternative: Use Safe-Push Script

```bash
# This runs type-check automatically before pushing
npm run safe-push origin feature/oracle-ai-capper
```

---

## 🚫 NEVER:

- ❌ Push without running `npm run type-check`
- ❌ Ignore TypeScript errors in `src/` folder
- ❌ Assume "it will probably work"
- ❌ Make multiple changes without checking incrementally

---

## ✅ ALWAYS:

- ✅ Run `npm run type-check` before EVERY push
- ✅ Fix ALL errors in `src/` folder
- ✅ Test locally when possible
- ✅ Read lint tool output carefully
- ✅ Use `read_lints` tool to check for errors in edited files

---

## 📊 Error Handling:

### **If type-check shows errors:**

1. **Read the full error message**
   - Note the file path
   - Note the line number
   - Note the error type

2. **Common TypeScript Errors:**
   - `'X' is possibly 'null'` → Add null check
   - `Property 'X' does not exist` → Check types/interfaces
   - `Cannot find module` → Check import paths

3. **Fix Strategy:**
   - Fix one file at a time
   - Run `npm run type-check` after each fix
   - Verify fix worked before moving to next error

---

## 🛠️ Tools at My Disposal:

- `npm run type-check` - TypeScript compiler check
- `npm run lint` - ESLint check
- `npm run check` - Both type-check + lint
- `read_lints` tool - Check specific files for errors

---

## 💡 Pro Tips:

- **Run type-check EARLY** - Don't wait until the end
- **Fix incrementally** - Check after each file edit
- **Use read_lints** - After editing TypeScript files
- **Be patient** - 30 seconds of checking saves 30 minutes of debugging

---

## 📈 Success Metrics:

**Goal: 0 failed deployments due to TypeScript errors**

- ✅ Before this workflow: 80% time spent on deployment fixes
- ✅ After this workflow: 0% time wasted on preventable errors

---

**REMEMBER: The type-check runs the EXACT SAME checks as Vercel. If it passes locally, it passes on Vercel!** 🎯

