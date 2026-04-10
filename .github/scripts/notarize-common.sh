#!/usr/bin/env bash
# Shared macOS notarization functions for build.yml and notarize.yml
#
# Required environment variables (set by caller as needed):
#   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID  — for xcrun notarytool
#   GITHUB_TOKEN                                           — for gh CLI
#
# Output files:
#   /tmp/notarize-results.md  — per-file markdown status lines
#   /tmp/notarize-status.txt  — "true" if all succeeded, "false" otherwise

set -euo pipefail

# ─── Download DMGs from GitHub Release ───────────────────────────────
# Usage: download_release_dmgs <tag> <output_dir>
download_release_dmgs() {
  local tag="$1" dir="$2"
  mkdir -p "$dir"

  local assets
  assets=$(gh release view "$tag" --json assets -q '.assets[] | select(.name | endswith(".dmg")) | .name')
  if [ -z "$assets" ]; then
    echo "No DMG files found in release $tag"
    return 1
  fi

  echo "Found DMGs:"
  echo "$assets"
  echo ""

  while IFS= read -r name; do
    [ -z "$name" ] && continue
    echo "Downloading $name..."
    gh release download "$tag" --pattern "$name" --dir "$dir"
  done <<< "$assets"

  ls -lh "$dir"/
}

# ─── Auto Mode: Submit + Wait + Staple ──────────────────────────────
# Usage: submit_wait_staple <dmg_dir>
# Submits each DMG, waits for Apple to process, then staples the ticket.
submit_wait_staple() {
  local dmg_dir="$1"
  local results="" all_ok=true

  echo "========== Auto Notarization: Submit + Wait + Staple =========="

  for file in "$dmg_dir"/*.dmg; do
    [ -f "$file" ] || continue
    local name
    name=$(basename "$file")
    echo ""
    echo "--- $name ---"

    local out sub_id status
    out=$(xcrun notarytool submit "$file" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --wait --output-format json 2>&1) || true

    sub_id=$(echo "$out" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
    status=$(echo "$out" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")

    echo "  Submission ID: ${sub_id:-N/A}"
    echo "  Status: $status"

    if [ "$status" = "Accepted" ]; then
      echo "  Stapling..."
      if xcrun stapler staple "$file" 2>&1; then
        echo "  Notarized & Stapled OK"
        results="${results}- \`${name}\`: ✅ Notarized & Stapled (\`${sub_id}\`)\n"
      else
        echo "  Accepted but staple failed"
        results="${results}- \`${name}\`: ⚠️ Accepted but staple failed (\`${sub_id}\`)\n"
        all_ok=false
      fi
    elif [ -z "$sub_id" ]; then
      echo "  Submit failed"
      echo "  $out"
      results="${results}- \`${name}\`: ❌ Submit failed\n"
      all_ok=false
    else
      echo "  Failed: $status"
      results="${results}- \`${name}\`: ❌ ${status} (\`${sub_id}\`)\n"
      all_ok=false
    fi
  done

  echo ""
  echo "========== Notarization Complete =========="

  echo -e "$results" > /tmp/notarize-results.md
  echo "$all_ok" > /tmp/notarize-status.txt
}

# ─── Manual Mode: Submit Only (no wait) ─────────────────────────────
# Usage: submit_only <dmg_dir>
submit_only() {
  local dmg_dir="$1"
  local results=""

  echo "========== Submitting for Notarization =========="

  for file in "$dmg_dir"/*.dmg; do
    [ -f "$file" ] || continue
    local name
    name=$(basename "$file")
    echo ""
    echo "--- Submitting: $name ---"

    local out sub_id
    out=$(xcrun notarytool submit "$file" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --output-format json 2>&1) || true

    sub_id=$(echo "$out" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

    if [ -z "$sub_id" ]; then
      echo "  Submit failed"
      echo "  $out"
      results="${results}- \`${name}\`: ❌ Submit failed\n"
    else
      echo "  Submitted: $sub_id"
      results="${results}- \`${name}\`: 📤 Submitted → \`${sub_id}\`\n"
    fi
  done

  echo ""
  echo "========== All submissions complete =========="

  echo -e "$results" > /tmp/notarize-results.md
}

# ─── Manual Mode: Check Status + Staple ─────────────────────────────
# Usage: check_and_staple <dmg_dir> <pairs_csv>
#   pairs_csv: "file1.dmg=uuid1,file2.dmg=uuid2"
check_and_staple() {
  local dmg_dir="$1" pairs_str="$2"
  local results="" all_ok=true

  echo "========== Checking & Stapling =========="

  IFS=',' read -ra pairs <<< "$pairs_str"
  for pair in "${pairs[@]}"; do
    [ -z "$pair" ] && continue
    local fname="${pair%%=*}" sub_id="${pair#*=}"
    local file="$dmg_dir/$fname"

    echo ""
    echo "--- $fname ($sub_id) ---"

    if [ ! -f "$file" ]; then
      echo "  File not found"
      results="${results}- \`${fname}\`: ⚠️ Not found in release\n"
      all_ok=false
      continue
    fi

    local info_out status
    info_out=$(xcrun notarytool info "$sub_id" \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_APP_SPECIFIC_PASSWORD" \
      --team-id "$APPLE_TEAM_ID" \
      --output-format json 2>&1) || true

    status=$(echo "$info_out" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
    echo "  Status: $status"

    if [ "$status" = "Accepted" ]; then
      echo "  Stapling..."
      if xcrun stapler staple "$file" 2>&1; then
        echo "  Stapled OK"
        results="${results}- \`${fname}\`: ✅ Notarized & Stapled (\`${sub_id}\`)\n"
      else
        echo "  Staple failed"
        results="${results}- \`${fname}\`: ⚠️ Accepted but staple failed (\`${sub_id}\`)\n"
        all_ok=false
      fi
    elif [ "$status" = "In Progress" ]; then
      echo "  Still processing — try again later"
      results="${results}- \`${fname}\`: ⏳ In Progress (\`${sub_id}\`)\n"
      all_ok=false
    elif [ "$status" = "Invalid" ] || [ "$status" = "Rejected" ]; then
      echo "  $status"
      xcrun notarytool log "$sub_id" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "$APPLE_TEAM_ID" 2>&1 || true
      results="${results}- \`${fname}\`: ❌ ${status} (\`${sub_id}\`)\n"
      all_ok=false
    else
      echo "  Unknown status: $status"
      results="${results}- \`${fname}\`: ❓ ${status} (\`${sub_id}\`)\n"
      all_ok=false
    fi
  done

  echo ""
  echo "========== Staple Complete =========="

  echo -e "$results" > /tmp/notarize-results.md
  echo "$all_ok" > /tmp/notarize-status.txt
}

# ─── Re-upload Stapled DMGs ─────────────────────────────────────────
# Usage: reupload_stapled <tag> <dmg_dir>
reupload_stapled() {
  local tag="$1" dmg_dir="$2"

  echo "Re-uploading stapled DMGs to release $tag..."
  for file in "$dmg_dir"/*.dmg; do
    [ -f "$file" ] || continue
    local name
    name=$(basename "$file")
    if xcrun stapler validate "$file" 2>&1; then
      echo "$name — valid staple, uploading"
      gh release upload "$tag" "$file" --clobber
    else
      echo "$name — no valid staple, skipping"
    fi
  done
  echo "Re-upload complete"
}

# ─── Update Release Notes with Notarization Status ──────────────────
# Usage: update_release_notarization <tag> <status_line> <note> <results_file>
update_release_notarization() {
  local tag="$1" status_line="$2" note="$3" results_file="$4"
  local timestamp
  timestamp=$(date -u +'%Y-%m-%d %H:%M UTC')

  # Fetch current release body
  gh release view "$tag" --json body -q '.body' > /tmp/_current-body.md

  local body
  body=$(cat /tmp/_current-body.md)

  # Remove old notarization section (from header to next ## or EOF)
  local clean_body
  clean_body=$(echo "$body" \
    | sed '/^## 🔏 macOS Notarization/,/^## [^🔏]/{ /^## [^🔏]/!d; }' \
    | sed '/^## 🔏 macOS Notarization/d')

  {
    echo "$clean_body"
    echo ""
    echo "## 🔏 macOS Notarization / 公证状态"
    echo ""
    echo "**Status**: ${status_line} (${timestamp})"
    echo ""
    cat "$results_file"
    echo ""
    echo "$note"
    echo ""
    echo "<details><summary>查询公证状态 / Check status</summary>"
    echo ""
    echo '```bash'
    echo 'xcrun notarytool info <submission-id> \'
    echo '  --apple-id "$APPLE_ID" \'
    echo '  --password "$APPLE_APP_SPECIFIC_PASSWORD" \'
    echo '  --team-id "$APPLE_TEAM_ID"'
    echo '```'
    echo ""
    echo "</details>"
  } > /tmp/_new-body.md

  gh release edit "$tag" --notes-file /tmp/_new-body.md
  echo "Release notes updated with notarization status"
}
