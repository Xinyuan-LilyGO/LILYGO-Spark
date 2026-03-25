# Hacking Guide

Development notes, internal tooling, and operational commands for LILYGO Spark maintainers.

## macOS Notarization

### How It Works

1. **Code Signing**: All macOS builds are signed with a Developer ID certificate during CI.
2. **Notarization**: The signed DMG/ZIP is submitted to Apple's notary service via `xcrun notarytool submit`.
3. **Stapling**: Once Apple approves, the notarization ticket is stapled into the DMG with `xcrun stapler staple`, so users can verify offline.
4. **Release Notes**: The Submission ID for each notarized file is recorded in the GitHub Release notes.

### Query Notarization Status

Each Release includes Apple notarization Submission IDs. Use the following command to check the status of a specific submission:

```bash
xcrun notarytool info <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

Example output:
```
  id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  status: Accepted
  createdDate: 2026-03-25T12:00:00.000Z
  name: LILYGO-Spark-2603251200-macOS-arm64.dmg
```

### View Notarization Log

If notarization fails or you need details, fetch the full log:

```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

### List Recent Submissions

```bash
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

### Validate a Downloaded DMG Locally

```bash
# Check if the notarization ticket is stapled
xcrun stapler validate /path/to/LILYGO-Spark-*.dmg

# Verify code signature
codesign --verify --deep --strict --verbose=2 "/path/to/LILYGO Spark.app"

# Check Gatekeeper assessment
spctl --assess --type execute --verbose=2 "/path/to/LILYGO Spark.app"
```

### Environment Variables

The following secrets are configured in GitHub Actions:

| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarytool |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `MAC_CERTS_P12` | Base64-encoded .p12 signing certificate |
| `MAC_CERTS_PASSWORD` | Password for the .p12 certificate |

## Build Artifacts

### Filename Format

Artifact filenames use a 10-digit timestamp (`YYMMDDHHMM`):

```
LILYGO-Spark-2603251200-macOS-arm64.dmg
LILYGO-Spark-2603251200-windows-x64-setup.exe
LILYGO-Spark-2603251200-linux-x86_64.AppImage
```

### Version Format

- **Stable**: `v0.1.0` (triggered by git tag)
- **Canary**: `v0.1.0-canary.260325.020441` (2-digit year, triggered by push to main)

## Firmware Manifest

### Upload to OSS

```bash
# Using ali-oss via Node.js (from LILYGO-Spark-Server directory)
node -e "
const OSS = require('ali-oss');
const fs = require('fs');
const client = new OSS({
  region: 'oss-cn-hongkong',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: 'lilygo',
  secure: true,
});
const buf = fs.readFileSync('../LILYGO-Spark/firmware_manifest.json');
client.put('firmware_manifest.json', buf, { headers: { 'Content-Type': 'application/json' } })
  .then(r => console.log('OK:', r.url));
"
```

### Manifest Structure

All firmware is in `firmware_list[]` with `supported_product_ids[]` for one-to-many product mapping.

## Admin Emails

Admin whitelist is in `LILYGO-Spark-Server/src/config.ts`. Add entries to the `ADMIN_EMAILS` array.
