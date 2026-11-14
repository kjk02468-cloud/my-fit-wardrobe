/* Enumerate wardrobe combinations by index without building the full list. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MyFitAllLooks=api;
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const base=['top','bottom','shoes','accessory','bag'];
 const types={base,short:['short',...base],long:['long',...base],layered:['long','short',...base]};

 function buildPools(items,outerLength,variants=item=>[item]){
  const pools={top:[],bottom:[],shoes:[],accessory:[],bag:[],short:[],long:[]};
  const seenIds=new Set();
  for(const item of items){
   if(!item||item.isDemo||typeof item.id!=='string'||!item.id||seenIds.has(item.id))continue;
   let slot=item.cat;
   if(slot==='outer'){
    slot=outerLength(item);
    if(slot!=='short'&&slot!=='long')continue;
   }else if(slot==='eyewear')slot='accessory';
   else if(!base.includes(slot))continue;

   seenIds.add(item.id);
   const views=new Set();
   const choices=variants(item);
   for(const choice of Array.isArray(choices)?choices:[]){
    if(choice?.id!==item.id||choice.cat!==item.cat)continue;
    const view=choice.lookView||'';
    if(typeof view!=='string'||views.has(view))continue;
    views.add(view);
    pools[slot].push(choice);
   }
   if(!views.size)pools[slot].push(item);
  }
  return pools;
 }

 function total(pools,slots){
  if(!slots.length)return 0;
  return slots.reduce((count,slot)=>count*(pools[slot]?.length||0),1);
 }

 function at(pools,slots,index){
  if(!Number.isSafeInteger(index)||index<0||index>=total(pools,slots))return null;
  const items=new Array(slots.length);
  for(let position=slots.length-1;position>=0;position--){
   const choices=pools[slots[position]];
   items[position]=choices[index%choices.length];
   index=Math.floor(index/choices.length);
  }
  return items;
 }

 return {types,buildPools,total,at};
});
