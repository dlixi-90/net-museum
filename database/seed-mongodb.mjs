import {loadEnvFile} from 'node:process';
import {connectDatabase,initializeDatabase} from '../server/db.mjs';
try{loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const {client,db}=await connectDatabase();
try{await initializeDatabase(db);console.log(`Đã khởi tạo MongoDB: ${await db.collection('artworks').countDocuments()} tác phẩm. Seed không ghi đè các tác phẩm đã chỉnh sửa.`);}finally{await client.close();}
