import {api} from './catalog.js';
import {uploadCloudFile} from './cloud-upload.js';
const types={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',mp3:'audio/mpeg',wav:'audio/wav',pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain'};
export async function uploadFile(file,{onProgress=()=>{},signal}={}){
  const mimeType=types[file.name.split('.').pop().toLowerCase()]||file.type;
  const sample=await new Blob([file.slice(0,1048576),file.slice(Math.max(0,file.size-1048576)),String(file.size),file.name,String(file.lastModified)]).arrayBuffer();
  const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',sample))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const session=await api('/session',{signal});
  if(session.uploadStorage==='cloudinary')return uploadCloudFile(file,{mimeType,fingerprint,onProgress,signal});
  const key='net.upload.'+fingerprint;let id;try{id=localStorage.getItem(key);}catch{}
  let status;
  if(id)try{status=(await api('/uploads/'+id+'/status',{signal})).upload;}catch(error){if(![404,410,422].includes(error.status))throw error;id=null;}
  if(!id){const result=await api('/uploads/init',{method:'POST',body:JSON.stringify({originalName:file.name,mimeType,sizeBytes:file.size,fingerprint}),signal});id=result.upload.id;status=result.upload;try{localStorage.setItem(key,id);}catch{}}
  if(status.completedResourceId){const {resource}=await api('/resources/'+status.completedResourceId,{signal});return {media:resource};}
  let offset=status.offset||0;const chunkSize=status.chunkSize||6*1024*1024;
  while(offset<file.size){
    signal?.throwIfAborted();let done=false;
    for(let attempt=0;attempt<3&&!done;attempt++){
      try{const result=await api('/uploads/'+id+'/chunk',{method:'PUT',headers:{'Content-Type':'application/octet-stream','Upload-Offset':String(offset)},body:file.slice(offset,offset+chunkSize),signal:signal||AbortSignal.timeout(180000)});offset=result.offset;done=true;}
      catch(error){if(signal?.aborted||attempt===2||error.status&&error.status!==409)throw error;const fresh=await api('/uploads/'+id+'/status',{signal});offset=fresh.upload.offset;}
    }
    onProgress({name:file.name,loaded:offset,total:file.size,percent:Math.round(offset/file.size*100)});
  }
  onProgress({name:file.name,loaded:offset,total:file.size,percent:100,validating:true});
  const result=await api('/uploads/'+id+'/complete',{method:'POST',signal:signal||AbortSignal.timeout(180000)});
  try{localStorage.removeItem(key);}catch{}return result;
}
