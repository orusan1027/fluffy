#!/usr/bin/env bash
# Applies grid CSS and shortcode to the "📕 ADS コミックポータル" fixed page
# on comic.urasougokeijiban.net via WP-CLI over SSH.
#
# Usage:
#   bash scripts/wp-comic-portal-setup.sh
#
# Env vars:
#   SSH_HOST   (default: orusanura@sv10662.xserver.jp)
#   SSH_KEY    (default: ~/.ssh/id_rsa)
#   WP_PATH    (default: comic.urasougokeijiban.net/public_html)
#   PAGE_SLUG  (default: ads-comic-portal)

set -euo pipefail

SSH_HOST="${SSH_HOST:-orusanura@sv10662.xserver.jp}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
WP_PATH="${WP_PATH:-comic.urasougokeijiban.net/public_html}"
MU_PLUGINS_DIR="${MU_PLUGINS_DIR:-comic.urasougokeijiban.net/public_html/wp-content/mu-plugins}"
PAGE_SLUG="${PAGE_SLUG:-ads-comic-portal}"

timestamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log()       { echo "[$(timestamp)] $*"; }

ssh_run() {
  ssh \
    -i "$SSH_KEY" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -o ConnectTimeout=15 \
    "$SSH_HOST" "$@"
}

wp() {
  # Runs a WP-CLI command on the remote WordPress installation.
  ssh_run "wp --path='$WP_PATH' --allow-root $*"
}

log "=== WP Comic Portal Setup ==="
log "Host    : $SSH_HOST"
log "WP path : $WP_PATH"
log "Slug    : $PAGE_SLUG"
log ""

# ── Step 1: Resolve page ID ───────────────────────────────────────────────────
log "Step 1: Resolving page ID for slug '$PAGE_SLUG'..."
PAGE_ID=$(wp "post list \
  --post_type=page \
  --post_status=publish,draft \
  --name='$PAGE_SLUG' \
  --fields=ID \
  --format=csv" | tail -n1 | tr -d '[:space:]')

if [[ -z "$PAGE_ID" || "$PAGE_ID" == "ID" ]]; then
  log "ERROR: Page with slug '$PAGE_SLUG' not found. Aborting."
  exit 1
fi
log "  Page ID: $PAGE_ID"
log ""

# ── Step 2: Write the mu-plugin ───────────────────────────────────────────────
log "Step 2: Writing mu-plugin for CSS + shortcode..."

# The PHP source is written here and piped to the remote server via SSH.
# Using a heredoc avoids quote-escaping issues with ssh_run.
MU_PLUGIN_CONTENT='<?php
/**
 * Plugin Name: ADS Comic Portal Styles
 * Description: Dark grid layout CSS and [ads_comic_grid] shortcode for the ADS comic portal page.
 */

add_action( "wp_head", function () {
    if ( ! is_page( "'"$PAGE_SLUG"'" ) ) {
        return;
    }
    ?>
    <style id="ads-comic-portal-css">
    body.page-<?php echo sanitize_html_class( "'"$PAGE_SLUG"'" ); ?> {
        background: #000 !important;
        color: #fff;
    }
    .ads-comic-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, 140px);
        gap: 12px;
        padding: 16px;
    }
    .ads-comic-thumb {
        position: relative;
        width: 140px;
    }
    .ads-comic-thumb img {
        width: 140px;
        height: auto;
        display: block;
        border-radius: 4px;
    }
    .ads-comic-view-badge {
        position: absolute;
        bottom: 4px;
        right: 4px;
        background: rgba(0, 0, 0, 0.72);
        color: #fff;
        font-size: 11px;
        line-height: 1;
        padding: 3px 6px;
        border-radius: 10px;
        pointer-events: none;
        white-space: nowrap;
    }
    </style>
    <?php
} );

// [ads_comic_grid] shortcode — wraps thumbnail HTML so wpautop cannot corrupt it.
// Inside the shortcode, use .ads-comic-thumb items with .ads-comic-view-badge spans.
add_shortcode( "ads_comic_grid", function ( $atts, $content = "" ) {
    // Remove <p> tags wpautop may have injected before shortcode expansion
    $content = preg_replace( "#<p>\s*</p>#", "", do_shortcode( $content ) );
    return "<div class=\"ads-comic-grid\">" . $content . "</div>";
} );
'

ssh_run "cat > '$MU_PLUGINS_DIR/ads-comic-portal-styles.php'" <<< "$MU_PLUGIN_CONTENT"
log "  mu-plugin written: $MU_PLUGINS_DIR/ads-comic-portal-styles.php"
log ""

# ── Step 3: Verify shortcode in page content ──────────────────────────────────
log "Step 3: Checking page content for [ads_comic_grid] shortcode..."
CURRENT_CONTENT=$(wp "post get $PAGE_ID --field=post_content")

if echo "$CURRENT_CONTENT" | grep -q '\[ads_comic_grid\]'; then
  log "  [ads_comic_grid] shortcode already present — skipping content update."
else
  log "  Shortcode not found. Wrapping existing content..."
  WRAPPED_CONTENT="[ads_comic_grid]
${CURRENT_CONTENT}
[/ads_comic_grid]"

  wp "post update $PAGE_ID \
    --post_content='$(echo "$WRAPPED_CONTENT" | sed "s/'/'\\\\''/g")' \
    --quiet"
  log "  Page content updated."
fi
log ""

# ── Step 4: Flush object cache ────────────────────────────────────────────────
log "Step 4: Flushing WordPress cache..."
wp "cache flush" 2>/dev/null && log "  Cache flushed." || log "  Cache flush skipped (no object cache active)."
log ""

log "=== Setup complete ==="
log "Visit https://comic.urasougokeijiban.net to verify the dark grid layout."
