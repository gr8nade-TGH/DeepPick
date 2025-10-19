@echo off
echo.
echo ========================================
echo 🔍 PRE-DEPLOYMENT CHECK
echo ========================================
echo.

call npm run check

if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo ❌ CHECKS FAILED!
    echo ========================================
    echo Fix the errors above before pushing.
    echo Note: Errors in checkpoints/ folder can be ignored.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ ALL CHECKS PASSED!
echo ========================================
echo Safe to push to Git.
echo.
pause

