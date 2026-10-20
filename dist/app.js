import {filterArtworks, colorHistogram, cosineSimilarity} from './core.js';
import {loadCatalog,categoryNames} from './catalog.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let artworks = [], scores = null, queryUrl = null, similarityRun = 0, lastFocus = null, toastTimer;
let state = {query:'',category:'all',era:'all',maxSize:'',sort:'curated'};
function readStore(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}}
const storedSaved = readStore('net.saved', []);
let saved = new Set((Array.isArray(storedSaved) ? storedSaved : []).map(String));
let views = readStore('net.views', {});
if (!views || typeof views !== 'object' || Array.isArray(views)) views = {};
function persist(key, value) {try {localStorage.setItem(key, JSON.stringify(value));} catch {toast('Trình duyệt không cho phép lưu dữ liệu. Thay đổi chỉ được giữ trong phiên này.');}}
function toast(message) {clearTimeout(toastTimer);$('#toast').textContent = message;$('#toast').classList.add('visible');toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);}
function updateSaved() {$('#saved-count').textContent = saved.size;$$('[data-save]').forEach(b => {const yes = saved.has(b.dataset.save);b.classList.toggle('is-saved',yes);b.setAttribute('aria-pressed',String(yes));b.setAttribute('aria-label',`${yes ? 'Bỏ lưu' : 'Lưu'} tác phẩm`);if(b.closest('.detail-actions'))b.textContent=yes?'Bỏ lưu tác phẩm ♥':'Lưu tác phẩm ♡';});}
function toggleSave(id) {saved.has(id) ? saved.delete(id) : saved.add(id);persist('net.saved',[...saved]);updateSaved();toast(saved.has(id) ? 'Đã thêm vào tác phẩm yêu thích.' : 'Đã bỏ lưu tác phẩm.');if ($('#utility-dialog').open && $('#saved-list')) renderSaved();}
function openDialog(dialog) {lastFocus = document.activeElement;$$('dialog[open]').forEach(d => d.close());dialog.showModal();}
function render() {
  let list = filterArtworks(artworks,state);
  if (scores) list.sort((a,b) => scores.get(b.id) - scores.get(a.id));
  $('#artwork-grid').innerHTML = list.map(a => `<article class="artwork-card"><button class="artwork-image-button" data-open="${a.id}" aria-label="Xem ${escapeHtml(a.title)}"><img src="${a.image}" alt="${escapeHtml(a.title)}" loading="lazy"><span class="artwork-index">NÉT / ${String(artworks.indexOf(a)+1).padStart(2,'0')}</span>${scores ? `<span class="similarity-score">Màu tương đồng · ${(scores.get(a.id)*100).toFixed(1)}%</span>`:''}</button><button class="artwork-save${saved.has(a.id)?' is-saved':''}" data-save="${a.id}" aria-label="Lưu tác phẩm" aria-pressed="${saved.has(a.id)}"><svg><use href="#icon-heart"/></svg></button><div class="card-meta"><span>${escapeHtml(a.categoryLabel)}</span><span>${escapeHtml(a.origin)}</span></div><button class="card-title" data-open="${a.id}">${escapeHtml(a.title)}</button><p class="card-subtitle">${escapeHtml(a.period)} · ${escapeHtml(a.author)}</p><button class="card-arrow" data-open="${a.id}" aria-label="Chi tiết ${escapeHtml(a.title)}">↗</button></article>`).join('');
  $('#empty-state').hidden = list.length > 0;
  $('#search-status').textContent = `${list.length} tác phẩm${scores?' · Xếp theo độ tương đồng màu sắc':''}${state.query?' · Kết quả cho “'+state.query+'”':''}`;
  $$('[data-category]').forEach(b => {const selected=b.dataset.category===state.category;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  updateSaved();
}
function showDetail(id) {
  const a = artworks.find(a => a.id === id); if (!a) return;
  views[id] = (Number(views[id]) || 0) + 1;persist('net.views',views);
  $('#detail-content').innerHTML = `<div class="detail-layout"><div class="detail-image"><img src="${a.image}" alt="${escapeHtml(a.title)}" tabindex="0" role="button" aria-label="Phóng lớn hoặc thu nhỏ ảnh" id="detail-zoom"></div><div class="detail-copy"><p class="eyebrow">NÉT / ${escapeHtml(a.categoryLabel)}</p><h2 id="detail-title">${escapeHtml(a.title)}</h2><p class="intro">${escapeHtml(a.description)}</p><dl><div><dt>Niên đại</dt><dd>${escapeHtml(a.period)}</dd></div><div><dt>Xuất xứ</dt><dd>${escapeHtml(a.origin)}</dd></div><div><dt>Tác giả</dt><dd>${escapeHtml(a.author)}</dd></div><div><dt>Chất liệu gốc</dt><dd>${escapeHtml(a.originalMedium)}</dd></div><div><dt>Mã tác phẩm</dt><dd>${escapeHtml(a.id)}</dd></div><div><dt>Ảnh số</dt><dd>${escapeHtml(a.format||"Ảnh")} · ${(a.sizeBytes/1024).toFixed(1)} KB</dd></div></dl><div class="detail-actions"><button class="button button-dark" data-save="${a.id}" aria-pressed="${saved.has(a.id)}">Lưu tác phẩm ♡</button><button class="button button-outline" id="speak-description">Đọc mô tả ▷</button></div><p class="detail-tip">Chạm ảnh để phóng lớn. Đọc mô tả dùng giọng tổng hợp của thiết bị; đây chưa phải audio thuyết minh được thu âm.</p><div class="detail-source">${a.originalTitle?"Tên gốc: "+escapeHtml(a.originalTitle)+"<br>":""}${a.source?`<a href="${escapeHtml(a.source)}" target="_blank" rel="noopener noreferrer">Xem nguồn tư liệu ↗</a><br>`:""}${escapeHtml(a.license||"Chưa bổ sung thông tin quyền sử dụng.")}</div></div></div>`;
  openDialog($('#detail-dialog'));updateSaved();
  const zoom=()=>$('#detail-zoom').parentElement.classList.toggle('zoomed');$('#detail-zoom').addEventListener('click',zoom);$('#detail-zoom').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();zoom();}});
  $('#speak-description').addEventListener('click', () => {
    if (!('speechSynthesis' in window)) return toast('Thiết bị này chưa hỗ trợ giọng đọc. Bạn có thể đọc mô tả ngay phía trên.');
    if (speechSynthesis.speaking) {speechSynthesis.cancel();$('#speak-description').textContent='Đọc mô tả ▷';return;}
    const u = new SpeechSynthesisUtterance(`${a.title}. ${a.period}. ${a.description}`);u.lang='vi-VN';u.rate=.88;
    const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('vi'));if(voice) u.voice=voice;
    const end=()=>{const b=$('#speak-description');if(b)b.textContent='Đọc mô tả ▷';};u.onend=end;u.onerror=()=>{end();toast('Không phát được giọng đọc. Vui lòng xem mô tả văn bản.');};speechSynthesis.speak(u);$('#speak-description').textContent='Dừng đọc ■';
  });
}
function renderSaved() {
  const list=artworks.filter(a=>saved.has(a.id));
  $('#saved-list').innerHTML=list.length?list.map(a=>`<div class="saved-item"><button data-open="${a.id}" aria-label="Xem ${escapeHtml(a.title)}"><img src="${a.image}" alt="${escapeHtml(a.title)}"></button><div><button class="card-title" data-open="${a.id}">${escapeHtml(a.title)}</button><small>${escapeHtml(a.period)}</small></div><button class="text-button" data-save="${a.id}">Bỏ lưu</button></div>`).join(''):'<p>Bạn chưa lưu tác phẩm nào. Chạm biểu tượng trái tim ở tác phẩm bạn yêu thích để tạo bộ sưu tập riêng.</p>';
}
function showUtility(kind) {
  const content=$('#utility-content');
  if(kind==='saved') {content.innerHTML='<div class="utility-body"><p class="eyebrow">GÓC NGHỆ THUẬT CỦA BẠN</p><h2 id="utility-title">Những tác phẩm đã lưu</h2><p>Danh sách được lưu trên trình duyệt hiện tại.</p><div id="saved-list" class="saved-list"></div></div>';renderSaved();}
  if(kind==='about') content.innerHTML=`<div class="utility-body"><p class="eyebrow">VỀ DỰ ÁN</p><h2 id="utility-title">Một không gian cho những cách nhìn mới.</h2><p>Nét là bản mẫu bảo tàng nghệ thuật số cho đề tài Hệ cơ sở dữ liệu đa phương tiện. Bộ sưu tập khởi đầu giới thiệu 7 hiện vật gốm Việt Nam từ nguồn Open Access của The Met.</p><h3>Trong bản mẫu này</h3><p>Bạn có thể tìm tác phẩm theo từ khóa, nhóm gốm, niên đại và dung lượng ảnh; xem ảnh phóng lớn; lưu yêu thích; đọc mô tả bằng giọng tổng hợp; tìm ảnh tương đồng bằng histogram màu và cosine similarity.</p><h3>Nguồn và phạm vi</h3><p>Ảnh và metadata thuộc bộ sưu tập The Metropolitan Museum of Art, được API nguồn đánh dấu Public Domain. Mỗi hồ sơ có liên kết tới trang gốc. Tên và mô tả tiếng Việt do dự án biên soạn; phân nhóm là lựa chọn biên tập, không phải phân loại chính thức của bảo tàng.</p><p>Đây là dự án học tập độc lập. Dữ liệu yêu thích và lượt mở chi tiết chỉ được lưu trên thiết bị này. Quản trị viên có thể thêm và sửa tác phẩm khi website chạy cùng backend MongoDB. Thống kê lượt xem và yêu thích vẫn phản ánh trình duyệt hiện tại.</p><p><a href="https://www.metmuseum.org/about-the-met/policies-and-documents/open-access" target="_blank" rel="noopener noreferrer">Chính sách Open Access của The Met ↗</a></p></div>`;
  if(kind==='stats') {
    const totalViews=artworks.reduce((sum,a)=>sum+(Number(views[a.id])||0),0);
    const top=artworks.filter(a=>views[a.id]).sort((a,b)=>views[b.id]-views[a.id]).slice(0,5);
    content.innerHTML=`<div class="utility-body"><p class="eyebrow">BỘ SƯU TẬP QUA NHỮNG CON SỐ</p><h2 id="utility-title">Góc nhìn dữ liệu</h2><span class="stats-total">${artworks.length}</span><p>Tác phẩm · ${artworks.length} ảnh · 0 video · 0 tệp âm thanh · 0 tài liệu PDF</p><div class="stats-counters"><div><strong>${totalViews}</strong><span>Lượt mở chi tiết</span></div><div><strong>${saved.size}</strong><span>Tác phẩm đã lưu</span></div><div><strong>${(artworks.reduce((s,a)=>s+a.sizeBytes,0)/1024/1024).toFixed(2)}</strong><span>MB ảnh mẫu</span></div></div><h3>Phân bố bộ sưu tập</h3>${Object.entries(categoryNames).map(([key,name])=>{const count=artworks.filter(a=>a.category===key).length;return `<div class="stat-row"><span>${name}</span><div class="stat-bar"><span style="width:${(artworks.length?count/artworks.length*100:0)}%"></span></div><span>${count}</span></div>`;}).join('')}<h3>Tác phẩm bạn xem nhiều nhất</h3>${top.length?top.map(a=>`<button class="top-views" data-open="${a.id}"><span>${a.title}</span><span>${views[a.id]} lượt ↗</span></button>`).join(''):'<p>Chưa có lượt xem. Mở một tác phẩm để bắt đầu.</p>'}<p>Lượt mở chi tiết và yêu thích chỉ phản ánh trình duyệt này, không phải số liệu khách tham quan toàn hệ thống.</p></div>`;
  }
  openDialog($('#utility-dialog'));
}
const featureCache=new Map();
async function imageFeatures(src) {
  const img=new Image();img.src=src;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,96,96);
  return colorHistogram(ctx.getImageData(0,0,96,96).data);
}
async function findSimilar(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return toast('Chọn ảnh JPG, PNG hoặc WebP.');
  if (file.size>10*1024*1024) return toast('Vui lòng chọn ảnh nhỏ hơn 10 MB.');
  const run=++similarityRun;const button=$('#image-search-button');button.disabled=true;
  const candidateUrl=URL.createObjectURL(file);
  $('#search-status').textContent='Đang trích xuất màu sắc từ ảnh…';
  try {
    const query=await imageFeatures(candidateUrl);
    const vectors=await Promise.all(artworks.map(async a=>{if(!featureCache.has(a.id))featureCache.set(a.id,await imageFeatures(a.image));return [a.id,featureCache.get(a.id)];}));
    if(run!==similarityRun){URL.revokeObjectURL(candidateUrl);return;}
    const newScores=new Map(vectors.map(([id,v])=>[id,cosineSimilarity(query,v)]));
    if(queryUrl)URL.revokeObjectURL(queryUrl);queryUrl=candidateUrl;scores=newScores;
    $('#query-preview').src=queryUrl;$('#similarity-info').hidden=false;$('#similarity-description').textContent='Đã xếp hạng theo histogram RGB 64 chiều. Độ giống màu có thể chịu ảnh hưởng của phông nền; không xác định danh tính tác phẩm.';render();
  } catch {URL.revokeObjectURL(candidateUrl);toast('Không đọc được ảnh. Hãy thử một ảnh khác.');render();}
  finally {if(run===similarityRun)button.disabled=false;$('#image-upload').value='';}
}
function clearSimilarity() {similarityRun++;scores=null;if(queryUrl)URL.revokeObjectURL(queryUrl);queryUrl=null;$('#query-preview').removeAttribute('src');$('#similarity-info').hidden=true;$('#image-search-button').disabled=false;}
function resetFilters(){state={query:'',category:'all',era:'all',maxSize:'',sort:'curated'};$('#search-input').value='';$('#era-filter').value='all';$('#size-filter').value='';$('#sort-filter').value='curated';clearSimilarity();render();}
document.addEventListener('click',e=>{
  const open=e.target.closest('[data-open]');if(open)return showDetail(open.dataset.open);
  const save=e.target.closest('[data-save]');if(save)return toggleSave(save.dataset.save);
  const close=e.target.closest('[data-close]');if(close)return close.closest('dialog').close();
  const category=e.target.closest('[data-category]');if(category){state.category=category.dataset.category;return render();}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='image-search'){$('#bo-suu-tap').scrollIntoView();$('#image-upload').click();return;}
  if(action==='search'){toggleAdvanced(true);$('#bo-suu-tap').scrollIntoView();$('#search-input').focus({preventScroll:true});return;}
  if(action)showUtility(action);
});
function toggleAdvanced(force){const show=force??$('#advanced-filters').hidden;$('#advanced-filters').hidden=!show;$('#advanced-toggle').setAttribute('aria-expanded',String(show));}
$('#advanced-toggle').addEventListener('click',()=>toggleAdvanced());
$('#search-input').addEventListener('input',e=>{state.query=e.target.value;render();});
$('#era-filter').addEventListener('change',e=>{state.era=e.target.value;render();});
$('#size-filter').addEventListener('input',e=>{state.maxSize=e.target.validity.valid?e.target.value:'';render();});
$('#sort-filter').addEventListener('change',e=>{state.sort=e.target.value;render();});
$('#reset-filters').addEventListener('click',resetFilters);$('#empty-reset').addEventListener('click',resetFilters);
$('#image-search-button').addEventListener('click',()=>$('#image-upload').click());
$('#image-upload').addEventListener('change',e=>findSimilar(e.target.files[0]));
$('#clear-similarity').addEventListener('click',()=>{clearSimilarity();render();});
const heroSlides = [
  {image:'assets/museum-hall.jpg',alt:'Đại sảnh mái vòm tại Natural History Museum, London — ảnh kiến trúc minh họa',kicker:'CHÀO MỪNG ĐẾN VỚI NÉT',title:'Nghệ thuật vượt thời gian',description:'Một không gian mở để khám phá tác phẩm, đến gần di sản và tìm cảm hứng của riêng bạn.',href:'#bo-suu-tap',credit:'Ảnh kiến trúc minh họa: <a href="https://commons.wikimedia.org/wiki/File:Natural_History_Museum_Main_Hall,_London,_UK_-_Diliff.jpg" target="_blank" rel="noopener noreferrer">DAVID ILIFF</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a> · Cắt khung hiển thị'},
  {image:'assets/37557.jpg',alt:'Bình hoa điểu, gốm men lam Việt Nam, thế kỷ XV',kicker:'TIÊU ĐIỂM BỘ SƯU TẬP',title:'Gốm Việt qua năm tháng',description:'Những cánh chim, dây hoa và sắc lam trên gốm. Khám phá vẻ đẹp từ những bàn tay nghệ nhân.',href:'#bo-suu-tap',credit:'Bình hoa điểu · Việt Nam, thế kỷ XV · The Met Open Access · Public Domain'},
  {image:'assets/37451.jpg',alt:'Đĩa hoa mẫu đơn, gốm Việt Nam, thế kỷ XV',kicker:'CÂU CHUYỆN NGHỆ THUẬT',title:'Câu chuyện từ sắc men',description:'Chậm lại để ngắm một đường vẽ. Đến gần hơn với những chi tiết làm nên một tác phẩm.',href:'#cau-chuyen',credit:'Đĩa hoa mẫu đơn · Việt Nam, thế kỷ XV · The Met Open Access · Public Domain'}
];
$$('[data-slide]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.slide),slide=heroSlides[index];
  $('#hero-image').src=slide.image;$('#hero-image').alt=slide.alt;
  $('#hero-image').style.objectPosition=index===0?'50% 48%':index===1?'50% 40%':'50% 47%';
  $('#hero-kicker').textContent=slide.kicker;$('#hero-title').textContent=slide.title;
  $('#hero-description').textContent=slide.description;$('#hero-link').href=slide.href;
  $('#hero-photo-credit').innerHTML=slide.credit;
  $$('[data-slide]').forEach(b=>{const selected=b===button;b.classList.toggle('current',selected);b.setAttribute('aria-pressed',String(selected));});
}));
const menuToggle=$('#mobile-menu-toggle');
function closeMenu(){$('.museum-header').classList.remove('menu-open');menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','Mở điều hướng');}
menuToggle.addEventListener('click',()=>{const open=$('.museum-header').classList.toggle('menu-open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Đóng điều hướng':'Mở điều hướng');});
$('#museum-nav').addEventListener('click',e=>{if(e.target.closest('a,button'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
[$('#detail-dialog'),$('#utility-dialog')].forEach(d=>{d.addEventListener('close',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();lastFocus?.focus();});d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});});
async function refreshCatalog(){
  try{
    const result=await loadCatalog();artworks=result.items.map(a=>({...a,id:String(a.id)}));
    $('#catalog-mode').textContent=result.mode==='mongodb'?'':'Đang xem bộ sưu tập mẫu. Kết nối máy chủ quản lý để thêm và sửa tác phẩm.';
    const existing=new Set(artworks.map(a=>a.id));saved=new Set([...saved].filter(id=>existing.has(id)));
    const filters=$('.filter-tabs');
    filters.innerHTML='<button data-category="all" aria-pressed="true">Tất cả <span id="total-count">'+artworks.length+'</span></button>'+Object.entries(categoryNames).filter(([key])=>artworks.some(a=>a.category===key)).map(([key,name])=>'<button data-category="'+key+'" aria-pressed="false">'+name+'</button>').join('');
    featureCache.clear();clearSimilarity();render();
  }catch{$('#search-status').textContent='Chưa tải được bộ sưu tập. Vui lòng kiểm tra kết nối và tải lại trang.';$('#image-search-button').disabled=true;}
}
window.addEventListener('catalog-updated',refreshCatalog);
await refreshCatalog();
