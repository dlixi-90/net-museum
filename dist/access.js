import {api} from './catalog.js';

let session=null,pending=null,version=0;
export const isAdmin=user=>user?.role==='admin';
export const sessionUser=()=>session?.user||null;

export function syncAccess(){
  const user=session?.user,admin=isAdmin(user);
  document.querySelectorAll('[data-admin-only]').forEach(node=>node.hidden=!admin);
  const account=document.querySelector('#account-link');
  if(account){
    account.hidden=admin;
    account.innerHTML=user?'Đăng xuất <span aria-hidden="true">↗</span>':'Đăng nhập <span aria-hidden="true">↗</span>';
    account.setAttribute('aria-label',user?'Đăng xuất tài khoản':'Đăng nhập tài khoản');
  }
  window.dispatchEvent(new Event('net-access-updated'));
}

export function setSession(user){
  version++;
  session={user:user||null,setupRequired:false,setupAvailable:false};
  syncAccess();
}

export function loadSession({refresh=false}={}){
  if(pending)return pending;
  if(session&&!refresh)return Promise.resolve(session);
  const revision=version;
  pending=api('/session').then(result=>{
    if(version===revision){session=result;syncAccess();}
    return version===revision?result:session;
  }).catch(error=>{
    if(version===revision){session=null;syncAccess();}
    throw error;
  }).finally(()=>{pending=null;});
  return pending;
}

export function initAccess(){
  syncAccess();
  loadSession().catch(()=>{});
  document.querySelector('#account-link')?.addEventListener('click',async event=>{
    if(!session?.user)return;
    event.preventDefault();
    try{await api('/auth/logout',{method:'POST'});setSession(null);location.assign('/');}
    catch{const toast=document.querySelector('#toast');if(toast){toast.textContent='Chưa đăng xuất được. Vui lòng thử lại.';toast.classList.add('visible');}}
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)loadSession({refresh:true}).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadSession({refresh:true}).catch(()=>{});});
}
