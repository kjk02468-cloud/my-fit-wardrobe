const assert = require('node:assert/strict');
const {types, buildPools, total, at} = require('../all-looks-engine.js');

const items = [
 {id:'shirt', cat:'top'},
 {id:'tee', cat:'top'},
 {id:'jeans', cat:'bottom'},
 {id:'slacks', cat:'bottom'},
 {id:'shoes', cat:'shoes'},
 {id:'belt', cat:'accessory'},
 {id:'glasses', cat:'eyewear'},
 {id:'tote', cat:'bag'},
 {id:'backpack', cat:'bag'},
 {id:'jacket', cat:'outer', outerLength:'short'},
 {id:'reversible', cat:'outer', outerLength:'short'},
 {id:'coat', cat:'outer', outerLength:'long'},
 {id:'fragrance', cat:'fragrance'},
 {id:'demo', cat:'top', isDemo:true},
 {id:'unknown-length', cat:'outer'},
 {id:'reversible', cat:'outer', outerLength:'long'},
 {id:'shirt', cat:'bottom'},
 {cat:'top'},
 null,
];
const pools = buildPools(items, item=>item.outerLength, item=>{
 if(item.id!=='reversible')return [item];
 return [
  {...item, lookView:'데님 면', lookImage:'./assets/denim.webp'},
  {...item, lookView:'바람막이 면', lookImage:'./assets/shell.webp'},
  {...item, lookView:'데님 면'},
  {...item, id:'another-item', lookView:'엉뚱한 면'},
 ];
});

assert.deepEqual(pools.accessory.map(item=>item.id), ['belt','glasses']);
assert.deepEqual(pools.short.map(item=>item.id), ['jacket','reversible','reversible']);
assert.deepEqual(pools.long.map(item=>item.id), ['coat']);
assert.equal(pools.short[2].lookImage, './assets/shell.webp');

const totals = {base:16, short:48, long:16, layered:48};
const slotMatches = (item, slot) => {
 if(slot==='long'||slot==='short')return item.cat==='outer'&&item.outerLength===slot;
 if(slot==='accessory')return ['accessory','eyewear'].includes(item.cat);
 return item.cat===slot;
};
for(const [type, slots] of Object.entries(types)){
 const count=total(pools,slots);
 assert.equal(count,totals[type]);
 const unique = new Set();
 for(let index=0;index<count;index++){
  const combo=at(pools,slots,index);
  assert(combo.every((item,i)=>slotMatches(item,slots[i])));
  assert.equal(new Set(combo.map(item=>item.id)).size,combo.length);
  unique.add(JSON.stringify(combo.map(item=>[item.id,item.lookView||''])));
 }
 assert.equal(unique.size,count);
 for(const index of [-1,0.5,NaN,Infinity,count,'0'])assert.equal(at(pools,slots,index),null);
 assert.equal(total({...pools,bag:[]},slots),0);
 assert.equal(at({...pools,bag:[]},slots,0),null);
}
assert.deepEqual(at(pools,types.layered,0).map(item=>item.id),['coat','jacket','shirt','jeans','shoes','belt','tote']);
const last = at(pools,types.layered,47);
assert.deepEqual(last.map(item=>item.id),['coat','reversible','tee','slacks','shoes','glasses','backpack']);
assert.equal(last[1].lookView,'바람막이 면');
console.log('PASS: exact Cartesian totals, indexing, boundary checks, reversible sides, owned items, and pool deduplication.');
