// Quick fix script to enable SHIVA UI
const fs = require('fs');

const filePath = 'src/app/cappers/shiva/management/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the environment variable check with a simple true
content = content.replace(
  /const uiEnabled = \(process\.env\.NEXT_PUBLIC_SHIVA_V1_UI_ENABLED \|\| ''\)\.toLowerCase\(\) === 'true'/,
  'const uiEnabled = true // Force enabled for production'
);

fs.writeFileSync(filePath, content);
console.log('✅ SHIVA UI enabled in production');
