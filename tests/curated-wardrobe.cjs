const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const C=require('../curated-look-engine.js'),M=require('../model-look-engine.js');
const manifest=JSON.parse(read('published-closet.json')),items=manifest.dataFiles.flatMap(f=>JSON.parse(read(f.path)).items),library=C.parseLibrary(read('curated-looks.json'));
assert.equal(library.length,20);assert.equal(new Set(library.map(l=>l.id)).size,20);
assert.equal(items.filter(i=>i.cat==='fragrance').length,6);assert.equal(items.filter(i=>i.photoStatus==='pending').length,1);
for(const group of ['office','date','daily','street'])assert.equal(library.filter(l=>l.group===group).length,5);
const resolved=library.map(l=>C.resolve(l,items,M));assert(resolved.every(Boolean));
for(const look of resolved){
 assert(look.reason.length>30&&look.tip.length>30);assert(look.fragrance?.cat==='fragrance');assert(look.items.every(i=>!i.isDemo&&i.photoStatus!=='pending'));assert.equal(new Set(look.items.map(i=>i.id)).size,look.items.length);
 assert.equal(C.resolve(look,items.filter(i=>i.id!==look.pieces[0].id),M),null);
 const changed=items.map(i=>i.id===look.pieces[0].id?{...i,image:'./assets/changed.webp'}:i);assert.equal(C.resolve(look,changed,M).image,'','Local edits must not keep an old model photo');
 assert(look.image,'Every curated look has a finished model photograph');assert(fs.existsSync(path.join(root,look.image)));
}
const reversible=resolved.filter(r=>r.items.some(i=>i.lookSide));assert.equal(reversible.length,2);assert.deepEqual(new Set(reversible.flatMap(r=>r.items.filter(i=>i.lookSide).map(i=>i.lookSide))),new Set(['데님 면','바람막이 면']));assert.equal(new Set(reversible.flatMap(r=>r.items.filter(i=>i.lookSide).map(i=>i.id))).size,1);
const vest=resolved.find(r=>r.id==='edit-14');assert.equal(vest.items.filter(i=>i.cat==='top').length,2,'Layered shirt and vest both retained');
const snapshots=resolved.map(l=>l.items.map(i=>i.id+'|'+(i.lookView||'')).sort().join(','));assert.equal(new Set(snapshots).size,20,'No duplicate outfits');
assert.throws(()=>C.parseLibrary(JSON.stringify({schemaVersion:1,looks:[{...library[0],image:'https://wrong.invalid/image.jpg'}]})));
assert.throws(()=>C.parseLibrary(' '.repeat(C.MAX_BYTES+1)));
assert(fs.statSync(path.join(root,'assets/wardrobe-room-v1.webp')).size<500000);
const total=fs.readdirSync(path.join(root,'assets')).filter(p=>p.startsWith('curated-look-')).reduce((n,p)=>n+fs.statSync(path.join(root,'assets',p)).size,0);assert(total<4000000,'Curated models stay under 4 MB total');
console.log('PASS: 20 unique owned outfits; four groups; both sides of one reversible garment; layers and optional extras; stale-photo protection; six perfumes; one honest pending image; compressed scene and model assets.');
