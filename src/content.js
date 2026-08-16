// ==UserScript==
// @name         Vinted → Beebs (by Valentin)
// @namespace    https://github.com/ValentinGratz
// @version      1.0.0
// @description  Exporte une annonce Vinted vers Beebs en 1 clic - titre, description, prix, taille, photos
// @author       ValentinGratz
// @match        https://www.vinted.fr/items/*
// @match        https://www.vinted.fr/*
// @match        https://www.vinted.com/*
// @match        https://www.vinted.de/*
// @match        https://www.vinted.es/*
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_notification
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const BEEBS_CONDITIONS = {
        'Neuf avec étiquette': 'Neuf avec étiquette',
        'Neuf sans étiquette': 'Neuf sans étiquette',
        'Très bon état': 'Très bon état',
        'Bon état': 'Bon état',
        'Satisfaisant': 'Satisfaisant',
        'Neuf': 'Neuf avec étiquette',
    };

    function log(...args) { console.log('[V→B]', ...args); }

    function extractVintedData() {
        const data = {};

        // Titre
        const titleEl = document.querySelector('h1[data-testid="item-title"], h1.web_ui__Text__title, [data-testid="item-title"] span');
        data.title = titleEl ? titleEl.innerText.trim() : document.title.split('|')[0].trim();

        // Description
        const descEl = document.querySelector('[data-testid="item-description"] span, [itemprop="description"]');
        data.description = descEl ? descEl.innerText.trim() : '';

        // Prix
        const priceEl = document.querySelector('[data-testid="item-price"] div, [class*="details-list"] [data-testid="price"]');
        let priceText = '';
        if (priceEl) priceText = priceEl.innerText;
        else {
            const all = document.body.innerText.match(/(\d+[.,]\d+)\s*€/);
            if (all) priceText = all[0];
        }
        data.priceRaw = priceText;
        data.price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

        // Photos
        const photoEls = document.querySelectorAll('img[data-testid*="item-photo"], .item-photos img, [class*="ItemPhotos"] img');
        const urls = new Set();
        photoEls.forEach(img => {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src && src.includes('vinted') && !src.includes('avatar') && src.length > 20) {
                // get high res
                const high = src.replace(/\/f\d+x\d+\//, '/f800x800/').split('?')[0];
                urls.add(high);
            }
        });
        // fallback from og:image meta
        document.querySelectorAll('meta[property="og:image"]').forEach(m => {
            if(m.content) urls.add(m.content);
        });
        data.photos = Array.from(urls).slice(0, 10);

        // Attributs (marque, taille, état)
        data.brand = '';
        data.size = '';
        data.condition = '';
        const details = document.querySelectorAll('[data-testid="attribute-list"] li, [class*="details-list"] li, [data-testid="item-attributes"] > div');
        details.forEach(li => {
            const text = li.innerText.toLowerCase();
            if (text.includes('marque')) data.brand = li.innerText.split('\n').pop().trim();
            if (text.includes('taille')) data.size = li.innerText.split('\n').pop().trim();
            if (text.includes('état') || text.includes('etat')) data.condition = li.innerText.split('\n').pop().trim();
        });

        // Si pas trouvé via liste, essaye autre sélecteur
        if (!data.brand) {
            const brandEl = document.querySelector('a[href*="/brand/"]');
            if (brandEl) data.brand = brandEl.innerText.trim();
        }

        return data;
    }

    function mapToBeebs(vinted) {
        const beebs = {};
        // Beebs titre 40 caractères max
        beebs.title = vinted.title.substring(0, 40);
        if (vinted.title.length > 40) beebs.title = beebs.title.substring(0, 37) + '...';

        // Description Beebs optimisée
        beebs.description = `${vinted.title}\n\n${vinted.description}\n\n`;
        if (vinted.brand) beebs.description += `Marque : ${vinted.brand}\n`;
        if (vinted.size) beebs.description += `Taille : ${vinted.size}\n`;
        if (vinted.condition) beebs.description += `État : ${vinted.condition}\n`;
        beebs.description += `\n📦 Envoi rapide / Article Vinted`;

        // Prix Beebs = -10% pour couvrir commission si tu veux même net, sinon même prix
        beebs.price = vinted.price;
        beebs.priceConseil = (vinted.price * 1.1).toFixed(2); // conseil si veut même marge

        beebs.conditionBeebs = BEEBS_CONDITIONS[vinted.condition] || 'Très bon état';
        beebs.size = vinted.size;
        beebs.brand = vinted.brand;

        return beebs;
    }

    function createUI() {
        if (document.getElementById('vinted-to-beebs-btn')) return;

        const titleContainer = document.querySelector('[data-testid="item-title"]')?.parentElement || document.querySelector('h1')?.parentElement;
        if (!titleContainer) return;

        const btn = document.createElement('button');
        btn.id = 'vinted-to-beebs-btn';
        btn.innerHTML = '⚡️ Exporter vers Beebs';
        btn.style.cssText = `
            background:#FFD100; color:#000; border:2px solid #000; border-radius:12px;
            padding:10px 18px; font-weight:900; font-size:15px; cursor:pointer;
            margin:12px 0; display:flex; align-items:center; gap:6px;
            box-shadow: 3px 3px 0px #000; font-family: inherit;
            transition: transform 0.1s;
        `;
        btn.onmouseenter = () => btn.style.transform = 'translate(-1px,-1px)';
        btn.onmouseleave = () => btn.style.transform = 'translate(0,0)';

        btn.onclick = async () => {
            const vinted = extractVintedData();
            const beebs = mapToBeebs(vinted);
            log('Vinted', vinted, 'Beebs', beebs);
            showPanel(vinted, beebs);
        };

        titleContainer.insertAdjacentElement('afterend', btn);
        log('Bouton injecté');
    }

    function showPanel(vinted, beebs) {
        document.getElementById('vinted-beebs-panel')?.remove();

        const panel = document.createElement('div');
        panel.id = 'vinted-beebs-panel';
        panel.style.cssText = `
            position:fixed; top:20px; right:20px; z-index:999999;
            width:380px; max-height:90vh; overflow:auto;
            background:#fff; border:3px solid #000; border-radius:16px;
            padding:16px; box-shadow:6px 6px 0px #000;
            font-family: sans-serif; font-size:14px;
        `;
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <b style="font-size:16px;">👶 Vinted → Beebs</b>
                <button id="vbb-close" style="background:#000;color:#fff;border:none;border-radius:8px;padding:4px 10px;cursor:pointer;">X</button>
            </div>

            <div style="background:#FFF8E1; border:2px dashed #000; border-radius:10px; padding:10px; margin-bottom:12px; font-size:12px;">
                ⚠️ Beebs ne permet de vendre que depuis l'app. Cette extension prépare tout pour que tu aies juste à coller dans l'app.
            </div>

            <label style="font-weight:800;">Titre Beebs (40 car max)</label>
            <div style="display:flex; gap:6px; margin:6px 0 12px;">
                <input id="vbb-title" value="${beebs.title.replace(/"/g,'&quot;')}" style="flex:1; border:2px solid #000; border-radius:8px; padding:8px;" />
                <button class="vbb-copy" data-copy="vbb-title" style="background:#000;color:#fff;border:none;border-radius:8px;padding:0 12px;cursor:pointer;">Copier</button>
            </div>

            <label style="font-weight:800;">Description Beebs</label>
            <div style="display:flex; gap:6px; margin:6px 0 12px;">
                <textarea id="vbb-desc" style="flex:1; border:2px solid #000; border-radius:8px; padding:8px; height:110px;">${beebs.description}</textarea>
                <button class="vbb-copy" data-copy="vbb-desc" style="background:#000;color:#fff;border:none;border-radius:8px;padding:0 12px;cursor:pointer;">Copier</button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
                <div>
                    <label style="font-weight:800; font-size:12px;">Prix Vinted</label>
                    <div style="border:2px solid #000; border-radius:8px; padding:8px; background:#f5f5f5;">${vinted.priceRaw || vinted.price + '€'}</div>
                </div>
                <div>
                    <label style="font-weight:800; font-size:12px;">Prix Beebs conseillé (+10%)</label>
                    <div style="display:flex; gap:4px;">
                        <input id="vbb-price" value="${beebs.price}" style="flex:1; border:2px solid #000; border-radius:8px; padding:8px;" />
                        <button class="vbb-copy" data-copy="vbb-price" style="background:#000;color:#fff;border:none;border-radius:8px;padding:0 10px;cursor:pointer;">Copier</button>
                    </div>
                </div>
            </div>

            <div style="font-size:12px; margin-bottom:12px; background:#f0f0f0; padding:8px; border-radius:8px;">
                <div>Marque: <b>${vinted.brand || '—'}</b> | Taille: <b>${vinted.size || '—'}</b> | État: <b>${vinted.condition || '—'} → ${beebs.conditionBeebs}</b></div>
            </div>

            <div id="vbb-photos" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:12px;">
                ${vinted.photos.map((url,i) => `
                    <div style="position:relative; border:2px solid #000; border-radius:8px; overflow:hidden;">
                        <img src="${url}" style="width:100%; height:70px; object-fit:cover; display:block;" />
                        <button data-dl="${url}" data-idx="${i}" class="vbb-dl" style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.8); color:#fff; border:none; font-size:10px; padding:2px; cursor:pointer;">DL</button>
                    </div>
                `).join('')}
            </div>

            <button id="vbb-dl-all" style="width:100%; background:#FFD100; border:2px solid #000; border-radius:10px; padding:10px; font-weight:900; cursor:pointer; box-shadow:2px 2px 0 #000; margin-bottom:8px;">📥 Télécharger toutes les photos (ZIP manuel)</button>
            <button id="vbb-open-beebs" style="width:100%; background:#000; color:#FFD100; border:2px solid #000; border-radius:10px; padding:10px; font-weight:900; cursor:pointer; margin-bottom:8px;">👶 Ouvrir Beebs + Copier tout</button>
            <div style="font-size:11px; color:#666; text-align:center;">100% local - rien n'est envoyé à un serveur</div>
        `;

        document.body.appendChild(panel);

        panel.querySelector('#vbb-close').onclick = () => panel.remove();

        panel.querySelectorAll('.vbb-copy').forEach(b => {
            b.onclick = () => {
                const id = b.getAttribute('data-copy');
                const el = document.getElementById(id);
                const text = el.value;
                if (false) GM_setClipboard(text);
                else navigator.clipboard.writeText(text);
                b.innerText = 'OK!';
                setTimeout(() => b.innerText = 'Copier', 1000);
            };
        });

        panel.querySelectorAll('.vbb-dl').forEach(b => {
            b.onclick = () => {
                const url = b.getAttribute('data-dl');
                const idx = b.getAttribute('data-idx');
                if (false) {
                    GM_download(url, `beebs-photo-${idx}.jpg`);
                } else {
                    if(typeof chrome!=='undefined' && chrome.downloads){ chrome.downloads.download({url}); } else { window.open(url, '_blank'); }
                }
            };
        });

        panel.querySelector('#vbb-dl-all').onclick = () => {
            vinted.photos.forEach((url,i) => {
                setTimeout(() => {
                    if (false) GM_download(url, `beebs-${beebs.title.substring(0,10)}-${i+1}.jpg`);
                    else if(typeof chrome!=='undefined' && chrome.downloads){ chrome.downloads.download({url}); } else { window.open(url, '_blank'); }
                }, i*400);
            });
        };

        panel.querySelector('#vbb-open-beebs').onclick = () => {
            const fullText = `${beebs.title}\n\n${beebs.description}\n\nPrix: ${beebs.price}€`;
            if (false) GM_setClipboard(fullText);
            else navigator.clipboard.writeText(fullText);
            window.open('https://www.beebs.app/', '_blank');
            if (false) GM_notification({title:'Vinted → Beebs', text:'Tout copié ! Colle dans l\'app Beebs'});
        };
    }

    // Observer pour SPA Vinted
    setInterval(createUI, 2000);
    const observer = new MutationObserver(createUI);
    observer.observe(document.body, {childList:true, subtree:true});
    createUI();

})();
