// ==UserScript==
// @name Vinted → Beebs (by Valentin) - FIXED v1.2.0
// @namespace https://github.com/ValentinGratz
// @version 1.2.0
// @description Exporte une annonce Vinted vers Beebs en 1 clic - titre, description, prix, taille, photos
// @author ValentinGratz
// @match https://www.vinted.fr/items/*
// @match https://www.vinted.fr/*
// @match https://www.vinted.com/*
// @match https://www.vinted.de/*
// @match https://www.vinted.es/*
// @grant GM_download
// @grant GM_setClipboard
// @grant GM_notification
// @run-at document-idle
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

    function log(...args) { console.log('[V→B]',...args); }

    function extractVintedData() {
        const data = { title: '', description: '', price: 0, priceRaw: '', photos: [], brand: '', size: '', condition: '' };

        // 1. Méthode la plus stable : JSON-LD + __NEXT_DATA__ / Apollo
        try {
            const ld = document.querySelector('script[type="application/ld+json"]');
            if (ld) {
                const j = JSON.parse(ld.textContent);
                if (j.name) data.title = j.name;
                if (j.description) data.description = j.description;
                if (j.image) data.photos = Array.isArray(j.image)? j.image : [j.image];
                if (j.offers?.price) {
                    data.price = parseFloat(j.offers.price);
                    data.priceRaw = j.offers.price + ' ' + (j.offers.priceCurrency || '€');
                }
            }
        } catch(e){}

        // 2. Fallback Apollo State (nouveau Vinted)
        try {
            const apolloScript = Array.from(document.querySelectorAll('script')).find(s => s.textContent.includes('ItemDto'));
            if (apolloScript) {
                const m = apolloScript.textContent.match(/"title":"([^"]+)"/);
                if (m &&!data.title) data.title = JSON.parse(`"${m[1]}"`);
                const descM = apolloScript.textContent.match(/"description":"([^"]+)"/);
                if (descM &&!data.description) data.description = JSON.parse(`"${descM[1]}"`);
            }
        } catch(e){}

        // 3. DOM Fallback (nouveaux sélecteurs 2026)
        if (!data.title) {
            const titleEl = document.querySelector('h1, [data-testid="item-title"], span[data-testid="item-title"]');
            data.title = titleEl? titleEl.innerText.trim() : document.title.split('|')[0].trim();
        }
        if (!data.description) {
            const descEl = document.querySelector('[data-testid="item-description"] div, div[itemprop="description"]');
            data.description = descEl? descEl.innerText.trim() : '';
        }
        if (!data.price) {
            const priceText = document.body.innerHTML.match(/(\d+[.,]\d+)\s*€/);
            if (priceText) {
                data.priceRaw = priceText[0];
                data.price = parseFloat(priceText[0].replace(/[^\d.,]/g,'').replace(',','.')) || 0;
            }
        }

        // Photos - nouveau sélecteur 2026
        if (data.photos.length === 0) {
            const urls = new Set(data.photos);
            document.querySelectorAll('img[src*="vinted"], img[data-src*="vinted"]').forEach(img => {
                let src = img.src || img.dataset.src || '';
                if (src.includes('vinted') &&!src.includes('avatar')) {
                    urls.add(src.replace(/\/f\d+x\d+\//, '/f1280x1280/').split('?')[0]);
                }
            });
            document.querySelectorAll('meta[property="og:image"]').forEach(m => m.content && urls.add(m.content));
            data.photos = Array.from(urls).slice(0,10);
        }

        // Attributs
        document.querySelectorAll('[data-testid*="attribute"], li').forEach(li => {
            const t = li.innerText || '';
            if (/marque/i.test(t)) data.brand = t.split('\n').pop().trim();
            if (/taille/i.test(t)) data.size = t.split('\n').pop().trim();
            if (/état|etat/i.test(t)) data.condition = t.split('\n').pop().trim();
        });
        const brandLink = document.querySelector('a[href*="/brand/"]');
        if (brandLink &&!data.brand) data.brand = brandLink.innerText.trim();

        return data;
    }

    function mapToBeebs(vinted) {
        const beebs = {};
        beebs.title = vinted.title.substring(0, 40);
        if (vinted.title.length > 40) beebs.title = beebs.title.substring(0, 37) + '...';
        beebs.description = `${vinted.title}\n\n${vinted.description}\n\n` +
            (vinted.brand? `Marque : ${vinted.brand}\n` : '') +
            (vinted.size? `Taille : ${vinted.size}\n` : '') +
            (vinted.condition? `État : ${vinted.condition}\n` : '') +
            `\n📦 Envoi rapide / Article Vinted`;
        beebs.price = vinted.price;
        beebs.conditionBeebs = BEEBS_CONDITIONS[vinted.condition] || 'Très bon état';
        beebs.size = vinted.size; beebs.brand = vinted.brand;
        return beebs;
    }

    function isItemPage() {
        return /\/items\/\d+/.test(location.href) &&!!document.querySelector('h1');
    }

    function createUI() {
        if (!isItemPage()) {
            document.getElementById('vinted-to-beebs-btn')?.remove();
            document.getElementById('vinted-beebs-panel')?.remove();
            return;
        }
        if (document.getElementById('vinted-to-beebs-btn')) return;
        const titleContainer = document.querySelector('h1')?.parentElement;
        if (!titleContainer) return;

        const btn = document.createElement('button');
        btn.id = 'vinted-to-beebs-btn';
        btn
