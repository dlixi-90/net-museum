import {api,escapeHtml as esc} from './catalog.js';

export function bindArtworkQR(item,actions,container){
  const button=document.createElement('button');
  button.id='artwork-qr';
  button.className='button button-outline artwork-qr-button';
  button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-controls','artwork-qr-dialog');
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM21 15v3h-3v3h-3M21 21h.01"/></svg>Mã QR';
  actions.append(button);
  const dialog=document.createElement('dialog');
  dialog.id='artwork-qr-dialog';
  dialog.className='artwork-download-dialog artwork-qr-dialog';
  dialog.setAttribute('aria-labelledby','artwork-qr-title');
  dialog.innerHTML=`<div class="download-heading"><div><p class="eyebrow">CHIA SẺ TÁC PHẨM</p><h2 id="artwork-qr-title">Mã QR</h2><p class="download-artwork-title">${esc(item.title)}</p></div><button class="icon-button download-close" aria-label="Đóng mã QR" autofocus>×</button></div><p class="artwork-qr-status" role="status" aria-live="polite"></p><div class="artwork-qr-content" hidden><img class="artwork-qr-image" width="768" height="768" alt="Mã QR mở chi tiết ${esc(item.title)}"><p class="artwork-qr-hint">Quét mã để mở chi tiết tác phẩm.</p><a class="artwork-qr-link" target="_blank" rel="noopener noreferrer"></a><div class="artwork-qr-actions"><a class="button button-dark artwork-qr-download">Tải mã PNG ↓</a><button class="button button-outline artwork-qr-copy">Sao chép liên kết</button></div></div><button class="button button-outline artwork-qr-retry" hidden>Thử lại ↻</button>`;
  container.append(dialog);
  const status=dialog.querySelector('.artwork-qr-status'),content=dialog.querySelector('.artwork-qr-content'),retry=dialog.querySelector('.artwork-qr-retry');
  let result,pending;
  async function load(){
    if(result)return;
    if(pending)return pending;
    status.textContent='Đang tạo mã QR…';retry.hidden=true;
    pending=(async()=>{
      try{
        const data=await api('/artworks/'+encodeURIComponent(item.id)+'/qr');
        if(!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(data.image)||!['http:','https:'].includes(new URL(data.url).protocol))throw new Error('Mã QR chưa hợp lệ.');
        dialog.querySelector('.artwork-qr-image').src=data.image;
        const link=dialog.querySelector('.artwork-qr-link');link.href=data.url;link.textContent=data.url;
        const download=dialog.querySelector('.artwork-qr-download');download.href=data.image;download.download=data.filename;
        result=data;content.hidden=false;status.textContent='';
      }catch{
        status.textContent='Chưa tạo được mã QR. Vui lòng thử lại.';retry.hidden=false;
      }finally{pending=null;}
    })();
    return pending;
  }
  button.addEventListener('click',()=>{dialog.showModal();load();});
  retry.addEventListener('click',load);
  dialog.querySelector('.download-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>button.focus());
  dialog.addEventListener('click',event=>{
    const rect=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();
  });
  dialog.querySelector('.artwork-qr-copy').addEventListener('click',async()=>{
    if(!result)return;
    try{await navigator.clipboard.writeText(result.url);status.textContent='Đã sao chép liên kết.';}
    catch{status.textContent='Chưa sao chép được. Bạn có thể mở hoặc chọn liên kết bên dưới mã QR.';}
  });
  return button;
}
