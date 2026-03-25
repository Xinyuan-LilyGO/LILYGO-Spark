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

// Signing environment summary (safe to log — no secrets leaked)
const isMacBuild = args.includes('--mac');
if (isMacBuild) {
    console.log('[Build Wrapper] === macOS Signing Environment ===');
    console.log(`  MAC_CERTS_P12:              ${process.env.MAC_CERTS_P12 ? 'SET (' + process.env.MAC_CERTS_P12.length + ' chars)' : 'NOT SET'}`);
    console.log(`  APPLE_ID:                   ${process.env.APPLE_ID ? 'SET' : 'NOT SET'}`);
    console.log(`  APPLE_APP_SPECIFIC_PASSWORD: ${process.env.APPLE_APP_SPECIFIC_PASSWORD ? 'SET' : 'NOT SET'}`);
    console.log(`  APPLE_TEAM_ID:              ${process.env.APPLE_TEAM_ID || 'NOT SET'}`);
    console.log('[Build Wrapper] ================================');
}

// Enable electron-builder debug logging for signing
process.env.DEBUG = (process.env.DEBUG || '') + ',electron-builder,electron-builder:*';

// Execute electron-builder
console.log(`[Build Wrapper] Building with timestamp: ${timestamp}`);
console.log(`[Build Wrapper] Command: npx electron-builder ${args}`);
try {
    execSync(`npx electron-builder ${args}`, { stdio: 'inherit', env: process.env });
} catch (error) {
    console.error('[Build Wrapper] Build failed');
    process.exit(1);
}
