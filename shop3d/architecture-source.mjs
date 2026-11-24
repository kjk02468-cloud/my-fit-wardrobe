import * as T from './vendor/three.module.min.js';
import {toWorld} from './layout.mjs';

// Asset authoring coordinates use metres. Layout-derived anchors pass through
// toWorld once. Geometry functions operate in the resulting Three.js axes.
export const surfaces = {
  limestone: [0xe3d8c7, .79, .02], oak: [0xa17a5c, .55, .01],
  walnut: [0x805a3d, .53, .015], plaster: [0xddd3c0, .88, 0],
  bronze: [0x9e764f, .33, .73], olive: [0x555a3e, .49, 0],
  ceiling: [0xdad5c7, .92, 0], pavement: [0xb8b5ac, .89, 0],
  track: [0x292824, .49, .35], frame: [0x584834, .40, .60],
  glow: [0xffd49d, .39, 0, .72], softbox: [0xf9e9d0, .67, 0, .26],
  glass: [0xc7d2ca, .14, .13, 0, .13], smoked: [0xc38e52, .23, .21, 0, .79],
  mirror: [0xe2d9c3, .105, .94], whiteWool: [0xd5c8ad, .88, 0],
  fogWool: [0x879694, .85, 0], oliveWool: [0x6b7259, .89, 0],
  navyWool: [0x4c555c, .85, 0], linen: [0xc6b89f, .95, 0],
  ceramic: [0xa6977e, .66, .02], branch: [0x655441, .84, 0],
  leaves: [0x757659, .86, 0], book: [0x484840, .67, 0], pages: [0xdfd2b7, .88, 0],
};

const material = Object.fromEntries(Object.entries(surfaces).map(([name, spec]) => {
  const [color, roughness, metalness, emission=0, opacity=1] = spec;
  const result = new T.MeshStandardMaterial({color, roughness, metalness, opacity,
    emissive: emission ? new T.Color(color).multiplyScalar(emission) : 0,
    transparent: opacity < 1, depthWrite: opacity >= 1});
  result.name = name;
  return [name, result];
}));

function group(parent, name, position=[0,0,0]) {
  const g = new T.Group(); g.name = name; g.position.set(...position);
  parent?.add(g);
  return g;
}

function mesh(parent, geometry, finish, position=[0,0,0], rotation=[0,0,0]) {
  const m = new T.Mesh(geometry, material[finish]);
  m.position.set(...position); m.rotation.set(...rotation);
  parent.add(m);
  return m;
}

function box(parent, finish, x,y,z, w,h,d) {
  const geo = new T.BoxGeometry(w,h,d);
  const uv = geo.attributes.uv;
  // BoxGeometry presents these six faces in +/-X, +/-Y, +/-Z order.
  [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]].forEach(([a,b],face) => {
    for (let i=face*4;i<face*4+4;i++) uv.setXY(i,uv.getX(i)*a,uv.getY(i)*b);
  });
  return mesh(parent,geo,finish,[x,y,z]);
}

function beam(parent, finish, start, end, radius, segments=10) {
  const from=new T.Vector3(...start), to=new T.Vector3(...end);
  const direction=to.clone().sub(from);
  const cylinder=new T.CylinderGeometry(radius,radius,direction.length(),segments);
  const obj=mesh(parent,cylinder,finish,from.lerp(to,.5).toArray());
  obj.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());
  return obj;
}

function flatPath(points) {
  const shape = new T.Shape();
  points.forEach(([x,y],i)=> i ? shape.lineTo(x,y) : shape.moveTo(x,y));
  shape.closePath();
  return shape;
}

function extrusion(parent, finish, points, depth, position, bevel=0) {
  return mesh(parent,new T.ExtrudeGeometry(flatPath(points),{
    depth, bevelEnabled:Boolean(bevel), bevelSegments:2,
    bevelSize:bevel, bevelThickness:bevel, steps:1,
  }),finish,position);
}

function arc(radius, cx, cy, a=0, b=Math.PI, steps=36) {
  return Array.from({length:steps+1},(_,i)=>{
    const t=a+(b-a)*i/steps;
    return [cx+Math.cos(t)*radius,cy+Math.sin(t)*radius];
  });
}

function portalTrim(parent, finish, x, z, radius, spring, width, depth) {
  const outside=arc(radius+width,x,spring);
  const inside=arc(radius,x,spring,Math.PI,0);
  extrusion(parent,finish,[...outside,...inside],depth,[0,0,z]);
  for(const sign of [-1,1]) {
    box(parent,finish,x+sign*(radius+width/2),spring/2,z+depth/2,width,spring,depth);
  }
}

function profile(parent, finish, x, y, z, width, depth, contour, segments=56) {
  // A lathed bevel profile is scaled into an ellipse. Its UVs retain a
  // continuous metre-scale grain along the curved furniture surface.
  const g = new T.LatheGeometry(contour.map(([r,h])=>new T.Vector2(r,h)),segments);
  g.scale(width/2,1,depth/2);
  const {uv,position,normal}=g.attributes;
  for(let i=0;i<uv.count;i++) {
    if(Math.abs(normal.getY(i))>.76) {
      uv.setXY(i,position.getX(i)+width/2,position.getZ(i)+depth/2);
    } else {
      uv.setXY(i,uv.getX(i)*Math.PI*(width+depth)/2,position.getY(i));
    }
  }
  return mesh(parent,g,finish,[x,y,z]);
}

function padded(parent,finish,x,y,z,w,h,d,r=.024) {
  const shape = new T.Shape();
  const a=w/2-r, b=d/2-r, c=Math.min(r, a*.9,b*.9);
  shape.moveTo(-a+c,-b);
  shape.lineTo(a-c,-b); shape.quadraticCurveTo(a,-b,a,-b+c);
  shape.lineTo(a,b-c); shape.quadraticCurveTo(a,b,a-c,b);
  shape.lineTo(-a+c,b); shape.quadraticCurveTo(-a,b,-a,b-c);
  shape.lineTo(-a,-b+c); shape.quadraticCurveTo(-a,-b,-a+c,-b);
  const geom = new T.ExtrudeGeometry(shape,{depth:Math.max(.004,h-2*r),steps:1,
    bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:2,curveSegments:3});
  geom.rotateX(-Math.PI/2); geom.translate(0,r,0);
  return mesh(parent,geom,finish,[x,y,z]);
}

function foldedStack(parent,x,y,z,w,d,index,quantity=3,turn=0) {
  const stack=group(parent,'folded-knit',[x,y,z]); stack.rotation.y=turn;
  const cloth=['whiteWool','fogWool','oliveWool','navyWool'];
  for(let i=0;i<quantity;i++) {
    const color=cloth[(index+i)%cloth.length];
    padded(stack,color,i*.012,i*.052,0,w-i*.013,.044,d-i*.012,.013);
    padded(stack,color,i*.012+.032,i*.052+.01,d*.24,w*.77,.029,d*.51,.01);
  }
  // The top piece has a shallow rolled neckline and a softer cuff fold.
  const last=quantity-1, collar=cloth[(index+last)%cloth.length];
  const neckline=mesh(stack,new T.TorusGeometry(Math.min(.058,w*.22),.007,6,20,Math.PI*1.53),collar,
    [last*.012-.036,last*.052+.044,-d*.104],[-Math.PI/2,0,-.71]);
  neckline.scale.set(1,.66,1);
  padded(stack,collar,.105,last*.052+.037,d*.088,w*.38,.018,d*.25,.007);
}

function chair(parent,x,z,turn) {
  const seat=group(parent,'olive leather chair',[x,0,z]); seat.rotation.y=turn;
  padded(seat,'olive',0,.39,0,.66,.17,.61,.042);
  const back=padded(seat,'olive',0,.49,-.265,.71,.46,.13,.037);
  back.rotation.x=.13;
  for(const s of [-1,1]) {
    padded(seat,'olive',s*.315,.45,-.015,.13,.27,.61,.038);
    for(const q of [-1,1]) beam(seat,'walnut',[s*.26,.43,q*.235],[s*.29,.02,q*.266],.025);
  }
}

function mirror(parent,x,z,y0=.23,w=1.76,h=2.69) {
  const lamp=.034;
  box(parent,'frame',x,y0+h/2,z-.028,w+.15,h+.15,.06);
  box(parent,'mirror',x,y0+h/2,z,w,h,.027);
  for(const s of [-1,1]) {
    box(parent,'glow',x+s*(w/2+.042),y0+h/2,z-.009,lamp,h+.1,.02);
    box(parent,'glow',x,y0+h/2+s*(h/2+.042),z-.009,w+.09,lamp,.02);
  }
}

function branchVase(parent,x,y,z,scale=1) {
  const g=group(parent,'seasonal branches',[x,y,z]);g.scale.setScalar(scale);
  profile(g,'ceramic',0,0,0,.35,.33,[[0,0],[.81,0],[.94,.06],[1,.25],[.82,.49],[.43,.62],[.44,.68],[.40,.69],[.37,.64],[0,.62]],26);
  const stemTips=[[-.25,1.49,.09],[.12,1.58,-.04],[.38,1.32,.08],[.02,1.73,.12],[-.34,1.15,-.07]];
  stemTips.forEach((end,index)=>{
    const bend=[end[0]*.42,(end[1]+.69)/2,end[2]*.38];
    beam(g,'branch',[0,.56,0],bend,.007,5);
    beam(g,'branch',bend,end,.005,5);
    for(let i=1;i<6;i++) {
      const p=bend.map((n,j)=>n+(end[j]-n)*i/6);
      const tip=[p[0]+(i%2?-1:1)*(.09+i*.006),p[1]+.08,p[2]+(index%2?-.07:.07)];
      beam(g,'branch',p,tip,.003,5);
      const leaf=mesh(g,new T.SphereGeometry(.038,7,4),'leaves',tip,[0,index*.7,i*.85]);
      leaf.scale.set(1.25,.32,.70);
    }
  });
}

function lightTrack(parent,x,y,north,start=-2,spacing=1.8) {
  const length=north;
  box(parent,'track',x,y,-length/2,.09,.034,length);
  for(let z=start; z > -length+.45;z-=spacing){
    box(parent,'track',x,y-.036,z,.083,.072,.12);
    const housing=group(parent,'track luminaire',[x,y-.098,z]);
    housing.rotation.z=x>0?-.32:.32;
    mesh(housing,new T.CylinderGeometry(.045,.057,.12,12),'track');
    mesh(housing,new T.CylinderGeometry(.046,.046,.006,12),'glow',[0,-.062,0]);
  }
}

function makeFacade() {
  const root=group(null,'mf_facade');
  // Thin planes of civic masonry around two display openings and the arched door.
  box(root,'limestone',0,3.72,.13,12.75,.60,.50);
  box(root,'limestone',0,4.05,.19,12.9,.096,.64);
  box(root,'limestone',0,4.13,.22,13.02,.056,.72);
  box(root,'limestone',0,4.245,.13,12.7,.175,.50);
  for (const s of [-1,1]) {
    const x=s*3.72;
    box(root,'limestone',x,.28,.13,3.72,.56,.50);
    box(root,'limestone',x,3.20,.13,3.72,.37,.50);
    box(root,'limestone',s*1.72,1.72,.13,.43,3.45,.50);
    box(root,'limestone',s*5.91,1.72,.13,1.05,3.45,.50);
    box(root,'glass',x,1.80,.12,3.52,2.49,.018);
    for (const y of [.54,3.063]) {
      box(root,'bronze',x,y,.38,3.65,.055,.08);
      box(root,'limestone',x,y+(y<1?-.047:.047),.405,3.78,.07,.12);
    }
    for(const edge of [-1,1]) {
      box(root,'bronze',x+edge*1.80,1.80,.38,.061,2.52,.078);
      box(root,'limestone',x+edge*1.88,1.80,.395,.075,2.60,.088);
    }
    box(root,'limestone',s*3.79,.29,-.66,2.90,.54,.99);
    foldedStack(root,s*3.56,.57,-.67,.46,.32,s>0?0:2,3,.1);
  }
  branchVase(root,-4.82,.56,-.63,.95);
  const crown=arc(1.485,0,1.79);
  extrusion(root,'limestone',[...crown,[-1.485,3.44],[1.485,3.44]],.49,[0,0,-.12]);
  portalTrim(root,'frame',0,.375,1.445,1.79,.081,.054);
  portalTrim(root,'bronze',0,.434,1.445,1.79,.028,.041);
  portalTrim(root,'bronze',0,-.071,1.455,1.79,.034,.037);
  for(const side of [-1,1]) {
    const g=group(root,side<0?'door-left':'door-right',[side*1.437,0,.10]);
    const low=side<0 ? Math.PI/2 : 0, high=side<0 ? Math.PI : Math.PI/2;
    const top=arc(1.422,-side*1.437,1.79,low,high,20);
    const inner=-side*1.427;
    const glassPolygon=[...top, ...(side<0?[[side*.002,.027],[inner,.027]]:[[inner,.027],[0,.027]])];
    extrusion(g,'glass',glassPolygon,.012,[0,0,0]);
    for(let i=1;i<top.length;i++) beam(g,'bronze',[...top[i-1],.016],[...top[i],.016],.013,7);
    for(const [dx,height] of [[0,1.79],[inner,3.209]]) {
      box(g,'bronze',dx,height/2,.016,.031,height,.035);
    }
    box(g,'bronze',inner/2,.039,.017,Math.abs(inner),.050,.05);
    for(const face of [-1,1]) {
      beam(g,'bronze',[inner*.916,.75,face*.077],[inner*.916,1.36,face*.077],.017,10);
      for(const y of [.79,1.32]) beam(g,'bronze',[inner*.916,y,0],[inner*.916,y,face*.077],.013,8);
    }
  }
  box(root,'bronze',0,.015,.067,2.88,.021,.28);
  box(root,'pavement',0,-.086,7.65,38,.17,15.3);
  for(let x=-16;x<=16;x+=2) box(root,'limestone',x,-.001,6.5,.014,.007,13.1);
  for(let z=1.3;z<=15.3;z+=1.3) box(root,'limestone',0,-.001,z,34,.007,.017);
  box(root,'frame',0,-.11,11.94,37,.18,.18);
  return root;
}

const westBays=[2.62,6.28,9.94];
export const garmentAnchors={
  hanging:westBays.flatMap(north=>[-.91,-.55,-.18,.18,.55,.91].map((offset,index)=>({
    position:toWorld([-5.37,north+offset,.29]), top:2.085, rotationY:Math.PI/2+(index-2.5)*.026, scale:.95,
  }))),
  shoes:[-.58,.58].map((x,index)=>({position:toWorld([x,10.72,.657]),ground:.657,rotationY:index?.26:-.26,scale:.99})),
};

function showRack(parent,north) {
  const z=-north, x=-5.54;
  box(parent,'walnut',x-.30,1.53,z,.085,2.97,3.26);
  for(const s of [-1,1]) {
    box(parent,'walnut',x,1.52,z+s*1.62,.72,3.0,.093);
    box(parent,'bronze',x+.369,1.56,z+s*1.62,.027,2.99,.046);
  }
  box(parent,'walnut',x,2.98,z,.72,.125,3.31);
  box(parent,'walnut',x,.22,z,.72,.41,3.30);
  box(parent,'bronze',x+.369,.411,z,.022,.041,3.28);
  box(parent,'glow',x+.185,2.908,z,.05,.013,3.09);
  beam(parent,'bronze',[x+.19,2.247,z-1.58],[x+.19,2.247,z+1.58],.017,12);
  for(const dz of [-.93,-.57,-.19,.19,.57,.93]) {
    const h=group(parent,'walnut hanger',[x+.19,2.248,z+dz]);
    h.rotation.y=Math.PI/2;
    beam(h,'bronze',[0,-.09,0],[0,.016,0],.006,7);
    for(const s of [-1,1]) beam(h,'walnut',[0,-.093,0],[s*.167,-.172,0],.017,9);
  }
}

function shelving(parent,north,length,fragrance=false) {
  const x=5.65,z=-north;
  box(parent,'walnut',5.883,1.59,z,.079,2.94,length);
  for(const end of [-1,1]) box(parent,'walnut',x,1.60,z+end*(length/2),.56,3.00,.080);
  if(!fragrance) box(parent,'walnut',x,1.60,z,.54,3.0,.069);
  for(const [index,y] of [.32,.82,1.33,1.84,2.35,2.91].entries()) {
    box(parent,'walnut',x,y,z,.58,.078,length);
    box(parent,'bronze',x-.303,y-.006,z,.017,.025,length);
    if(index>0) box(parent,'glow',x-.12,y-.045,z,.036,.012,length-.21);
    if(!fragrance && index<5) for(let i=0;i<6;i++) {
      const p=z+length*(i-2.5)/6;
      foldedStack(parent,x-.018,y+.041,p,.28,.42,index+i,2+(i%2),(i%3-1)*.045);
    }
  }
}

function makeShell() {
  const root=group(null,'mf_store_shell');
  box(group(root,'baked-floor'),'oak',0,-.071,-9.5,12,.14,19);
  const envelope=group(root,'cutaway-envelope');
  box(envelope,'plaster',-6.12,1.90,-6.50,.24,3.8,13);
  box(group(root,'fitting-occlusion'),'plaster',-6.12,1.90,-16,.24,3.8,6);
  box(envelope,'plaster',6.12,1.90,-9.50,.24,3.8,19);
  box(envelope,'plaster',0,1.90,-19.12,12.5,3.8,.24);
  group(root,'cutaway-ceiling');
  const ceiling=root.getObjectByName('cutaway-ceiling');
  box(ceiling,'ceiling',0,3.83,-9.50,12.25,.062,19.20);
  for(const x of [-3.54,3.54]) lightTrack(ceiling,x,3.747,12.45);
  for(const x of [-5.97,5.97]) box(root,'walnut',x,.068,-6.5,.067,.134,13);
  for(const [start,end] of [[-6,-4.7],[-3.3,-.70],[.70,3.30],[4.70,6]]) {
    const wall = group(root,'rear-portal-wall');
    box(wall,'walnut',(start+end)/2,1.9,-13,end-start,3.8,.15);
    for(let x=start+.13;x<end-.04;x+=.164) box(wall,'frame',x,1.9,-12.918,.009,3.78,.012);
  }
  for(const [index,x] of [-4,0,4].entries()) {
    const g=group(root,`zone__${['fitting','concierge','ootd'][index]}`);
    box(g,'walnut',x,3.25,-13,1.40,1.10,.15);
    box(g,'walnut',x,2.696,-12.881,1.62,.097,.201);
    box(g,'bronze',x,2.647,-12.971,1.39,.014,.12);
    for(const s of [-1,1]) {
      box(g,'walnut',x+s*.759,1.349,-12.883,.104,2.67,.201);
      box(g,'frame',x+s*.704,1.349,-12.996,.013,2.67,.082);
    }
  }
  for (const x of [-2,2]) box(group(root,x<0?'fitting-occlusion':'rear-wall'), 'plaster',x,1.9,-16,.14,3.8,6);
  for(const x of [-6,6]) box(root,'walnut',x,2.76,-13,.084,2.05,.29);
  const [x,,z]=toWorld([0,6.4,0]);
  profile(root,'bronze',x,.011,z,2.33,4.29,[[0,0],[.96,0],[1,.025],[1,.071],[0,.071]]);
  profile(root,'walnut',x,.072,z,2.38,4.37,[[0,0],[.93,0],[.96,.033],[1,.14],[1,.66],[.987,.727],[0,.727]]);
  profile(root,'bronze',x,.793,z,2.47,4.47,[[0,0],[.989,0],[1,.018],[1,.029],[0,.029]]);
  profile(root,'walnut',x,.821,z,2.5,4.5,[[0,0],[.985,0],[1,.018],[1,.035],[.989,.05],[0,.05]],72);
  for(const [i,[sx,sz]] of [[-.54,-.65],[.54,-.60],[-.57,.07],[.57,.12],[-.47,.81],[.49,.85]].entries()) {
    foldedStack(root,sx,.873,z+sz,.44,.37,i, i%2?2:3,i%2?.03:-.04);
  }
  branchVase(root,-.03,.874,z-.05,.49);
  padded(root,'olive',.008,.875,z+.63,.31,.035,.47,.012);
  for(const s of [-1,1]) {
    box(root,'bronze',s*.157,.906,z+.63,.015,.047,.466);
    box(root,'bronze',0,.906,z+.63+s*.235,.32,.047,.015);
  }
  const belt=mesh(root,new T.TorusGeometry(.105,.011,9,32),'olive',[0,.918,z+.63],[-Math.PI/2,0,0]);
  belt.scale.x=.84;
  box(root,'bronze',.012,.93,z+.725,.065,.02,.045);
  const [px,,pz]=toWorld([0,10.75,0]);
  padded(root,'limestone',px,.007,pz,1.60,.643,.84,.023);
  for(const north of westBays) showRack(root,north);
  shelving(root,4.61,4.59,false);
  shelving(root,10.22,3.44,true);
  return root;
}

function makeFitting() {
  const root=group(null,'mf_room_fitting');
  const roomFloor = padded(root,'linen',-4,.002,-16.07,3.76,.019,5.68,.006);
  roomFloor.name='fitting rug';
  const side=group(root,'fitting-occlusion');
  for(const x of [-5.926,-2.075]) {
    box(side,'walnut',x,.55,-16.06,.066,1.05,5.9);
    box(side,'bronze',x,1.089,-16.06,.066,.026,5.9);
  }
  const [mx,,mz]=toWorld([-4,18.81,0]);
  box(root,'walnut',-4,.56,-18.979,3.83,1.08,.057);
  mirror(root,mx,mz);
  const [bx,,bz]=toWorld([-5.52,16.64,0]);
  padded(side,'olive',bx,.419,bz,.56,.145,1.94,.036);
  for(const dx of [-.218,.218]) for(const dz of [-.81,.81]) beam(side,'bronze',[bx+dx,.44,bz+dz],[bx+dx*.98,.026,bz+dz],.018);
  const [rx,,rz]=toWorld([-2.53,17.06,0]);
  beam(side,'bronze',[rx,1.98,rz-.89],[rx,1.98,rz+.89],.018,12);
  for(const s of [-1,1]) beam(side,'bronze',[rx,1.98,rz+s*.89],[-2.09,1.98,rz+s*.89],.013,10);
  for(const s of [-1,1]) {
    const curtain=group(side,'linen curtain',[-4+s*.92,0,-13.27]);
    for(let j=0;j<14;j++) {
      const dx=(j-6.5)*.036;
      mesh(curtain,new T.CylinderGeometry(.032+(j%3)*.005,.040+(j%3)*.005,2.59,8),'linen',[dx,1.32,Math.sin(j*1.17)*.027]);
    }
  }
  box(root,'track',-4,3.67,-16.07,.065,.02,4.63);
  for(const z of [-14.45,-15.93,-17.85]) mesh(root,new T.CylinderGeometry(.057,.052,.04,14),'glow',[-4,3.64,z]);
  return root;
}

function makeConsult() {
  const root=group(null,'mf_room_consult');
  padded(root,'linen',0,.002,-16.19,3.68,.019,5.02,.006);
  const [tx,,tz]=toWorld([0,16.04,0]);
  profile(root,'walnut',tx,.015,tz,1.42,.66,[[0,0],[.87,0],[1,.04],[1,.65],[.95,.701],[0,.701]]);
  profile(root,'walnut',tx,.716,tz,2.15,1.24,[[0,0],[.987,0],[1,.021],[.986,.05],[0,.05]]);
  for(const s of [-1,1]) chair(root,tx+s*.92,tz+.97,s*-.35);
  chair(root,tx,tz-.94,Math.PI);
  const lamp=group(root,'brass table lamp',[tx-.57,.767,tz-.10]);
  profile(lamp,'ceramic',0,0,0,.145,.145,[[0,0],[.89,0],[1,.04],[.96,.36],[.68,.39],[0,.39]],20);
  profile(lamp,'bronze',0,.31,0,.49,.49,[[0,.17],[.22,.16],[.57,.131],[.89,.071],[1,0],[.94,.007],[.80,.06]],28);
  mesh(lamp,new T.SphereGeometry(.069,12,8),'glow',[0,.34,0]);
  for(const x of [.12,.41,.67]) {
    box(root,'book',x,.779,tz+.13,.208,.022,.29);
    box(root,'pages',x,.795,tz+.13,.182,.011,.262);
  }
  box(root,'walnut',.83,.49,-18.55,2.20,.98,.69);
  branchVase(root,.85,.987,-18.55,.72);
  box(root,'frame',-1.98,2.03,-15.84,.067,1.37,1.23);
  box(root,'linen',-1.941,2.03,-15.84,.016,1.28,1.14);
  box(root,'bronze',-1.91,2.80,-15.84,.09,.045,.63);
  box(root,'glow',-1.88,2.774,-15.84,.03,.012,.60);
  for(const y of [1.24,1.80,2.36,2.93]) {
    box(root,'walnut',1.71,y,-17.98,.43,.083,1.78);
    box(root,'glow',1.76,y-.050,-17.98,.032,.012,1.60);
    foldedStack(root,1.67,y+.043,-18.29,.28,.32,2,3);
  }
  return root;
}

function tripod(parent,x,z,height) {
  const center=[x,height*.69,z];
  for(let i=0;i<3;i++) {
    const a=i*Math.PI*2/3;
    beam(parent,'track',center,[x+Math.cos(a)*.42,.032,z+Math.sin(a)*.42],.014,8);
  }
  beam(parent,'track',[x,.21,z],[x,height,z],.022,10);
}

function makeOotd() {
  const root=group(null,'mf_room_ootd');
  const points=[[0,0],[0,2.88],[-.054,2.88],[-.054,.39],[-.11,.24],[-.23,.12],[-.42,.065],[-.66,.049],[-2.52,.041],[-2.52,0]];
  const cove=extrusion(root,'linen',points,3.18,[2.41,0,-18.82]);
  // Rotate around the width axis so the continuous sweep follows north/south.
  cove.rotation.y=Math.PI/2;
  const [px,,pz]=toWorld([4,17.61,0]);
  box(root,'bronze',px,.070,pz,.172,.005,.022);
  box(root,'bronze',px,.071,pz,.022,.005,.17);
  for(const s of [-1,1]) {
    const x=4+s*1.27,z=-17.44;
    tripod(root,x,z,1.88);
    const soft=group(root,'softbox',[x,1.98,z]); soft.rotation.y=s*-.90; soft.rotation.x=.17;
    extrusion(soft,'track',[[-.29,-.45],[.29,-.45],[.40,-.29],[.40,.29],[.29,.45],[-.29,.45],[-.40,.29],[-.40,-.29]],.101,[0,0,-.07],.015);
    extrusion(soft,'softbox',[[-.27,-.41],[.27,-.41],[.36,-.27],[.36,.27],[.27,.41],[-.27,.41],[-.36,.27],[-.36,-.27]],.01,[0,0,.043]);
  }
  tripod(root,4,-14.92,1.41);
  box(root,'track',4,1.45,-14.92,.23,.139,.143);
  const lens=mesh(root,new T.CylinderGeometry(.061,.073,.122,20),'track',[4,1.46,-15.026],[Math.PI/2,0,0]);
  lens.name='studio camera lens';
  mesh(root,new T.CylinderGeometry(.051,.051,.009,16),'glass',[4,1.46,-15.09],[Math.PI/2,0,0]);
  return root;
}

function makeBar() {
  const root=group(null,'mf_fragrance_counter');
  const target=group(root,'zone__fragrance');
  const [x,,z]=toWorld([4.63,10.16,0]);
  profile(target,'bronze',x,.011,z,1.39,3.25,[[0,0],[.967,0],[1,.031],[1,.07],[0,.07]]);
  profile(target,'walnut',x,.075,z,1.43,3.28,[[0,0],[.98,0],[1,.045],[1,.817],[.98,.850],[0,.850]]);
  profile(target,'bronze',x,.921,z,1.475,3.32,[[0,0],[1,0],[1,.022],[0,.022]]);
  profile(target,'limestone',x,.943,z,1.5,3.36,[[0,0],[.983,0],[1,.016],[1,.031],[.983,.047],[0,.047]]);
  return root;
}

function bottle(parent,x,y,z,i,small=false) {
  const width=small?.115:.138, h=small?.125:.154;
  const g=group(parent,small?'display-bottle':`fragrance__${i}`,[x,y,z]);
  const finish = i%4===0 ? 'glass' : 'smoked';
  padded(g,finish,0,0,0,width,h,width*.76,.011);
  box(g,'linen',-.001,h*.47,width*.39,width*.70,h*.32,.005);
  for(const s of [-1,1]) box(g,'bronze',.003,h*.48+s*.011,width*.42,width*.42,.0028,.002);
  mesh(g,new T.CylinderGeometry(.027,.028,.043,14),'track',[0,h+.022,0]);
  mesh(g,new T.CylinderGeometry(.024,.024,.006,14),'bronze',[0,h+.046,0]);
  g.rotation.y=-Math.PI/2 + (i%3-1)*.045;
}

function makeBarProps() {
  const root=group(null,'mf_fragrance_props');
  box(root,'walnut',4.61,.995,-10.16,.415,.023,2.01);
  for(let i=0;i<6;i++) bottle(root,4.57,1.009,-9.32-i*.315,i);
  for(let row=0;row<4;row++) for(let i=0;i<9;i++) {
    bottle(root,5.681,.360+row*.508,-8.855-i*.332,i,true);
  }
  profile(root,'ceramic',4.57,.989,-8.997,.128,.127,[[0,0],[.93,0],[1,.094],[.87,.099],[.83,.028],[0,.02]],20);
  for(let i=0;i<7;i++) {
    const paper=box(root,'linen',4.55+i*.009,1.126,-8.983+i*.005,.013,.174,.006);
    paper.rotation.z=.04+i*.051;
  }
  return root;
}

export const assetBuilders={
  mf_facade:makeFacade, mf_store_shell:makeShell,
  mf_room_fitting:makeFitting, mf_room_consult:makeConsult, mf_room_ootd:makeOotd,
  mf_fragrance_counter:makeBar, mf_fragrance_props:makeBarProps,
};
