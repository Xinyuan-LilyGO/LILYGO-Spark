# Firmware Upload Feature Design

## Overview

GitHub login-based firmware upload system with admin whitelist, review workflow, and dual client+server security verification.

---

## 1. Upload Form UI

Based on `firmware_manifest.json` fields, the upload page should include all metadata inputs:

### Required Fields

| Field | Input Type | Description |
|-------|-----------|-------------|
| **firmware file** (.bin) | File picker | The firmware binary file |
| **name** | Text input | Firmware display name (e.g. "Factory Firmware v1.4") |
| **product_id** | Dropdown (searchable) | Target product from manifest's product_list |
| **description** | Textarea | Firmware description / release notes |

### Optional Fields

| Field | Input Type | Description |
|-------|-----------|-------------|
| **release_tag** | Text input | Version tag (e.g. "v1.4", "v1.10.3") |
| **release_name** | Text input | Release display name |
| **source** | Tag selector | Source type: `REPO` / `RELEASE` / `COMMUNITY` / `CUSTOM` |
| **source_code_url** | URL input | Link to source code repository |
| **github_repo** | URL input | GitHub repository URL |
| **author_name** | Text input | Author display name |
| **author_link** | URL input | Author profile URL |
| **author_email** | Email input | Author contact email |
| **firmware_type** | Tag selector (multi) | Tags: `factory`, `community`, `tool`, `experiment`, etc. |
| **path** | Text input | Flash address / partition path (e.g. "0x0", "0x10000") |

### Auto-computed Fields (server-side, read-only display)

| Field | Source |
|-------|--------|
| **size** | Original file size in bytes |
| **compressed_size** | ZIP compressed size |
| **md5** | MD5 hash of original binary |
| **sha256** | SHA256 hash of original binary |
| **oss_url** | Generated OSS download URL |
| **url** | Original download URL (= oss_url for uploaded files) |

### UI Design Notes

- `source` field: radio button group or segmented control (REPO / RELEASE / COMMUNITY / CUSTOM)
- `firmware_type`: tag-style multi-select chips, click to toggle
- `product_id`: searchable dropdown grouped by series, showing product name + MCU
- Form should show a live preview card matching the firmware card layout in Firmware Center
- Pre-fill `author_name` / `author_email` from GitHub login profile

---

## 2. Admin Whitelist

### 2.1 Configuration Location

**Server-side only** -- in `LILYGO-Spark-Server/src/config.ts`:

```typescript
export const CONFIG = {
  // ... existing config ...
  ADMIN_USERS: (process.env.ADMIN_USERS || 'eggfly').split(','),
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || 'lihaohua90@gmail.com').split(','),
};
```

- `ADMIN_USERS`: GitHub username whitelist
- `ADMIN_EMAILS`: Email whitelist (GitHub account's primary/verified emails)
- Both configurable via environment variables, with defaults in code
- **NEVER** store admin list in client-side code

### 2.2 Admin Check Logic (server)

```typescript
// In auth service or middleware
function isAdmin(user: { login: string; email?: string }): boolean {
  if (CONFIG.ADMIN_USERS.includes(user.login)) return true;
  if (user.email && CONFIG.ADMIN_EMAILS.includes(user.email)) return true;
  return false;
}
```

---

## 3. Permission & Review Workflow

### 3.1 Roles

| Role | Upload | Review | Publish |
|------|--------|--------|---------|
| **Admin** | Direct publish | Can approve/reject | Automatic |
| **User** | Submit for review | No | After approval |
| **Guest** (not logged in) | No | No | No |

### 3.2 Upload Flow

```
User uploads firmware
        |
        v
  [Server validates]
   - GitHub token valid?
   - File is valid .bin (ESP32 magic byte check)?
   - Metadata fields valid?
        |
        v
  [Check role]
   - Admin? --> status = "approved", publish to manifest immediately
   - User?  --> status = "pending", store in review queue
        |
        v
  [Notify]
   - Admin sees pending count badge on Review tab
   - Uploader sees "Pending Review" status on their uploads
```

### 3.3 Review States

```
pending  -->  approved  -->  published (added to manifest)
   |
   +----->  rejected (with reason)
```

### 3.4 Admin Review Tab

- Visible **only** when logged-in user is confirmed admin (via server API)
- Shows list of pending firmware uploads with:
  - Firmware metadata preview card
  - Uploader info (GitHub avatar, username, email)
  - Upload timestamp
  - Action buttons: **Approve** / **Reject** (with reason input)
- Location: new tab in the Firmware Center page, or a dedicated section in sidebar (visible to admins only)

---

## 4. API Endpoints

### 4.1 Permission Check

```
GET /api/user/role
Authorization: Bearer <github_jwt_token>

Response 200:
{
  "login": "eggfly",
  "email": "lihaohua90@gmail.com",
  "role": "admin" | "user",
  "isAdmin": true | false
}
```

### 4.2 Upload Firmware

```
POST /api/firmware/upload
Authorization: Bearer <github_jwt_token>
Content-Type: multipart/form-data

Body:
  - file: <binary>
  - name: string
  - product_id: string
  - description: string
  - release_tag?: string
  - source?: string
  - source_code_url?: string
  - author_name?: string
  - author_link?: string
  - firmware_type?: string (comma-separated tags)
  - path?: string

Response 200:
{
  "id": "upload_abc123",
  "status": "approved" | "pending",
  "oss_url": "https://...",
  "message": "Firmware uploaded successfully" | "Firmware submitted for review"
}
```

### 4.3 List Pending Reviews (admin only)

```
GET /api/firmware/pending
Authorization: Bearer <github_jwt_token>

Response 200:
{
  "items": [
    {
      "id": "upload_abc123",
      "status": "pending",
      "uploader": { "login": "someone", "avatar_url": "..." },
      "firmware": { ...metadata... },
      "uploaded_at": "2026-03-24T..."
    }
  ]
}

Response 403: { "error": "Admin access required" }
```

### 4.4 Approve / Reject (admin only)

```
POST /api/firmware/:id/review
Authorization: Bearer <github_jwt_token>

Body:
{
  "action": "approve" | "reject",
  "reason": "optional rejection reason"
}

Response 200: { "status": "approved" | "rejected" }
Response 403: { "error": "Admin access required" }
```

---

## 5. Security Architecture

### 5.1 Authentication Flow

```
Client                          Server                      GitHub API
  |                               |                            |
  |-- GitHub OAuth login -------->|                            |
  |                               |-- exchange code for token ->|
  |                               |<-- access_token ------------|
  |                               |-- GET /user (verify) ------>|
  |                               |<-- user profile ------------|
  |                               |                            |
  |                               | [Create JWT with:          |
  |                               |   login, email, isAdmin]   |
  |<-- JWT token -----------------|                            |
  |                               |                            |
  |-- API call + Bearer JWT ----->|                            |
  |                               | [Verify JWT signature]     |
  |                               | [Check isAdmin from DB/    |
  |                               |  config, NOT from JWT]     |
```

### 5.2 Critical Security Rules

1. **Admin status is NEVER trusted from client or JWT payload**
   - JWT contains `login` and `email` for identification only
   - Every admin-gated request re-checks `isAdmin` against server-side `CONFIG.ADMIN_USERS` / `CONFIG.ADMIN_EMAILS`
   - Even if someone decodes and modifies JWT, the server re-validates

2. **Token validation on every request**
   - `requireAuth` middleware verifies JWT signature + expiry
   - Optionally re-verify GitHub token is still valid (not revoked)

3. **Admin middleware**
   ```typescript
   // requireAdmin middleware
   async function requireAdmin(req, res, next) {
     // requireAuth already ran, req.user is set
     const isAdmin = CONFIG.ADMIN_USERS.includes(req.user.login)
       || CONFIG.ADMIN_EMAILS.includes(req.user.email);
     if (!isAdmin) {
       return res.status(403).json({
         error: 'Forbidden',
         message: 'Admin access required'
       });
     }
     next();
   }
   ```

4. **Forged admin requests**
   - Non-admin sends `POST /api/firmware/:id/review` -> server checks `requireAdmin` -> returns `403 Forbidden`
   - Non-admin sends upload with `status: "approved"` in body -> server ignores client-provided status, determines from role

5. **File validation (server-side)**
   - Check file extension (.bin)
   - Check ESP32 magic byte (0xE9) at offset 0
   - File size limits (e.g. max 16MB)
   - Compute MD5/SHA256 server-side (never trust client hashes)

### 5.3 Dual Verification Summary

| Check | Client | Server |
|-------|--------|--------|
| Login status | JWT exists in localStorage | JWT signature valid + not expired |
| Admin role | `/api/user/role` response | `CONFIG.ADMIN_USERS` / `CONFIG.ADMIN_EMAILS` lookup |
| Upload permission | Show/hide upload button | `requireAuth` middleware |
| Review permission | Show/hide review tab | `requireAuth` + `requireAdmin` middleware |
| File integrity | Basic file type check | Magic byte + size + hash computation |

---

## 6. Data Storage

### 6.1 Pending Uploads

Store pending uploads as JSON files on server (or SQLite for future scaling):

```
/data/lilygo/uploads/
  pending/
    upload_abc123.json    # metadata + status
  approved/
    upload_def456.json
  rejected/
    upload_ghi789.json
  files/
    {sha256_prefix}_{filename}.bin   # original binary (before compression)
```

### 6.2 Upload Metadata Schema

```json
{
  "id": "upload_abc123",
  "status": "pending",
  "uploader": {
    "login": "github_username",
    "email": "user@example.com",
    "avatar_url": "https://..."
  },
  "firmware": {
    "name": "My Custom Firmware v1.0",
    "product_id": "T-Embed-CC1101",
    "description": "...",
    "release_tag": "v1.0",
    "source": "COMMUNITY",
    "source_code_url": "https://github.com/...",
    "author_name": "...",
    "author_link": "...",
    "firmware_type": ["community", "tool"],
    "path": "0x10000",
    "size": 4203216,
    "compressed_size": 2450000,
    "md5": "...",
    "sha256": "...",
    "oss_url": "https://lilygo.oss-accelerate.aliyuncs.com/firmware/...",
    "filename": "my_firmware.bin"
  },
  "uploaded_at": "2026-03-24T10:00:00Z",
  "reviewed_at": null,
  "reviewed_by": null,
  "reject_reason": null
}
```

---

## 7. Admin Manage Tab (Review Dashboard)

### 7.1 Overview

When logged-in user is admin, show an **"Admin Review"** tab (with Shield icon) in the Upload page's tab bar, alongside "Upload Firmware" and "My Uploads". This tab is a full review dashboard for managing all pending firmware submissions.

### 7.2 Tab Visibility

- Tab **only rendered** when `user.isAdmin === true` (from `GET /auth/role`)
- The `isAdmin` prop is passed from `App.tsx` → `FirmwareUpload` (not re-fetched)
- A red badge on the tab shows pending count (e.g. `3`)

### 7.3 Data Source & Storage

All upload records are stored as JSON files on the server filesystem:

```
{CONFIG.OSS_MOUNT}/uploads/
  pending/                          # Awaiting admin review
    upload_1711234567_a1b2c3d4.json
  approved/                         # Admin approved
    upload_1711234500_e5f6g7h8.json
  rejected/                         # Admin rejected
    upload_1711234400_i9j0k1l2.json
```

Each JSON file is a complete `UploadRecord` (see Section 6.2 for schema).

**Why filesystem, not database?**
- Low volume (tens to hundreds of uploads, not millions)
- Zero dependencies (no DB setup needed)
- JSON files are human-readable and easy to debug/backup
- Can migrate to SQLite/PostgreSQL later if needed

**OSS storage** (firmware binaries):

```
oss://lilygo/firmware/
  {sha256_prefix}_{filename}.zip      # Compressed firmware (uploaded at submission time)
  {sha256_prefix}_{filename}.json     # Metadata JSON
```

The firmware ZIP is uploaded to OSS at **submission time** (not at approval time), so admins can download and test it during review.

### 7.4 Admin Review UI Layout

```
+------------------------------------------------------------------+
| Upload Firmware | My Uploads | [Shield] Admin Review  (3)        |
+------------------------------------------------------------------+
|                                                                    |
|  [Shield] Pending Review              [Refresh]                    |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  | [Avatar] username  ·  2026-03-24 15:30                        |  |
|  |--------------------------------------------------------------|  |
|  | Firmware Name: Bruce v1.10.3                                  |  |
|  | File: Bruce-lilygo-t-embed-cc1101.bin  ·  4.0 MB → 2.3 MB   |  |
|  | Product: T-Embed-CC1101  ·  Source: COMMUNITY                 |  |
|  | Author: BruceDevices  ·  Tags: community                     |  |
|  | Version: v1.10.3                                              |  |
|  | Description: Flipper Zero alternative for ESP32...            |  |
|  |                                                                |  |
|  | MD5: abc123...    SHA256: def456...                            |  |
|  |                                                                |  |
|  | [Download .bin]   [Approve ✓]   [reason input] [Reject ✗]    |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  | [Avatar] another_user  ·  2026-03-24 14:00                    |  |
|  | ...                                                            |  |
|  +--------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### 7.5 Review Card Fields

Each pending upload card shows:

| Section | Fields |
|---------|--------|
| **Header** | Uploader avatar, login, upload timestamp |
| **Firmware Info** | name, filename, original size, compressed size (with ratio) |
| **Metadata** | product_id, source type, author_name, firmware_type tags, release_tag |
| **Description** | Full description / release notes text |
| **Hashes** | MD5, SHA256 (monospace, small text) |
| **OSS Link** | Direct link to the uploaded ZIP on OSS (for admin to download & test) |
| **Actions** | Download button, Approve button, Reject input + button |

### 7.6 Review Actions

**Approve:**
1. Client sends `POST /upload/{id}/review` with `{ action: "approve" }`
2. Server checks `requireAuth` + `AuthService.isAdmin()` → 403 if not admin
3. Server moves `{id}.json` from `pending/` to `approved/`
4. Server updates record: `status: "approved"`, `reviewed_at`, `reviewed_by`
5. (Future) Server adds firmware entry to `firmware_manifest.json` and re-uploads manifest to OSS

**Reject:**
1. Client sends `POST /upload/{id}/review` with `{ action: "reject", reason: "..." }`
2. Same auth check as above
3. Server moves `{id}.json` from `pending/` to `rejected/`
4. Server updates record: `status: "rejected"`, `reviewed_at`, `reviewed_by`, `reject_reason`

**Download:**
- Admin clicks download → opens `firmware.oss_url` in browser (the ZIP on OSS)
- This lets admin download, unzip, and flash-test the firmware before approving

### 7.7 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/upload/pending` | GET | Admin | List all pending uploads |
| `/upload/approved` | GET | Admin | List all approved uploads |
| `/upload/my` | GET | User | List current user's uploads (all statuses) |
| `/upload/:id/review` | POST | Admin | Approve or reject a pending upload |
| `/auth/role` | GET | User | Get current user's role (admin/user) |

### 7.8 State Flow

```
                    ┌─────────────┐
   User uploads ──▶ │   pending   │
                    └──────┬──────┘
                           │
              Admin reviews │
                    ┌──────┴──────┐
                    ▼             ▼
             ┌───────────┐ ┌───────────┐
             │  approved  │ │  rejected  │
             └─────┬─────┘ └───────────┘
                   │
                   ▼ (future)
          ┌─────────────────┐
          │ Added to manifest│
          │ (firmware_list)  │
          └─────────────────┘
```

### 7.9 Client-Server Data Flow

```
FirmwareUpload.tsx                    Server (upload.ts)
      │                                     │
      │── GET /auth/role ──────────────────▶│ Returns { isAdmin: true }
      │◀── { isAdmin: true } ──────────────│
      │                                     │
      │  (Admin sees "Admin Review" tab)    │
      │                                     │
      │── GET /upload/pending ─────────────▶│ Reads pending/*.json files
      │◀── { items: [...] } ───────────────│
      │                                     │
      │  (Admin clicks Download)            │
      │── opens oss_url in browser ────────▶│ (direct OSS download)
      │                                     │
      │  (Admin clicks Approve)             │
      │── POST /upload/{id}/review ────────▶│ isAdmin check → move file
      │   { action: "approve" }             │ pending/ → approved/
      │◀── { status: "approved" } ─────────│
      │                                     │
      │── GET /upload/pending (refresh) ───▶│ (list updated)
      │◀── { items: [...] } ───────────────│
```

---

## 8. Implementation Checklist

### Server (LILYGO-Spark-Server)

- [x] Add `ADMIN_EMAILS` to `config.ts`
- [x] Update `isAdmin()` logic to check both username and email
- [x] Add `GET /auth/role` endpoint
- [x] Add `POST /upload/firmware` with full metadata fields
- [x] Add `GET /upload/pending` (admin only)
- [x] Add `GET /upload/approved` (admin only)
- [x] Add `GET /upload/my` (user's own uploads)
- [x] Add `POST /upload/:id/review` (admin only)
- [x] Server-side file validation (magic byte, size limit, hash)
- [x] Upload storage (pending/approved/rejected directories)
- [x] JWT: removed expiration, removed isAdmin from payload
- [x] requireAdmin: now checks server-side whitelist, not JWT
- [ ] On approve: add firmware entry to firmware_manifest.json and re-upload to OSS

### Client (LILYGO-Spark)

- [x] Redesign upload form with all manifest fields
- [x] Tag-style input for source / firmware_type
- [x] Searchable product dropdown
- [x] Call `/auth/role` on login to determine permissions
- [x] Admin badge in sidebar with i18n
- [x] Show email in sidebar
- [x] Prominent console logs for role check
- [x] Show review tab for admin users
- [x] Review UI: list pending, approve/reject actions
- [x] Upload status indicator (pending / approved / rejected)
- [ ] Admin review: download firmware button (open oss_url)
- [ ] Pass `isAdmin` from App.tsx → FirmwareUpload (avoid double role fetch)
- [ ] Live preview card during upload form filling
