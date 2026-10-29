import {loadEnvFile} from 'node:process';
import {writeFile,mkdir} from 'node:fs/promises';
import {connectDatabase} from '../server/db.mjs';
import {FEATURE_VERSION} from '../server/files.mjs';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
const {db,client}=await connectDatabase();
try{
  const artworks=(await db.listArtworks()).filter(a=>['blue','brown','white'].includes(a.category)&&a.imageId.startsWith('met-'));
  const ids=artworks.map(a=>a.imageId),labels=new Map(artworks.map(a=>[a.imageId,a.category])),rows=[];
  for(const artifact of artworks){
    const feature=await db.getImageVector(artifact.imageId);if(!feature?.vector||feature.version!==FEATURE_VERSION)throw new Error('Run npm run media:index before evaluation');
    const start=performance.now(),hits=await db.similarImages(feature.vector,{excludeId:artifact.imageId,onlyIds:ids,limit:5}),elapsedMs=performance.now()-start;
    const relevant=artworks.filter(a=>a.id!==artifact.id&&a.category===artifact.category).length,found=hits.filter(h=>labels.get(h.id)===artifact.category).length;
    rows.push({query:artifact.id,title:artifact.title,category:artifact.category,relevant,found,precisionAt5:found/5,recallAt5:relevant?found/relevant:null,elapsedMs:Number(elapsedMs.toFixed(2)),hits:hits.map(h=>({id:h.id,category:labels.get(h.id),score:Number(h.similarity.toFixed(6))}))});
  }
  const answerable=rows.filter(r=>r.relevant>0),mean=key=>answerable.reduce((sum,r)=>sum+r[key],0)/answerable.length;
  const result={generatedAt:new Date().toISOString(),featureVersion:FEATURE_VERSION,protocol:'Leave-one-out on seven original covers; labels are ceramic categories; detail crops excluded; singleton excluded from macro averages.',queries:rows.length,answerableQueries:answerable.length,macroPrecisionAt5:mean('precisionAt5'),macroRecallAt5:mean('recallAt5'),meanQueryMs:rows.reduce((sum,r)=>sum+r.elapsedMs,0)/rows.length,rows};
  await mkdir(new URL('../.local/reports/',import.meta.url),{recursive:true});await writeFile(new URL('../.local/reports/cbir-evaluation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await client.close();}
