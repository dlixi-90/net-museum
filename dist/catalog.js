export const categoryNames={blue:'Gốm men lam',brown:'Gốm men nâu',white:'Gốm men trắng',painting:'Hội họa',sculpture:'Điêu khắc',graphic:'Đồ họa',other:'Nghệ thuật khác'};
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function api(path,options={}){
  const response=await fetch('/api'+path,{...options,credentials:'same-origin',headers:{...(options.body&&typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers},signal:options.signal||AbortSignal.timeout(10000)});
  let result;try{result=await response.json();}catch{const error=new Error('Trang này chưa kết nối với máy chủ quản lý tác phẩm.');error.status=response.status;throw error;}
  if(!response.ok){const error=new Error(result.error||'Không hoàn tất được yêu cầu.');error.status=response.status;error.fields=result.fields;throw error;}
  return result;
}
export async function loadCatalog(){
  try{const result=await api('/artworks');return {items:result.items,mode:'mongodb'};}
  catch(error){const response=await fetch('/assets/artworks.json');if(!response.ok)throw error;return {items:await response.json(),mode:'snapshot'};}
}
