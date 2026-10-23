import {api,escapeHtml as esc} from './catalog.js';
import {loadSession,setSession,sessionUser,isAdmin} from './access.js';

const root=document.querySelector('#account-body');
const params=new URLSearchParams(location.search);
let current=null,busy=false;
function setMode(mode){
  const query=new URLSearchParams(location.search);
  if(mode==='register')query.set('mode','register');else query.delete('mode');
  history.replaceState(null,'',location.pathname+(query.size?'?'+query:''));
  renderForm(mode);
}
function field(name,label,{type='text',autocomplete='',minlength='',help=''}={}){
  return `<label class="account-field" for="account-${name}">${label}<input id="account-${name}" name="${name}" type="${type}" autocomplete="${autocomplete}" required ${minlength?`minlength="${minlength}"`:''} maxlength="${type==='password'?200:name==='name'?150:254}" aria-describedby="${name}-error${help?' '+name+'-help':''}">${help?`<small id="${name}-help">${help}</small>`:''}<small id="${name}-error" class="field-error"></small></label>`;
}
function renderForm(mode='login'){
  const register=mode==='register';
  root.innerHTML=`<div class="account-card"><nav class="account-tabs" aria-label="Truy cập tài khoản"><button type="button" data-auth-mode="login" aria-pressed="${!register}">Đăng nhập</button><button type="button" data-auth-mode="register" aria-pressed="${register}">Đăng ký</button></nav><h1>${register?'Tạo tài khoản Nét':'Chào mừng bạn trở lại'}</h1><p class="account-intro">${register?'Giữ lại những cảm hứng và tiếp tục hành trình nghệ thuật của bạn.':'Đăng nhập để tiếp tục hành trình cùng Nét.'}</p><form id="account-form" novalidate>${register?field('name','Họ và tên',{autocomplete:'name'})+field('username','Tên tài khoản',{autocomplete:'username',help:'Từ 3–80 ký tự: chữ thường, số, dấu chấm, gạch nối hoặc gạch dưới.'}):''}${field('email',register?'Email':'Email hoặc tên tài khoản',{type:register?'email':'text',autocomplete:register?'email':'username'})}${field('password','Mật khẩu',{type:'password',autocomplete:register?'new-password':'current-password',minlength:register?10:1,help:register?'Sử dụng ít nhất 10 ký tự.':''})}${register?field('confirmPassword','Nhập lại mật khẩu',{type:'password',autocomplete:'new-password',minlength:10}):''}<p id="account-error" class="form-error" role="alert"></p><button class="button button-dark account-submit" type="submit">${register?'Tạo tài khoản':'Đăng nhập'} <span aria-hidden="true">↗</span></button></form><p class="account-switch">${register?'Đã có tài khoản?':'Chưa có tài khoản?'} <button type="button" data-auth-mode="${register?'login':'register'}">${register?'Đăng nhập':'Đăng ký ngay'}</button></p></div>`;
  root.querySelectorAll('[data-auth-mode]').forEach(button=>button.addEventListener('click',()=>{if(!busy)setMode(button.dataset.authMode);}));
  root.querySelector('#account-form').addEventListener('submit',event=>submit(event,register));
}
function showErrors(form,fields,message){
  for(const [name,text] of Object.entries(fields||{})){
    const input=form.elements.namedItem(name),error=document.querySelector('#'+name+'-error');
    if(input&&error){input.setAttribute('aria-invalid','true');error.textContent=text;}
  }
  document.querySelector('#account-error').textContent=Object.keys(fields||{}).length?'':message;
  const first=form.querySelector('[aria-invalid="true"]');if(first)first.focus();
}
async function submit(event,register){
  event.preventDefault();if(busy)return;
  const form=event.currentTarget,data=Object.fromEntries(new FormData(form));
  form.querySelectorAll('[aria-invalid]').forEach(input=>input.removeAttribute('aria-invalid'));
  form.querySelectorAll('.field-error').forEach(error=>error.textContent='');document.querySelector('#account-error').textContent='';
  const errors={};
  if(register&&!data.name.trim())errors.name='Nhập họ và tên của bạn.';
  if(register&&!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(data.username))errors.username='Tên tài khoản chưa đúng định dạng.';
  if(!data.email.trim()||(register&&!form.elements.email.validity.valid))errors.email='Nhập địa chỉ email hợp lệ.';
  if(!data.password||(register&&data.password.length<10))errors.password=register?'Mật khẩu cần ít nhất 10 ký tự.':'Nhập mật khẩu của bạn.';
  if(register&&data.confirmPassword!==data.password)errors.confirmPassword='Mật khẩu nhập lại chưa khớp.';
  if(Object.keys(errors).length)return showErrors(form,errors,'');
  busy=true;const controls=[...root.querySelectorAll('button,input')],button=form.querySelector('[type="submit"]');controls.forEach(control=>control.disabled=true);button.setAttribute('aria-busy','true');button.textContent=register?'Đang tạo tài khoản…':'Đang đăng nhập…';
  try{
    const result=await api(register?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(data)});
    current=result.user;setSession(current);
    if(isAdmin(current)&&params.get('next')==='/quan-ly/')location.assign('/quan-ly/');else renderAccount();
  }catch(error){
    if(form.isConnected)showErrors(form,error.fields,error.message);
  }finally{
    busy=false;if(form.isConnected){controls.forEach(control=>control.disabled=false);button.removeAttribute('aria-busy');button.innerHTML=(register?'Tạo tài khoản':'Đăng nhập')+' <span aria-hidden="true">↗</span>';form.querySelector('[aria-invalid="true"]')?.focus();}
  }
}
function renderAccount(){
  root.innerHTML=`<section class="account-card account-profile"><span class="account-avatar" aria-hidden="true">${esc(current.name?.trim().slice(0,1).toLocaleUpperCase('vi')||'N')}</span><h1>Chào ${esc(current.name)}.</h1><p class="account-email">${esc(current.email)}</p><div class="account-links"><a class="button button-dark" href="/bo-suu-tap/">Khám phá bộ sưu tập ↗</a><a class="button button-outline" href="/da-luu/">Tác phẩm đã lưu ♡</a>${isAdmin(current)?'<a class="text-link" href="/quan-ly/">Quản lý tác phẩm ↗</a>':''}</div><p id="account-error" class="form-error" role="alert"></p><button id="account-logout" class="account-signout" type="button">Đăng xuất</button></section>`;
  document.querySelector('#account-logout').addEventListener('click',async event=>{
    if(busy)return;busy=true;const button=event.currentTarget;button.disabled=true;button.textContent='Đang đăng xuất…';
    try{await api('/auth/logout',{method:'POST'});current=null;setSession(null);setMode('login');}
    catch(error){document.querySelector('#account-error').textContent=error.message;button.disabled=false;button.textContent='Đăng xuất';}
    finally{busy=false;}
  });
}
window.addEventListener('net-access-updated',()=>{
  if(busy)return;const next=sessionUser();
  if(current&&!next){current=null;renderForm();}
  else if(next&&(!current||current.email!==next.email||current.role!==next.role)){current=next;renderAccount();}
});
try{const session=await loadSession({refresh:true});current=session.user;if(current)renderAccount();else renderForm(params.get('mode')==='register'?'register':'login');}
catch{renderForm(params.get('mode')==='register'?'register':'login');document.querySelector('#account-error').textContent='Chưa kết nối được máy chủ. Bạn có thể thử lại sau.';}
