// Pure domain logic. This module never writes to the existing wardrobe database.
export const VERSION = 'template-1';
export const STATES = ['INTRO_SCROLL','STORE_EXPLORE','ITEM_DETAIL','FITTING','CONCIERGE','FRAGRANCE','OOTD','CLASSIC_2D'];
export const ZONES = {
 showroom:{name:'MAIN SHOWROOM',label:'쇼룸',position:[0,1.65,5],yaw:0},
 concierge:{name:'STYLE CONCIERGE',label:'스타일 상담',position:[-4,1.65,4],yaw:.65},
 fragrance:{name:'FRAGRANCE BAR',label:'향수 바',position:[4.4,1.65,1],yaw:-.65},
 fitting:{name:'FITTING ROOM',label:'피팅룸',position:[-3.8,1.65,-4.2],yaw:0},
 ootd:{name:'OOTD STUDIO',label:'코디·기록',position:[3.8,1.65,-4.2],yaw:0}
};
export const OBSTACLES = [
 [-8,-6.9,-7.9,7.7],[6.9,8,-7.9,7.7],[-8,8,-8.2,-7.8],
 [-8,-1.65,7.7,8.2],[1.65,8,7.7,8.2], // entrance opening
 [-6.7,-4.7,2.0,3.3],[5.6,6.8,-2.7,2.6], // concierge and fragrance counter
 [-1.5,1.5,-1.1,1.1], // central display
 [-7,-5,4.65,4.95],[5,7,4.65,4.95],[-7,-5,-1.25,-.95],[5,7,-1.25,-.95], // clothing racks
 [-7,-2,-3.1,-2.85],[-7,-2,-7.6,-7.3], // fitting wall, open east entrance
 [-2.2,-2,-7.5,-5.5],[2,6.8,-3.1,-2.85] // studio screen, entrance at center
];
export function walk(p,dx,dz,obstacles=OBSTACLES,doorOpen=true){
 const q={...p},steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
 const blocked=(x,z)=>Math.abs(x)>7.5||z< -7.4||z>7.45||(!doorOpen&&z>7.3&&Math.abs(x)<1.8)||obstacles.some(([a,b,c,d])=>x>a-.22&&x<b+.22&&z>c-.22&&z<d+.22);
 for(let i=0;i<steps;i++){if(!blocked(q.x+dx/steps,q.z))q.x+=dx/steps;if(!blocked(q.x,q.z+dz/steps))q.z+=dz/steps;}
 return q;
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function introPose(t){t=clamp(t,0,1);return {x:0,y:1.65,z:16-11*t,yaw:0,door:clamp((t-.2)/.25,0,1)};}
export const COLORS={black:'#202024',navy:'#26313f',charcoal:'#45464a',brown:'#736050',beige:'#c3b193',cream:'#e2dbc9',white:'#eeeae2',gray:'#aaa9a4',blue:'#456082',green:'#59604a',silver:'#949a9e',yellow:'#d8a83e',pink:'#c68d9b',purple:'#594166',other:'#b2a389'};
export function mapping(item){
 const n=item.name||'',cat=item.cat;
 let type='',slot=cat;
 if(cat==='top'){type=/후드/.test(n)?'hoodie':/베스트|조끼/.test(n)?'vest':/셔츠/.test(n)&&!/티셔츠/.test(n)?'shirt':/니트|가디건/.test(n)?'knit':/긴팔/.test(n)?'longtee':'tee';slot=['vest','shirt','knit'].includes(type)?'middle':'top';}
 if(cat==='outer')type=/코트|트렌치|발마칸/.test(n)?'coat':/블레이저|더블 재킷/.test(n)?'blazer':/MA-1/.test(n)?'bomber':'jacket';
 if(cat==='bottom')type=/버뮤다|쇼츠/.test(n)?'shorts':/벌룬|커브/.test(n)?'balloon':/와이드|셋업|테이핑/.test(n)?'wide':'straight';
 if(cat==='shoes')type=/로퍼/.test(n)?'loafer':/닥터마틴/.test(n)?'derby':/트랙|점프맨|샥스/.test(n)?'chunky':'sneaker';
 if(cat==='bag')type=/백팩/.test(n)?'backpack':'tote';
 if(cat==='accessory'&&/볼캡|트러커/.test(n)){type='cap';slot='accessory';}
 const sides=/리버서블/.test(n)?['데님 면','바람막이 면']:['기본'];
 return {itemId:item.id,slot,garmentType:type||'unsupported',templateId:type||null,modelVersion:VERSION,
  body:'neutral-adult-male-fixed-pose',color:/브라운 블랙/.test(n)?'#393332':COLORS[item.color]||COLORS.other,sides,
  level:type?'APPROXIMATE':'UNSUPPORTED',material:/데님/.test(n)?'denim':/가죽|레더/.test(n)?'leather':/니트|울/.test(n)?'knit':'woven',
  compatible:['top','middle','outer','bottom','shoes','bag','accessory'],source:'MY FIT procedural templates',license:'project-authored',
  limitation:type?'유사 실루엣 · 고정 포즈 · 로고/패턴/실측 핏과 원단 움직임은 재현하지 않아요.':cat==='fragrance'?'향수는 코디 정보로만 연결해요. 병은 일반형 전시 모델이에요.':'3D 착용 미지원 · 상품 사진과 상세는 이용할 수 있어요.'};
}
export const signature=i=>{const text=JSON.stringify([i.name,i.cat,i.color,i.image,i.photoLabels,i.aiEditVersion]);let hash=2166136261;for(let j=0;j<text.length;j++)hash=Math.imul(hash^text.charCodeAt(j),16777619);return String(hash>>>0);};
export function selectionFor(item,side){const m=mapping(item);if(m.level==='UNSUPPORTED')throw Error('아직 3D 착용을 지원하지 않는 아이템이에요.');return {itemId:item.id,slot:m.slot,side:m.sides.includes(side)?side:m.sides[0],version:VERSION,level:m.level,signature:signature(item)};}
export function reconcile(fit,items){const byId=new Map(items.map(i=>[i.id,i])),removed=[],changed=[];const out={};for(const[k,p]of Object.entries(fit||{})){const item=byId.get(p.itemId);if(!item){removed.push(p.itemId);continue}if(p.signature!==signature(item))changed.push(p.itemId);const m=mapping(item);if(m.level==='UNSUPPORTED'||m.slot!==k){removed.push(p.itemId);continue}out[k]=selectionFor(item,p.side);}return {fit:out,removed,changed};}
export function snapshot(fit,fragrance,items,name='나의 가상 코디'){
 const clean=reconcile(fit,items);if(clean.removed.length||clean.changed.length)throw Error('변경된 아이템을 다시 선택해주세요.');
 if(!Object.keys(clean.fit).length)throw Error('먼저 피팅할 옷을 선택해주세요.');
 if(fragrance&&!items.some(i=>i.id===fragrance&&i.cat==='fragrance'))throw Error('향수 정보를 다시 확인해주세요.');
 return {id:crypto.randomUUID(),type:'virtual',name:String(name).slice(0,80),createdAt:new Date().toISOString(),fit:clean.fit,fragrance:fragrance||null,modelVersion:VERSION};
}
export function parseSaves(raw){
 if(raw.length>512000)throw Error('백업 파일이 너무 커요.');const v=JSON.parse(raw);
 if(!v||v.schema!==1||!Array.isArray(v.looks)||v.looks.length>100)throw Error('3D 코디 백업 형식이 아니에요.');
 if(new Set(v.looks.map(r=>r?.id)).size!==v.looks.length)throw Error('코디 ID가 중복돼요.');
 for(const r of v.looks)if(!r||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||r.fragrance!==null&&typeof r.fragrance!=='string'||r.modelVersion!==VERSION)throw Error('지원하지 않거나 손상된 코디 정보예요.');
 for(const r of v.looks){if(r.type!=='virtual'||typeof r.id!=='string'||typeof r.name!=='string'||r.name.length>80||!r.fit||Object.keys(r.fit).some(k=>!['top','middle','outer','bottom','shoes','bag','accessory'].includes(k)))throw Error('손상된 코디예요.');for(const[k,p]of Object.entries(r.fit))if(!p||typeof p.itemId!=='string'||p.slot!==k||!['기본','데님 면','바람막이 면'].includes(p.side)||typeof p.signature!=='string'||p.signature.length>1500)throw Error('잘못된 아이템 참조예요.');}
 return v.looks;
}
export class SaveStore{
 constructor(storage){this.storage=storage;this.key='myfit-shop3d-virtual-v1';}
 read(){const raw=this.storage.getItem(this.key);return raw?parseSaves(raw):[];}
 write(rows){const raw=JSON.stringify({schema:1,looks:rows});parseSaves(raw);this.storage.setItem(this.key,raw);return rows;}
 save(row){const rows=this.read();if(rows.length>=100)throw Error('코디 100개 한도예요. 백업 후 정리해주세요.');this.write([row,...rows]);}
 import(raw){const next=parseSaves(raw),old=this.read(),map=new Map(old.map(r=>[r.id,r]));for(const r of next)if(!map.has(r.id))map.set(r.id,r);return this.write([...map.values()]);}
}
export class LatestSelection{
 constructor(){this.tokens={};}
 async run(slot,load,apply,discard){const token=this.tokens[slot]=(this.tokens[slot]||0)+1;const result=await load();if(this.tokens[slot]!==token){discard?.(result);return false;}apply(result);return true;}
 cancel(){for(const k of Object.keys(this.tokens))this.tokens[k]++;}
}
export function fragranceMatches(item,{season='fall',occasion='casual',tag=''}={}){
 const reasons=[];let score=0;
 if(item.season===season){score+=2;reasons.push('등록된 계절과 일치');}
 else if(item.season==='all')reasons.push('기존 옷장에 사계절로 등록됨');
 const wanted=['office','date','formal'].includes(occasion)?'smart':'casual';
 if(item.formality===wanted){score++;reasons.push('기존 옷장 분위기 분류와 일치');}
 const tags=[...(Array.isArray(item.tags)?item.tags:[]),item.notes||'',item.userNote||''].join(' ');
 if(tag&&tags.toLowerCase().includes(tag.toLowerCase())){score+=3;reasons.push('등록된 메모·태그 일치');}
 if(tag&&!tags.toLowerCase().includes(tag.toLowerCase()))reasons.push('요청한 태그 정보 없음');
 return {score,reasons,hasNotes:!!item.scentNotes};
}
