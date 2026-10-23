import {isIP} from 'node:net';
export function clientAddress(req,{trustedProxy=process.env.RENDER==='true'||process.env.VERCEL==='1'}={}){
  if(trustedProxy){const last=String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim();if(isIP(last))return last;}
  return req.socket.remoteAddress||'unknown';
}
