# 🚀 보이저 1호, 49년 만의 ‘1광일’ 도달 티저 영상 (Voyager 1 Light-Day Teaser)

![Voyager 1 Teaser Preview](https://img.shields.io/badge/VOYAGER--1-1--LIGHT--DAY-00f0ff?style=for-the-badge&logo=nasa)
![License](https://img.shields.io/badge/LICENSE-MIT-yellow?style=for-the-badge)

본 프로젝트는 한겨레 곽노필 기자의 과학 기사 [**"보이저 1호, 49년 만에 ‘1광일’ 거리…2030년대 타임캡슐로 남는다"**](https://www.hani.co.kr/arti/science/science_general/1269765.html) 내용을 바탕으로 제작된 **모션 티저 영상 및 인터랙티브 웹 애플리케이션**입니다.

---

## 📌 주요 뉴스 핵심 요약 (Key Facts)

1. **지구로부터 '1광일' (Light-Day) 도달**
   - 1977년 9월 5일 발사 이후 **49년 만인 2026년 11월 18일 오전 2시 16분(PST) / 한국시각 11월 18일 오후 7시 16분**, 지구에서 **259억 2,06만 8,356km** 떨어진 '1광일' 우주 공간을 통과.
2. **48시간 신호 시차**
   - 빛의 속도로 명령("안녕")을 전달하더라도 지구로 답장이 도착하기까지 **꼬박 이틀(48시간)** 소요.
3. **2030년대 통신 차단 예고**
   - 플루토늄 원자력 발전기(RTG) 전력 감소로 탑재된 10개 과학 장비 중 **자력계 및 플라스마 파동 관측기 2개만 가동 중**.
   - 2030년대 초 전력이 임계치 이하로 떨어져 지구와의 통신이 영구 차단될 예정.
4. **성간 우주 타임캡슐 (Golden Record)**
   - 통신이 끊긴 후에도 인류의 문화, 50개 언어 인사말, 음악, 지구 지도 정보가 새겨진 **'골든 레코드(Golden Record)'**를 품고 영원히 광활한 성간 우주를 항해.

---

## 🎬 티저 영상 시놉시스 (Storyline)

- **SCENE 01 / LAUNCH (1977)**: 1977년 9월 5일, 지구를 떠난 인류 최전방 우주 척후병 보이저 1호.
- **SCENE 02 / 1 LIGHT-DAY MILESTONE**: 49년 만의 역사적 이정표... 지구로부터 인류 최초 '1광일(259억 km)' 도달!
- **SCENE 03 / 48-HOUR DELAY**: 월요일 아침 보낸 명령이 수요일 아침이 되어서야 응답받는 극한의 신호 시차.
- **SCENE 04 / POWER FADE**: 식어가는 원자력 전력... 10개 장비 중 2개만 가동, 2030년대 초 예고된 침묵.
- **SCENE 05 / GOLDEN RECORD**: 지구의 소리와 음악을 담은 골든 레코드를 품은 영원한 타임캡슐.
- **SCENE 06 / EPILOGUE**: 인류가 도달한 가장 깊은 우주. 영원히 항해할 외로운 척후병, 보이저 1호.

---

## ✨ 기술 특징 & 주요 기능

- **60FPS Dynamic HTML5 Canvas Space Renderer**:
  - 패럴랙스 별자리 성단, 우주 가스 성운(Nebulae), 실시간 거리 계산 릴레이 틱커.
  - 보이저 1호 파라볼라 안테나, RTG 원자력 핵심, 자력계 붐, 안테나 전파 펄스 실시간 Vector Canvas 그래픽 구현.
- **Web Audio API Ambient Synthesizer**:
  - 우주 분위기의 우웅거리는 딥 서브 드론 오디오 및 고성능 무선 텔레메트리 톤 사운드 자체 생성.
- **1-Click High-Quality Video Export (.webm)**:
  - 브라우저 내 `MediaRecorder` API를 활용하여 캔버스 모션 및 사운드를 실시간으로 인코딩하여 즉시 동영상 파일로 다운로드 제공.
- **Responsive Dark Sci-Fi UI**:
  - 씬 컨트롤 툴바, 48시간 전파 딜레이 노드 가시화, 골든 레코드 3D 회전 오버레이.

---

## 💻 실행 및 보기 (Getting Started)

### 1. 로컬 브라우저 실행
`index.html` 파일을 웹 브라우저로 직접 열거나, Node.js로 실행합니다:

```bash
# 로컬 개발 서버 실행
npm start
```

### 2. 영상 다운로드 (.webm)
1. 웹 UI 하단의 **`🎬 영상 다운로드 (.webm)`** 버튼 클릭.
2. 약 24초 동안 전체 6개 씬이 자동 녹화 진행.
3. 녹화 완료 시 `voyager1_teaser_1lightday.webm` 동영상 파일 자동 저장.

---

## 📄 출처 기사
- **기사 제목**: 보이저 1호, 49년 만에 ‘1광일’ 거리…2030년대 타임캡슐로 남는다
- **언론사**: 한겨레 (곽노필의 미래창)
- **URL**: [https://www.hani.co.kr/arti/science/science_general/1269765.html](https://www.hani.co.kr/arti/science/science_general/1269765.html)

---

### Author
Produced & Pushed to [GitHub Repository](https://github.com/oj-o/voyager1-teaser) by **oj-o**
