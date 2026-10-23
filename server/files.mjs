import {open,readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import sharp from 'sharp';
import ffprobe from 'ffprobe-static';
import {PDFDocument} from 'pdf-lib';
import {unzipSync} from 'fflate';
import {colorHistogram} from '../dist/core.js';
import {HttpError} from './validation.mjs';
const execute=promisify(execFile);
const MiB=1024*1024;
export const uploadTypes={
  'image/jpeg':{kind:'image',ext:'jpg',limit:8*MiB},'image/png':{kind:'image',ext:'png',limit:8*MiB},'image/webp':{kind:'image',ext:'webp',limit:8*MiB},
  'video/mp4':{kind:'video',ext:'mp4',limit:1024*MiB},'video/webm':{kind:'video',ext:'webm',limit:1024*MiB},'video/quicktime':{kind:'video',ext:'mov',limit:1024*MiB},
  'audio/mpeg':{kind:'audio',ext:'mp3',limit:64*MiB},'audio/mp3':{kind:'audio',ext:'mp3',limit:64*MiB},'audio/wav':{kind:'audio',ext:'wav',limit:64*MiB},'audio/x-wav':{kind:'audio',ext:'wav',limit:64*MiB},
  'application/pdf':{kind:'document',ext:'pdf',limit:20*MiB},'text/plain':{kind:'text',ext:'txt',limit:5*MiB},
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{kind:'document',ext:'docx',limit:20*MiB}
};
export const FEATURE_VERSION='rgb4x4x4-128-v2';
export async function imageFeatures(buffer){const pixels=await sharp(buffer,{limitInputPixels:40000000}).rotate().resize({width:128,height:128,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer();return colorHistogram(pixels);}
function xmlText(xml){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new HttpError(422,'DOCX không hỗ trợ khai báo thực thể XML.');
  return xml.replace(/<w:tab\b[^>]*\/>/g,'\t').replace(/<w:br\b[^>]*\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const value=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return value<=0x10ffff?String.fromCodePoint(value):'';})
    .replace(/&(lt|gt|amp|quot|apos);/g,(_,key)=>({lt:'<',gt:'>',amp:'&',quot:'"',apos:"'"}[key])).trim();
}
export async function inspectFile(filename,mimeType){
  const spec=uploadTypes[mimeType];if(!spec)throw new HttpError(415,'Định dạng tệp chưa được hỗ trợ.');
  const info=await stat(filename);if(info.size<1||info.size>spec.limit)throw new HttpError(413,'Tệp vượt giới hạn dung lượng.');
  const result={resourceType:spec.kind,mimeType,format:spec.ext.toUpperCase(),extension:spec.ext,sizeBytes:info.size};
  try{
    if(spec.kind==='image'){
      const input=await readFile(filename),meta=await sharp(input,{limitInputPixels:40000000}).metadata();
      if(!['jpeg','png','webp'].includes(meta.format))throw new Error('image');
      const buffer=await sharp(input,{limitInputPixels:40000000}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
      const output=await sharp(buffer).metadata();
      return {...result,mimeType:'image/webp',format:'WEBP',extension:'webp',sizeBytes:buffer.length,width:output.width,height:output.height,buffer,colorVector:await imageFeatures(buffer),featureVersion:FEATURE_VERSION};
    }
    if(spec.kind==='video'||spec.kind==='audio'){
      const handle=await open(filename,'r');const header=Buffer.alloc(16);try{await handle.read(header,0,16,0);}finally{await handle.close();}
      const iso=header.toString('ascii',4,8)==='ftyp',webm=header.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
      if(spec.kind==='video'&&!(spec.ext==='webm'?webm:iso))throw new Error('container');
      if(spec.ext==='wav'&&!(header.toString('ascii',0,4)==='RIFF'&&header.toString('ascii',8,12)==='WAVE'))throw new Error('wave');
      const {stdout}=await execute(ffprobe.path,['-v','error','-show_format','-show_streams','-of','json',filename],{windowsHide:true,timeout:30000,maxBuffer:1024*1024});
      const media=JSON.parse(stdout),video=media.streams?.find(s=>s.codec_type==='video'),audio=media.streams?.find(s=>s.codec_type==='audio');
      if(spec.ext==='mp3'&&media.format?.format_name!=='mp3')throw new Error('mp3');
      if(spec.kind==='video'&&!video||spec.kind==='audio'&&(!audio||video))throw new Error('streams');
      const duration=Number(media.format?.duration||audio?.duration||video?.duration);
      if(!Number.isFinite(duration)||duration<=0)throw new Error('duration');
      return {...result,duration,...(video?{width:video.width,height:video.height}:{}),...(audio&&!video?{language:'vi-VN'}:{})};
    }
    const buffer=await readFile(filename);
    if(spec.ext==='pdf'){
      if(!buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('pdf');
      const pdf=await PDFDocument.load(buffer,{updateMetadata:false});return {...result,pageCount:pdf.getPageCount()};
    }
    if(spec.ext==='docx'){
      let total=0;
      const entries=unzipSync(buffer,{filter:entry=>{
        if(entry.originalSize>8*MiB||(total+=entry.originalSize)>20*MiB)throw new HttpError(413,'Nội dung DOCX giải nén quá lớn.');
        return ['word/document.xml','[Content_Types].xml'].includes(entry.name);
      }});
      if(!entries['word/document.xml']||!entries['[Content_Types].xml'])throw new Error('docx');
      return {...result,content:xmlText(new TextDecoder('utf-8',{fatal:true}).decode(entries['word/document.xml']))};
    }
    const content=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
    if(content.includes('\0'))throw new Error('text');return {...result,content};
  }catch(error){if(error instanceof HttpError)throw error;throw new HttpError(422,'Không đọc được nội dung tệp. Kiểm tra đúng định dạng và chọn lại.');}
}
export function localMediaPath(url,{publicDir,uploadDir}){
  let root,relative;
  if(url.startsWith('/assets/')){root=publicDir;relative=url.slice(1);}
  else if(/^\/uploads\/[a-f0-9-]{36}\.[a-z0-9]+$/.test(url)){root=uploadDir;relative=url.slice(9);}
  else throw new HttpError(404,'Không tìm thấy tệp.');
  const filename=path.resolve(root,relative),rel=path.relative(root,filename);
  if(rel.startsWith('..')||path.isAbsolute(rel)||rel.split(path.sep).some(p=>p.startsWith('.')))throw new HttpError(404,'Không tìm thấy tệp.');
  return filename;
}
export async function serveMedia(req,res,media,roots,{download=false}={}){
  const headers={'Content-Type':media.mimeType,'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"frame-ancestors 'self'",'Accept-Ranges':'bytes'};
  if(download)headers['Content-Disposition']=`attachment; filename*=UTF-8''${encodeURIComponent((media.title||'tai-nguyen').slice(0,100)+'.'+media.format.toLowerCase())}`;
  if(media.url.startsWith('/')){
    const filename=localMediaPath(media.url,roots);let info;try{info=await stat(filename);}catch{throw new HttpError(404,'Tệp không còn trên hệ thống lưu trữ.');}
    let start=0,end=info.size-1,status=200;
    if(req.headers.range){
      const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!range||!range[1]&&!range[2]){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      if(!range[1])start=Math.max(0,info.size-Number(range[2]));else start=Number(range[1]);
      if(range[1]&&range[2])end=Math.min(end,Number(range[2]));
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    res.writeHead(status,{...headers,'Content-Length':end-start+1});
    if(req.method==='HEAD')res.end();else await pipeline(createReadStream(filename,{start,end}),res);
    return;
  }
  const url=new URL(media.url);
  if(url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.port||url.username||url.password)throw new HttpError(502,'Kho tài nguyên không được hỗ trợ để phát trực tiếp.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  let response;try{response=await fetch(url,{headers:req.headers.range?{Range:req.headers.range}:{},signal:controller.signal,redirect:'error'});}finally{clearTimeout(timer);}
  if(!response.ok&&response.status!==416)throw new HttpError(502,'Không lấy được tệp từ kho lưu trữ.');
  for(const name of ['Content-Length','Content-Range'])if(response.headers.has(name))headers[name]=response.headers.get(name);
  res.writeHead(response.status,headers);
  if(req.method==='HEAD'){controller.abort();res.end();return;}
  res.on('close',()=>controller.abort());await pipeline(Readable.fromWeb(response.body),res);
}
