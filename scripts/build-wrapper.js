const { execSync } = require('child_process');

// Generate timestamp YYYYMMDDHHMM
const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, '0');
const dd = String(now.getDate()).padStart(2, '0');
const hh = String(now.getHours()).padStart(2, '0');
const min = String(now.getMinutes()).padStart(2, '0');
const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;

// Set environment variable
process.env.BUILD_TIMESTAMP = timestamp;

// Get arguments
const args = process.argv.slice(2).join(' ');

// Execute electron-builder
console.log(`[Build Wrapper] Building with timestamp: ${timestamp}`);
try {
    execSync(`npx electron-builder ${args}`, { stdio: 'inherit', env: process.env });
} catch (error) {
    console.error('[Build Wrapper] Build failed');
    process.exit(1);
}
