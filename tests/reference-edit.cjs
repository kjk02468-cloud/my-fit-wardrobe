const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const E=require('../reference-edit-engine.js'),C=require('../curated-look-engine.js'),M=require('../model-look-engine.js');
const manifest=JSON.parse(read('published-closet.json')),items=manifest.dataFiles.flatMap(f=>JSON.parse(read(f.path)).items),raw=read('reference-edit-looks.json'),library=E.parseLibrary(raw);
assert.equal(library.length,10);assert.equal(new Set(library.map(r=>r.id)).size,10);
for(const[k,count]of [['sns',6],['airport',2],['show',2]])assert.equal(E.select(library,k).length,count);
const resolved=library.map(row=>E.resolve(row,items,M,C));assert(resolved.every(Boolean));
assert.equal(new Set(resolved.map(r=>r.items.map(i=>i.id+'|'+(i.lookView||'')).sort().join(','))).size,10);
assert.equal(new Set(resolved.flatMap(r=>r.items.filter(i=>i.cat==='shoes').map(i=>i.id))).size,7,'Use the actual varied owned footwear collection');
for(const row of library){
 const current=E.resolve(row,items,M,C);assert(current.image&&current.photoMatches);assert(current.items.every(i=>!i.isDemo&&i.photoStatus!=='pending'));
 assert.equal(E.resolve(row,items.filter(i=>i.id!==row.pieces[0].id),M,C),null);
 const changed=items.map(i=>i.id===row.pieces[0].id?{...i,color:'changed'}:i);assert.equal(E.resolve(row,changed,M,C).image,'');
 assert(row.anchors.length===3&&row.observation&&row.differences&&row.reference.credit);assert(new URL(row.reference.sourceUrl).protocol==='https:');
 assert(fs.existsSync(path.join(root,row.image)),'Each edit needs its own finished image');
}
const a=resolved[0].items.find(i=>i.id.includes('reversible')),b=resolved[1].items.find(i=>i.id.includes('reversible'));assert.equal(a.id,b.id);assert.equal(a.lookSide,'바람막이 면');assert.equal(b.lookSide,'데님 면');assert.notEqual(a.lookImage,b.lookImage);
const change=mutate=>{const d=JSON.parse(raw);mutate(d);return JSON.stringify(d)};
assert.throws(()=>E.parseLibrary(change(d=>d.looks[0].reference.sourceUrl='https://wrong.invalid/post')));
assert.throws(()=>E.parseLibrary(change(d=>d.looks[0].reference.imageUrl='data:image/png;base64,abc')));
assert.throws(()=>E.parseLibrary(change(d=>d.looks[0].reference.profileUrl='javascript:alert(1)')));
assert.throws(()=>E.parseLibrary(change(d=>d.looks[1].reference.imageUrl=d.looks[0].reference.imageUrl)));
assert.throws(()=>E.parseLibrary(change(d=>d.figureView='face')));assert.throws(()=>E.parseLibrary(' '.repeat(E.MAX_BYTES+1)));
assert(!raw.includes('184cm')&&!raw.includes('82kg')&&!raw.includes('C:\\Users')&&!raw.includes('data:image'),'No private measurements, raw input paths or image copies in the public index');
const media=library.reduce((sum,row)=>sum+fs.statSync(path.join(root,row.image)).size,0);assert(media<900000,'Ten final pictures must stay below 900 KB');
console.log('PASS: 10 source-backed edits; 6 SNS / 2 airport / 2 fashion-week; all 7 owned shoe choices; exact owned pieces, both reversible faces, local-edit/deletion protection, bounded trusted source links, metadata-only reference photos; '+media+' bytes of final images.');
