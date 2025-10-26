// content_script.js

(function() {
  // wait for page to be somewhat stable
  const panelId = 'discord-voice-downloader-panel-v1';
  if (document.getElementById(panelId)) return;

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = panelId;
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.zIndex = 2147483647; // max
    panel.style.maxWidth = '380px';
    panel.style.maxHeight = '60vh';
    panel.style.overflow = 'auto';
    panel.style.background = 'rgba(255,255,255,0.98)';
    panel.style.border = '1px solid rgba(0,0,0,0.12)';
    panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    panel.style.borderRadius = '8px';
    panel.style.padding = '8px';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '13px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '6px';

    const title = document.createElement('strong');
    title.innerText = 'Voice messages';
    header.appendChild(title);

    const actions = document.createElement('div');

    const scanBtn = document.createElement('button');
    scanBtn.innerText = 'Scan';
    scanBtn.style.marginRight = '6px';
    scanBtn.onclick = scanAndRender;
    actions.appendChild(scanBtn);

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '×';
    closeBtn.title = 'Close panel';
    closeBtn.onclick = () => panel.remove();
    actions.appendChild(closeBtn);

    header.appendChild(actions);
    panel.appendChild(header);

    const list = document.createElement('div');
    list.id = panelId + '-list';
    panel.appendChild(list);

    document.body.appendChild(panel);
    return { panel, list };
  }

  function canonicalizeUrl(url) {
    try {
      return new URL(url, location.href).href;
    } catch (e) {
      return url;
    }
  }

  function findVoiceUrls() {
    const urls = new Set();

    // 1) search for elements with src attributes pointing to voice-message.ogg
    const els = Array.from(document.querySelectorAll('[src], [href]'));
    els.forEach(el => {
      const src = el.getAttribute('src') || el.getAttribute('href');
      if (!src) return;
      const s = src.toLowerCase();
      if (s.includes('voice-message.ogg') || /cdn\.discordapp\.com\/attachments\/.+\/voice-message\.ogg/.test(s)) {
        urls.add(canonicalizeUrl(src));
      }
    });

    // 2) search in DOM text nodes for direct links
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      const text = node.nodeValue;
      if (!text) continue;
      const regex = /(https?:\/\/cdn\.discordapp\.com\/attachments\/\d+\/\d+\/voice-message\.ogg[^\s]*)/ig;
      let m;
      while (m = regex.exec(text)) {
        urls.add(canonicalizeUrl(m[1]));
      }
    }

    // 3) check for anchor tags with discordcdn
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    anchors.forEach(a => {
      const href = a.href;
      if (!href) return;
      if (href.includes('cdn.discordapp.com') && href.toLowerCase().includes('voice-message.ogg')) {
        urls.add(href);
      }
    });

    return Array.from(urls);
  }

  function safeFilenameFromUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts.slice(-2).join('_');
    } catch (e) {
      return 'voice-message.ogg';
    }
  }

  function renderList(listEl, urls) {
    listEl.innerHTML = '';
    if (!urls.length) {
      const p = document.createElement('div');
      p.innerText = 'No voice messages found on this page.';
      listEl.appendChild(p);
      return;
    }

    urls.forEach(u => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.marginBottom = '6px';

      const link = document.createElement('a');
      link.href = u;
      link.innerText = u.replace(/^https?:\/\//, '');
      link.style.flex = '1 1 auto';
      link.style.marginRight = '8px';
      link.target = '_blank';

      const btn = document.createElement('button');
      btn.innerText = 'Download';
      btn.onclick = (ev) => {
        ev.preventDefault();
        // try using chrome.downloads via background service worker
        const filename = safeFilenameFromUrl(u);
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: 'download', url: u, filename });
        } else {
          // fallback: open in new tab
          window.open(u, '_blank');
        }
      };

      row.appendChild(link);
      row.appendChild(btn);
      listEl.appendChild(row);
    });
  }

  function scanAndRender() {
    const { list } = panelObj;
    const urls = findVoiceUrls();
    renderList(list, urls);
  }

  const panelObj = createPanel();
  // initial scan
  scanAndRender();

  // Also observe DOM changes and rescan occasionally (throttled)
  let timeout = null;
  const obs = new MutationObserver(() => {
    if (timeout) return;
    timeout = setTimeout(() => {
      scanAndRender();
      timeout = null;
    }, 1200);
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'download-error') {
      alert('Download failed: ' + msg.error);
    }
  });
})();