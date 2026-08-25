// ==UserScript==
// @name Vinted → Beebs (by Valentin) - V3.2.1 PERSIST+GRID
// @namespace https://github.com/ValentinGratz
// @version 3.2.1
// @description Exporte Vinted vers Beebs en 1 clic - description propre (Craquez pour...), prix, photos via GM_xmlhttpRequest, état "Exporté" persistant + badges sur la grille du dressing, compat vinted2leboncoin
// @author ValentinGratz
// @match https://www.vinted.fr/items/*
// @match https://www.vinted.fr/*
// @match https://*.beebs.app/*
// @match https://www.beebs.app/*
// @grant GM_xmlhttpRequest
// @grant GM_download
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_deleteValue
// @grant GM_notification
// @connect vinted.net
// @connect vinted.fr
// @run-at document-idle
// ==/UserScript==

(function() {
'use strict';
const IS_VINTED = location.hostname.includes('vinted');
const IS_BEEBS = location.hostname.includes('beebs');

// ---------------------------------------------------------------------------
// Style des badges (état "Exporté" sur la page annonce + grille du dressing)
// ---------------------------------------------------------------------------
const style = document.createElement('style');
style.textContent = `
  .v2b-img-badge {
    position: absolute; top: 8px; left: 8px; z-index: 999998;
    background: #eab308; color: #000; font-family: sans-serif;
    font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,.3); pointer-events: none;
  }
  .v2b-grid-badge {
    position: absolute; top: 4px; left: 4px; z-index: 998;
    background: #eab308; color: #000; font-size: 11px; line-height: 1;
    padding: 3px 5px; border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0,0,0,.3); pointer-events: none;
  }
`;
document.head.appendChild(style);

// ---------------------------------------------------------------------------
// Persistance de l'état "Exporté" (issue #2, partie 1)
// Clé: vinted2beebs_exported_{item_id} -> { date: ISOString, url: string }
// GM_setValue/GM_getValue = stockage propre au script, partagé entre
// vinted.fr et beebs.app, survit au refresh/fermeture de page.
// ---------------------------------------------------------------------------
function getVintedItemId(url){
  const m = (url || location.href).match(/\/items\/(\d+)/);
  return m ? m[1] : null;
}
function exportedKey(itemId){ return `vinted2beebs_exported_${itemId}`; }
function formatDateFR(iso){
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch(e){ return ''; }
}
function getExportedState(itemId){
  if(!itemId) return null;
  return GM_getValue(exportedKey(itemId), null);
}
function setExportedState(itemId, url){
  if(!itemId) return;
  GM_setValue(exportedKey(itemId), { date: new Date().toISOString(), url });
}
function clearExportedState(itemId){
  if(!itemId) return;
  GM_deleteValue(exportedKey(itemId));
}

// ---------------------------------------------------------------------------
// Compat vinted2leboncoin (issue #2, partie 2 - bonus)
// ---------------------------------------------------------------------------
function detectLeboncoinInstalled(){
  if(document.querySelector('#vc-lbc-transfer-btn, .vc-lbc-badge')) return true;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('vinted2leboncoin_exported_')) return true;
    }
  }catch(e){ /* ignore */ }
  return false;
}

// Badge compact en haut à gauche de l'image principale de l'annonce.
// Leboncoin utilise le haut à droite -> pas de conflit visuel.
function renderImageBadge(show){
  const existing = document.getElementById('v2b-img-badge');
  if(!show){ existing?.remove(); return; }
  if(existing) return;

  const mainImg = document.querySelector('img[data-testid^="item-photo-1"]') ||
                   document.querySelector('img[data-testid*="photo"]') ||
                   document.querySelector('[data-testid="item-page-summary-plugin"] img');
  const container = mainImg?.closest('div');
  if(!container) return;
  if(getComputedStyle(container).position === 'static') container.style.position = 'relative';

  const badge = document.createElement('div');
  badge.id = 'v2b-img-badge';
  badge.className = 'v2b-img-badge';
  badge.textContent = '⚡ Beebs ✓';
  badge.title = 'Déjà exporté vers Beebs';
  container.appendChild(badge);
}

// ---------------------------------------------------------------------------
// Badges sur les grilles (dressing, recherche, favoris...)
// ---------------------------------------------------------------------------
const V2B_GRID_BADGE_CLASS = 'v2b-grid-badge';
const V2B_SCANNED_ATTR = 'data-v2b-scanned';

function extractItemIdFromHref(href){
  const m = (href || '').match(/\/items\/(\d+)/);
  return m ? m[1] : null;
}
function findCardContainer(link){
  return link.closest('[data-testid*="grid-item"]') ||
         link.closest('[data-testid*="item-box"]') ||
         link.closest('article') ||
         link.closest('div') ||
         link;
}
function addGridBadge(card){
  if(card.querySelector(`.${V2B_GRID_BADGE_CLASS}`)) return;
  if(getComputedStyle(card).position === 'static') card.style.position = 'relative';
  const badge = document.createElement('div');
  badge.className = V2B_GRID_BADGE_CLASS;
  badge.textContent = '⚡';
  badge.title = 'Déjà exporté vers Beebs';
  card.appendChild(badge);
}
function scanGridForBadges(root = document){
  const links = root.querySelectorAll(`a[href*="/items/"]:not([${V2B_SCANNED_ATTR}])`);
  links.forEach(link => {
    link.setAttribute(V2B_SCANNED_ATTR, '1');
    const itemId = extractItemIdFromHref(link.getAttribute('href'));
    if(!itemId) return;
    const state = getExportedState(itemId);
    if(!state) return;
    addGridBadge(findCardContainer(link));
  });
}

function getCleanDesc(){
  const body = document.body.innerText || "";
  const start = body.indexOf('Craquez pour');
  if(start!==-1){
    let chunk = body.slice(start);
    let cut = chunk.search(/\n#|Envoi\n|Booster|Indiquer comme vendu|Marquer comme réservé|Masquer\nModifier/);
    if(cut!==-1) chunk = chunk.slice(0,cut);
    return chunk.trim();
  }
  // fallback: cherche le plus long span hors protection consommateur
  const all = [...document.querySelectorAll('span,div')].filter(s=>s.innerText && s.innerText.length>80 && s.innerText.length<2000 && s.children.length<=1 &&!s.innerText.includes('Les lois en matière') &&!s.innerText.includes('Publicité'));
  return all.sort((a,b)=>b.innerText.length-a.innerText.length)[0]?.innerText.trim() || "";
}

function extractVintedData(){
  const title = document.querySelector('h1')?.innerText.trim() || document.title.split('|')[0].trim();
  const description = getCleanDesc();
  const priceRaw = document.querySelector('[data-testid="item-price"]')?.innerText || (document.body.innerText.match(/\d+[.,]\d+\s*€/)?.[0] || "2 €");
  const price = parseFloat(priceRaw.replace(/[^\d.,]/g,'').replace(',','.')) || 2;

  const photos = [...new Set([...document.querySelectorAll('img[src*="vinted.net"]')].map(i=>i.currentSrc||i.src).filter(s=>s &&!s.includes('avatar') &&!s.includes('25x25')))].slice(0,10);

  return { title, description, price, priceRaw, photos };
}

function fetchAsDataUrl(url){
  return new Promise((res)=>{
    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      onload: function(r){
        try{
          const blob = new Blob([r.response], {type:'image/jpeg'});
          const reader = new FileReader();
          reader.onload = ()=>res(reader.result);
          reader.readAsDataURL(blob);
        }catch(e){ res(null); }
      },
      onerror: ()=>res(null)
    });
  });
}

if(IS_VINTED){
  // Scan de la grille (dressing, recherche, favoris) : initial, puis à
  // chaque changement du DOM (scroll infini, navigation SPA sans reload),
  // avec un filet de sécurité en cas de mutation ratée.
  scanGridForBadges();
  const v2bGridObserver = new MutationObserver(() => {
    clearTimeout(window.__v2bGridScanTimeout);
    window.__v2bGridScanTimeout = setTimeout(() => scanGridForBadges(), 300);
  });
  v2bGridObserver.observe(document.body, { childList: true, subtree: true });
  setInterval(() => scanGridForBadges(), 4000);

  const check = setInterval(()=>{
    if(!/\/items\/\d+/.test(location.href)) return;
    const h1 = document.querySelector('h1');
    if(!h1) return;

    const itemId = getVintedItemId(location.href);
    const leboncoinDetected = detectLeboncoinInstalled();
    if(leboncoinDetected) console.log('[vinted2beebs] vinted2leboncoin détecté, badge Beebs en haut à gauche de l\'image');

    function renderClassicButton(){
      document.getElementById('vinted-to-beebs-btn')?.remove();
      document.getElementById('v2b-status')?.remove();

      const btn = document.createElement('button');
      btn.id='vinted-to-beebs-btn';
      btn.textContent='⚡ Exporter vers Beebs';
      btn.style.cssText='margin:10px 0;background:#eab308;color:#000;border:0;padding:10px 14px;border-radius:10px;font-weight:700;cursor:pointer;z-index:9999;display:block';
      h1.parentElement.appendChild(btn);

      const status = document.createElement('div');
      status.id='v2b-status'; status.style.cssText='font-size:12px;margin:6px 0;background:#fef9c3;padding:6px;border-radius:6px';
      status.textContent='Prêt';
      h1.parentElement.appendChild(status);

      btn.onclick = async ()=>{
        btn.textContent='⏳ Récupération...';
        const data = extractVintedData();
        status.textContent = `Detect: ${data.photos.length} | DL...`;

        const dataUrls = [];
        for(let u of data.photos){
          const d = await fetchAsDataUrl(u);
          if(d) dataUrls.push(d);
          status.textContent = `Detect: ${data.photos.length} | OK: ${dataUrls.length}`;
        }

        const payload = { fullTitle: data.title, description: data.description, price: data.priceRaw, photosData: dataUrls, photos: data.photos };
        GM_setValue('lastBeebsExport', payload);
        localStorage.setItem('lastBeebsExport', JSON.stringify(payload)); // fallback pour beebs.app

        GM_notification({title:'Vinted → Beebs', text:`${dataUrls.length} photos + description propre prêtes! Va sur beebs.app/fr/listing`, timeout:4000});

        if(itemId) setExportedState(itemId, location.href);
        renderImageBadge(true);
        renderExportedUI();
      };
    }

    function renderExportedUI(){
      const persisted = getExportedState(itemId);
      const s = persisted || { date: new Date().toISOString() };

      document.getElementById('vinted-to-beebs-btn')?.remove();
      document.getElementById('v2b-status')?.remove();

      const box = document.createElement('div');
      box.id = 'v2b-status';
      box.style.cssText = 'margin:10px 0;background:#fef9c3;border:2px solid #eab308;padding:10px;border-radius:12px;font-family:sans-serif';
      box.innerHTML = `
        <button id="v2b-done-btn" disabled style="width:100%;background:#22c55e;color:#fff;border:0;padding:10px 14px;border-radius:10px;font-weight:700;cursor:default">✅ Exporté sur Beebs</button>
        <div style="font-size:12px;color:#555;margin-top:6px" title="${s.date}">Exporté le ${formatDateFR(s.date)}
          <span id="v2b-clear-btn" title="Réinitialiser l'état exporté" style="cursor:pointer;color:#b91c1c;margin-left:6px">✕</span>
        </div>
        <a href="https://www.beebs.app/fr/listing" target="_blank" style="display:inline-block;margin-top:6px;font-size:12px;color:#555;text-decoration:underline">Ré-ouvrir Beebs</a>`;
      h1.parentElement.appendChild(box);

      const reset = (e) => {
        e.preventDefault();
        if(itemId) clearExportedState(itemId);
        renderImageBadge(false);
        renderClassicButton();
      };
      document.getElementById('v2b-clear-btn').onclick = reset;
      document.getElementById('v2b-done-btn').oncontextmenu = reset;
    }

    if(document.getElementById('vinted-to-beebs-btn') || document.getElementById('v2b-status')) return; // déjà rendu pour cette annonce

    const existing = itemId ? getExportedState(itemId) : null;
    if(existing){
      renderExportedUI();
      renderImageBadge(true);
    } else {
      renderClassicButton();
    }
  },1000);
}

if(IS_BEEBS){
  const check2 = setInterval(()=>{
    if(!location.href.includes('/listing')) return;
    if(document.getElementById('v2bB')) return;
    const payload = GM_getValue('lastBeebsExport') || JSON.parse(localStorage.getItem('lastBeebsExport')||'null');
    if(!payload) return;

    const p=document.createElement('div'); p.id='v2bB';
    p.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:12px;border-radius:12px;width:350px;font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2)';
    p.innerHTML=`<b>⚡ Import Vinted → Beebs V3.2.1</b><br><small>${payload.fullTitle}</small><div style="font-size:11px;background:#fff;padding:6px;border-radius:6px;max-height:110px;overflow:auto;white-space:pre-wrap;margin:6px 0">${payload.description}</div><div style="font-size:11px">Prix: <b>${payload.price}</b></div><div id="th" style="display:flex;gap:4px;flex-wrap:wrap;background:#fff;padding:4px;border-radius:6px"></div><button id="f1" style="width:100%;background:#111;color:#fff;padding:12px;border-radius:10px;font-weight:600;cursor:pointer;margin-top:8px">1. Remplir + ${payload.photosData.length} photos auto</button>`;
    document.body.appendChild(p);

    const files=[]; const th=document.getElementById('th');
    (payload.photosData||[]).forEach((d,i)=>{
      const im=document.createElement('img'); im.src=d; im.style.cssText='width:54px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #eab308'; th.appendChild(im);
      try{
        const b64=d.split(',')[1]; const bin=atob(b64); const ab=new Uint8Array(bin.length);
        for(let j=0;j<bin.length;j++) ab[j]=bin.charCodeAt(j);
        files.push(new File([ab],`beebs-${i+1}.jpg`,{type:'image/jpeg'}));
      }catch(e){}
    });

    function setReact(el,val){
      el.focus();
      const last=el.value;
      const desc=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');
      if(desc&&desc.set) desc.set.call(el,val); else el.value=val;
      if(el._valueTracker) el._valueTracker.setValue(last);
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    }

    document.getElementById('f1').onclick=async()=>{
      const all=[...document.querySelectorAll('input,textarea')];
      let ti=all.find(i=>(i.placeholder||'').toLowerCase().includes('titre')) || document.querySelector('input[name="title"]') || all.find(i=>i.type==='text');
      if(ti) setReact(ti,payload.fullTitle);
      let di=document.querySelector('textarea[name="description"]') || document.querySelector('textarea');
      if(di) setReact(di,payload.description);
      let pi=document.querySelector('input[type="number"]') || document.querySelector('input[inputmode="numeric"]');
      if(pi){
        let pr = (payload.price||'2').toString().replace(/[^\d.,]/g,'').replace(',','.').split('.')[0] || '2';
        setReact(pi,pr);
      }
      const inputs=[...document.querySelectorAll('input[type="file"]')];
      if(inputs.length && files.length){
        const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f));
        inputs.forEach(inp=>{ inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true})); });
      }
    };
  },1200);
}
})();
