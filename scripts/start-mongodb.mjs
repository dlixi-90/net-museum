import {MongoMemoryServer} from 'mongodb-memory-server-core';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const dbPath=path.resolve('.local/mongodb-data');await mkdir(dbPath,{recursive:true});
process.env.MONGOMS_DOWNLOAD_DIR=path.resolve('.local/mongodb-binaries');
const server=await MongoMemoryServer.create({binary:{version:'8.0.17',downloadDir:process.env.MONGOMS_DOWNLOAD_DIR},instance:{port:27017,ip:'127.0.0.1',dbPath,storageEngine:'wiredTiger'}});
console.log('MongoDB is ready at mongodb://127.0.0.1:27017\nDữ liệu lưu bền vững tại .local/mongodb-data. Giữ terminal này mở khi dùng website.');
let stopping=false;async function stop(){if(stopping)return;stopping=true;await server.stop({doCleanup:false,force:false});process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
