import * as T from './vendor/three.module.min.js';
import {mapping} from './core.mjs';
const mat=(color,roughness=.88)=>new T.MeshStandardMaterial({color,roughness,side:T.DoubleSide});
function mesh(g,m,parent,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
// Cross-section lofts produce closed, three-dimensional garments, not photo planes.
function loft(rings,n=40,fold=.004){const p=[],uv=[],idx=[];for(let j=0;j<rings.length;j++){const [y,w,d,cx=0,cz=0]=rings[j];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=1+fold*Math.cos(a*11+j*.45);p.push(cx+Math.cos(a)*w*r,y,cz+Math.sin(a)*d*r);uv.push(i/n,j/(rings.length-1));}}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+n+1;idx.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;}
function ellipsoid(parent,m,x,y,z,sx,sy,sz){const o=mesh(new T.SphereGeometry(1,24,16),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o;}
function patch(parent,m,points,z){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return mesh(new T.ExtrudeGeometry(shape,{depth:.009,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:1,steps:1}),m,parent,0,0,z);}
function torso(g,m,{bottom=.99,width=.255,depth=.145,sleeves=true,short=false,open=false}={}){
 const rings=[[bottom,width*.98,depth],[bottom+.08,width,depth],[1.26,width*.96,depth],[1.46,width,depth*.97],[1.53,width*.89,depth*.81],[1.57,.082,.08]];
 const geo=loft(rings,48,.012);
 if(open){const index=geo.getIndex(),keep=[];for(let a=0;a<index.count;a+=3){const vs=[index.getX(a),index.getX(a+1),index.getX(a+2)],pos=geo.attributes.position;const x=vs.reduce((s,i)=>s+pos.getX(i),0)/3,z=vs.reduce((s,i)=>s+pos.getZ(i),0)/3;if(!(Math.abs(x)<.07&&z>.07))keep.push(...vs);}geo.setIndex(keep);}
 mesh(geo,m,g);
 if(sleeves)for(const s of [-1,1]){const end=short?1.22:.94,off=s*.23,k=depth/.166;mesh(loft([[1.51,.105*k,.104*k,off],[1.4,.105*k,.098*k,off+s*.045],[1.23,.088*k,.085*k,off+s*.075],[end,.075*k,.071*k,off+s*.095]],32,.01),m,g);}
}
export function mannequin(){const g=new T.Group(),skin=mat('#b8aca0',.55),under=mat('#696563');
 mesh(loft([[.95,.16,.12],[1.25,.19,.13],[1.48,.22,.12],[1.54,.08,.08]]),under,g);
 ellipsoid(g,skin,0,1.77,0,.107,.14,.10);mesh(new T.CylinderGeometry(.063,.075,.15,24),skin,g,0,1.61,0);
 for(const s of [-1,1]){mesh(loft([[.14,.064,.07,s*.105],[.53,.075,.075,s*.105],[.95,.10,.11,s*.105]]),under,g);mesh(loft([[.91,.047,.048,s*.33],[1.28,.06,.065,s*.30],[1.49,.075,.08,s*.23]]),skin,g);ellipsoid(g,skin,s*.34,.86,0,.047,.075,.035);}
 return g;
}
export function garment(item,side='기본'){
 const m=mapping(item);if(!m.templateId)throw Error('이 품목은 모델이 준비되지 않았어요.');
 const g=new T.Group();g.userData={itemId:item.id,type:m.garmentType,side,level:m.level};
 const reverse=side==='바람막이 면',fabric=mat(reverse?'#272a2c':m.color,m.material==='leather'?.48:.9),trim=mat('#302f2f'),button=mat('#9d9587',.3);const type=m.garmentType;
 if(['tee','longtee','shirt','knit','vest','hoodie','jacket','coat','blazer','bomber'].includes(type)){
  const outer=m.slot==='outer',middle=m.slot==='middle',width=outer?.30:middle?.273:.247,depth=outer?.22:middle?.19:.166;
  const bottom=type==='coat'?.39:type==='blazer'?.81:type==='bomber'?.99:.97;
  torso(g,fabric,{bottom,width,depth,short:type==='tee',sleeves:type!=='vest',open:!reverse&&['coat','blazer','shirt','jacket'].includes(type)});
  // Ribbed hems, collars, opening plackets, and lapels distinguish silhouettes.
  if(['knit','hoodie','bomber','vest'].includes(type)){mesh(loft([[bottom,.99*width,depth],[bottom+.035,.99*width,depth]]),fabric,g);}
  if(['coat','blazer','shirt'].includes(type))for(const s of [-1,1]){
   patch(g,fabric,[[s*.08,1.57],[s*.20,1.48],[s*.11,1.27],[s*.05,1.40]],depth+.006);
   for(let y=1.23;y>bottom+.08;y-=.13)ellipsoid(g,button,s*.076,y,depth+.01,.012,.012,.006);
   patch(g,fabric,[[s*.13,1.15],[s*.24,1.15],[s*.24,1.06],[s*.13,1.06]],depth+.009);
  }
  if(type==='hoodie'){
   const hood=mesh(new T.TorusGeometry(.10,.043,16,32,Math.PI*1.6),fabric,g,0,1.57,-.04);hood.rotation.x=.8;
   patch(g,fabric,[[-.15,1.15],[.15,1.15],[.13,1.02],[-.13,1.02]],depth+.015);
  }
  if(['jacket','bomber'].includes(type))mesh(new T.BoxGeometry(.008,.46,.008),button,g,0,1.25,depth+.01);
  if(reverse)for(const s of [-1,1]){const stripe=mesh(new T.BoxGeometry(.028,.42,.013),mat('#747776'),g,s*.31,1.20,.07);stripe.rotation.z=s*.10;}
  if(type==='vest')for(let y=1.04;y<1.5;y+=.14)patch(g,mat('#d3c7aa'),[[-.19,y],[.10,y+.07],[.18,y+.03],[-.03,y-.03]],depth+.01);
 }
 else if(['straight','wide','balloon','shorts'].includes(type)){
  const w=type==='straight'?.101:type==='balloon'?.148:.133,end=type==='shorts'?.55:.12;
  mesh(loft([[.83,.202,.145],[1.04,.201,.14],[1.075,.193,.137]]),fabric,g);
  for(const s of [-1,1]){mesh(loft([[end,w*(type==='balloon'?.83:1),.10,s*.115],[.53,w*(type==='balloon'?1.12:1),.113,s*.112],[.82,w,.125,s*.105],[.95,.105,.125,s*.098]],36,.009),fabric,g);const seam=mesh(new T.BoxGeometry(.004,.60,.003),mat(m.material==='denim'?'#a9a18e':m.color),g,s*(.112+w),.46,.035);seam.visible=type!=='shorts';}
  ellipsoid(g,button,0,1.04,.146,.012,.012,.005);
 }
 else if(['sneaker','chunky','derby','loafer'].includes(type))for(const s of [-1,1]){
  const chunky=type==='chunky',sx=chunky?.105:.089,sz=chunky?.19:.177;
  ellipsoid(g,trim,s*.12,.045,.066,sx,.042,sz);
  ellipsoid(g,fabric,s*.12,.103,.05,sx*.96,.075,sz*.95);
  if(type!=='loafer')for(let j=0;j<4;j++){const lace=mesh(new T.BoxGeometry(.10,.005,.008),mat(type==='derby'?'#343131':'#c5c1b5'),g,s*.12,.164,.035+j*.024);lace.rotation.y=(j%2?.1:-.1);}
  else mesh(new T.BoxGeometry(.16,.014,.04),trim,g,s*.12,.151,.08);
 }
 else if(type==='cap'){
  const cap=mesh(new T.SphereGeometry(.114,32,16,0,Math.PI*2,0,Math.PI/2),fabric,g,0,1.81,0);cap.scale.y=.7;ellipsoid(g,fabric,0,1.81,.112,.103,.008,.09);
 }
 else if(type==='tote'||type==='backpack'){
  const x=type==='tote'?.43:0,z=type==='tote'?.03:-.24,y=type==='tote'?.66:1.29;
  const bag=ellipsoid(g,fabric,x,y,z,.18,.21,.075);bag.scale.y*=type==='tote'?1:1.2;
  const handle=mesh(new T.TorusGeometry(.115,.012,8,32,Math.PI),fabric,g,x,y+.18,z);handle.scale.y=1.5;
 }
 return g;
}
export function disposeGroup(group){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});group.removeFromParent();}
