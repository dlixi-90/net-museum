import QRCode from 'qrcode';
import {HttpError} from './validation.mjs';

export function artworkShareURL(id,{publicOrigin='',requestHost=''}={}){
  if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,64}$/.test(id))throw new HttpError(400,'Mã tác phẩm không hợp lệ.');
  let origin;
  try{origin=new URL(publicOrigin||`http://${requestHost}`);}catch{throw new HttpError(503,'Chưa cấu hình địa chỉ website để tạo mã QR.');}
  if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||(!publicOrigin&&!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw new HttpError(503,'Chưa cấu hình địa chỉ website để tạo mã QR.');
  const link=new URL('/tac-pham/',origin.origin);
  link.searchParams.set('id',id);
  return link.href;
}

export async function createArtworkQR(id,options){
  const url=artworkShareURL(id,options);
  const image=await QRCode.toDataURL(url,{type:'image/png',width:768,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000ff',light:'#ffffffff'}});
  return {url,image,filename:`net-${id}-qr.png`};
}
