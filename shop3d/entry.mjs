let app,loading=false;
const root=document.getElementById('shop-page');
async function route(){
 const active=(!location.hash||location.hash==='#shop');
 if(!active){app?.deactivate();return;}
 if(!window.MyFitBridge||loading)return;
 if(app){app.activate();return;}
 loading=true;
 try{const {mountShop}=await import('./shop.mjs');app=await mountShop(root,window.MyFitBridge);if(!location.hash||location.hash==='#shop')app.activate();}
 catch(error){console.error('3D store unavailable',error);root.innerHTML='<div class="shop-fallback"><h1>일반 옷장에서 계속할 수 있어요.</h1><p>3D 화면을 불러오지 못했어요. WebGL 지원과 로컬 파일을 확인해주세요.</p><a href="#closet">일반 2D 옷장</a><button onclick="location.reload()">3D 다시 불러오기</button></div>';}
 finally{loading=false;}
}
window.addEventListener('myfit-ready',route);window.addEventListener('myfit-route',route);route();
