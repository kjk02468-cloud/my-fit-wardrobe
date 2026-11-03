const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),M=require('../model-look-engine.js'),R=require('../style-reference-engine.js');
const manifest=JSON.parse(read('published-closet.json')),items=manifest.dataFiles.flatMap(p=>JSON.parse(read(p.path)).items),library=M.parseLibrary(read('model-looks.json'));
const context={purpose:'casual',season:'fall',temperature:null,code:null};
assert.equal(library.length,5);assert.equal(M.candidates(library,items,context).length,5);
assert.equal(new Set(items.map(i=>i.id)).size,66);assert.equal(items.filter(i=>i.cat==='eyewear').length,2);
assert.equal(items.filter(i=>i.name.includes('리버서블')).length,1);
const reversible=items.find(i=>i.name.includes('리버서블')),views=M.variants(reversible);assert.equal(views.length,2);assert.equal(views[0].id,views[1].id);assert.notEqual(views[0].lookImage,views[1].lookImage);
for(const model of library){
 const resolved=M.resolve(model,items);assert(resolved);assert.equal(resolved.length,4);assert.equal(M.match(library,resolved).id,model.id);
 assert.equal(M.match(library,[...resolved,items.find(i=>i.cat==='eyewear')]),null,'No photo may depict an unpictured extra item');
 assert.equal(M.resolve(model,items.filter(i=>i.id!==model.pieces[0].id)),null);
 for(const field of ['name','brand','color','image'])assert.equal(M.resolve(model,items.map(i=>i.id===model.pieces[0].id?{...i,[field]:i[field]+' changed'}:i)),null,field+' edits invalidate prepared photos');
 assert.equal(M.resolve(model,items.map(i=>i.id===model.pieces[0].id?{...i,isDemo:true}:i)),null);
 assert(fs.existsSync(path.join(root,model.image)));
}
const wind=library.find(l=>l.id==='wind'),windItems=M.resolve(wind,items),altered=items.map(i=>i.id===reversible.id?{...i,additionalImages:['./assets/replaced.webp',...i.additionalImages.slice(1)]}:i);
assert.equal(M.resolve(wind,altered),null,'Changed reverse face invalidates its model cut');
assert.equal(M.match(library,windItems.map(i=>i.id===reversible.id?views[0]:i)),null,'Denim face must not select the windbreaker photo');
assert.equal(M.candidates(library,items,{...context,temperature:30}).length,0);assert.equal(M.candidates(library,items,{...context,temperature:2}).length,0);
assert(!M.candidates(library,items,{...context,temperature:17,code:61}).some(r=>r.model.id==='beige'),'No suede loafers in rain');
assert.equal(M.candidates(library,items,{...context,purpose:'formal'}).length,1);
assert.throws(()=>M.parseLibrary(' '.repeat(M.MAX_BYTES+1)));assert.throws(()=>M.parseLibrary(JSON.stringify({schemaVersion:1,looks:[{...library[0],image:'https://wrong.invalid/model.webp'}]})));
assert(fs.readdirSync(path.join(root,'assets')).filter(p=>p.startsWith('model-look-')).reduce((n,p)=>n+fs.statSync(path.join(root,'assets',p)).size,0)<300000);
const nodes=new Map(),inputs={'#stylist-purpose':{value:'casual'},'#stylist-destination':{value:'도심'},'#city':{value:'서울'},'input[name=mood]:checked':{value:'minimal'}};
const query=s=>inputs[s]||(nodes.has(s)?nodes.get(s):(nodes.set(s,{hidden:true,textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){}}),nodes.get(s)));
class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-11-02T05:00:00Z']))}}
let offline=false;
const ctx={window:{MyFitModels:M,MyFitReferences:R},document:{querySelector:query,querySelectorAll:()=>[]},localStorage:{getItem:()=>null},Intl,Date:FixedDate,URL,TextEncoder,Set,Map,AbortController,setTimeout,clearTimeout,console:{warn(){}},fetch:async u=>{if(offline)throw Error('offline');const text=read(u.split('?')[0]);return {ok:true,headers:{get:()=>Buffer.byteLength(text)},text:async()=>text}}};
const code=read('app.js').replace(/ init\(\)\.catch\([^\n]+\);/,'').replace(/\}\)\(\);\s*$/,`globalThis.api={makeRecommendations,loadModelLooks,normalizeItem,stylingSummary,outfitBoard,modelPhoto,renderRecommendations,setItems(v){items=v.map(normalizeItem)},setMode(v){recommendationMode=v},setWeather(v){weather=v},failPhoto(id){failedModelImages.add(id)}};})();`);
vm.createContext(ctx);vm.runInContext(code,ctx);const a=ctx.api;
(async()=>{
 await a.loadModelLooks();a.setMode('model');a.setItems(items);let recs=a.makeRecommendations();assert.equal(recs.length,5);assert(recs.every(r=>r.model&&r.items.length===4));
 assert(!a.stylingSummary(recs.find(r=>r.model.id==='brown')).join(' ').includes('화이트 셔츠'));
 const w=recs.find(r=>r.model.id==='wind');assert(a.outfitBoard(w).includes('data-view-photo="1"'));assert(a.outfitBoard(w).includes('바람막이 면 착용'));assert(!a.outfitBoard(w).includes('november-balenciaga-reversible-0.webp'));
 a.renderRecommendations();assert(nodes.get('#outfit-results').innerHTML.includes('AI 예상 착장'));assert(!nodes.get('#outfit-results').innerHTML.includes('data-reference-image'));
 a.failPhoto('wind');assert.equal(a.modelPhoto(w),'');a.renderRecommendations();assert(nodes.get('#outfit-results').innerHTML.includes('모델컷을 불러오지 못해'));
 a.setItems(items.filter(i=>i.id!==reversible.id));assert.equal(a.makeRecommendations().length,3);
 a.setItems(items);a.setWeather({city:'서울',temp:30,code:0});assert(a.makeRecommendations().every(r=>!r.model));a.setWeather(null);
 a.setMode('more');recs=a.makeRecommendations();assert.equal(recs.length,3);assert(recs.every(r=>r.items.filter(i=>i.cat==='eyewear').length===1));assert(recs.every(r=>new Set(r.items.map(i=>i.id)).size===r.items.length));
 offline=true;await a.loadModelLooks();a.setMode('model');assert(a.makeRecommendations().every(r=>!r.model));
 console.log('PASS: 5 exact-item model looks; reversible faces share one ID and open the correct photo; changed/deleted/demo items reject stale photos; no extra accessories in prepared cuts; weather and catalog/image failure fallback; 66-item normalization and eyewear; model media below 300KB.');
})().catch(e=>{console.error(e);process.exitCode=1});
