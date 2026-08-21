// src/content.js V3.1 FINAL - tout-en-un
console.log('Beebs V3.1 chargé sur', location.hostname);
const IS_VINTED = location.hostname.includes('vinted');
const IS_BEEBS = location.hostname.includes('beebs.app');

function getDesc(){
  const body = document.body.innerText || "";
  const start = body.indexOf('Craquez pour');
  if(start!== -1){
    let chunk = body.slice(start);
    let cut = chunk.search(/\n#|Envoi\n|Booster|Indiquer comme vendu|Marquer comme réservé|Masquer\nModifier/);
    if(cut!== -1) chunk = chunk.slice(0, cut);
    return chunk.trim();
  }
  return document.querySelector('[data-testid="item-description"] span')?.innerText?.trim() ||
         document.querySelector('[data-testid="item-description"]')?.innerText?.trim() || "";
}

function getPrice(){
  const el = document.querySelector('[data-testid="item-price"]');
  return el? el.innerText : (document.body.innerText.match(/\d+[.,]\d+\s*€/)?.[0] || "");
}

function setReact(el,val){
  if(!el) return;
  el.focus();
  const last = el.value;
  try{
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value');
    if(desc && desc.set) desc.set.call(el,val); else el.value=val;
  }catch(e){ el.value=val; }
  if(el._valueTracker) el._valueTracker.setValue(last);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  el.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true, key:'Enter'}));
}

if(IS_VINTED){
  setTimeout(async()=>{
    document.getElementById('v2b')?.remove();
    const box=document.createElement('div'); box.id='v2b';
    box.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:10px;border-radius:12px;width:310px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.15)';
    box.innerHTML=`<b>⚡ Export Beebs</b><br><span id="st">Scan photos...</span><div id="pr" style="font-size:11px;background:#fff;padding:5px;margin:5px 0;border-radius:6px;max-height:90px;overflow:auto;white-space:pre-wrap"></div><button id="goB" style="width:100%;background:#eab308;border:0;padding:8px;border-radius:8px;font-weight:bold;cursor:pointer">🚀 Ouvrir Beebs</button>`;
    document.body.appendChild(box);

    const desc = getDesc();
    const price = getPrice();
    const title = document.querySelector('h1')?.innerText?.trim() || document.title.split('|')[0] || '';

    document.getElementById('pr').innerText = desc.slice(0,250) + '...\n\nPrix: ' + price;

    let photos = [...new Set([...document.querySelectorAll('img[src*="vinted.net"]')].map(i=>i.src).filter(s=>!s.includes('avatar') &&!s.includes('25x25') &&!s.includes('50x50')))].slice(0,10);
    document.getElementById('st').innerText = `Detect: ${photos.length} | fetch background...`;

    const dataUrl = await new Promise(res=>{
      chrome.runtime.sendMessage({type:'FETCH_PHOTOS', urls: photos}, (r)=>res(r||[]));
    });
    const clean = (dataUrl||[]).filter(Boolean);
    document.getElementById('st').innerText = `Detect: ${photos.length} | OK: ${clean.length}`;

    await chrome.storage.local.set({lastBeebsExport:{fullTitle:title, description:desc, price, photosData:clean}});
    document.getElementById('goB').onclick=()=>window.open('https://www.beebs.app/fr/listing','_blank');
  },1000);
}

if(IS_BEEBS){
  (async()=>{
    const {lastBeebsExport}=await chrome.storage.local.get('lastBeebsExport'); if(!lastBeebsExport) return;
    if(document.getElementById('v2bB')) return;
    const p=document.createElement('div'); p.id='v2bB';
    p.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:12px;border-radius:12px;width:350px;font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2)';
    p.innerHTML=`<b>⚡ Import Vinted → Beebs</b><br><small style="display:block;word-break:break-word;margin:4px 0">${lastBeebsExport.fullTitle}</small><div style="font-size:11px;background:#fff;padding:6px;border-radius:6px;max-height:110px;overflow:auto;white-space:pre-wrap">${lastBeebsExport.description}</div><div style="font-size:11px;margin:4px 0">Prix brut: <b>${lastBeebsExport.price}</b></div><div id="th" style="display:flex;gap:4px;flex-wrap:wrap;background:#fff;padding:4px;border-radius:6px;min-height:30px"></div><button id="f1" style="width:100%;background:#111;color:#fff;padding:12px;border-radius:10px;font-weight:600;cursor:pointer;margin-top:8px">1. Remplir + ${lastBeebsExport.photosData.length} photos auto</button><div id="st2" style="font-size:11px;margin-top:6px"></div>`;
    document.body.appendChild(p);

    const files=[]; const th=document.getElementById('th');
    (lastBeebsExport.photosData||[]).forEach((d,i)=>{
      const im=document.createElement('img'); im.src=d; im.style.cssText='width:54px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #eab308'; th.appendChild(im);
      try{
        const b64=d.split(',')[1]; const bin=atob(b64); const ab=new Uint8Array(bin.length);
        for(let j=0;j<bin.length;j++) ab[j]=bin.charCodeAt(j);
        files.push(new File([ab],`beebs-${i+1}.jpg`,{type:'image/jpeg'}));
      }catch(e){}
    });

    document.getElementById('f1').onclick=async()=>{
      window.scrollTo(0,400); await new Promise(r=>setTimeout(r,200)); window.scrollTo(0,0); await new Promise(r=>setTimeout(r,200));

      const all=[...document.querySelectorAll('input,textarea')];
      let ti=all.find(i=>(i.placeholder||'').toLowerCase().includes('titre')) || document.querySelector('input[name="title"]') || all.find(i=>i.type==='text') || all[0];
      if(ti){ ti.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,150)); setReact(ti,lastBeebsExport.fullTitle); }

      let di=document.querySelector('textarea[name="description"]') || document.querySelector('textarea') || all.find(i=>i.tagName==='TEXTAREA');
      if(di){ di.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,150)); setReact(di,lastBeebsExport.description); }

      let pi=document.querySelector('input[type="number"]') || document.querySelector('input[inputmode="numeric"]') || [...document.querySelectorAll('input')].find(i=>(i.placeholder||'').toLowerCase().includes('prix'));
      if(pi){
        let pr = (lastBeebsExport.price||'').toString().replace(/[^\d.,]/g,'').replace(',','.'); // 2,00€ -> 2.00
        pr = pr.split('.')[0]; // Beebs veut entier
        if(!pr) pr='2';
        pi.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,150));
        setReact(pi,pr);
      }

      const inputs=[...document.querySelectorAll('input[type="file"]')];
      if(inputs.length && files.length){
        const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f));
        inputs.forEach(inp=>{
          inp.files=dt.files;
          inp.dispatchEvent(new Event('change',{bubbles:true}));
          inp.dispatchEvent(new Event('input',{bubbles:true}));
        });
        document.getElementById('st2').innerText=`✓ ${files.length} photos injectées + titre + desc + prix`;
      }else{
        document.getElementById('st2').innerText=`Photos: ${files.length} - input file non trouvé`;
      }
    };
  })();
}