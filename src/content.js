// src/content.js V2.4 FINAL - Auto photos comme leboncoin V3 + vraie desc + fix console
const IS_VINTED = location.hostname.includes('vinted');
const IS_BEEBS = location.hostname.includes('beebs.app');

function getData() {
  let desc = document.querySelector('[data-testid="item-description"]')?.innerText || "";
  if (!desc) {
    const els = [...document.querySelectorAll('div,span')].filter(e=>e.innerText&&e.innerText.length>60&&e.innerText.length<1500&&!e.querySelector('div'));
    if (els.length) desc = els.sort((a,b)=>b.innerText.length-a.innerText.length)[0].innerText.trim();
  }
  const set = new Set();
  document.querySelectorAll('main img, [class*="gallery"] img, img[src*="vinted.net"]').forEach(img=>{
    const s = img.src || img.currentSrc || "";
    if (!s.includes('vinted.net') || s.includes('avatar') || s.includes('25x25') || s.includes('50x50')) return;
    if (img.width<120) return;
    set.add(s.replace(/\/\d+x\d+\//,'/f800/').split('?')[0]+'?s=original');
  });
  document.querySelectorAll('script').forEach(sc=>{
    const t=sc.textContent||""; if(!t.includes('f800')) return;
    const re=/https:\/\/[^"]*\/f800\/[^"]+/g; (t.match(re)||[]).forEach(u=>{ if(!u.includes('avatar')) set.add(u.split('\\')[0].split('"')[0]); });
  });
  return {photos:[...set].slice(0,10), desc};
}

function setVal(input,val){
  try{
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto,'value') || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto),'value');
    if(desc && desc.set) desc.set.call(input,val); else input.value=val;
    if(input._valueTracker) input._valueTracker.setValue('');
  }catch(e){ input.value=val; }
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  input.dispatchEvent(new Event('blur',{bubbles:true}));
}

if(IS_VINTED){
  (async()=>{
    await new Promise(r=>setTimeout(r,1200));
    if(document.getElementById('v2b')) return;
    const {photos,desc}=getData();
    const dataUrl=[];
    for(const u of photos){ try{ const r=await fetch(u); const b=await r.blob(); dataUrl.push(await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(b);})); }catch(e){} }
    const title=document.querySelector('h1')?.innerText?.trim()||document.title.split('|')[0].trim()||'';
    const price=document.querySelector('[data-testid="item-price"]')?.innerText||'';
    await chrome.storage.local.set({lastBeebsExport:{fullTitle:title, description:desc||title, price, photos, photosData:dataUrl}});
    const box=document.createElement('div'); box.id='v2b'; box.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:10px;border-radius:12px;width:260px;font-family:sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.15)';
    box.innerHTML=`<b>⚡ Export Beebs</b><br>${dataUrl.length} photos article<br><small style="display:block;background:#fff;padding:4px;border-radius:4px;margin:4px 0;max-height:60px;overflow:auto">${(desc||'').slice(0,100)}...</small><button id="goB" style="width:100%;margin-top:6px;background:#eab308;border:0;padding:8px;border-radius:8px;font-weight:bold;cursor:pointer">🚀 Ouvrir Beebs</button>`;
    document.body.appendChild(box);
    document.getElementById('goB').onclick=()=>window.open('https://www.beebs.app/fr/listing','_blank');
  })();
}

if(IS_BEEBS){
  (async()=>{
    const {lastBeebsExport}=await chrome.storage.local.get('lastBeebsExport'); if(!lastBeebsExport ||!lastBeebsExport.photosData) return;
    if(document.getElementById('v2bB')) return;
    const p=document.createElement('div'); p.id='v2bB'; p.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:12px;border-radius:12px;width:330px;font-family:sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2)';
    p.innerHTML=`<b>⚡ Import Vinted → Beebs</b><br><small style="word-break:break-word">${lastBeebsExport.fullTitle}</small><div style="font-size:11px;background:#fff;padding:4px;border-radius:4px;margin:4px 0;max-height:60px;overflow:auto">${(lastBeebsExport.description||'').slice(0,150)}...</div><div id="th" style="display:flex;flex-wrap:wrap;gap:4px;background:#fff;padding:4px;margin:6px 0;border-radius:6px;min-height:30px"></div><button id="f1" style="width:100%;background:#111;color:#fff;padding:11px;border-radius:10px;font-weight:600;cursor:pointer">1. Remplir + Photos auto (comme leboncoin)</button><div id="st" style="font-size:11px;margin-top:6px;color:#555">${lastBeebsExport.photosData.length} photos prêtes à injecter</div>`;
    document.body.appendChild(p);

    const th=document.getElementById('th'); const files=[];
    lastBeebsExport.photosData.forEach((d,i)=>{
      const im=document.createElement('img'); im.src=d; im.style.cssText='width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid orange'; th.appendChild(im);
      try{ const b64=d.split(',')[1]; const bin=atob(b64); const ab=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++) ab[j]=bin.charCodeAt(j); files.push(new File([new Blob([ab],{type:'image/jpeg'})],`beebs-${i+1}.jpg`,{type:'image/jpeg'})); }catch(e){}
    });

    document.getElementById('f1').onclick=async()=>{
      const st=document.getElementById('st'); st.innerText='Remplissage...';
      window.scrollTo(0,500); await new Promise(r=>setTimeout(r,400)); window.scrollTo(0,0); await new Promise(r=>setTimeout(r,300));

      const all=[...document.querySelectorAll('input,textarea')];
      let ti=all.find(i=>(i.placeholder||'').toLowerCase().includes('titre')) || document.querySelector('input[name="title"]') || all.find(i=>i.type==='text') || all[0];
      if(ti){ ti.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,200)); ti.focus(); ti.click(); setVal(ti,lastBeebsExport.fullTitle); if(!ti.value || ti.value.length<3){ ti.focus(); document.execCommand('selectAll',false,null); document.execCommand('insertText',false,lastBeebsExport.fullTitle); } }

      let di=document.querySelector('textarea[name="description"]') || document.querySelector('textarea') || all.find(i=>i.tagName==='TEXTAREA');
      if(di){ di.focus(); setVal(di,lastBeebsExport.description); await new Promise(r=>setTimeout(r,100)); if(!di.value || di.value.length<10){ di.focus(); document.execCommand('selectAll',false,null); document.execCommand('insertText',false,lastBeebsExport.description); } }

      let pi=document.querySelector('input[type="number"]') || all.find(i=>(i.placeholder||'').toLowerCase().includes('prix')) || all.find(i=>i.type==='number');
      if(pi){ const pr=(lastBeebsExport.price||'').toString().replace(/[^\d.,]/g,'').replace(',','.'); pi.focus(); pi.click(); setVal(pi,pr); }

      // AUTO PHOTOS - comme leboncoin V3
      st.innerText='Injection photos...';
      let injected=false;
      const fileInputs=[...document.querySelectorAll('input[type="file"]')];
      if(fileInputs.length){
        for(const inp of fileInputs){
          try{
            const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f));
            inp.files=dt.files;
            inp.dispatchEvent(new Event('change',{bubbles:true}));
            inp.dispatchEvent(new Event('input',{bubbles:true}));
            injected=true;
          }catch(e){ console.log('inject fail',e); }
        }
      }
      // fallback drag & drop zone
      if(!injected){
        const zones=[...document.querySelectorAll('div')].filter(d=>d.innerText && (d.innerText.includes('Ajouter des photos') || d.innerText.includes('Glissez')));
        if(zones[0]){
          try{
            const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f));
            ['dragenter','dragover','drop'].forEach(type=>{
              zones[0].dispatchEvent(new DragEvent(type,{bubbles:true,dataTransfer:dt}));
            });
            injected=true;
          }catch(e){}
        }
      }

      st.innerText = injected? `✓ ${files.length} photos injectées auto (comme leboncoin)` : 'Photos prêtes mais input non trouvé - dis moi';
    };
  })();
}
