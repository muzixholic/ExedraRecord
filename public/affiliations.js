// 게임 내 작품·그룹 순서. 일본어 원문을 함께 보존합니다.
globalThis.ExedraAffiliations={
  "works": [
    {
      "id": "madoka",
      "ko": "마도카☆마기카",
      "ja": "まどか☆マギカ"
    },
    {
      "id": "magia-record",
      "ko": "마기아 레코드",
      "ja": "マギアレコード"
    },
    {
      "id": "oriko",
      "ko": "오리코☆마기카",
      "ja": "おりこ☆マギカ"
    },
    {
      "id": "tart",
      "ko": "타루토☆마기카",
      "ja": "たると☆マギカ"
    },
    {
      "id": "suzune",
      "ko": "스즈네☆마기카",
      "ja": "すずね☆マギカ"
    },
    {
      "id": "sorana",
      "ko": "소라나☆마기카"
    },
    {
      "id": "collaboration",
      "ko": "콜라보",
      "ja": "コラボ"
    }
  ],
  "groups": [
    {
      "id": "mikazuki",
      "ko": "미카즈키장",
      "ja": "みかづき荘"
    },
    {
      "id": "daito",
      "ko": "카미하마 다이토 단지",
      "ja": "神浜大東団地"
    },
    {
      "id": "tsutsuji",
      "ko": "츠츠지의 집",
      "ja": "つつじの家"
    },
    {
      "id": "nanaka",
      "ko": "팀 나나카",
      "ja": "チームななか"
    },
    {
      "id": "momoko",
      "ko": "팀 모모코",
      "ja": "チームももこ"
    },
    {
      "id": "emily",
      "ko": "에밀리의 상담소",
      "ja": "エミリーの相談所"
    },
    {
      "id": "blossom",
      "ko": "블로섬",
      "ja": "ブロッサム"
    },
    {
      "id": "yachiyo",
      "ko": "팀 야치요",
      "ja": "チームやちよ"
    },
    {
      "id": "magius",
      "ko": "마기우스의 날개",
      "ja": "マギウスの翼"
    },
    {
      "id": "unaffiliated",
      "ko": "무소속",
      "ja": "無所属"
    }
  ]
};

// 기존 단일 그룹 자료도 새 다중 소속 화면에서 읽습니다.
globalThis.ExedraAffiliations.groupsFor=memory=>[...new Set(Array.isArray(memory.groups)?memory.groups:memory.group?[memory.group]:[])];
