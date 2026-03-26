# Share Code (Firmware Sharing) — Technical Architecture

## Overview

Share Code is a lightweight firmware sharing feature that allows users to share a specific firmware with others via a short code. The design is **purely client-side** — no server-side API, no database, no OSS write required.

## How It Works

### Share Code = SHA256 Prefix

The share code is simply the **first 8 characters** of the firmware's `sha256` hash.

- SHA256 is computed from the **original .bin file** (before compression), server-side at upload time
- Every firmware in `firmware_manifest.json` already has a `sha256` field
- 8 hex chars = 16^8 = 4.29 billion combinations, effectively unique within any manifest

Example:
```
Firmware: MicroPython v1.27.0 for ESP32-S3
SHA256:   a3b8c2f1e9d0...64 chars total
Share Code: a3b8c2f1
```

### Sharing Flow

```
User A                              User B
  |                                   |
  | Click share button on firmware    |
  | → Copy "a3b8c2f1" to clipboard   |
  |                                   |
  | Send code via chat/email/doc      |
  | --------------------------------> |
  |                                   |
  |                  Paste "a3b8c2f1" |
  |                  in share code input
  |                  → Client searches |
  |                    manifest.firmware_list
  |                    where sha256.startsWith("a3b8c2f1")
  |                  → Match found    |
  |                  → Auto-select product
  |                  → Highlight firmware card
```

### Key Design Decisions

| Question | Answer |
|----------|--------|
| Share code stored where? | Nowhere — it's derived from sha256 on the fly |
| How does it find firmware? | Client-side `sha256.startsWith(code)` on local manifest |
| Does it map to firmware + hardware? | **Firmware only**. One firmware can support multiple hardware (via `supported_product_ids[]`). When navigating, the first supported product is auto-selected. |
| Saved to OSS? | No. Zero server interaction. |
| Can anyone generate a share code? | Yes, any user can click the share button. No auth required. No write to OSS. |
| Server-side API needed? | No. Entirely client-side. |

### Why SHA256 Prefix?

1. **Already exists** — every firmware uploaded has sha256 computed server-side
2. **Deterministic** — same firmware always generates the same code
3. **No storage needed** — code is derived, not assigned
4. **Collision-resistant** — 8 hex chars in a manifest of ~1000 firmware = negligible collision risk
5. **Offline-capable** — works even if the server is down, as long as the manifest is cached

### UI Components

#### 1. Share Code Input (Left panel, below search bar)
- Small input field with `#` icon and "Go" button
- User types or pastes the 8-char code
- Press Enter or click Go → navigate to firmware
- Shows error if no match found

#### 2. Share Button (Each firmware card)
- Small button showing the 8-char code next to the firmware type badge
- Click → copy code to clipboard
- Brief checkmark animation confirms copy

#### 3. Highlight Effect
- When navigating via share code, the matching firmware card gets a highlight ring (primary color)
- Highlight fades after 4 seconds

### Limitations & Future Enhancements

| Limitation | Possible Enhancement |
|-----------|---------------------|
| Code is 8 hex chars (not human-friendly) | Could add base62 encoding or short aliases |
| No QR code | Could generate QR code from share code |
| No deep link from outside the app | Could register `lilygo-spark://fw/<code>` URL scheme |
| No analytics on share usage | Could add optional server-side tracking |
| Code only works if firmware is in current manifest | Expected behavior — old/removed firmware won't match |

### Data Flow Diagram

```
firmware_manifest.json (on OSS)
  └── firmware_list[]
        └── each firmware has: { sha256: "a3b8c2f1e9d0..." }

Share Code Generation:
  sha256.slice(0, 8) → "a3b8c2f1"

Share Code Resolution:
  Input "a3b8c2f1"
  → firmware_list.find(f => f.sha256.startsWith("a3b8c2f1"))
  → found: { name: "MicroPython v1.27.0", supported_product_ids: ["general-esp32s3"] }
  → setSelectedProductId("general-esp32s3")
  → setHighlightedFwSha("a3b8c2f1e9d0...")
```
