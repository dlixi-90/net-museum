import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {HttpError} from './validation.mjs';
const scrypt=promisify(scryptCallback);
export const hashToken=token=>createHash('sha256').update(token).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`;}
export async function passwordMatches(password,stored){if(typeof stored!=='string'||!/^([a-f0-9]{32}):([a-f0-9]{128})$/.test(stored))return false;const [salt,key]=stored.split(':');const actual=await scrypt(password,salt,64);const expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function parseAdminEmails(value=process.env.ADMIN_EMAILS||''){
  const emails=value instanceof Set||Array.isArray(value)?[...value]:String(value).split(',');
  return new Set(emails.map(email=>String(email).trim().toLowerCase()).filter(email=>/^\S+@\S+\.\S+$/.test(email)));
}
export const accountRole=(email,adminEmails)=>adminEmails.has(String(email||'').trim().toLowerCase())?'admin':'user';
export function validateCredentials(body,{setup=false}={}){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(422,'Thông tin đăng nhập không hợp lệ.');
  if(typeof body.email!=='string'||body.email.length>254||!(setup?/^\S+@\S+\.\S+$/:/^(?:\S+@\S+\.\S+|[a-zA-Z0-9._-]{3,80})$/).test(body.email))throw new HttpError(422,setup?'Nhập địa chỉ email hợp lệ.':'Nhập email hoặc tên tài khoản hợp lệ.');
  if(setup&&body.username!==undefined&&(typeof body.username!=='string'||!/^[a-zA-Z0-9._-]{3,80}$/.test(body.username)))throw new HttpError(422,'Tài khoản dùng 3–80 chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.',{username:'Tên tài khoản chưa hợp lệ.'});
  if(typeof body.password!=='string'||body.password.length<(setup?10:1)||body.password.length>200)throw new HttpError(422,setup?'Mật khẩu cần từ 10 đến 200 ký tự.':'Nhập mật khẩu.');
  if(setup&&(typeof body.name!=='string'||!body.name.trim()||body.name.length>150))throw new HttpError(422,'Nhập tên quản trị viên (tối đa 150 ký tự).');
  return {email:body.email.trim().toLowerCase(),password:body.password,name:body.name?.trim(),username:body.username?.trim().toLowerCase()};
}
export function sessionCookie(token,{secure=false,clear=false}={}){return `net_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:86400}${secure?'; Secure':''}`;}
export async function getSession(req,db,adminEmails=parseAdminEmails()){
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('net_session='))?.slice(12);
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  const session=await db.getSession(hashToken(token));
  if(!session)return null;
  const user=await db.getUser(session.userId);
  return user&&user.active!==false?{id:user._id,name:user.name,email:user.email,username:user.username,role:user.role==='admin'?'admin':'user',sessionId:session._id}:null;
}
export async function newSession(db,user){const token=randomBytes(32).toString('hex');await db.createSession({hash:hashToken(token),userId:user._id,expiresAt:new Date(Date.now()+86400000)});return token;}
