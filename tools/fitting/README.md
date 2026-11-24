# MY FIT 피팅 모델 제작 원본

M01은 약 1.81m의 중립 기준 모델이다. Innerscene의 남성 베이스 GLB를 Blender에서 얕은 A 포즈로 리바인드했다. 피부는 CC0 배포본인 Mindfront의 Aksel 색·노멀 아틀라스를 원본 머리와 손의 UV에 맞췄다. 보이는 UV 섬만 텍스처에 남기고, 한쪽 눈의 색 자국은 아틀라스의 반대쪽 섬을 사용해 정리했다. 머리카락 표면은 Blender에서 두상 단면에 맞추고 결을 따라가는 노멀 맵을 적용했다. [Innerscene 남성 베이스 GLB](https://www.innerscene.com/tools/library/3d-parts/male-base-mesh-3d-person-rigged-a-pose-380e6d89) · [MakeHuman 라이선스](https://www.makehumancommunity.org/about/license.html) · [Mindfront Aksel 수록 Skins 02 팩](https://static.makehumancommunity.org/assets/assetpacks/skins02.html)

`shop3d/tailoring.mjs`에는 의상 곡면의 재사용 가능한 패턴과 진열용 LOD가 있다. Blender에서 메시를 구성하고 163개 조인트의 공용 바인드에 웨이트를 입혔다. 첨부 `11_material`의 멜턴·메리노·옥스퍼드·저지·트윌·카프스킨 견본에서 조명 성분을 줄인 작은 반복 타일을 만들고, 색·노멀·ORM을 분리했다. 의상은 재질별로 병합하며 가상 피팅에서 선택 시 로드된다. GLB가 없는 분류도 같은 바인드에 맞춘 유사 실루엣과 기존 재질 타일을 사용한다.

재생성에는 Node.js, Blender 4.5.15 LTS, Python 3.10 이상, Basis Universal 1.16.4가 필요하다. 첫 번째 명령에서 받는 CC0 원본 GLB의 SHA-256은 `86C7CDFA989924B45E2E5110C131A4A4E6251CEB4E71246BE68E468F3A32CA86`이다. Skins 02 팩의 `skins/mindfront_aksel_skin/` 아래 `Aksel_Skin_diffuse.png`와 `Aksel_Skin_NRM.png`를 작업 폴더에 둔다. 제작용 원본과 작업 파일은 운영 경로 밖에 둔다.

```powershell
New-Item -ItemType Directory -Force ../my-fit-fitting-source
Invoke-WebRequest 'https://files.innerscene.com/library/male-base-mesh-3d-person-rigged-a-pose-380e6d89/038f3a526b2fc3efd012/male-base-mesh-base_male.glb' -OutFile ../my-fit-fitting-source/cc0-male-base.glb
node tools/fitting/emit-tailoring.mjs ../my-fit-fitting-source/tailoring-patterns.json
blender -b --python-exit-code 1 --python tools/fitting/build-fitting.py -- --base ../my-fit-fitting-source/cc0-male-base.glb --patterns ../my-fit-fitting-source/tailoring-patterns.json --output shop3d/assets/fitting --blend ../my-fit-fitting-source/MY_FIT_Fitting_Library_Photo.blend --swatches ../my-fit-reference-input/MY_FIT_Originals/11_material --skin-diffuse ../my-fit-fitting-source/Aksel_Skin_diffuse.png --skin-normal ../my-fit-fitting-source/Aksel_Skin_NRM.png --draco
python tools/fitting/pack-textures.py shop3d/assets/fitting /path/to/basisu
```

`--draco`를 생략한 뒤 별도 디렉터리로 내보내면 Khronos glTF Validator가 압축 확장 없이 원래 지오메트리와 PNG 텍스처를 검사할 수 있다. 배포용 모델은 Draco 지오메트리와 KTX2 텍스처를 포함한다. 색은 sRGB이고 노멀과 ORM은 선형이다. Blender 원본의 Outliner에서 필요한 의상 컬렉션만 켜면 한 조합을 볼 수 있다.

정적 피팅은 아바타 회전과 메쉬 교체를 지원한다. 제품의 정확한 실루엣, 체형 보정, 천 시뮬레이션, 포즈 애니메이션은 제공하지 않는다. 대표 니트와 코트 조합의 시각 검수는 모든 보유품과 레이어 조합의 관통 검증을 대신하지 않는다.
