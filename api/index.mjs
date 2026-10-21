import {connectDatabase,initializeDatabase} from '../server/db.mjs';
import {createRequestHandler} from '../server/app.mjs';

let ready;
async function getHandler(){
  if(!ready)ready=(async()=>{
    let connection;
    try{
      connection=await connectDatabase();
      await initializeDatabase(connection.db,{seed:false});
      const hostname=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
      return createRequestHandler({db:connection.db,allowSetup:false,secureCookies:true,directUploads:true,publicOrigin:process.env.PUBLIC_ORIGIN||(hostname?`https://${hostname}`:''),onError:error=>console.error('API request failed:',error.name)});
    }catch(error){await connection?.client.close();throw error;}
  })().catch(error=>{ready=null;throw error;});
  return ready;
}

export default async function handler(req,res){
  try{return await (await getHandler())(req,res);}
  catch(error){
    console.error('API initialization failed:',error.name);
    res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'Chưa kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.'}));
  }
}
