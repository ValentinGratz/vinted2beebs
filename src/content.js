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
  const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value'); if(d&&d.set) d.set.call(input,val); else input.value=val;
  input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));
}

if(IS_VINTED){
  (async()=>{
    await new Promise(r=>setTimeout(r,1200));
    if(document.getElementById('v2b')) return;
    const {photos,desc}=getData();
    console.log('PHOTOS',photos,'DESC',desc?.slice(0,80));
    const dataUrl=[];
    for(const u of photos){ try{ const r=await fetch(u); const b=await r.blob(); dataUrl.push(await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(b);})); }catch(e){} }
    const title=document.querySelector('h1')?.innerText?.trim()||'';
    await chrome.storage.local.set({lastBeebsExport:{fullTitle:title, description:desc||title, price:document.querySelector('[data-testid="item-price"]')?.innerText||'', photos, photosData:dataUrl}});
    const box=document.createElement('div'); box.id='v2b'; box.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:10px;border-radius:12px;width:260px;font-family:sans-serif';
    box.innerHTML=`<b>⚡ Export Beebs</b><br>${dataUrl.length} photos<br><small>${(desc||'').slice(0,80)}...</small><br><button id="goB" style="width:100%;margin-top:6px;background:#eab308;padding:8px;border-radius:8px;font-weight:bold">🚀 Ouvrir Beebs</button>`;
    document.body.appendChild(box);
    document.getElementById('goB').onclick=()=>window.open('https://www.beebs.app/fr/listing','_blank');
  })();
}

if(IS_BEEBS){
  (async()=>{
    const {lastBeebsExport}=await chrome.storage.local.get('lastBeebsExport'); if(!lastBeebsExport) return;
    const p=document.createElement('div'); p.style.cssText='position:fixed;right:12px;top:80px;z-index:9999999;background:#fef9c3;border:2px solid #eab308;padding:12px;border-radius:12px;width:320px;font-family:sans-serif';
    p.innerHTML=`<b>Import Vinted → Beebs</b><br><small>${lastBeebsExport.fullTitle}</small><div id="th" style="display:flex;flex-wrap:wrap;gap:4px;background:#fff;padding:4px;margin:6px 0;border-radius:6px"></div><button id="f1" style="width:100%;background:#111;color:#fff;padding:10px;border-radius:8px">1. Remplir</button><button id="f2" style="width:100%;margin-top:6px;background:#eab308;padding:10px;border-radius:8px">2. Télécharger ${lastBeebsExport.photosData.length} photos</button><div id="st" style="font-size:11px;margin-top:4px"></div>`;
    document.body.appendChild(p);
    const th=document.getElementById('th'); const files=[];
    lastBeebsExport.photosData.forEach((d,i)=>{ const im=document.createElement('img'); im.src=d; im.style.cssText='width:50px;height:50px;object-fit:cover;border:1px solid orange;border-radius:4px'; th.appendChild(im); try{ const b64=d.split(',')[1]; const bin=atob(b64); const ab=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++) ab[j]=bin.charCodeAt(j); files.push(new File([new Blob([ab],{type:'image/jpeg'})],`p${i}.jpg`,{type:'image/jpeg'})); }catch(e){} });
    document.getElementById('f2').onclick=()=>files.forEach(f=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(f); a.download=f.name; a.click(); });
    document.getElementById('f1').onclick=async()=>{
      window.scrollTo(0,500); await new Promise(r=>setTimeout(r,400)); window.scrollTo(0,0);
      const all=[...document.querySelectorAll('input,textarea')];
      let ti=all.find(i=>(i.placeholder||'').toLowerCase().includes('titre'))||all.find(i=>i.type==='text')||all[0];
      if(ti){ ti.focus(); ti.click(); setVal(ti,lastBeebsExport.fullTitle); if(!ti.value){ document.execCommand('selectAll',false,null); document.execCommand('insertText',false,lastBeebsExport.fullTitle); } }
      let di=document.querySelector('textarea')||all.find(i=>i.tagName==='TEXTAREA');
      if(di){ di.focus(); setVal(di,lastBeebsExport.description); if(!di.value){ document.execCommand('selectAll',false,null); document.execCommand('insertText',false,lastBeebsExport.description); } }
      let pi=document.querySelector('input[type="number"]')||all.find(i=>(i.placeholder||'').toLowerCase().includes('prix'));
      if(pi){ const pr=(lastBeebsExport.price||'').replace(/[^\d.,]/g,'').replace(',','.'); pi.focus(); setVal(pi,pr); }
      document.getElementById('st').innerText='Rempli ✓';
    };
  })();
}