// src/content.js V3.2 - persistance état "Exporté" + compat vinted2leboncoin (fixes #2)
console.log('Beebs V3.2 chargé sur', location.hostname);
const IS_VINTED = location.hostname.includes('vinted');
const IS_BEEBS = location.hostname.includes('beebs.app');

// ---------------------------------------------------------------------------
// Persistance de l'état "Exporté" (issue #2, partie 1)
// Clé: vinted2beebs_exported_{item_id} -> { date: ISOString, url: string }
// chrome.storage.local en priorité, fallback localStorage.
// ---------------------------------------------------------------------------
function getVintedItemId(url) {
  const m = (url || location.href).match(/\/items\/(\d+)/);
  return m ? m[1] : null;
}

function exportedKey(itemId) {
  return `vinted2beebs_exported_${itemId}`;
}

function formatDateFR(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch (e) {
    return '';
  }
}

async function v2bStorageGet(key) {
  try {
    if (chrome?.storage?.local) {
      const res = await chrome.storage.local.get(key);
      if (res && res[key] !== undefined) return res[key];
    }
  } catch (e) { /* extension context invalide, on tente le fallback */ }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

async function v2bStorageSet(key, value) {
  try {
    if (chrome?.storage?.local) await chrome.storage.local.set({ [key]: value });
  } catch (e) { /* ignore */ }
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
}

async function v2bStorageRemove(key) {
  try {
    if (chrome?.storage?.local) await chrome.storage.local.remove(key);
  } catch (e) { /* ignore */ }
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

async function getExportedState(itemId) {
  if (!itemId) return null;
  return v2bStorageGet(exportedKey(itemId));
}

async function setExportedState(itemId, url) {
  if (!itemId) return;
  await v2bStorageSet(exportedKey(itemId), { date: new Date().toISOString(), url });
}

async function clearExportedState(itemId) {
  if (!itemId) return;
  await v2bStorageRemove(exportedKey(itemId));
}

// ---------------------------------------------------------------------------
// Compat vinted2leboncoin (issue #2, partie 2 - bonus)
// ---------------------------------------------------------------------------
function detectLeboncoinInstalled() {
  if (document.querySelector('#vc-lbc-transfer-btn, .vc-lbc-badge')) return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vinted2leboncoin_exported_')) return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

// Badge compact posé en haut à gauche de l'image principale, uniquement
// visible quand l'annonce est déjà exportée vers Beebs. Leboncoin utilise le
// haut à droite (voir vc-lbc-badge / vc-lbc-transfer-btn) -> pas de conflit.
function renderImageBadge(show) {
  const existing = document.getElementById('v2b-img-badge');
  if (!show) { existing?.remove(); return; }
  if (existing) return;

  const mainImg = document.querySelector('img[data-testid^="item-photo-1"]') ||
                   document.querySelector('img[data-testid*="photo"]') ||
                   document.querySelector('[data-testid="item-page-summary-plugin"] img');
  const container = mainImg?.closest('div');
  if (!container) return;

  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const badge = document.createElement('div');
  badge.id = 'v2b-img-badge';
  badge.className = 'v2b-img-badge';
  badge.textContent = '⚡ Beebs ✓';
  badge.title = 'Déjà exporté vers Beebs';
  container.appendChild(badge);
}

// ---------------------------------------------------------------------------
// Badges sur les grilles (dressing, recherche, favoris...) (issue #2 - suite)
// La page dressing affiche toutes les annonces en vignettes : il faut
// scanner chaque carte, pas juste la page d'une annonce individuelle.
// ---------------------------------------------------------------------------
const V2B_GRID_BADGE_CLASS = 'v2b-grid-badge';
const V2B_SCANNED_ATTR = 'data-v2b-scanned';

function extractItemIdFromHref(href) {
  const m = (href || '').match(/\/items\/(\d+)/);
  return m ? m[1] : null;
}

function findCardContainer(link) {
  // Vinted change régulièrement ses data-testid ; on essaie plusieurs
  // sélecteurs plausibles avant de retomber sur le lien lui-même.
  return link.closest('[data-testid*="grid-item"]') ||
         link.closest('[data-testid*="item-box"]') ||
         link.closest('article') ||
         link.closest('div') ||
         link;
}

function addGridBadge(card) {
  if (card.querySelector(`.${V2B_GRID_BADGE_CLASS}`)) return;
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
  const badge = document.createElement('div');
  badge.className = V2B_GRID_BADGE_CLASS;
  badge.textContent = '⚡';
  badge.title = 'Déjà exporté vers Beebs';
  card.appendChild(badge);
}

function removeGridBadge(card) {
  card?.querySelector(`.${V2B_GRID_BADGE_CLASS}`)?.remove();
}

async function scanGridForBadges(root = document) {
  const links = root.querySelectorAll(`a[href*="/items/"]:not([${V2B_SCANNED_ATTR}])`);
  for (const link of links) {
    link.setAttribute(V2B_SCANNED_ATTR, '1');
    const itemId = extractItemIdFromHref(link.getAttribute('href'));
    if (!itemId) continue;
    const state = await getExportedState(itemId);
    if (!state) continue;
    addGridBadge(findCardContainer(link));
  }
}

// Met à jour en direct les badges déjà affichés à l'écran quand un export
// est fait/annulé dans un autre onglet (ou après un rescan périodique).
function updateGridBadgesForItem(itemId, exported) {
  document.querySelectorAll(`a[href*="/items/${itemId}"]`).forEach(link => {
    const card = findCardContainer(link);
    if (exported) addGridBadge(card); else removeGridBadge(card);
  });
}

if (IS_VINTED) {
  // Scan initial, puis à chaque changement du DOM (scroll infini,
  // navigation interne à la SPA Vinted qui ne recharge pas la page).
  scanGridForBadges();
  const v2bGridObserver = new MutationObserver(() => {
    clearTimeout(window.__v2bGridScanTimeout);
    window.__v2bGridScanTimeout = setTimeout(() => scanGridForBadges(), 300);
  });
  v2bGridObserver.observe(document.body, { childList: true, subtree: true });

  // Filet de sécurité : re-scan périodique (au cas où le MutationObserver
  // rate un changement, ex. remplacement de nœuds sans ajout/suppression).
  setInterval(() => scanGridForBadges(), 4000);

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const key of Object.keys(changes)) {
        if (!key.startsWith('vinted2beebs_exported_')) continue;
        const itemId = key.replace('vinted2beebs_exported_', '');
        updateGridBadgesForItem(itemId, !!changes[key].newValue);
      }
    });
  }
}

if (IS_VINTED) {
  setTimeout(async () => {
    const itemId = getVintedItemId(location.href);
    if (!itemId) return; // pas une page annonce, rien à afficher/persister

    document.getElementById('v2b')?.remove();
    const box = document.createElement('div'); box.id = 'v2b';
    box.style.cssText = 'position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:10px;border-radius:12px;width:310px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.15)';
    document.body.appendChild(box);

    const leboncoinDetected = detectLeboncoinInstalled();
    if (leboncoinDetected) console.log('[vinted2beebs] vinted2leboncoin détecté, badge Beebs positionné en haut à gauche de l\'image');

    async function runExtraction() {
      box.innerHTML = `<b>⚡ Export Beebs</b><br><span id="st">Scan photos...</span><div id="pr" style="font-size:11px;background:#fff;padding:5px;margin:5px 0;border-radius:6px;max-height:90px;overflow:auto;white-space:pre-wrap"></div><button id="goB" style="width:100%;background:#eab308;border:0;padding:8px;border-radius:8px;font-weight:bold;cursor:pointer">🚀 Exporter vers Beebs</button>`;

      const desc = getDesc();
      const price = getPrice();
      const title = document.querySelector('h1')?.innerText?.trim() || document.title.split('|')[0] || '';

      document.getElementById('pr').innerText = desc.slice(0, 250) + '...\n\nPrix: ' + price;

      let photos = [...new Set([...document.querySelectorAll('img[src*="vinted.net"]')].map(i => i.src).filter(s => !s.includes('avatar') && !s.includes('25x25') && !s.includes('50x50')))].slice(0, 10);
      document.getElementById('st').innerText = `Detect: ${photos.length} | fetch background...`;

      const dataUrl = await new Promise(res => {
        chrome.runtime.sendMessage({ type: 'FETCH_PHOTOS', urls: photos }, (r) => res(r || []));
      });
      const clean = (dataUrl || []).filter(Boolean);
      document.getElementById('st').innerText = `Detect: ${photos.length} | OK: ${clean.length}`;

      await chrome.storage.local.set({ lastBeebsExport: { fullTitle: title, description: desc, price, photosData: clean } });

      document.getElementById('goB').onclick = async () => {
        window.open('https://www.beebs.app/fr/listing', '_blank');
        await setExportedState(itemId, location.href);
        renderExportedUI();
        renderImageBadge(true);
      };
    }

    function renderExportedUI() {
      getExportedState(itemId).then(persisted => {
        const s = persisted || { date: new Date().toISOString() };
        box.innerHTML = `<b>⚡ Export Beebs</b><br>
          <button id="doneBtn" disabled style="width:100%;background:#22c55e;color:#fff;border:0;padding:8px;border-radius:8px;font-weight:bold;cursor:default;margin-top:6px">✅ Exporté sur Beebs</button>
          <div style="font-size:11px;color:#555;margin-top:6px" title="${s.date}">Exporté le ${formatDateFR(s.date)}
            <span id="clearBtn" title="Réinitialiser l'état exporté" style="cursor:pointer;color:#b91c1c;margin-left:6px">✕</span>
          </div>
          <a href="https://www.beebs.app/fr/listing" target="_blank" style="display:inline-block;margin-top:6px;font-size:12px;color:#555;text-decoration:underline">Ré-ouvrir Beebs</a>`;

        document.getElementById('clearBtn').onclick = async (e) => {
          e.preventDefault();
          await clearExportedState(itemId);
          renderImageBadge(false);
          runExtraction();
        };
        // clic droit sur le bouton = raccourci pour réinitialiser aussi
        document.getElementById('doneBtn').oncontextmenu = async (e) => {
          e.preventDefault();
          await clearExportedState(itemId);
          renderImageBadge(false);
          runExtraction();
        };
      });
    }

    const existing = await getExportedState(itemId);
    if (existing) {
      renderExportedUI();
      renderImageBadge(true);
    } else {
      runExtraction();
    }
  }, 1000);
}

function getDesc() {
  const body = document.body.innerText || "";
  const start = body.indexOf('Craquez pour');
  if (start !== -1) {
    let chunk = body.slice(start);
    let cut = chunk.search(/\n#|Envoi\n|Booster|Indiquer comme vendu|Marquer comme réservé|Masquer\nModifier/);
    if (cut !== -1) chunk = chunk.slice(0, cut);
    return chunk.trim();
  }
  return document.querySelector('[data-testid="item-description"] span')?.innerText?.trim() ||
    document.querySelector('[data-testid="item-description"]')?.innerText?.trim() || "";
}

function getPrice() {
  const el = document.querySelector('[data-testid="item-price"]');
  return el ? el.innerText : (document.body.innerText.match(/\d+[.,]\d+\s*€/)?.[0] || "");
}

function setReact(el, val) {
  if (!el) return;
  el.focus();
  const last = el.value;
  try {
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    if (desc && desc.set) desc.set.call(el, val); else el.value = val;
  } catch (e) { el.value = val; }
  if (el._valueTracker) el._valueTracker.setValue(last);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
}

if (IS_BEEBS) {
  (async () => {
    const { lastBeebsExport } = await chrome.storage.local.get('lastBeebsExport'); if (!lastBeebsExport) return;
    if (document.getElementById('v2bB')) return;
    const p = document.createElement('div'); p.id = 'v2bB';
    p.style.cssText = 'position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:12px;border-radius:12px;width:350px;font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2)';
    p.innerHTML = `<b>⚡ Import Vinted → Beebs</b><br><small style="display:block;word-break:break-word;margin:4px 0">${lastBeebsExport.fullTitle}</small><div style="font-size:11px;background:#fff;padding:6px;border-radius:6px;max-height:110px;overflow:auto;white-space:pre-wrap">${lastBeebsExport.description}</div><div style="font-size:11px;margin:4px 0">Prix brut: <b>${lastBeebsExport.price}</b></div><div id="th" style="display:flex;gap:4px;flex-wrap:wrap;background:#fff;padding:4px;border-radius:6px;min-height:30px"></div><button id="f1" style="width:100%;background:#111;color:#fff;padding:12px;border-radius:10px;font-weight:600;cursor:pointer;margin-top:8px">1. Remplir + ${lastBeebsExport.photosData.length} photos auto</button><div id="st2" style="font-size:11px;margin-top:6px"></div>`;
    document.body.appendChild(p);

    const files = []; const th = document.getElementById('th');
    (lastBeebsExport.photosData || []).forEach((d, i) => {
      const im = document.createElement('img'); im.src = d; im.style.cssText = 'width:54px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #eab308'; th.appendChild(im);
      try {
        const b64 = d.split(',')[1]; const bin = atob(b64); const ab = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) ab[j] = bin.charCodeAt(j);
        files.push(new File([ab], `beebs-${i + 1}.jpg`, { type: 'image/jpeg' }));
      } catch (e) { }
    });

    document.getElementById('f1').onclick = async () => {
      window.scrollTo(0, 400); await new Promise(r => setTimeout(r, 200)); window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 200));

      const all = [...document.querySelectorAll('input,textarea')];
      let ti = all.find(i => (i.placeholder || '').toLowerCase().includes('titre')) || document.querySelector('input[name="title"]') || all.find(i => i.type === 'text') || all[0];
      if (ti) { ti.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150)); setReact(ti, lastBeebsExport.fullTitle); }

      let di = document.querySelector('textarea[name="description"]') || document.querySelector('textarea') || all.find(i => i.tagName === 'TEXTAREA');
      if (di) { di.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150)); setReact(di, lastBeebsExport.description); }

      let pi = document.querySelector('input[type="number"]') || document.querySelector('input[inputmode="numeric"]') || [...document.querySelectorAll('input')].find(i => (i.placeholder || '').toLowerCase().includes('prix'));
      if (pi) {
        let pr = (lastBeebsExport.price || '').toString().replace(/[^\d.,]/g, '').replace(',', '.'); // 2,00€ -> 2.00
        pr = pr.split('.')[0]; // Beebs veut entier
        if (!pr) pr = '2';
        pi.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150));
        setReact(pi, pr);
      }

      const inputs = [...document.querySelectorAll('input[type="file"]')];
      if (inputs.length && files.length) {
        const dt = new DataTransfer(); files.forEach(f => dt.items.add(f));
        inputs.forEach(inp => {
          inp.files = dt.files;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new Event('input', { bubbles: true }));
        });
        document.getElementById('st2').innerText = `✓ ${files.length} photos injectées + titre + desc + prix`;
      } else {
        document.getElementById('st2').innerText = `Photos: ${files.length} - input file non trouvé`;
      }
    };
  })();
}
