import {api} from './catalog.js';
export async function uploadCloudFile(file,{mimeType,fingerprint,onProgress=()=>{},signal}={}){
  const key='net.cloud-upload.'+fingerprint;let id;try{id=localStorage.getItem(key);}catch{}
  let upload;
  if(id)try{
    upload=(await api('/cloud-uploads/'+id+'/status',{signal})).upload;
    if(!upload.completedResourceId)try{const result=await api('/cloud-uploads/'+id+'/complete',{method:'POST',signal:signal||AbortSignal.timeout(240000)});try{localStorage.removeItem(key);}catch{}return result;}catch(error){if(error.status!==502)throw error;}
  }catch(error){if(![404,422].includes(error.status))throw error;id=null;}
  if(!id){upload=(await api('/cloud-uploads/init',{method:'POST',body:JSON.stringify({mimeType,originalName:file.name,sizeBytes:file.size,fingerprint}),signal})).upload;id=upload.id;try{localStorage.setItem(key,id);}catch{}}
  const forget=()=>{try{localStorage.removeItem(key);}catch{}};
  if(upload.completedResourceId){const {resource}=await api('/resources/'+upload.completedResourceId,{signal});forget();return {media:resource};}
  let offset=upload.offset||0;
  while(offset<file.size){
    signal?.throwIfAborted();const end=Math.min(offset+upload.chunkSize,file.size),form=new FormData();
    for(const [name,value] of Object.entries(upload.fields))form.append(name,String(value));form.append('file',file.slice(offset,end),file.name);
    let result,response;
    try{response=await fetch(upload.url,{method:'POST',credentials:'omit',headers:{'X-Unique-Upload-Id':id,'Content-Range':`bytes ${offset}-${end-1}/${file.size}`},body:form,signal:signal||AbortSignal.timeout(240000)});result=await response.json();}
    catch(error){if(signal?.aborted)throw error;throw new Error('Chưa gửi được khối dữ liệu tới kho tệp. Chọn lại cùng tệp để tiếp tục.');}
    if(!response.ok){if(response.status===400)forget();throw new Error(response.status===413?'Cloudinary từ chối dung lượng tệp. Kiểm tra hạn mức tài khoản.':'Cloudinary chưa nhận được tệp. Kiểm tra định dạng, hạn mức hoặc bắt đầu lại lượt tải.');}
    if(end===file.size&&result.done===false)throw new Error('Kho tệp chưa xác nhận hoàn tất. Chọn lại cùng tệp để thử tiếp.');
    offset=end;
    // If this acknowledgement fails, only the final verification can accept the resource.
    await api('/cloud-uploads/'+id+'/progress',{method:'PUT',body:JSON.stringify({offset}),signal});
    onProgress({name:file.name,loaded:offset,total:file.size,percent:Math.round(offset/file.size*100)});
  }
  onProgress({name:file.name,loaded:offset,total:file.size,percent:100,validating:true});
  const result=await api('/cloud-uploads/'+id+'/complete',{method:'POST',signal:signal||AbortSignal.timeout(240000)});forget();return result;
}
