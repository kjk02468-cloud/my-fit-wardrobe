/* Finished, jointly lit room photographs. No runtime generation or compositing. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitRoomScenes=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const scenes=[
 {
  "id": "personal",
  "title": "내가 고른 13개 전시",
  "image": "./assets/wardrobe-personal-20261103-v4.webp",
  "slots": [
   {
    "id": "item-20261029-11-balmacaan",
    "view": ""
   },
   {
    "id": "item-20261025-06-ma1",
    "view": ""
   },
   {
    "id": "item-20261102-balenciaga-reversible",
    "view": "AI 보정 · 바람막이 면"
   },
   {
    "id": "item-20261029-18-stucoat",
    "view": ""
   },
   {
    "id": "item-20261103-polo",
    "view": ""
   },
   {
    "id": "item-mvnm5zvx-2egc7m",
    "view": ""
   },
   {
    "id": "item-20261102-yournus-balloon",
    "view": ""
   },
   {
    "id": "item-20261102-photo-denim",
    "view": ""
   },
   {
    "id": "item-20261103-bag",
    "view": ""
   },
   {
    "id": "item-20261103-le-labo",
    "view": ""
   },
   {
    "id": "item-20261025-09-drmartens",
    "view": ""
   },
   {
    "id": "item-20261025-02-track",
    "view": ""
   },
   {
    "id": "item-20261103-wood-salt",
    "view": ""
   }
  ],
  "identities": [
   {
    "id": "item-20261029-11-balmacaan",
    "name": "언더마이카 리전 02 발마칸 오버사이즈 울 코트 카키",
    "brand": "UNDERMYCAR",
    "cat": "outer",
    "color": "green",
    "imageKey": "13bc9e78",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-06-ma1",
    "name": "우영미 백로고 MA-1 블랙",
    "brand": "WOOYOUNGMI / 우영미",
    "cat": "outer",
    "color": "black",
    "imageKey": "1e949c8c",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-balenciaga-reversible",
    "name": "발렌시아가 x 언더아머 리버서블 데님·바람막이 자켓",
    "brand": "BALENCIAGA x Under Armour",
    "cat": "outer",
    "color": "charcoal",
    "imageKey": "1817afc5",
    "view": "AI 보정 · 바람막이 면",
    "viewImageKey": "21202fb4"
   },
   {
    "id": "item-20261029-18-stucoat",
    "name": "STU 핸드 스티치 더블 코트 블랙",
    "brand": "STU",
    "cat": "outer",
    "color": "black",
    "imageKey": "9ea06587",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-polo",
    "name": "폴로 랄프로렌 쿼터집 니트 라이트 그레이",
    "brand": "Polo Ralph Lauren",
    "cat": "top",
    "color": "gray",
    "imageKey": "b03f8b0d",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-mvnm5zvx-2egc7m",
    "name": "우영미 블랙 후드 티셔츠 (105)",
    "brand": "WOOYOUNGMI / 우영미",
    "cat": "top",
    "color": "black",
    "imageKey": "a02369f5",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-yournus-balloon",
    "name": "유어너스 블렌디드 데미지 벌룬 데님 브라운 블랙",
    "brand": "YOURNUS",
    "cat": "bottom",
    "color": "brown",
    "imageKey": "c9c3284d",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-photo-denim",
    "name": "브랜드 미상 워싱 와이드 데님 흑청",
    "brand": "브랜드 미상",
    "cat": "bottom",
    "color": "charcoal",
    "imageKey": "3584e242",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-bag",
    "name": "블랙 레더룩 쇼퍼 토트백",
    "brand": "브랜드 미상",
    "cat": "bag",
    "color": "black",
    "imageKey": "31de7577",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-le-labo",
    "name": "르 라보 라방드 31 오 드 퍼퓸 100ml",
    "brand": "LE LABO",
    "cat": "fragrance",
    "color": "other",
    "imageKey": "41b3df7b",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-09-drmartens",
    "name": "닥터마틴 1461 3홀 블랙 나파 (11838001)",
    "brand": "DR. MARTENS / 닥터마틴",
    "cat": "shoes",
    "color": "black",
    "imageKey": "12e8d8a8",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-02-track",
    "name": "발렌시아가 트랙 스니커즈 블랙 (43)",
    "brand": "BALENCIAGA / 발렌시아가",
    "cat": "shoes",
    "color": "black",
    "imageKey": "5d391492",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-wood-salt",
    "name": "탬버린즈 우드 솔트 비치 퍼퓸",
    "brand": "TAMBURINS",
    "cat": "fragrance",
    "color": "other",
    "imageKey": "b006e1e5",
    "view": "",
    "viewImageKey": ""
   }
  ]
 },
 {
  "id": "warm",
  "title": "베이지·퍼플 전시",
  "image": "./assets/wardrobe-natural-warm-v3.webp",
  "slots": [
   {
    "id": "item-20261025-04-trench",
    "view": ""
   },
   {
    "id": "item-20261029-14-beigejacket",
    "view": ""
   },
   {
    "id": "item-20261025-06-ma1",
    "view": ""
   },
   {
    "id": "item-20261102-balenciaga-reversible",
    "view": ""
   },
   {
    "id": "item-20261102-white-shirt",
    "view": ""
   },
   {
    "id": "item-20261103-vest",
    "view": ""
   },
   {
    "id": "item-20261102-gray-slacks",
    "view": ""
   },
   {
    "id": "item-20261102-photo-denim",
    "view": ""
   },
   {
    "id": "item-20261103-matin",
    "view": ""
   },
   {
    "id": "item-20261103-wood-salt",
    "view": ""
   },
   {
    "id": "item-20261025-09-drmartens",
    "view": ""
   },
   {
    "id": "item-20261103-nike",
    "view": ""
   },
   {
    "id": "item-20261103-le-labo",
    "view": ""
   }
  ],
  "identities": [
   {
    "id": "item-20261025-04-trench",
    "name": "우영미 턴업 트렌치코트 베이지 (46)",
    "brand": "WOOYOUNGMI / 우영미",
    "cat": "outer",
    "color": "beige",
    "imageKey": "cd321020",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261029-14-beigejacket",
    "name": "우영미 23SS 베이지 더블 재킷",
    "brand": "WOOYOUNGMI",
    "cat": "outer",
    "color": "beige",
    "imageKey": "a7e3f41b",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-06-ma1",
    "name": "우영미 백로고 MA-1 블랙",
    "brand": "WOOYOUNGMI / 우영미",
    "cat": "outer",
    "color": "black",
    "imageKey": "1e949c8c",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-balenciaga-reversible",
    "name": "발렌시아가 x 언더아머 리버서블 데님·바람막이 자켓",
    "brand": "BALENCIAGA x Under Armour",
    "cat": "outer",
    "color": "charcoal",
    "imageKey": "1817afc5",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-white-shirt",
    "name": "화이트 포켓 셔츠 (브랜드 미상)",
    "brand": "",
    "cat": "top",
    "color": "white",
    "imageKey": "5ded0982",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-vest",
    "name": "스탠다드 저널 퍼플 패턴 니트 베스트",
    "brand": "STANDARD JOURNAL",
    "cat": "top",
    "color": "purple",
    "imageKey": "95bfb997",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-gray-slacks",
    "name": "무신사 스탠다드 그레이 슬랙스",
    "brand": "MUSINSA STANDARD",
    "cat": "bottom",
    "color": "charcoal",
    "imageKey": "ddd7153f",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-photo-denim",
    "name": "브랜드 미상 워싱 와이드 데님 흑청",
    "brand": "브랜드 미상",
    "cat": "bottom",
    "color": "charcoal",
    "imageKey": "3584e242",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-matin",
    "name": "마뗑킴 로고 워시드 데님 토트백 블랙",
    "brand": "MATIN KIM",
    "cat": "bag",
    "color": "black",
    "imageKey": "6ddbba5a",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-wood-salt",
    "name": "탬버린즈 우드 솔트 비치 퍼퓸",
    "brand": "TAMBURINS",
    "cat": "fragrance",
    "color": "other",
    "imageKey": "b006e1e5",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-09-drmartens",
    "name": "닥터마틴 1461 3홀 블랙 나파 (11838001)",
    "brand": "DR. MARTENS / 닥터마틴",
    "cat": "shoes",
    "color": "black",
    "imageKey": "12e8d8a8",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-nike",
    "name": "나이키크래프트 제너럴 퍼포즈 슈 아카이브",
    "brand": "NikeCraft",
    "cat": "shoes",
    "color": "yellow",
    "imageKey": "ed6a9d46",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-le-labo",
    "name": "르 라보 라방드 31 오 드 퍼퓸 100ml",
    "brand": "LE LABO",
    "cat": "fragrance",
    "color": "other",
    "imageKey": "41b3df7b",
    "view": "",
    "viewImageKey": ""
   }
  ]
 },
 {
  "id": "dark",
  "title": "블랙·카키 전시",
  "image": "./assets/wardrobe-natural-dark-v3.webp",
  "slots": [
   {
    "id": "item-20261029-18-stucoat",
    "view": ""
   },
   {
    "id": "item-20261025-06-ma1",
    "view": ""
   },
   {
    "id": "item-20261102-balenciaga-reversible",
    "view": "AI 보정 · 바람막이 면"
   },
   {
    "id": "item-20261029-11-balmacaan",
    "view": ""
   },
   {
    "id": "item-20261103-polo",
    "view": ""
   },
   {
    "id": "item-mvnm5zvx-2egc7m",
    "view": ""
   },
   {
    "id": "item-20261102-gray-slacks",
    "view": ""
   },
   {
    "id": "item-20261102-photo-denim",
    "view": ""
   },
   {
    "id": "item-20261103-bag",
    "view": ""
   },
   {
    "id": "item-20261103-le-labo",
    "view": ""
   },
   {
    "id": "item-20261025-09-drmartens",
    "view": ""
   },
   {
    "id": "item-20261103-nike",
    "view": ""
   },
   null
  ],
  "identities": [
   {
    "id": "item-20261029-18-stucoat",
    "name": "STU 핸드 스티치 더블 코트 블랙",
    "brand": "STU",
    "cat": "outer",
    "color": "black",
    "imageKey": "9ea06587",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-06-ma1",
    "name": "우영미 백로고 MA-1 블랙",
    "brand": "WOOYOUNGMI / 우영미",
    "cat": "outer",
    "color": "black",
    "imageKey": "1e949c8c",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-balenciaga-reversible",
    "name": "발렌시아가 x 언더아머 리버서블 데님·바람막이 자켓",
    "brand": "BALENCIAGA x Under Armour",
    "cat": "outer",
    "color": "charcoal",
    "imageKey": "1817afc5",
    "view": "AI 보정 · 바람막이 면",
    "viewImageKey": "21202fb4"
   },
   {
    "id": "item-20261029-11-balmacaan",
    "name": "언더마이카 리전 02 발마칸 오버사이즈 울 코트 카키",
    "brand": "UNDERMYCAR",
    "cat": "outer",
    "color": "green",
    "imageKey": "13bc9e78",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-polo",
    "name": "폴로 랄프로렌 쿼터집 니트 라이트 그레이",
    "brand": "Polo Ralph Lauren",
    "cat": "top",
    "color": "gray",
    "imageKey": "b03f8b0d",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-mvnm5zvx-2egc7m",
    "name": "우영미 블랙 후드 티셔츠 (105)",
    "brand": "WOOYOUNGMI / 우영미",
    "cat": "top",
    "color": "black",
    "imageKey": "a02369f5",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-gray-slacks",
    "name": "무신사 스탠다드 그레이 슬랙스",
    "brand": "MUSINSA STANDARD",
    "cat": "bottom",
    "color": "charcoal",
    "imageKey": "ddd7153f",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261102-photo-denim",
    "name": "브랜드 미상 워싱 와이드 데님 흑청",
    "brand": "브랜드 미상",
    "cat": "bottom",
    "color": "charcoal",
    "imageKey": "3584e242",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-bag",
    "name": "블랙 레더룩 쇼퍼 토트백",
    "brand": "브랜드 미상",
    "cat": "bag",
    "color": "black",
    "imageKey": "31de7577",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-le-labo",
    "name": "르 라보 라방드 31 오 드 퍼퓸 100ml",
    "brand": "LE LABO",
    "cat": "fragrance",
    "color": "other",
    "imageKey": "41b3df7b",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261025-09-drmartens",
    "name": "닥터마틴 1461 3홀 블랙 나파 (11838001)",
    "brand": "DR. MARTENS / 닥터마틴",
    "cat": "shoes",
    "color": "black",
    "imageKey": "12e8d8a8",
    "view": "",
    "viewImageKey": ""
   },
   {
    "id": "item-20261103-nike",
    "name": "나이키크래프트 제너럴 퍼포즈 슈 아카이브",
    "brand": "NikeCraft",
    "cat": "shoes",
    "color": "yellow",
    "imageKey": "ed6a9d46",
    "view": "",
    "viewImageKey": ""
   }
  ]
 }
];
 const points=[[15,45],[25,33],[33,36],[43,37],[56,28],[68,27],[57,66],[69,66],[87,25],[83.7,44],[86,65],[87,82],[89.3,44]];
 function current(scene,items,models){return scene.identities.every(p=>{const i=items.find(i=>!i.isDemo&&i.id===p.id);if(!i)return false;const a=models.identity(i);if(Object.keys(a).some(k=>a[k]!==p[k]))return false;if(!p.view)return true;const v=models.variants(i).find(v=>v.lookView===p.view);return v&&models.imageKey(v.lookImage)===p.viewImageKey})}
 function find(slots,items,models){return scenes.find(s=>s.slots.length===slots.length&&s.slots.every((e,n)=>!e?!slots[n]:e.id===slots[n]?.id&&e.view===(slots[n]?.view||''))&&current(s,items,models))||null}
 return {scenes,points,current,find};
});
