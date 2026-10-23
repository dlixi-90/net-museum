import {uploadFile} from './upload.js';
import {adminNav} from './multimedia.js';
import {api,categoryNames,escapeHtml as esc} from './catalog.js';
import {isAdmin,loadSession,setSession,sessionUser} from './access.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let attachmentIds=[],attachmentResources=[],attachmentFiles=[],attachmentsReady=Promise.resolve(),uploadController;
let user=null,items=[],selected=null,pendingId=null,imageUrl=null,videoUrl=null,pendingMediaId=null,pendingVideoId=null,videoRemoved=false,unsaved=false,busy=false,setupAvailable=false,directUploads=false,cloudMode=false,cloudMax=100;
function clearPreviews(){if(imageUrl)URL.revokeObjectURL(imageUrl);if(videoUrl)URL.revokeObjectURL(videoUrl);imageUrl=videoUrl=null;$('#editor-video').pause();$('#editor-video').removeAttribute('src');$('#editor-video').load();}
function message(text='',error=false){$('#manage-error').textContent=error?text:'';}
function setEditorError(text){$('#editor-error').textContent=text;}
function showManage(){$('#manage-panel').setAttribute('aria-busy','false');}
function hideEditor(){if(busy)return;if(unsaved&&!window.confirm('Bạn có thay đổi chưa lưu. Đóng biểu mẫu?'))return;$('#editor-dialog').close();clearPreviews();}
async function openManager(id=null){
  pendingId=id;showManage();$('#manage-body').innerHTML='<p class="manage-loading">Đang kết nối bộ sưu tập…</p>';message('');
  try{const session=await loadSession({refresh:true});user=session.user;setupAvailable=session.setupAvailable===true;directUploads=session.directUploads===true;cloudMode=session.uploadStorage==='cloudinary';cloudMax=session.cloudMaxMiB||100;if(!user)return showLogin(session.setupRequired);if(!isAdmin(user))return showDenied();await renderManager();if(pendingId){const a=items.find(a=>a.id===pendingId);pendingId=null;if(a)openEditor(a);}}
  catch{user=null;$('#manage-body').innerHTML='<div class="backend-needed"><h3>Chưa kết nối máy chủ quản lý</h3><p>Bạn vẫn có thể xem bộ sưu tập trên trang này. Để thêm và chỉnh sửa tác phẩm, hãy mở bản website có máy chủ quản lý hoạt động.</p><p>Dữ liệu sẽ chỉ được lưu khi kết nối thành công; biểu mẫu không lưu tạm vào trình duyệt.</p></div>';}
}
function showLogin(setup=false){
  $('#manage-body').innerHTML=`<form id="admin-auth-form" class="auth-form"><h3>${setup?'Thiết lập tài khoản quản trị':'Đăng nhập'}</h3><p>${setup?'Chỉ email được cấu hình trong danh sách quản trị mới có thể tạo tài khoản trên máy này.':'Đăng nhập bằng tài khoản Nét của bạn.'}</p>${setup?'<label>Họ tên<input name="name" autocomplete="name" required maxlength="150"></label>':''}<label>Email<input name="email" type="email" autocomplete="username" required maxlength="254"></label><label>Mật khẩu<input name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" required minlength="${setup?10:1}" maxlength="200"></label>${setup?'<small>Mật khẩu ít nhất 10 ký tự. Thiết lập này chỉ mở trên máy cục bộ.</small>':''}<p id="auth-error" class="form-error" role="alert"></p><button class="button button-dark" type="submit">${setup?'Tạo tài khoản & tiếp tục':'Đăng nhập'} ↗</button>${setupAvailable?`<button id="auth-switch" type="button" class="text-link">${setup?'Đã có tài khoản? Đăng nhập':'Thiết lập tài khoản quản trị trên máy này'}</button>`:''}<a class="manager-register" href="/tai-khoan/?mode=register">Chưa có tài khoản? Đăng ký</a></form>`;
  $('#auth-switch')?.addEventListener('click',()=>showLogin(!setup));
  $('#admin-auth-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;$('#auth-error').textContent='';try{const body=Object.fromEntries(new FormData(form));const result=await api(setup?'/auth/setup':'/auth/login',{method:'POST',body:JSON.stringify(body)});user=result.user;setSession(user);if(!isAdmin(user))return showDenied();await renderManager();if(pendingId){const a=items.find(a=>a.id===pendingId);pendingId=null;if(a)openEditor(a);}}catch(error){$('#auth-error').textContent=error.message;}finally{button.disabled=false;}});
}
function showDenied(){user=null;items=[];$('#manage-body').innerHTML='<div class="empty-state"><h2>Tài khoản không có quyền quản trị.</h2><p>Bạn vẫn có thể khám phá và lưu các tác phẩm yêu thích.</p><a class="button button-dark" href="/bo-suu-tap/">Khám phá bộ sưu tập ↗</a></div>';}
window.addEventListener('net-access-updated',()=>{
  const current=sessionUser();
  if(user&&!isAdmin(current)){
    user=null;items=[];unsaved=false;
    if($('#editor-dialog').open)$('#editor-dialog').close();
    clearPreviews();
    if(current)showDenied();else showLogin(false);
  }
});
async function renderManager(){
  if(!isAdmin(user))return showDenied();
  const result=await api('/artworks');items=result.items.map(a=>({...a,id:String(a.id)}));
  $('#manage-body').innerHTML=`${adminNav}<div class="manager-toolbar"><p><strong>${esc(user.name)}</strong></p><button class="button button-outline" id="admin-logout">Đăng xuất</button><button class="button button-dark" id="add-artwork">+ Thêm tác phẩm</button></div><div class="manager-search"><label>Tìm trong bộ sưu tập<input id="manager-query" type="search" placeholder="Tên tác phẩm, tác giả…"></label><button id="reload-manager" type="button" class="button button-outline manager-reload" aria-busy="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/></svg><span>Tải lại danh sách</span></button></div><div class="manager-table-container"><table class="manager-table"><thead><tr><th>Tác phẩm</th><th>Nhóm nghệ thuật</th><th>Niên đại</th><th>Thao tác</th></tr></thead><tbody id="manager-rows"></tbody></table></div>`;
  renderRows();$('#manager-query').addEventListener('input',renderRows);
  $('#add-artwork').addEventListener('click',()=>openEditor());
  $('#reload-manager').addEventListener('click',reloadManager);
  $('#admin-logout').addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST'});user=null;items=[];setSession(null);showLogin(false);}catch(e){message(e.message,true);}});
}
async function reloadManager(event){
  const button=event.currentTarget,label=button.querySelector('span');
  if(button.disabled||!isAdmin(user))return;
  button.disabled=true;button.setAttribute('aria-busy','true');label.textContent='Đang tải…';message('');
  try{
    const result=await api('/artworks');
    if(!button.isConnected||!isAdmin(user))return;
    items=result.items.map(item=>({...item,id:String(item.id)}));renderRows();
  }catch(error){if(button.isConnected)message(error.message,true);}
  finally{button.disabled=false;button.setAttribute('aria-busy','false');label.textContent='Tải lại danh sách';}
}
function renderRows(){
  const query=$('#manager-query').value.trim().toLocaleLowerCase('vi');const list=items.filter(a=>`${a.title} ${a.author}`.toLocaleLowerCase('vi').includes(query));
  $('#manager-rows').innerHTML=list.length?list.map(a=>`<tr><td><div class="manager-artwork"><img src="${esc(a.image)}" alt=""><div><strong>${esc(a.title)}</strong><span>${esc(a.author)}</span></div></div></td><td>${esc(categoryNames[a.category]||a.category)}</td><td>${esc(a.period)}</td><td><button class="edit-artwork" data-edit-artwork="${esc(a.id)}">Chỉnh sửa ↗</button> <button class="danger-link" data-delete-artwork="${esc(a.id)}">Xóa</button></td></tr>`).join(''):'<tr><td colspan="4" class="manager-empty">Chưa có tác phẩm phù hợp.</td></tr>';
}
function openEditor(artwork=null){
  if(!isAdmin(user))return;
  clearPreviews();selected=artwork;pendingMediaId=pendingVideoId=null;videoRemoved=false;unsaved=false;busy=false;setEditorError('');const form=$('#artwork-form');form.reset();
  $('#editor-title').textContent=artwork?'Chỉnh sửa tác phẩm':'Thêm tác phẩm mới';$('#editor-submit').textContent=artwork?'Lưu thay đổi ↗':'Thêm vào bộ sưu tập ↗';
  for(const name of ['title','author','category','period','year','material','origin','description','topic','originalTitle','source','license'])form.elements[name].value=artwork?.[name]??({category:'painting',origin:'Việt Nam',author:'Chưa xác định'}[name]||'');
  $('#editor-image').src=artwork?.image||'/assets/favicon.svg';$('#editor-image').alt=artwork?.title||'Ảnh đại diện đang chờ chọn';$('#image-filename').textContent=artwork?'Ảnh đại diện hiện tại. Chọn tệp để thay ảnh.':'Chọn ảnh JPG, PNG hoặc WebP, tối đa 8 MB.';
  $('#editor-video').hidden=!artwork?.video;if(artwork?.video)$('#editor-video').src=artwork.video;
  $('#video-filename').textContent=artwork?.video?'Video hiện tại. Chọn tệp để thay video.':'Video tùy chọn · MP4, WebM hoặc MOV · tối đa 1 GiB.';
  $('#remove-video').hidden=!artwork?.video;
  form.elements.tags.value=(artwork?.tags||[]).join(', ');attachmentIds=[];attachmentFiles=[];attachmentResources=[];$('#attachment-files').value='';$('#editor-progress').textContent='';$('#attachment-items').textContent=artwork?'Đang mở tư liệu…':'';
  attachmentsReady=artwork?api('/artworks/'+artwork.id+'/resources').then(({items})=>{attachmentResources=items.filter(r=>!['cover','video'].includes(r.purpose));attachmentIds=attachmentResources.map(r=>r.id);renderAttachments();}):Promise.resolve();attachmentsReady.catch(error=>setEditorError(error.message));
  if(cloudMode)$('#video-filename').textContent+=' Kho cloud: tối đa '+cloudMax+' MiB theo cấu hình, phụ thuộc hạn mức tài khoản.';
  $('#editor-dialog').showModal();
}
$('#artwork-form').addEventListener('input',()=>{unsaved=true;});
$('#artwork-image-file').addEventListener('change',async e=>{
  if(busy)return;
  const file=e.target.files[0];if(!file)return;
  pendingMediaId=null;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){e.target.value='';setEditorError('Chọn ảnh JPG, PNG hoặc WebP nhỏ hơn 8 MB.');return;}
  if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(file);$('#editor-image').src=imageUrl;$('#image-filename').textContent=file.name;setEditorError('');unsaved=true;
});
$('#artwork-video-file').addEventListener('change',e=>{
  if(busy)return;const file=e.target.files[0];if(!file)return;
  if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)||file.size>1024*1024*1024){
    e.target.value='';pendingVideoId=null;if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=null;
    const current=videoRemoved?'':selected?.video;$('#editor-video').pause();if(current)$('#editor-video').src=current;else $('#editor-video').removeAttribute('src');$('#editor-video').load();$('#editor-video').hidden=!current;$('#remove-video').hidden=!current;
    $('#video-filename').textContent=current?'Video hiện tại. Chọn tệp để thay video.':'Video tùy chọn · MP4, WebM hoặc MOV · tối đa 1 GiB.';
    setEditorError('Chọn video MP4, WebM hoặc MOV nhỏ hơn 1 GiB.');return;
  }
  pendingVideoId=null;videoRemoved=false;if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=URL.createObjectURL(file);
  $('#editor-video').src=videoUrl;$('#editor-video').hidden=false;$('#video-filename').textContent=file.name;$('#remove-video').hidden=false;unsaved=true;setEditorError('');
});
$('#remove-video').addEventListener('click',()=>{
  if(busy)return;pendingVideoId=null;videoRemoved=true;$('#artwork-video-file').value='';
  $('#editor-video').pause();$('#editor-video').removeAttribute('src');$('#editor-video').load();$('#editor-video').hidden=true;
  if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=null;$('#remove-video').hidden=true;$('#video-filename').textContent='Không gắn video với tác phẩm này.';unsaved=true;
});
async function uploadMedia(file){
  return uploadFile(file,{signal:uploadController?.signal,onProgress:p=>$('#editor-progress').textContent=p.name+' · '+p.percent+'%'+(p.validating?' · đang kiểm tra tệp…':'')});

}
$('#artwork-form').addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;const form=e.currentTarget;
  const file=form.elements.imageFile.files[0];if(!selected&&!file)return setEditorError('Chọn ảnh đại diện cho tác phẩm mới.');
  try{await attachmentsReady;}catch(error){return setEditorError(error.message);}
  busy=true;uploadController=new AbortController();const submit=$('#editor-submit');setEditorError('');submit.textContent='Đang lưu…';
  const controls=[...form.elements],disabled=controls.map(c=>c.disabled),formData=new FormData(form);controls.forEach(c=>c.disabled=true);$('#editor-cancel-upload').disabled=false;$('#editor-cancel-upload').hidden=false;
  try{
    let imageId=pendingMediaId||selected?.imageId;
    if(file&&!pendingMediaId){submit.textContent='Đang tải ảnh…';const result=await uploadMedia(file);imageId=result.media.id;pendingMediaId=imageId;}
    const videoFile=formData.get('videoFile');let videoId=videoRemoved?'':pendingVideoId||selected?.videoId||'';
    if(videoFile?.size&&!pendingVideoId){submit.textContent='Đang tải video…';const result=await uploadMedia(videoFile);videoId=result.media.id;pendingVideoId=videoId;}
    for(const pending of attachmentFiles){if(!pending.media){const result=await uploadMedia(pending.file);pending.media=result.media;attachmentIds.push(result.media.id);}}
    const data=Object.fromEntries(formData);delete data.imageFile;delete data.videoFile;data.year=Number(data.year);data.tags=String(data.tags||'').split(',').map(v=>v.trim()).filter(Boolean);data.resourceIds=[...attachmentIds];data.imageId=imageId;data.videoId=videoId;if(selected)data.revision=selected.revision;
    const {item}=await api(selected?'/artworks/'+encodeURIComponent(selected.id):'/artworks',{method:selected?'PUT':'POST',body:JSON.stringify(data)});
    unsaved=false;busy=false;$('#editor-dialog').close();clearPreviews();
    window.dispatchEvent(new CustomEvent('catalog-updated',{detail:{id:item.id}}));await renderManager();
  }catch(error){setEditorError((uploadController?.signal.aborted?'Đã dừng tải. Chọn lại cùng tệp để tiếp tục.':error.message)+(error.fields?' '+Object.values(error.fields).join(' '):''));}
  finally{busy=false;$('#editor-cancel-upload').hidden=true;controls.forEach((c,i)=>c.disabled=disabled[i]);submit.textContent=selected?'Lưu thay đổi ↗':'Thêm vào bộ sưu tập ↗';}
});
function renderAttachments(){$('#attachment-items').innerHTML=attachmentResources.filter(r=>attachmentIds.includes(r.id)).map(r=>`<p>${esc(r.title)} <button type="button" class="text-link" data-detach="${esc(r.id)}">Gỡ ×</button></p>`).join('')+attachmentFiles.map(p=>`<p>${esc(p.file.name)} · chờ lưu</p>`).join('');}
$('#attachment-files').addEventListener('change',e=>{attachmentFiles=[...e.target.files].map(file=>({file}));unsaved=true;renderAttachments();});
$('#attachment-items').addEventListener('click',e=>{const button=e.target.closest('[data-detach]');if(button&&!busy){attachmentIds=attachmentIds.filter(id=>id!==button.dataset.detach);unsaved=true;renderAttachments();}});
$('#editor-cancel-upload').addEventListener('click',()=>uploadController?.abort());
document.addEventListener('click',async e=>{
  const del=e.target.closest('[data-delete-artwork]');if(del&&confirm('Xóa hồ sơ tác phẩm? Tư liệu được giữ trong kho để tái sử dụng.')){try{await api('/artworks/'+del.dataset.deleteArtwork,{method:'DELETE'});await renderManager();}catch(error){message(error.message,true);}return;}
  if(e.target.closest('[data-manage-open]'))return openManager();
  const edit=e.target.closest('[data-edit-artwork]');if(edit){if(!user)return openManager(edit.dataset.editArtwork);const item=items.find(a=>a.id===edit.dataset.editArtwork);if(item)openEditor(item);return;}
  if(e.target.closest('[data-editor-close]'))hideEditor();
});
$('#editor-dialog').addEventListener('cancel',e=>{e.preventDefault();hideEditor();});
window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
await openManager(new URLSearchParams(location.search).get('edit'));
