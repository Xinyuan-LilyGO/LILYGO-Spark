/**
 * LILYGO Spark Download Widget (auto-generated, do not edit manually)
 *
 * Embed on any page with a single <script> tag:
 *   <script src="https://lilygo.oss-accelerate.aliyuncs.com/spark-releases/latest/spark-latest.js"></script>
 *
 * Add <div id="spark-widget"></div> where you want the widget rendered.
 * If absent, only window.SPARK_LATEST is set (no UI rendered).
 *
 * Release data is baked in at build time — no CORS, no extra fetch.
 */
(function () {
  var R = __RELEASE_DATA__;
  var GH = 'https://github.com/Xinyuan-LilyGO/LILYGO-Spark/releases';

  // Expose data globally so other scripts (e.g. index.html) can read it
  window.SPARK_LATEST = R;

  /* ---- platform detection ---- */
  function detect() {
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('mac') !== -1) {
      try {
        var c = document.createElement('canvas'), gl = c.getContext('webgl');
        if (gl) { var d = gl.getExtension('WEBGL_debug_renderer_info'); if (d && gl.getParameter(d.UNMASKED_RENDERER_WEBGL).indexOf('Apple') !== -1) return { k: 'macOS-arm64', l: 'macOS (Apple Silicon)' }; }
      } catch (e) {}
      return { k: 'macOS-arm64', l: 'macOS' };
    }
    if (ua.indexOf('win') !== -1) return { k: 'windows-x64-setup', l: 'Windows' };
    if (ua.indexOf('linux') !== -1) return { k: 'linux-x86_64-AppImage', l: 'Linux' };
    return { k: 'windows-x64-setup', l: 'Windows' };
  }

  function fmtSize(b) { return b ? (b / 1048576).toFixed(1) + ' MB' : ''; }

  /* ---- render ---- */
  function render() {
    var p = detect();
    var a = R.assets && R.assets[p.k];
    var url = a ? a.url : GH;
    var size = a ? ' \u00b7 ' + fmtSize(a.size) : '';
    var ver = R.version ? 'v' + R.version : '';

    var host = document.getElementById('spark-widget');
    if (!host) return; // Only render widget if page has a #spark-widget container

    // Apply theme class if data-theme is set
    var theme = host.getAttribute('data-theme');
    if (theme) host.classList.add('spw-' + theme);

    var sparkIcon = '<svg class="spw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
    var dlIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    // Build "All Platforms" expanded list
    var groups = [
      { label: 'macOS', keys: [
        { k: 'macOS-arm64', l: 'Apple Silicon (.dmg)' },
        { k: 'macOS-x64', l: 'Intel (.dmg)' },
        { k: 'macOS-universal', l: 'Universal (.dmg)' }
      ]},
      { label: 'Windows', keys: [
        { k: 'windows-x64-setup', l: 'x64 Installer (.exe)' },
        { k: 'windows-x64-portable', l: 'x64 Portable (.exe)' },
        { k: 'windows-arm64-setup', l: 'ARM64 Installer (.exe)' }
      ]},
      { label: 'Linux', keys: [
        { k: 'linux-x86_64-AppImage', l: 'x86_64 (.AppImage)' },
        { k: 'linux-amd64-deb', l: 'amd64 (.deb)' },
        { k: 'linux-x86_64-rpm', l: 'x86_64 (.rpm)' }
      ]}
    ];

    var expandHtml = '';
    for (var g = 0; g < groups.length; g++) {
      var grp = groups[g];
      var pills = '';
      for (var i = 0; i < grp.keys.length; i++) {
        var ak = grp.keys[i], asset = R.assets && R.assets[ak.k];
        if (asset) {
          pills += '<a class="spw-dl-pill" href="' + asset.url + '">' +
            '<span class="spw-dl-label">' + ak.l + '</span>' +
            '<span class="spw-dl-size">' + fmtSize(asset.size) + '</span></a>';
        }
      }
      if (pills) {
        expandHtml += '<div class="spw-dl-group"><div class="spw-dl-platform">' + grp.label + '</div>' +
          '<div class="spw-dl-pills">' + pills + '</div></div>';
      }
    }

    var chevron = '<svg class="spw-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

    host.innerHTML =
      '<div class="spw">' +
        '<div class="spw-info">' +
          '<div class="spw-title">' + sparkIcon + '<p class="spw-name">LILYGO Spark</p></div>' +
          '<p class="spw-desc">Cross-platform firmware flash tool for ESP32 development boards</p>' +
          '<p class="spw-ver">' + ver + size + ' \u00b7 macOS / Windows / Linux</p>' +
        '</div>' +
        '<div class="spw-actions">' +
          '<a class="spw-btn spw-btn-primary" href="' + url + '">' + dlIcon + ' Download for ' + p.l + '</a>' +
          '<button class="spw-btn spw-btn-secondary spw-toggle" type="button">All Platforms ' + chevron + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="spw-expand">' + expandHtml + '</div>';

    // Toggle expand
    var toggle = host.querySelector('.spw-toggle');
    var expand = host.querySelector('.spw-expand');
    var card = host.querySelector('.spw');
    toggle.addEventListener('click', function () {
      var open = expand.classList.toggle('spw-expand-open');
      toggle.classList.toggle('spw-toggle-open', open);
      card.classList.toggle('spw-open', open);
    });
  }

  /* ---- styles (injected once) ---- */
  if (!document.getElementById('spw-css')) {
    var s = document.createElement('style');
    s.id = 'spw-css';
    s.textContent =
      '.spw{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;background:linear-gradient(135deg,#0a0f2e,#162050)!important;border-radius:16px;padding:2rem 2.5rem;display:flex;align-items:center;justify-content:space-between;gap:2rem;flex-wrap:wrap;max-width:960px;margin:2rem auto;color:#fff!important;box-shadow:0 8px 32px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08)}' +
      '.spw-info{flex:1;min-width:240px}' +
      '.spw-title{display:flex;align-items:center;gap:.5rem;margin-bottom:.2rem}' +
      '.spw-icon{width:28px;height:28px;display:none;stroke:#4caf7d!important}' +
      '.spw-name{font-size:1.4rem;font-weight:700;margin:0;letter-spacing:-.01em;color:#fff!important}' +
      '.spw-desc{font-size:.9rem;color:rgba(255,255,255,.75)!important;margin:0 0 .5rem;line-height:1.5}' +
      '.spw-ver{font-size:.8rem;color:rgba(255,255,255,.5)!important}' +
      '.spw-actions{display:flex;gap:.8rem;align-items:center;flex-wrap:wrap}' +
      '.spw-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.7rem 1.6rem;border-radius:40px;font-size:.95rem;font-weight:600;text-decoration:none!important;transition:transform .15s,box-shadow .15s;white-space:nowrap;line-height:1.4!important}' +
      '.spw-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.3)}' +
      '.spw-btn-primary{background:#fff!important;color:#0a0f2e!important}' +
      '.spw-btn-secondary{background:rgba(255,255,255,.1)!important;color:#fff!important;border:1px solid rgba(255,255,255,.2)!important}' +
      '.spw-btn-secondary:hover{background:rgba(255,255,255,.18)!important}' +
      '.spw-btn svg{width:18px;height:18px;color:inherit!important;stroke:currentColor!important}' +
      '.spw-btn-secondary{cursor:pointer!important}' +
      '.spw-chevron{width:14px!important;height:14px!important;transition:transform .25s!important}' +
      '.spw-toggle-open .spw-chevron{transform:rotate(180deg)!important}' +
      /* expand panel */
      '.spw-expand{max-height:0;overflow:hidden;transition:max-height .35s cubic-bezier(.4,0,.2,1);max-width:960px;margin:0 auto}' +
      '.spw-expand-open{max-height:600px}' +
      '.spw-dl-group{padding:.5rem 0}' +
      '.spw-dl-platform{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.4)!important;margin-bottom:.5rem}' +
      '.spw-dl-pills{display:flex;flex-wrap:wrap;gap:.4rem}' +
      '.spw-dl-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .9rem;border:1px solid rgba(255,255,255,.15);border-radius:20px;text-decoration:none!important;color:rgba(255,255,255,.85)!important;font-size:.8rem;transition:all .15s;white-space:nowrap;background:rgba(255,255,255,.05)}' +
      '.spw-dl-pill:hover{border-color:rgba(255,255,255,.4);background:rgba(255,255,255,.1)}' +
      '.spw-dl-label{color:inherit}' +
      '.spw-dl-size{font-size:.7rem;color:rgba(255,255,255,.4)!important}' +
      '@media(max-width:640px){.spw{flex-direction:column;text-align:center;padding:1.5rem}.spw-actions{justify-content:center}}' +
      /* green / light theme (Style D) for wiki pages: <div id="spark-widget" data-theme="green"> */
      '.spw-green .spw{background:linear-gradient(135deg,#f0faf4,#e4f5ec)!important;border:1px solid #c8e6d5!important;border-radius:12px!important;padding:1.5rem 1.8rem!important;box-shadow:none!important;color:#333!important;margin:0!important}' +
      '.spw-green .spw-icon{display:inline-block!important;stroke:#4caf7d!important}' +
      '.spw-green .spw-name{color:#1a1a1a!important;font-size:1.1rem!important}' +
      '.spw-green .spw-desc{color:#555!important;font-size:.85rem!important}' +
      '.spw-green .spw-ver{color:#999!important;font-size:.75rem!important}' +
      '.spw-green .spw-btn{border-radius:8px!important}' +
      '.spw-green .spw-btn-primary{background:#4caf7d!important;color:#fff!important;padding:9px 20px!important;box-shadow:0 2px 10px rgba(76,175,125,.3)!important;font-size:.88rem!important}' +
      '.spw-green .spw-btn-primary:hover{background:#3d9e6e!important;transform:translateY(-1px)!important;box-shadow:0 4px 14px rgba(76,175,125,.4)!important}' +
      '.spw-green .spw-btn-secondary{background:transparent!important;color:#4caf7d!important;border:1px solid #4caf7d!important;padding:9px 14px!important;font-size:.85rem!important}' +
      '.spw-green .spw-btn-secondary:hover{background:rgba(76,175,125,.08)!important}' +
      '.spw-green .spw-btn svg{stroke:currentColor!important}' +
      /* green expand panel — seamless with card */
      '.spw-green .spw.spw-open{border-radius:12px 12px 0 0!important;border-bottom:none!important}' +
      '.spw-green .spw-expand{background:linear-gradient(180deg,#e8f5ee,#f4fbf7)!important;border:1px solid #c8e6d5!important;border-top:none!important;border-radius:0 0 12px 12px!important;max-width:100%!important;margin:0!important}' +
      '.spw-green .spw-expand-open{padding:.6rem 1.2rem 1rem!important}' +
      '.spw-green .spw-dl-group{padding:.5rem 0!important}' +
      '.spw-green .spw-dl-platform{color:#6b9e82!important;margin-bottom:.5rem!important}' +
      '.spw-green .spw-dl-pill{background:#fff!important;border:1px solid #c8e6d5!important;color:#333!important}' +
      '.spw-green .spw-dl-pill:hover{border-color:#4caf7d!important;background:#eef9f2!important}' +
      '.spw-green .spw-dl-size{color:#aaa!important}';
    document.head.appendChild(s);
  }

  /* ---- init ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
