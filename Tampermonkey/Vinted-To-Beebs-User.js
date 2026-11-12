// ==UserScript==
// @name         Vinted → Beebs (V4.0.1)
// @namespace    https://github.com/ValentinGratz/vinted2beebs
// @version      4.0.1
// @description  Prépare une annonce Vinted pour Beebs : description complète, photos HD, remplissage automatique et suivi des annonces exportées.
// @author       ValentinGratz
// @match        https://www.vinted.fr/*
// @match        https://*.vinted.fr/*
// @match        https://www.beebs.app/*
// @match        https://*.beebs.app/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM_addValueChangeListener
// @connect      vinted.net
// @connect      vinted.fr
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const IS_VINTED = location.hostname.includes('vinted');
  const IS_BEEBS = location.hostname.endsWith('beebs.app');
  const EXPORT_KEY = 'lastBeebsExport';
  const MAX_PHOTOS = 10;
  const BEEBS_URL = 'https://www.beebs.app/fr/listing';
  const STYLE_ID = 'v2b-v40-style';

  if (!IS_VINTED && !IS_BEEBS) return;

  // -----------------------------------------------------------------------
  // Styles communs
  // -----------------------------------------------------------------------
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .v2b-img-badge{position:absolute;top:8px;left:8px;z-index:999998;background:#eab308;color:#111;font:700 11px sans-serif;padding:4px 8px;border-radius:6px;box-shadow:0 1px 4px #0005;pointer-events:none}
      .v2b-grid-badge{position:absolute;top:4px;left:4px;z-index:998;background:#eab308;color:#111;font:700 11px sans-serif;line-height:1;padding:4px 6px;border-radius:50%;box-shadow:0 1px 3px #0004;pointer-events:none}
      #v2b-panel,#v2b-beebs-panel{box-sizing:border-box;color:#171717;font:13px/1.4 Arial,sans-serif}
      #v2b-panel button,#v2b-beebs-panel button{display:block;box-sizing:border-box;width:100%;min-height:38px;font:700 13px Arial,sans-serif;border:0;border-radius:8px;padding:9px 11px;cursor:pointer}
      #v2b-panel #v2b-preview{display:block;max-height:120px;overflow:auto;white-space:pre-wrap}
      #v2b-panel > div,#v2b-panel > button,#v2b-panel > a{max-width:100%;box-sizing:border-box}
      #v2b-panel button:disabled,#v2b-beebs-panel button:disabled{opacity:.6;cursor:wait}
      #v2b-panel .v2b-muted{font-size:11px;color:#555}
    `;
    document.head.appendChild(style);
  }

  // -----------------------------------------------------------------------
  // Outils généraux et stockage Tampermonkey (partagé entre les domaines)
  // -----------------------------------------------------------------------
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const itemIdFromUrl = url => (url || location.href).match(/\/items\/(\d+)/)?.[1] || null;
  const exportedKey = id => `vinted2beebs_exported_${id}`;
  const getExportedState = id => id ? GM_getValue(exportedKey(id), null) : null;
  const setExportedState = (id, url) => {
    if (id) GM_setValue(exportedKey(id), { date: new Date().toISOString(), url });
  };
  const clearExportedState = id => { if (id) GM_deleteValue(exportedKey(id)); };
  const formatDate = value => {
    try { return new Date(value).toLocaleDateString('fr-FR'); }
    catch (_) { return ''; }
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function detectLeboncoinInstalled() {
    if (document.querySelector('#vc-lbc-transfer-btn,.vc-lbc-badge')) return true;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('vinted2leboncoin_exported_')) return true;
      }
    } catch (_) {}
    return false;
  }

  // -----------------------------------------------------------------------
  // Vinted : lecture des données annonce via l'API interne
  // -----------------------------------------------------------------------
  let cachedItemId = null;
  let cachedItemPromise = null;

  function getItemApi() {
    const id = itemIdFromUrl();
    if (!id) return Promise.resolve(null);
    if (cachedItemId === id && cachedItemPromise) return cachedItemPromise;
    cachedItemId = id;
    cachedItemPromise = (async () => {
      try {
        const response = await fetch(`/api/v2/items/${id}`, {
          credentials: 'include',
          headers: { accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`API Vinted : HTTP ${response.status}`);
        const json = await response.json();
        return json?.item || null;
      } catch (error) {
        console.warn('[Vinted → Beebs] API annonce indisponible :', error);
        return null;
      }
    })();
    return cachedItemPromise;
  }

  function getTitle(item) {
    return String(item?.title || document.querySelector('h1')?.innerText || document.title.split('|')[0] || '').trim();
  }

  async function getDescription(item) {
    const fromApi = String(item?.description || '').trim();
    if (fromApi) return fromApi;
    const block = document.querySelector('[itemprop="description"],[data-testid="item-description"]');
    return String(block?.innerText || '').trim();
  }

  function getPriceRaw(item) {
    const apiPrice = item?.price?.amount ?? item?.price ?? null;
    if (apiPrice !== null && apiPrice !== undefined && String(apiPrice).trim() !== '') {
      const currency = item?.price?.currency_code || 'EUR';
      return `${String(apiPrice).replace('.', ',')} ${currency === 'EUR' ? '€' : currency}`;
    }
    const node = document.querySelector('[data-testid="item-price"]');
    return node?.innerText?.trim() || document.body.innerText.match(/\d+[.,]\d+\s*€/)?.[0] || '';
  }

  function priceForBeebs(raw) {
    const normalized = String(raw ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const amount = Number.parseFloat(normalized);
    if (!Number.isFinite(amount)) return '';
    // Beebs attend un prix entier : arrondi mathématique à l'euro le plus proche.
    return String(Math.max(1, Math.round(amount)));
  }

  async function getPhotoUrls(item) {
    const apiPhotos = (item?.photos || [])
      .map(photo => photo?.full_size_url || photo?.url)
      .filter(Boolean);
    if (apiPhotos.length) return [...new Set(apiPhotos)].slice(0, MAX_PHOTOS);

    const selectors = [
      'img[data-testid^="item-photo-"]',
      '[data-testid^="item-photo-"] img',
      '[data-testid="item-photos"] img',
      '.item-photos img'
    ];
    for (const selector of selectors) {
      const urls = [...document.querySelectorAll(selector)]
        .map(img => img.currentSrc || img.src)
        .filter(url => url && /vinted\.net/i.test(url));
      if (urls.length) return [...new Set(urls)].slice(0, MAX_PHOTOS);
    }

    const first = document.querySelector('img[data-testid*="photo"]');
    const zone = first?.closest('section,aside,[class*="photo"],[class*="gallery"]') || document;
    return [...new Set([...zone.querySelectorAll('img[src*="vinted.net"]')]
      .map(img => img.currentSrc || img.src)
      .filter(url => url && !/avatar|25x25|50x50|\.svg(?:\?|$)/i.test(url)))].slice(0, MAX_PHOTOS);
  }

  // Récupération cross-origin des photos sans les enregistrer sur le PC.
  function fetchPhotoAsDataUrl(url) {
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 30000,
        onload(response) {
          try {
            if (response.status < 200 || response.status >= 300 || !response.response) return resolve(null);
            const typeHeader = response.responseHeaders?.match(/content-type:\s*([^;\r\n]+)/i)?.[1];
            const mime = typeHeader?.startsWith('image/') ? typeHeader : 'image/jpeg';
            const blob = new Blob([response.response], { type: mime });
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          } catch (error) {
            console.warn('[Vinted → Beebs] Conversion photo impossible :', error);
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null)
      });
    });
  }

  async function extractListing(status) {
    const id = itemIdFromUrl();
    const item = await getItemApi();
    const title = getTitle(item);
    const description = await getDescription(item);
    const priceRaw = getPriceRaw(item);
    const price = priceForBeebs(priceRaw);
    const photoUrls = await getPhotoUrls(item);
    const photosData = [];

    for (let i = 0; i < photoUrls.length; i++) {
      if (status) status.textContent = `Récupération des photos : ${i + 1}/${photoUrls.length}…`;
      const dataUrl = await fetchPhotoAsDataUrl(photoUrls[i]);
      if (dataUrl) photosData.push(dataUrl);
    }

    return {
      itemId: id,
      sourceUrl: location.href,
      fullTitle: title,
      description,
      price: priceRaw,
      beebsPrice: price,
      photoUrls,
      photosData,
      exportedAt: new Date().toISOString()
    };
  }

  // -----------------------------------------------------------------------
  // Vinted : badges sur l'annonce et les cartes de dressing/recherche
  // -----------------------------------------------------------------------
  function renderImageBadge(show) {
    const existing = document.getElementById('v2b-img-badge');
    if (!show) { existing?.remove(); return; }
    if (existing) return;
    const image = document.querySelector('img[data-testid^="item-photo-1"]') ||
      document.querySelector('img[data-testid*="photo"]') ||
      document.querySelector('[data-testid="item-page-summary-plugin"] img');
    const container = image?.closest('div');
    if (!container) return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    const badge = document.createElement('div');
    badge.id = 'v2b-img-badge';
    badge.className = 'v2b-img-badge';
    badge.textContent = '⚡ Beebs ✓';
    badge.title = 'Déjà préparé pour Beebs';
    container.appendChild(badge);
  }

  function findCard(link) {
    return link.closest('[data-testid*="grid-item"]') ||
      link.closest('[data-testid*="item-box"]') || link.closest('article') ||
      link.closest('div') || link;
  }

  async function scanGrid(root = document) {
    const links = root.querySelectorAll('a[href*="/items/"]');
    for (const link of links) {
      const id = itemIdFromUrl(link.href);
      if (!id) continue;
      const card = findCard(link);
      const hasBadge = !!card.querySelector('.v2b-grid-badge');
      const exported = !!getExportedState(id);
      if (exported && !hasBadge) {
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        const badge = document.createElement('span');
        badge.className = 'v2b-grid-badge';
        badge.textContent = '⚡';
        badge.title = 'Déjà préparé pour Beebs';
        card.appendChild(badge);
      } else if (!exported && hasBadge) {
        card.querySelectorAll('.v2b-grid-badge').forEach(node => node.remove());
      }
    }
  }

  function renderExportedPanel(itemId, host) {
    const state = getExportedState(itemId) || { date: new Date().toISOString() };
    host.innerHTML = `
      <div style="font-weight:700">⚡ Vinted → Beebs</div>
      <div style="background:#dcfce7;color:#166534;padding:8px;border-radius:8px;font-weight:700;text-align:center">✓ Annonce préparée pour Beebs</div>
      <div class="v2b-muted">Dernier export : ${escapeHtml(formatDate(state.date))}</div>
      <button type="button" id="v2b-reexport" style="width:100%;background:#eab308;color:#111">↻ Réexporter / Retester</button>
      <button type="button" id="v2b-reset" style="width:100%;background:#eee;color:#333">Réinitialiser le statut</button>
      <a href="${BEEBS_URL}" target="_blank" rel="noopener" style="font-size:12px;color:#555">Réouvrir Beebs</a>`;
    host.querySelector('#v2b-reexport').onclick = () => prepareExport(itemId, host, true);
    host.querySelector('#v2b-reset').onclick = () => {
      clearExportedState(itemId);
      renderImageBadge(false);
      renderReadyPanel(itemId, host);
      scanGrid();
    };
  }

  function renderReadyPanel(itemId, host) {
    host.innerHTML = `
      <div style="font-weight:700;margin-bottom:7px">⚡ Export Vinted → Beebs</div>
      <div id="v2b-preview" style="font-size:11px;background:#fff;padding:7px;border-radius:7px;max-height:100px;overflow:auto;white-space:pre-wrap">Lecture de l'annonce…</div>
      <div id="v2b-status" class="v2b-muted" style="margin:7px 0">Prêt</div>
      <button type="button" id="v2b-export" style="width:100%;background:#eab308;color:#111">🚀 Préparer et ouvrir Beebs</button>`;
    host.querySelector('#v2b-export').onclick = () => prepareExport(itemId, host, false);
    (async () => {
      const item = await getItemApi();
      const title = getTitle(item);
      const description = await getDescription(item);
      const raw = getPriceRaw(item);
      const preview = host.querySelector('#v2b-preview');
      if (preview) preview.textContent = `${title}\n\n${description || '⚠️ Description non trouvée'}\n\nPrix Vinted : ${raw || 'inconnu'}\nPrix Beebs : ${priceForBeebs(raw) || 'à vérifier'} €`;
    })();
  }

  async function prepareExport(itemId, host, isReexport) {
    const button = host.querySelector('#v2b-export') || host.querySelector('#v2b-reexport');
    const status = host.querySelector('#v2b-status') || host.querySelector('.v2b-muted');
    if (button) { button.disabled = true; button.textContent = '⏳ Préparation…'; }
    try {
      const payload = await extractListing(status);
      if (!payload.fullTitle) throw new Error('Titre de l’annonce introuvable.');
      if (!payload.price) throw new Error('Prix Vinted introuvable.');
      if (!payload.photosData.length) throw new Error('Aucune photo récupérée. Recharge l’annonce puis réessaie.');
      GM_setValue(EXPORT_KEY, payload);
      setExportedState(itemId, location.href);
      renderImageBadge(true);
      scanGrid();
      GM_notification?.({ title: 'Vinted → Beebs', text: `${payload.photosData.length} photo(s) prêtes. Beebs va s’ouvrir.`, timeout: 4000 });
      if (status) status.textContent = `✓ ${payload.photosData.length} photo(s) récupérées. Ouverture de Beebs…`;
      renderExportedPanel(itemId, host);
      GM_openInTab(BEEBS_URL, { active: true, insert: true, setParent: true });
    } catch (error) {
      console.error('[Vinted → Beebs]', error);
      if (status) status.textContent = `⚠️ ${error.message || 'Erreur pendant la préparation.'}`;
      if (button) { button.disabled = false; button.textContent = isReexport ? '↻ Réessayer' : '🚀 Réessayer'; }
    }
  }

  function initVinted() {
    if (!/\/items\/\d+/.test(location.href)) {
      scanGrid();
      return;
    }
    const itemId = itemIdFromUrl();
    if (!itemId || !document.querySelector('h1')) return;
    let panel = document.getElementById('v2b-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'v2b-panel';
      // Panneau flottant : on l'ajoute directement au body pour éviter
      // qu'un conteneur Vinted (flex/overflow/hauteur limitée) ne le tronque.
      panel.style.cssText = [
        'position:fixed', 'top:90px', 'right:18px',
        'width:min(380px, calc(100vw - 24px))',
        'max-height:calc(100vh - 110px)', 'overflow-y:auto',
        'display:block', 'visibility:visible', 'opacity:1',
        'z-index:2147483647', 'box-sizing:border-box',
        'background:#fef9c3', 'color:#171717',
        'border:2px solid #eab308', 'padding:12px',
        'border-radius:12px', 'margin:0',
        'box-shadow:0 3px 16px #0004', 'font:13px/1.45 Arial,sans-serif'
      ].join(';');
      document.body.appendChild(panel);
    }
    if (getExportedState(itemId)) {
      renderExportedPanel(itemId, panel);
      renderImageBadge(true);
    } else {
      renderReadyPanel(itemId, panel);
    }
  }

  // -----------------------------------------------------------------------
  // Beebs : panneau d'import et injection dans les champs React
  // -----------------------------------------------------------------------
  function setReactValue(element, value) {
    if (!element) return false;
    element.focus();
    const previous = element.value;
    let prototype = element;
    let descriptor;
    while (prototype && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      prototype = Object.getPrototypeOf(prototype);
    }
    try {
      if (descriptor?.set) descriptor.set.call(element, String(value ?? ''));
      else element.value = String(value ?? '');
    } catch (_) { element.value = String(value ?? ''); }
    if (element._valueTracker) element._valueTracker.setValue(previous);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function dataUrlToFile(dataUrl, index) {
    const match = String(dataUrl).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!match) return null;
    const mime = match[1] || 'image/jpeg';
    let bytes;
    if (match[2]) {
      const binary = atob(match[3]);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(match[3]));
    }
    const extension = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    return new File([bytes], `vinted-beebs-${index + 1}.${extension}`, { type: mime });
  }

  function findTitleInput() {
    const inputs = [...document.querySelectorAll('input:not([type="hidden"]),textarea')];
    return inputs.find(el => /titre|title/i.test(`${el.placeholder || ''} ${el.name || ''} ${el.getAttribute('aria-label') || ''}`)) ||
      document.querySelector('input[name="title"]') || inputs.find(el => el.tagName === 'INPUT' && el.type === 'text');
  }

  function findDescriptionInput() {
    return document.querySelector('textarea[name="description"]') ||
      [...document.querySelectorAll('textarea')].find(el => /description/i.test(`${el.placeholder || ''} ${el.name || ''} ${el.getAttribute('aria-label') || ''}`)) ||
      document.querySelector('textarea');
  }

  function findPriceInput() {
    return document.querySelector('input[type="number"]') ||
      document.querySelector('input[inputmode="numeric"]') ||
      [...document.querySelectorAll('input:not([type="hidden"])')].find(el => /prix|price/i.test(`${el.placeholder || ''} ${el.name || ''} ${el.getAttribute('aria-label') || ''}`));
  }

  async function fillBeebs(payload, panel) {
    const status = panel.querySelector('#v2b-beebs-status');
    const button = panel.querySelector('#v2b-beebs-fill');
    button.disabled = true;
    button.textContent = '⏳ Remplissage…';
    try {
      await sleep(250);
      const titleInput = findTitleInput();
      const descriptionInput = findDescriptionInput();
      const priceInput = findPriceInput();
      if (titleInput) setReactValue(titleInput, payload.fullTitle);
      if (descriptionInput) setReactValue(descriptionInput, payload.description || '');
      if (priceInput && payload.beebsPrice) setReactValue(priceInput, payload.beebsPrice);

      const files = (payload.photosData || []).map(dataUrlToFile).filter(Boolean);
      const fileInputs = [...document.querySelectorAll('input[type="file"]')];
      let photosInjected = false;
      if (fileInputs.length && files.length) {
        const transfer = new DataTransfer();
        files.forEach(file => transfer.items.add(file));
        for (const input of fileInputs) {
          try {
            input.files = transfer.files;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            photosInjected = true;
            break;
          } catch (error) {
            console.warn('[Vinted → Beebs] Injection photo impossible sur cet input :', error);
          }
        }
      }

      const missing = [];
      if (!titleInput) missing.push('titre');
      if (!descriptionInput) missing.push('description');
      if (!priceInput) missing.push('prix');
      if (!photosInjected) missing.push('photos (sélecteur de fichiers Beebs non trouvé)');
      if (status) status.textContent = `${photosInjected ? `✓ ${files.length} photo(s) injectée(s)` : '⚠️ Photos non injectées'} · ${missing.length ? `À vérifier : ${missing.join(', ')}` : 'Titre, description et prix remplis.'}`;
      button.textContent = '✓ Tentative de remplissage terminée';
    } catch (error) {
      console.error('[Vinted → Beebs] Remplissage :', error);
      if (status) status.textContent = `⚠️ ${error.message || 'Erreur pendant le remplissage.'}`;
      button.disabled = false;
      button.textContent = 'Réessayer le remplissage';
    }
  }

  function initBeebs() {
    if (!location.pathname.includes('/listing')) return;
    const payload = GM_getValue(EXPORT_KEY, null);
    if (!payload || document.getElementById('v2b-beebs-panel')) return;

    const panel = document.createElement('aside');
    panel.id = 'v2b-beebs-panel';
    panel.style.cssText = 'position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:12px;border-radius:12px;width:min(360px,calc(100vw - 24px));max-height:80vh;overflow:auto;box-shadow:0 6px 18px #0003';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <b style="flex:1">⚡ Import Vinted → Beebs V4.0</b>
        <button type="button" id="v2b-beebs-min" title="Réduire" style="padding:2px 7px;background:#eee">−</button>
        <button type="button" id="v2b-beebs-close" title="Fermer et oublier cet import" style="padding:2px 7px;background:#fee2e2;color:#991b1b">×</button>
      </div>
      <div id="v2b-beebs-body">
        <div style="font-size:12px;font-weight:700;overflow-wrap:anywhere">${escapeHtml(payload.fullTitle)}</div>
        <div style="font-size:11px;background:#fff;padding:7px;border-radius:7px;max-height:100px;overflow:auto;white-space:pre-wrap;margin:7px 0">${escapeHtml(payload.description || 'Aucune description récupérée.')}</div>
        <div style="font-size:11px;margin:5px 0">Prix Vinted : <b>${escapeHtml(payload.price || '—')}</b><br>Prix Beebs : <b>${escapeHtml(payload.beebsPrice || 'à vérifier')} €</b> (arrondi à l’euro)</div>
        <div id="v2b-beebs-thumbs" style="display:flex;gap:4px;flex-wrap:wrap;background:#fff;padding:5px;border-radius:7px;min-height:30px"></div>
        <button type="button" id="v2b-beebs-fill" style="width:100%;background:#171717;color:#fff;margin-top:8px">1. Remplir l’annonce + ${payload.photosData?.length || 0} photo(s)</button>
        <div id="v2b-beebs-status" style="font-size:11px;margin-top:7px">Vérifie les champs après le remplissage.</div>
      </div>`;
    document.body.appendChild(panel);

    const thumbs = panel.querySelector('#v2b-beebs-thumbs');
    (payload.photosData || []).forEach(dataUrl => {
      const image = document.createElement('img');
      image.src = dataUrl;
      image.alt = 'Photo de l’annonce Vinted';
      image.style.cssText = 'width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid #eab308';
      thumbs.appendChild(image);
    });

    panel.querySelector('#v2b-beebs-min').onclick = () => {
      const body = panel.querySelector('#v2b-beebs-body');
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? '' : 'none';
      panel.style.width = hidden ? 'min(360px,calc(100vw - 24px))' : 'auto';
      panel.querySelector('#v2b-beebs-min').textContent = hidden ? '−' : '+';
    };
    panel.querySelector('#v2b-beebs-close').onclick = () => {
      panel.remove();
      GM_deleteValue(EXPORT_KEY);
    };
    panel.querySelector('#v2b-beebs-fill').onclick = () => fillBeebs(payload, panel);
  }

  // -----------------------------------------------------------------------
  // Démarrage et suivi des navigations SPA
  // -----------------------------------------------------------------------
  if (IS_VINTED) {
    const startVinted = () => {
      if (/\/items\/\d+/.test(location.href)) initVinted();
      scanGrid();
    };
    startVinted();
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        cachedItemId = null;
        cachedItemPromise = null;
        setTimeout(startVinted, 700);
      }
    }, 700);
    const observer = new MutationObserver(() => {
      clearTimeout(window.__v2bGridTimer);
      window.__v2bGridTimer = setTimeout(() => {
        scanGrid();
        if (/\/items\/\d+/.test(location.href) && document.querySelector('h1') && !document.getElementById('v2b-panel')) initVinted();
      }, 350);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (typeof GM_addValueChangeListener === 'function') {
      GM_addValueChangeListener('vinted2beebs_exported_', () => scanGrid());
    }
  }

  if (IS_BEEBS) {
    const startBeebs = () => initBeebs();
    startBeebs();
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(startBeebs, 800);
      }
      if (location.pathname.includes('/listing') && !document.getElementById('v2b-beebs-panel')) startBeebs();
    }, 1000);
  }

})();
