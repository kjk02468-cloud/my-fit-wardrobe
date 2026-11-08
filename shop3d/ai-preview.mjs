// Optional future adapter boundary. No provider, credential, upload or network call.
export const photoPreview = Object.freeze({
 enabled: false,
 provider: null,
 status: '공급자 미연결 · 외부 전송 OFF',
 requirements: ['사용자가 직접 선택한 본인 사진', '선택한 상품 사진', '전송 대상·용도 고지와 명시적 동의', '비밀 키를 보관할 승인된 서버'],
 async generate(){throw new Error('실사 AI 피팅 공급자가 연결되지 않았어요. 사진을 전송하지 않았습니다.');}
});
