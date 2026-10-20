// mongosh: mongosh mongodb://127.0.0.1:27017 database/queries.mongodb.js
// Fifteen read-only queries for the active MongoDB model.
const museum=db.getSiblingDB('net_museum');
function result(label,value){print('\n'+label);printjson(value);}
// 01. Entire catalogue, projected fields.
result('01. Catalogue',museum.artworks.find({},{_id:0,title:1,author:1,period:1}).toArray());
// 02. Title keyword.
result('02. Title search',museum.artworks.find({title:{$regex:'bình',$options:'i'}}).toArray());
// 03. Artist.
result('03. Artist search',museum.artworks.find({author:'Chưa xác định'}).toArray());
// 04. Art category.
result('04. Category',museum.artworks.find({category:'blue'}).toArray());
// 05. Date range.
result('05. Period range',museum.artworks.find({year:{$gte:1300,$lt:1500}}).toArray());
// 06. File size.
result('06. Images below 100 KiB',museum.artworks.find({sizeBytes:{$lt:102400}}).toArray());
// 07. Tag membership.
result('07. Keyword',museum.artworks.find({tags:{$in:['hoa mẫu đơn','chim']}}).toArray());
// 08. Combined filters.
result('08. Combined filters',museum.artworks.find({category:'blue',year:{$gte:1300},sizeBytes:{$lt:1048576}}).toArray());
// 09. Most recently modified.
result('09. Latest updates',museum.artworks.find().sort({updatedAt:-1}).limit(5).toArray());
// 10. Total records.
result('10. Total',museum.artworks.countDocuments());
// 11. Count and storage by category.
result('11. Category statistics',museum.artworks.aggregate([{$group:{_id:'$category',total:{$sum:1},bytes:{$sum:'$sizeBytes'}}},{$sort:{total:-1}}]).toArray());
// 12. Artists with at least two works (HAVING equivalent).
result('12. Artist statistics',museum.artworks.aggregate([{$match:{author:{$ne:'Chưa xác định'}}},{$group:{_id:'$author',total:{$sum:1}}},{$match:{total:{$gte:2}}}]).toArray());
// 13. Artwork plus media metadata ($lookup).
result('13. Media join',museum.artworks.aggregate([{$lookup:{from:'media',localField:'imageId',foreignField:'id',as:'imageMetadata'}},{$project:{title:1,imageMetadata:1,_id:0}}]).toArray());
// 14. Uploaded media not currently referenced by any artwork.
result('14. Unused media',museum.media.aggregate([{$match:{seed:{$ne:true}}},{$lookup:{from:'artworks',localField:'id',foreignField:'imageId',as:'works'}},{$match:{works:{$size:0}}},{$project:{_id:0,id:1,url:1,createdAt:1}}]).toArray());
// 15. Audit events with curator identity; never expose password hashes.
result('15. Edit history',museum.audit_logs.aggregate([{$sort:{createdAt:-1}},{$limit:20},{$lookup:{from:'users',localField:'userId',foreignField:'_id',as:'curator'}},{$project:{_id:0,artworkId:1,action:1,revision:1,createdAt:1,'curator.name':1}}]).toArray());
