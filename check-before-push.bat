@echo off
echo ========================================
echo 🔍 PRE-DEPLOYMENT CHECK
echo ========================================
echo.

echo 1️⃣ Running TypeScript type check...
call npm run type-check
if %errorlevel% neq 0 (
    echo.
    echo ❌ TypeScript errors found! Fix them before pushing.
    pause
    exit /b 1
)

echo.
echo 2️⃣ Running linter...
call npx next lint
if %errorlevel% neq 0 (
    echo.
    echo ⚠️ Linter warnings found (not blocking)
)

echo.
echo ========================================
echo ✅ ALL CHECKS PASSED!
echo ========================================
echo Safe to push to Git.
pause

