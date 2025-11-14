# Capper Creation Flow - Complete Testing Guide

## 🎯 Quick Test (5 minutes)

### **Happy Path Test**
1. ✅ Navigate to `/cappers/create`
2. ✅ See welcome banner and user info
3. ✅ Select "Sharp Auto-Generated + Manual Picks"
4. ✅ Click "Next"
5. ✅ Click "The Balanced Sharp" preset
6. ✅ Click "Next"
7. ✅ Review configuration (should show "Using preset: The Balanced Sharp")
8. ✅ See "What happens next" checklist
9. ✅ Click "Become a Capper"
10. ✅ See loading spinner ("Creating Capper...")
11. ✅ See success toast (🎉 Capper Created Successfully!)
12. ✅ Redirect to `/dashboard/capper`
13. ✅ See new capper with "Active" status

**Expected Time**: 2-3 minutes  
**Pass Criteria**: All steps complete without errors, toast appears, redirect works

---

## 🔍 Detailed Test (15 minutes)

### **Test 1: Authentication (2 min)**
- [ ] Log out → Navigate to `/cappers/create` → Should redirect to `/login`
- [ ] Log in → Navigate to `/cappers/create` → Should see loading spinner → Should load wizard

### **Test 2: Step 1 - Pick Strategy (3 min)**
- [ ] Welcome banner appears with blue gradient
- [ ] Capper name auto-populated from profile
- [ ] Capper ID auto-generated (lowercase, no spaces)
- [ ] Select "Manual Only" → Team exclusions hidden
- [ ] Select "Auto/Hybrid" → Team exclusions appear
- [ ] Toggle 3 teams → See count update
- [ ] Click "Next" → Proceeds to Step 2 (auto) or Step 3 (manual)

### **Test 3: Step 2 - Factor Configuration (5 min)**
- [ ] See 5 preset cards in grid
- [ ] Click "The Pace Demon" → All factors apply
- [ ] Click again → Deselects
- [ ] Manually toggle factors → Weight budget updates
- [ ] Set total to 200% → "Next" button disabled, budget red
- [ ] Set total to 250% → "Next" button enabled, budget green
- [ ] Click "Next" → Proceeds to Step 3

### **Test 4: Step 3 - Review & Launch (5 min)**
- [ ] All configuration displays correctly
- [ ] Preset name shows (if used): "Using preset: [Name]"
- [ ] "What happens next" checklist appears
- [ ] 4 bullet points with green checkmarks
- [ ] Click "Become a Capper"
- [ ] Button shows spinner + "Creating Capper..."
- [ ] Success toast appears (green, with capper name)
- [ ] Redirects to dashboard after 1.5 seconds
- [ ] Dashboard shows new capper as "Active"

---

## 🐛 Edge Cases to Test

### **Weight Budget Edge Cases**
- [ ] Total = 249.9% → Should be invalid (red)
- [ ] Total = 250.0% → Should be valid (green)
- [ ] Total = 250.1% → Should be invalid (red)

### **Preset Edge Cases**
- [ ] Select preset → Deselect → Factors remain configured
- [ ] Select preset A → Select preset B → Preset B overwrites A
- [ ] Configure manually → Select preset → Preset overwrites manual config

### **Navigation Edge Cases**
- [ ] Step 1 (Manual) → Next → Should skip to Step 3
- [ ] Step 3 (Manual) → Back → Should go to Step 1 (not Step 2)
- [ ] Step 3 (Auto) → Back → Should go to Step 2

### **Error Edge Cases**
- [ ] Disconnect network → Submit → Should show error toast + error message
- [ ] Error message should have red background + AlertCircle icon
- [ ] Should stay on Step 3 (can retry)

---

## 🎨 Visual Checks

### **Dark Theme**
- [ ] No white backgrounds (should be slate-900/800)
- [ ] Error messages are red-500/10 background (not red-50)
- [ ] All text is readable on dark background
- [ ] Gradients look good (blue/purple, green/blue)

### **Loading States**
- [ ] Auth loading: Spinner + "Loading..." text
- [ ] Button loading: Spinner + "Creating Capper..." text
- [ ] Spinner rotates smoothly

### **Toast Notifications**
- [ ] Success toast: Green border, green text, 🎉 emoji
- [ ] Error toast: Red border, red text, error icon
- [ ] Toast appears in top-right corner
- [ ] Toast doesn't auto-dismiss (stays until redirect)

---

## ✅ Final Verification

After creating a capper, verify:
- [ ] Capper exists in database (`user_cappers` table)
- [ ] Execution schedule created (`capper_execution_schedules` table)
- [ ] Dashboard shows correct capper data
- [ ] Public profile accessible (`/profile/[user_id]`)
- [ ] Auto-generation works (wait 15 min, check for picks)
- [ ] Manual picks work (create a pick manually)

---

## 🚨 Known Issues to Watch For

### **Fixed Issues** ✅
- ✅ Database error: `auto_generate_hours_before` column not found → FIXED
- ✅ No success feedback after creation → FIXED (toast added)
- ✅ Light theme error messages → FIXED (dark theme styling)
- ✅ No loading state on button → FIXED (spinner added)
- ✅ No auth check → FIXED (redirect to login)

### **Potential Issues** ⚠️
- ⚠️ Toast might not appear if `<Toaster />` not in layout
- ⚠️ Redirect might fail if dashboard page doesn't exist
- ⚠️ Auto-generation might not work if cron is disabled

---

## 📊 Test Results Template

```
Date: [YYYY-MM-DD]
Tester: [Your Name]
Browser: [Chrome/Firefox/Safari/Edge]
Device: [Desktop/Tablet/Mobile]

Quick Test: ⬜ Pass | ⬜ Fail
Detailed Test: ⬜ Pass | ⬜ Fail
Edge Cases: ⬜ Pass | ⬜ Fail
Visual Checks: ⬜ Pass | ⬜ Fail
Final Verification: ⬜ Pass | ⬜ Fail

Issues Found:
1. [Issue description]
2. [Issue description]

Notes:
[Any additional observations]
```

---

**Ready to test! 🚀**

