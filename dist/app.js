import {loadCatalog,categoryNames,escapeHtml as esc} from './catalog.js';
import {filterArtworks} from './core.js';
import {initHero} from './hero.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const page=document.body.dataset.page;
if(page==='home')initHero();
function readStore(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
const previous=readStore('net.saved',[]);
let saved=new Set(Array.isArray(previous)?previous.map(String):[]),artworks=[],toastTimer;
const params=new URLSearchParams(location.search);
let state={query:params.get('q')||'',category:Object.hasOwn(categoryNames,params.get('category'))?params.get('category'):'all',era:['early','late'].includes(params.get('era'))?params.get('era'):'all',sort:['name','oldest'].includes(params.get('sort'))?params.get('sort'):'curated'};
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{toast('Trình duyệt chưa cho phép lưu. Thay đổi được giữ trong phiên này.');}}
function updateSaved(){
  $('#saved-count').textContent=saved.size;
  $$('[data-save]').forEach(button=>{const active=saved.has(button.dataset.save);button.classList.toggle('is-saved',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'Bỏ lưu tác phẩm':'Lưu tác phẩm');if(button.classList.contains('detail-save'))button.innerHTML=`<svg><use href="#icon-heart"/></svg>${active?'Đã lưu tác phẩm':'Lưu tác phẩm'}`;});
}
function toggleSave(id){saved.has(id)?saved.delete(id):saved.add(id);persist('net.saved',[...saved]);updateSaved();if(page==='saved')renderGallery();toast(saved.has(id)?'Đã giữ lại một cảm hứng.':'Đã bỏ lưu tác phẩm.');}
const artworkUrl=id=>'/tac-pham/?id='+encodeURIComponent(id);
function card(a,index){return `<article class="artwork-card"><div class="artwork-image"><a class="artwork-image-link" href="${artworkUrl(a.id)}" aria-label="Xem ${esc(a.title)}"><img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy"><span class="artwork-index">${esc(categoryNames[a.category]||a.categoryLabel)}</span><div class="artwork-caption"><span class="artwork-period">${esc(a.period)}</span><h3 class="card-title">${esc(a.title)} <span aria-hidden="true">↗</span></h3><p class="card-author">${esc(a.author||'Chưa xác định')} · ${esc(a.origin||'Việt Nam')}</p></div></a><button class="artwork-save" data-save="${esc(a.id)}" aria-label="Lưu tác phẩm" aria-pressed="false"><svg><use href="#icon-heart"/></svg></button></div></article>`;}

function updateLocation(){if(page!=='collection')return;const next=new URLSearchParams();if(state.query)next.set('q',state.query);if(state.category!=='all')next.set('category',state.category);if(state.era!=='all')next.set('era',state.era);if(state.sort!=='curated')next.set('sort',state.sort);history.replaceState(null,'',location.pathname+(next.size?'?'+next:''));}
function renderGallery(){
  const list=page==='saved'?artworks.filter(a=>saved.has(a.id)):filterArtworks(artworks,state);
  $('#artwork-grid').innerHTML=list.map(a=>card(a,artworks.indexOf(a))).join('');$('#empty-state').hidden=list.length>0;
  $('#search-status').textContent=`${list.length} tác phẩm${state.query&&page==='collection'?' · Tên chứa “'+state.query+'”':''}`;
  $$('[data-category]').forEach(b=>{const active=b.dataset.category===state.category;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});updateSaved();updateLocation();
}
function resetFilters(){state={query:'',category:'all',era:'all',sort:'curated'};$('#header-search-input').value='';for(const [selector,value] of [['#era-filter','all'],['#sort-filter','curated']])if($(selector))$(selector).value=value;renderGallery();}
function initGallery(){
  if($('#category-filters'))$('#category-filters').innerHTML=`<button data-category="all" aria-pressed="true">Tất cả <span>${artworks.length}</span></button>`+Object.entries(categoryNames).filter(([key])=>artworks.some(a=>a.category===key)).map(([key,label])=>`<button data-category="${key}" aria-pressed="false">${label}</button>`).join('');
  for(const [selector,value] of [['#era-filter',state.era],['#sort-filter',state.sort]])if($(selector))$(selector).value=value;
  if(state.era!=='all'){if($('#advanced-filters'))$('#advanced-filters').hidden=false;$('#advanced-toggle')?.setAttribute('aria-expanded','true');}
  $('#advanced-toggle')?.addEventListener('click',()=>{const open=$('#advanced-filters').hidden;$('#advanced-filters').hidden=!open;$('#advanced-toggle').setAttribute('aria-expanded',String(open));});
  $('#era-filter')?.addEventListener('change',e=>{state.era=e.target.value;renderGallery();});
  $('#sort-filter')?.addEventListener('change',e=>{state.sort=e.target.value;renderGallery();});
  $('#reset-filters')?.addEventListener('click',resetFilters);$('#empty-reset')?.addEventListener('click',resetFilters);
  renderGallery();
}
function initHeaderSearch(){
  const form=$('#header-search'),input=$('#header-search-input');
  input.value=page==='collection'?state.query:'';
  input.addEventListener('input',()=>{if(page!=='collection')return;state.query=input.value;renderGallery();});
  form.addEventListener('submit',e=>{
    if(page!=='collection')return;
    e.preventDefault();state.query=input.value.trim();input.value=state.query;renderGallery();$('.collection').scrollIntoView({block:'start'});
  });
  $$('[data-focus-search]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();input.scrollIntoView({block:'center'});input.focus({preventScroll:true});}));
}

function renderDetail(){
  const item=artworks.find(a=>a.id===params.get('id'));
  if(!item){$('#artwork-detail').innerHTML='<div class="empty-state"><h1>Chưa tìm thấy tác phẩm này.</h1><p>Tác phẩm có thể đã thay đổi hoặc đường dẫn chưa chính xác.</p><a class="button button-dark" href="/bo-suu-tap/">Trở lại bộ sưu tập ↗</a></div>';return;}
  const views=readStore('net.views',{}),safeViews=views&&typeof views==='object'&&!Array.isArray(views)?views:{};safeViews[item.id]=(Number(safeViews[item.id])||0)+1;persist('net.views',safeViews);
  document.title=item.title+' — Nét';
  $('#artwork-detail').innerHTML=`<div class="detail-layout"><div class="detail-figure"><div class="zoom-stage"><img id="detail-image" src="${esc(item.image)}" alt="${esc(item.title)}"></div><div class="image-toolbar"><span>NGẮM THẬT GẦN</span><button id="detail-zoom" aria-pressed="false">Phóng lớn ＋</button><a href="${esc(item.image)}" target="_blank" rel="noopener noreferrer">Mở ảnh ↗</a></div></div><div class="detail-copy"><p class="eyebrow">${esc(categoryNames[item.category]||item.categoryLabel)}</p><h1>${esc(item.title)}</h1><p class="detail-author">${esc(item.author||'Chưa xác định')}</p><p class="detail-description">${esc(item.description)}</p><dl><div><dt>Niên đại</dt><dd>${esc(item.period)}</dd></div><div><dt>Chất liệu</dt><dd>${esc(item.material||item.originalMedium)}</dd></div><div><dt>Xuất xứ</dt><dd>${esc(item.origin)}</dd></div><div><dt>Ảnh số</dt><dd>${esc(item.format||'Ảnh')} · ${(item.sizeBytes/1024).toFixed(1)} KB</dd></div></dl><div class="detail-actions"><button class="button button-dark detail-save" data-save="${esc(item.id)}" aria-pressed="false"></button><button id="speak-description" class="button button-outline">Nghe mô tả ▷</button></div><p class="detail-tip">Giọng đọc tổng hợp của thiết bị. Chất lượng và ngôn ngữ phụ thuộc thiết bị đang dùng.</p><p class="detail-source">${item.originalTitle?'Tên gốc: '+esc(item.originalTitle)+'<br>':''}${item.source?`<a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Nguồn tư liệu ↗</a><br>`:''}${esc(item.license||'Chưa bổ sung thông tin quyền sử dụng.')}</p><a class="detail-edit text-link" href="/quan-ly/?edit=${encodeURIComponent(item.id)}">Chỉnh sửa hồ sơ tác phẩm ↗</a></div></div>`;
  if(item.video){
    $('.detail-figure').insertAdjacentHTML('beforeend',`<section class="artwork-video"><p class="eyebrow">VIDEO GIỚI THIỆU</p><video id="artwork-video" controls playsinline preload="metadata" poster="${esc(item.image)}" aria-label="Video giới thiệu: ${esc(item.title)}"><source src="${esc(item.video)}" type="${esc(item.videoMimeType||'video/mp4')}">Trình duyệt chưa hỗ trợ phát video.</video><p id="video-playback-error" class="detail-tip" role="status" hidden>Chưa phát được video. <a href="${esc(item.video)}" target="_blank" rel="noopener noreferrer">Mở video ↗</a></p></section>`);
    const player=$('#artwork-video');player.addEventListener('error',()=>{$('#video-playback-error').hidden=false;});player.querySelector('source').addEventListener('error',()=>{$('#video-playback-error').hidden=false;});
  }
  $('#detail-zoom').addEventListener('click',()=>{const active=$('.zoom-stage').classList.toggle('zoomed');$('#detail-zoom').textContent=active?'Thu nhỏ −':'Phóng lớn ＋';$('#detail-zoom').setAttribute('aria-pressed',String(active));});
  $('#speak-description').addEventListener('click',()=>{
    if(!('speechSynthesis'in window))return toast('Thiết bị chưa hỗ trợ giọng đọc. Bạn có thể xem mô tả phía trên.');
    const button=$('#speak-description');if(speechSynthesis.speaking){speechSynthesis.cancel();button.textContent='Nghe mô tả ▷';return;}
    const utterance=new SpeechSynthesisUtterance(`${item.title}. ${item.period}. ${item.description}`);utterance.lang='vi-VN';utterance.rate=.88;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('vi'));if(voice)utterance.voice=voice;const end=()=>{button.textContent='Nghe mô tả ▷';};utterance.onend=end;utterance.onerror=()=>{end();toast('Không phát được giọng đọc. Vui lòng xem mô tả văn bản.');};speechSynthesis.speak(utterance);button.textContent='Dừng đọc ■';
  });
  const related=artworks.filter(a=>a.id!==item.id).sort((a,b)=>(b.category===item.category)-(a.category===item.category)).slice(0,3);$('#related-artworks').innerHTML=related.map((a)=>card(a,artworks.indexOf(a))).join('');updateSaved();
}
function renderStats(){
  const raw=readStore('net.views',{}),views=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const totalViews=artworks.reduce((sum,a)=>sum+(Number(views[a.id])||0),0);
  const top=artworks.filter(a=>Number(views[a.id])>0).sort((a,b)=>views[b.id]-views[a.id]).slice(0,5);
  const bytes=artworks.reduce((sum,a)=>sum+(Number(a.sizeBytes)||0),0);
  $('#stats-content').innerHTML=`<div class="stats-summary"><div><strong>${artworks.length}</strong><span>TÁC PHẨM</span></div><div><strong>${artworks.filter(a=>a.image).length}</strong><span>ẢNH ĐẠI DIỆN</span></div><div><strong>${(bytes/1024/1024).toFixed(2)}</strong><span>MB HÌNH ẢNH</span></div></div><div class="stats-columns"><div><p class="eyebrow">CÁC NHÓM NGHỆ THUẬT</p><h2>Những sắc thái<br>của bộ sưu tập.</h2><div class="category-bars">${Object.entries(categoryNames).map(([key,name])=>{const count=artworks.filter(a=>a.category===key).length;return `<div class="category-bar"><span>${name}</span><div><span style="width:${artworks.length?count/artworks.length*100:0}%"></span></div><strong>${count}</strong></div>`;}).join('')}</div></div><div><p class="eyebrow">HÀNH TRÌNH CỦA RIÊNG BẠN</p><h2>Những tác phẩm<br>bạn dừng lại lâu hơn.</h2><p class="stats-personal"><strong>${totalViews}</strong> lượt mở chi tiết · <strong>${saved.size}</strong> tác phẩm đã lưu</p>${top.length?top.map((a,i)=>`<a class="stats-viewed" href="${artworkUrl(a.id)}"><span>0${i+1}</span><p>${esc(a.title)}<small>${Number(views[a.id])} lượt mở</small></p><span>↗</span></a>`).join(''):'<p class="stats-empty">Hãy mở một tác phẩm để bắt đầu hành trình khám phá của bạn.</p>'}<p class="stats-disclaimer">Lượt mở và yêu thích chỉ phản ánh trình duyệt này, không phải số liệu khách tham quan toàn hệ thống. Bộ sưu tập hiện có ${artworks.filter(a=>a.video).length} video giới thiệu.</p></div></div>`;
}
document.addEventListener('click',e=>{const save=e.target.closest('[data-save]');if(save)return toggleSave(save.dataset.save);const category=e.target.closest('[data-category]');if(category){state.category=category.dataset.category;renderGallery();}});
const menu=$('#mobile-menu-toggle');function closeMenu(){$('.museum-header').classList.remove('menu-open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Mở điều hướng');}
menu.addEventListener('click',()=>{const open=$('.museum-header').classList.toggle('menu-open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Đóng điều hướng':'Mở điều hướng');});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
window.addEventListener('storage',e=>{if(e.key==='net.saved'){const values=readStore('net.saved',[]);saved=new Set(Array.isArray(values)?values.map(String):[]);updateSaved();if(page==='saved')renderGallery();}});
window.addEventListener('pagehide',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();});
updateSaved();
initHeaderSearch();
if(['home','collection','saved','artwork','stats'].includes(page)){
  try{
    const result=await loadCatalog();artworks=result.items.map(a=>({...a,id:String(a.id)}));if($('#catalog-mode'))$('#catalog-mode').textContent=result.mode==='snapshot'?'Bộ sưu tập mẫu · Bản xem đang dùng tư liệu khởi đầu.':'';
    if(page==='home'){$('#home-artworks').innerHTML=artworks.slice(0,2).map((a,i)=>card(a,i)).join('');$('#curated-artworks').innerHTML=artworks.slice(2,5).map((a,i)=>card(a,i+2)).join('');updateSaved();}
    if(['collection','saved'].includes(page))initGallery();
    if(page==='artwork')renderDetail();
    if(page==='stats')renderStats();
  }catch{const target=$('#search-status')||$('#home-artworks')||$('#artwork-detail');if(target)target.textContent='Chưa tải được bộ sưu tập. Vui lòng kiểm tra kết nối và tải lại trang.';}
}
