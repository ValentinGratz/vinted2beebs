// background.js v2.1.1 - keep alive + async correct
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type!== 'FETCH_VINTED_PHOTOS') return;

  (async () => {
    const out = [];
    for (const url of msg.urls) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const buf = await blob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i=0;i<bytes.byteLength;i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const dataUrl = `data:${blob.type || 'image/jpeg'};base64,${b64}`;
        out.push({ url, dataUrl, ok: true });
      } catch(e) {
        out.push({ url, ok: false, error: String(e) });
      }
    }
    sendResponse(out);
  })();

  return true; // garde le canal ouvert
});

// garde le service worker en vie sur beebs.app
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Beebs] background installed');
});