chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type!== 'FETCH_PHOTOS') return;
  (async () => {
    const out = [];
    for (const url of msg.urls) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const dataUrl = await new Promise(r=>{
          const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(blob);
        });
        out.push(dataUrl);
      } catch(e) { out.push(null); }
    }
    sendResponse(out);
  })();
  return true;
});