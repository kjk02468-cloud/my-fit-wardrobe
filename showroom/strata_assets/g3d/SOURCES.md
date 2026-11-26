# 3D 옷 출처 (STRATA lab 무료 3D 옷 시험)

행거의 두 벌만 사진 윤곽 대신 3D 모델로 겁니다. 나머지 옷은 기존 사진 방식 그대로입니다.
불러오지 못하면 자동으로 사진 방식으로 돌아갑니다.

| 파일 | 옷(옷장 ID) | 모양 | 겉면(색·무늬·로고) |
|---|---|---|---|
| coat.glb | 우영미 턴업 트렌치코트 베이지 (`item-20261025-04-trench`) | Microsoft TRELLIS.2 (Hugging Face 무료 데모, MIT) | 판매처 앞·뒤 사진 투영 — https://fruitsfamily.com/product/2iwj3 |
| jacket.glb | 슈프림 x 노스페이스 서밋 아우터 테이프 심 자켓 (`item-20261029-12-supreme`) | Microsoft TRELLIS.2 (Hugging Face 무료 데모, MIT) | KREAM 앞·뒤 사진 투영 — https://kream.co.kr/products/35716 |

- 사진 저작권은 각 판매처·브랜드에 있습니다(옷장 데이터에 이미 저장된 사진과 같은 것).
- 만든 방법: STRATA lab `lab3d/`(gen3d.py → project_tex.py → eval3d.py), 웹용 압축 `tools/node/opt_garment.mjs`(meshopt + WebP, 면 수 그대로).
- 채점(웹용 파일 기준): 코트 색 차이 0.17/0.13, 등판 장식 일치 0.97, 윤곽 겹침 0.93/0.89 · 재킷 색 차이 1.8/1.8, 로고 5곳 0.67~0.95(뒤집힘 없음), 윤곽 0.96/0.93.
- 사진에 안 보이는 옆구리는 추정색입니다. 재킷 후드 안쪽에 작은 흰 조각이 남아 있습니다.
