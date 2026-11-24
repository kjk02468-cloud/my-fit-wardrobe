import * as T from './vendor/three.module.min.js';

const twoPi = Math.PI * 2;
const blend = (a, b, t) => a + (b - a) * t;
const sq = value => value * value;
const signedPower = (value, exponent) => Math.sign(value) * Math.pow(Math.abs(value), exponent);

function material(color, role, roughness, metalness = 0) {
  const result = new T.MeshStandardMaterial({ color, roughness, metalness, vertexColors: true, side: T.DoubleSide });
  result.name = role;
  return result;
}

function addMesh(group, geometry, surface, region = 'body') {
  const item = new T.Mesh(geometry, surface);
  item.name = region;
  item.castShadow = true;
  item.receiveShadow = true;
  group.add(item);
  return item;
}

// Curved garment panels share continuous edge samples. The open front is an
// actual opening, with both facing edges separate from the inner layer.
function panel(rows, columns, sample, omit, reverse = false) {
  const position = [], uv = [], colors = [], indices = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns, v = row / rows;
      const [x, y, z, tone = 1] = sample(u, v);
      position.push(x, y, z);
      uv.push(u, v);
      colors.push(tone, tone, tone);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (omit?.((column + .5) / columns, (row + .5) / rows)) continue;
      const a = row * (columns + 1) + column, b = a + columns + 1;
      if (reverse) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function detailPanel(group, rows, columns, sample, omit, reverse = false) {
  if (group.userData.display) {
    rows = Math.max(3, Math.round(rows * .44));
    columns = Math.max(4, Math.round(columns * .50));
  }
  return panel(rows, columns, sample, omit, reverse);
}

function interpolate(profile, t) {
  const p = t * (profile.length - 1);
  const i = Math.min(Math.floor(p), profile.length - 2), u = p - i;
  return profile[i].map((a, k) => {
    const b = profile[i + 1][k];
    const previous = profile[Math.max(i - 1, 0)][k];
    const next = profile[Math.min(i + 2, profile.length - 1)][k];
    return blend(a, b, u) + .5 * u * (1 - u) * ((1 - u) * (b + previous * -1 - 2 * (b - a)) - u * (next - a - 2 * (b - a)));
  });
}

function cord(group, points, radius, surface, region = 'body', sides = 6) {
  const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
  const simple = group.userData.display;
  const geometry = new T.TubeGeometry(curve, Math.max(5, points.length * (simple ? 1 : 2)), radius, simple ? 4 : sides, false);
  geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
  return addMesh(group, geometry, surface, region);
}

function outline(group, sample, radius, surface, region, span = [0, 1]) {
  const points = Array.from({ length: 13 }, (_, i) => sample(blend(...span, i / 12)).slice(0, 3));
  return cord(group, points, radius, surface, region);
}

function sphere(group, center, scale, surface, region) {
  const geometry = new T.SphereGeometry(1, group.userData.display ? 8 : 16, group.userData.display ? 6 : 10);
  geometry.scale(...scale);
  geometry.translate(...center);
  geometry.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
  return addMesh(group, geometry, surface, region);
}

function shellSampler(profile, open, fold, box = .86) {
  return (u, v) => {
    const [y, width, depth, centerZ, opening] = interpolate(profile, v);
    const gap = open ? Math.max(.001, opening) : 0;
    const angle = gap + u * (twoPi - 2 * gap);
    const foldX = Math.sin(angle * 7 + v * 4.8) * Math.sin(v * Math.PI) * .55;
    const drape = fold * (foldX + .4 * Math.sin(angle * 12 - v * 9) * sq(1 - v))
      + .004 * Math.sin(angle * 3 + .25) * Math.sin(v * Math.PI);
    const x = (width + drape) * signedPower(Math.sin(angle), box);
    const z = centerZ + (depth + drape) * signedPower(Math.cos(angle), .95);
    const shade = .95 + foldX * .065 + .018 * Math.sin(v * 15 - angle * 5);
    return [x, y + (1 - v) ** 6 * .012 * Math.sin(angle * 2 + .2), z, shade];
  };
}

function topProfile(type) {
  const long = type === 'coat';
  const outer = ['coat', 'blazer', 'jacket', 'bomber'].includes(type);
  const size = outer ? 1.065 : ['tee', 'longtee'].includes(type) ? .94 : .995;
  const bottom = long ? .48 : type === 'blazer' ? .88 : type === 'bomber' ? 1.045 : type === 'hoodie' ? .97 : 1.01;
  const lowerWidth = long ? .251 : type === 'bomber' ? .192 : .194;
  const lowDepth = long ? .145 : .127;
  const upperGap = type === 'shirt' ? .28 : .67;
  const collar = outer ? .082 : .079;
  return [
    [bottom, lowerWidth * size, lowDepth * size, .027, .16],
    [blend(bottom, 1.18, .30), (lowerWidth - .005) * size, (lowDepth + .005) * size, .029, .16],
    [blend(bottom, 1.27, .65), (long ? .238 : .198) * size, (lowDepth + .002) * size, .029, .12],
    [1.275, .207 * size, .135 * size, .029, .14],
    [1.38, .225 * size, .137 * size, .022, .23],
    [1.457, .210 * size, .111 * size, .015, upperGap * .7],
    [1.486, .184 * size, .093 * size, .016, upperGap * .93],
    [1.511, .128 * size, .075 * size, .023, upperGap],
    [1.529, collar, .066, .034, upperGap * .95],
  ];
}

function sleeve(group, sign, type, fabric, seam, facing, reverse) {
  const outer = ['coat', 'blazer', 'jacket', 'bomber'].includes(type);
  const short = type === 'tee';
  const light = ['tee', 'longtee', 'shirt'].includes(type);
  const size = outer ? 1.07 : light ? .98 : 1.015;
  const end = short ? 1.273 : outer ? .911 : type === 'shirt' ? .937 : .948;
  const sections = [[1.485,.177,.020,.019,.049],[1.468,.187,.020,.041,.065],
    [1.426,.205,.021,.057,.069],[1.359,.219,.021,.065,.070],[1.284,.230,.023,.062,.065]];
  if (!short) sections.push([1.191,.241,.026,.058,.059],[1.115,.250,.030,.052,.054],[1.018,.261,.033,.046,.047]);
  const cuffWidth = short ? .060 : outer ? .046 : .033;
  const cuffDepth = short ? .061 : outer ? .051 : .040;
  sections.push([end,short ? .232 : .271,.036,cuffWidth,cuffDepth]);
  const side = sign > 0 ? 'L' : 'R';
  const region = `sleeve${side}`;
  const sample = (u, v) => {
    const [y, centerX, centerZ, width, depth] = interpolate(sections, v);
    const theta = u * twoPi;
    const fold = .0032 * Math.sin(theta * 4 + 17 * v) * Math.sin(v * 5)
      + .0038 * Math.sin(theta * 3 - v * 10) * (1 - v)
      + .005 * Math.exp(-sq((v - .61) / .14)) * Math.sin(41 * v - theta * 2.1);
    const x = centerX + Math.cos(theta) * (width * size + fold);
    return [sign * x, y + .012 * Math.cos(theta), centerZ + Math.sin(theta) * (depth * size + fold), .92 + .05 * Math.sin(theta * 2 + 12 * v)];
  };
  addMesh(group, detailPanel(group, short ? 18 : 32, 32, sample, null, sign < 0), fabric, region);
  outline(group, u => sample(u, .98), .0017, seam, region);
  if (['knit','bomber','hoodie','shirt'].includes(type)) {
    const cuff = (u, v) => {
      const [x, y, z, shade] = sample(u, blend(.93, 1, v));
      return [x + .0025 * Math.cos(twoPi * u) * sign, y, z + .0025 * Math.sin(twoPi * u), shade - .08];
    };
    addMesh(group, detailPanel(group, 5, 32, cuff, null, sign < 0), facing, region);
  }
  if (reverse) {
    const stripe = (u, v) => {
      const [x, y, z] = sample(blend(.22,.275,u), blend(.16,.83,v));
      return [x + sign * .0008, y, z + .002, .92];
    };
    addMesh(group, detailPanel(group, 24, 4, stripe, null, sign < 0), material('#898881','reflective piping',.46,.12), region);
  }
}

function facePanel(group, left, right, surface, region = 'body') {
  return addMesh(group, detailPanel(group, 13, 10, (u, v) => {
    const a = interpolate(left, v), b = interpolate(right, v);
    return [blend(a[0],b[0],u),blend(a[1],b[1],u),blend(a[2],b[2],u) + .006 * Math.sin(u * Math.PI), .89 + .10 * Math.sin(u * Math.PI)];
  }, null, left[0][0] > right[0][0]), surface, region);
}

function tailoredTop(group, type, fabric, seam, facing, hardware, reverse) {
  const isCoat = type === 'coat' || type === 'blazer';
  const open = isCoat || (type === 'jacket' && !reverse) || type === 'shirt';
  const profile = topProfile(type);
  if (type === 'shirt') for (let row = 0; row < 5; row++) profile[row][4] = .026;
  if (type === 'jacket') for (const row of profile) row[4] *= .48;
  const sample = shellSampler(profile, open, isCoat ? .007 : .005);
  addMesh(group, detailPanel(group, 48, 64, sample), fabric);
  outline(group, u => sample(u, .012), .0015, seam, 'body');
  if (type !== 'vest') for (const sign of [-1,1]) sleeve(group, sign, type, fabric, seam, facing, reverse);

  const collarBottom = type === 'tee' ? .955 : .97;
  const collarSample = (u, v) => {
    const [x,y,z,shade] = sample(u, blend(collarBottom,1,v));
    return [x * 1.026, y + .003, z + .002 * Math.cos(u * twoPi), shade - .065];
  };
  addMesh(group, detailPanel(group, 8, 52, collarSample), facing);
  if (isCoat || type === 'shirt') {
    for (const sign of [-1, 1]) {
      if (isCoat) {
        facePanel(group, [[sign*.035,1.205,.181],[sign*.056,1.357,.175],[sign*.070,1.463,.133],[sign*.061,1.521,.100]],
          [[sign*.042,1.205,.181],[sign*.128,1.410,.159],[sign*.146,1.463,.135],[sign*.072,1.531,.093]], fabric);
        facePanel(group, [[sign*.076,1.522,.091],[sign*.111,1.494,.124]], [[sign*.109,1.510,.092],[sign*.141,1.476,.127]], facing);
        const pocketY = type === 'coat' ? 1.039 : 1.057;
        facePanel(group, [[sign*.124,pocketY-.045,.144],[sign*.122,pocketY,.144]], [[sign*.204,pocketY-.030,.095],[sign*.202,pocketY+.012,.097]], fabric);
        cord(group, [[sign*.122,pocketY,.146],[sign*.166,pocketY+.006,.128],[sign*.202,pocketY+.012,.100]], .0022, seam);
      } else {
        facePanel(group, [[sign*.048,1.509,.095],[sign*.023,1.448,.132]], [[sign*.086,1.524,.079],[sign*.116,1.484,.106]], facing);
      }
    }
    for (let i = 0; i < (isCoat ? 3 : 6); i++) {
      const y = isCoat ? 1.229 - i * .106 : 1.412 - i * .069;
      sphere(group,[isCoat ? .058 : .009,y,isCoat ? .188 : .171],isCoat ? [.009,.009,.003] : [.004,.004,.002],hardware,'body');
    }
  }
  if (open) for (const edge of [0,1]) outline(group, v => sample(edge, v), .0023, facing, 'body');
  if (['bomber','jacket'].includes(type)) {
    outline(group, v => { const p = sample(0,v);p[2] += .003; return p; },.0019,hardware,'body');
    sphere(group,[0,1.46,.155],[.006,.013,.005],hardware,'body');
  }
  if (type === 'hoodie') {
    const hood = (u,v) => {
      const a = .55 + u * (twoPi - 1.1);
      const r = Math.sin(Math.PI * (.27 + v * .60));
      return [.099 * r * Math.sin(a),1.415 + .143 * v,-.035 + .078 * r * Math.cos(a),.93 + .06 * Math.cos(13*u+8*v)];
    };
    addMesh(group, detailPanel(group, 23,38,hood),fabric);
    for (const s of [-1,1]) cord(group,[[s*.043,1.509,.087],[s*.066,1.426,.145],[s*.059,1.365,.158]],.0025,facing);
    facePanel(group,[[-.123,1.022,.157],[-.090,1.126,.160]],[[.123,1.022,.157],[.090,1.126,.160]],fabric);
  }
}

function trousers(group, type, fabric, seam, facing, hardware) {
  const short = type === 'shorts';
  const wide = type === 'wide' || type === 'balloon' || short;
  const end = short ? .51 : .079;
  const width = wide ? .105 : .079;
  const profile = [[end,width,.070,.115,.014],[blend(end,.52,.28),width+.006,.078,.118,.019],
    [blend(end,.62,.62),width+(type==='balloon'?.019:.011),.090,.116,.026],
    [.705,type === 'balloon' ? .121 : .109,.110,.112,.030],[.813,.108,.123,.104,.024],[.899,.107,.136,.102,.014],
    [.982,.103,.126,.102,.017],[1.052,.093,.115,.096,.025]];
  for (const sign of [-1,1]) {
    const region = sign > 0 ? 'legL' : 'legR';
    const sample = (u,v) => {
      const [y,w,d,cx,cz] = interpolate(profile,v);
      const a = twoPi * u, s = Math.sin(a), c = Math.cos(a);
      const join = T.MathUtils.smoothstep(y,.795,.885);
      const x = sign * blend(cx + w * s, Math.max(s,0) * (w + cx), join);
      const fall = .004 * Math.sin(9*a + 20*v) * (1-v) + .007 * Math.exp(-sq((y-.54)/.09)) * Math.sin(11*a+44*y);
      const crease = !wide ? .009 * Math.exp(-sq(s/.18)) * (1 - join*.85) : 0;
      return [x + sign*fall*s, y + .006 * c * (1-v)**4, cz + (d + fall + crease) * c, .91 + .065 * Math.cos(a*2+v*3) + .025*Math.cos(v*12)];
    };
    addMesh(group,detailPanel(group, 50,44,sample,(u,v)=>u>.5&&interpolate(profile,v)[0]>.886,sign<0),fabric,region);
    outline(group,u=>sample(u,.013),.0017,seam,region);
    outline(group,v=>{const p=sample(.25,v);p[0]+=sign*.0013;return p;},.0015,seam,region,[.035,.96]);
    addMesh(group,detailPanel(group, 8,22,(u,v)=>{const p=sample(u*.5,.935+.065*v);p[0]*=1.011;p[2]+=.002*Math.cos(Math.PI*u);return p;},null,sign<0),facing,region);
  }
  sphere(group,[0,1.035,.145],[.006,.006,.003],hardware,'body');
}

function shoes(group,type,fabric,seam,facing,hardware) {
  const bulky = type === 'chunky';
  const sneaker = bulky || type === 'sneaker';
  const radius = bulky ? .072 : sneaker ? .061 : .057;
  for(const sign of [-1,1]) {
    const region=sign>0?'footL':'footR';
    const sample=(u,v)=>{
      const angle=u*twoPi,s=Math.sin(angle),c=Math.cos(angle);
      const center=sign*.119;
      const toe=c>0?c:0;
      const top=v**1.4;
      const x=center + radius*s*(1-.41*top) + sign*.024*c*(1-.35*top);
      const y=.035+(bulky?.125:.109)*v*(.61+.36*(1-toe));
      const z=blend(.070,.020,top)+c*blend(bulky ? .159 : sneaker ? .151 : .145,.047,top);
      return [x,y,z,.94 + .05*Math.sin(angle*2+v*2)];
    };
    addMesh(group,detailPanel(group, 24,48,sample),fabric,region);
    const sole=(u,v)=>{
      const [x,,z]=sample(u,0);
      const scale=Math.sin(v*Math.PI)*.0027;
      return [x+scale*Math.sin(u*twoPi),.008 + v*(bulky?.040:.030)+.008*Math.max(0,Math.cos(u*twoPi))**5,z+scale*Math.cos(u*twoPi),.90+v*.07];
    };
    addMesh(group,detailPanel(group, 10,48,sole),facing,region);
    outline(group,u=>sole(u,.88),.0019,seam,region);
    outline(group,u=>sample(u,.97),.0023,facing,region);
    if (type!=='loafer') {
      for(let l=0;l<4;l++){
        const z=.059+l*.015,y=.127-l*.014,x=sign*.119;
        cord(group,[[x-.025,y-.002,z-.004],[x-.010,y+.004,z],[x+.010,y+.005,z+.004],[x+.024,y-.002,z+.006]],.0021,hardware,region);
      }
    } else facePanel(group,[[sign*.119-.040,.094,.087],[sign*.119-.033,.111,.071]],[[sign*.119+.038,.094,.087],[sign*.119+.034,.111,.071]],facing,region);
  }
}

function accessory(group,type,fabric,seam,facing) {
  if (type==='cap') {
    const crown = (u,v) => {
      const a=u*twoPi,p=v*Math.PI*.5;
      return [Math.sin(a)*.087*Math.cos(p),1.711+.108*Math.sin(p),.051+Math.cos(a)*.109*Math.cos(p),.94+.045*Math.sin(a*6)];
    };
    addMesh(group,detailPanel(group, 18,38,crown),fabric,'head');
    addMesh(group,detailPanel(group, 8,25,(u,v)=>{const a=blend(-1.04,1.04,u),r=blend(.087,.172,v);return [Math.sin(a)*r,1.71-.018*v-.010*Math.abs(a),.050+Math.cos(a)*(r+.016),.94];}),facing,'head');
    return;
  }
  const backpack=type==='backpack';
  const centerX=backpack?0:.383,centerZ=backpack?-.15:.042,base=backpack?.954:.503;
  const sample=(u,v)=>{
    const a=u*twoPi,w=.145+.022*Math.sin(v*Math.PI),d=.047+.020*Math.sin(v*Math.PI);
    return [centerX+signedPower(Math.sin(a),.49)*w,base+.29*v,centerZ+signedPower(Math.cos(a),.63)*d,.9+.06*Math.cos(a*3+v*6)];
  };
  addMesh(group,detailPanel(group, 26,44,sample),fabric);
  outline(group,u=>sample(u,.97),.0023,seam,'body');
  for(const depth of [-.039,.039]){
    cord(group,[[centerX-.113,base+.23,centerZ+depth],[centerX-.093,base+.366,centerZ+depth],[centerX,base+.424,centerZ+depth],[centerX+.089,base+.359,centerZ+depth],[centerX+.112,base+.231,centerZ+depth]],.010,facing);
  }
}

export function buildGarment(spec, side = '기본', { display = false } = {}) {
  const group = new T.Group();
  group.userData.display = display;
  const type=spec.garmentType;
  const reverse=side==='바람막이 면';
  const isShoe=['sneaker','chunky','derby','loafer'].includes(type);
  const leather=(spec.material==='leather'||(isShoe&&['derby','loafer'].includes(type)));
  const color=new T.Color(reverse?'#25282a':spec.color);
  const fabric=material(color,'fabric',leather?.54:reverse?.70:.91);
  const seam=material(color.clone().multiplyScalar(spec.material==='denim'?1.18:.70),'seam',.89);
  const facing=material(isShoe?(type==='sneaker'?'#a6a291':'#272321'):color.clone().multiplyScalar(.80),'facing',leather?.65:.91);
  const hardware=material(type==='sneaker'?'#c7c4b5':isShoe?'#31271f':spec.material==='denim'?'#877764':'#3e342c','hardware',.56,spec.material==='denim'?.35:.10);
  if(['straight','wide','balloon','shorts'].includes(type)) trousers(group,type,fabric,seam,facing,hardware);
  else if(isShoe) shoes(group,type,fabric,seam,facing,hardware);
  else if(['cap','backpack','tote'].includes(type)) accessory(group,type,fabric,seam,facing);
  else tailoredTop(group,type,fabric,seam,facing,hardware,reverse);
  return group;
}
