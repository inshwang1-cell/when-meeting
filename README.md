# When? - 스마트 회의 일정 조율 시스템

엔디에스 전략기획팀에서 만든 회의 일정 조율 도구.
링크 하나로 모두에게 묻고, AI가 최적의 시간을 찾아드립니다.

## 📁 프로젝트 구조

```
meeting-scheduler/
├── index.html          # 메인 HTML
├── app.js              # 클라이언트 JavaScript
├── api/
│   └── meetings.js     # Vercel 서버리스 함수 (API)
├── vercel.json         # Vercel 라우팅 설정
├── package.json
└── README.md
```

## 🚀 Vercel 배포 가이드

### 1단계: Upstash Redis 무료 계정 만들기 (데이터 저장용)

1. https://upstash.com 접속 → **Sign Up** (Google/GitHub 로그인 가능)
2. 로그인 후 **Create Database** 클릭
3. 다음과 같이 설정:
   - **Name**: `when-meeting` (원하는 이름)
   - **Type**: `Regional` (무료)
   - **Region**: `AP-Northeast-1 (Tokyo)` (한국에서 가장 빠름)
   - **TLS**: 활성화 (기본값)
4. **Create** 클릭
5. 데이터베이스 페이지에서 **REST API** 섹션을 찾아 다음 두 값을 복사 (나중에 필요):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2단계: GitHub에 코드 올리기 (선택사항이지만 추천)

```bash
# 프로젝트 폴더로 이동
cd meeting-scheduler

# Git 초기화
git init
git add .
git commit -m "Initial commit"

# GitHub에서 새 저장소 만든 뒤
git remote add origin https://github.com/[your-username]/when-meeting.git
git branch -M main
git push -u origin main
```

### 3단계: Vercel에 배포

#### 방법 A: Vercel 웹사이트에서 (가장 쉬움)

1. https://vercel.com 접속 → **Sign Up** (GitHub 계정으로 로그인 추천)
2. 대시보드에서 **Add New → Project** 클릭
3. GitHub 저장소를 import (1단계에서 만든 저장소 선택)
4. **Configure Project** 화면에서:
   - Framework Preset: `Other`
   - Build Command: 비워두기
   - Output Directory: 비워두기
5. **Environment Variables** 섹션에서 다음 두 개를 추가:
   - Name: `UPSTASH_REDIS_REST_URL` / Value: 1단계에서 복사한 URL
   - Name: `UPSTASH_REDIS_REST_TOKEN` / Value: 1단계에서 복사한 TOKEN
6. **Deploy** 버튼 클릭
7. 1-2분 후 배포 완료! `https://your-project.vercel.app` 같은 URL이 생성됩니다.

#### 방법 B: Vercel CLI로 (개발자용)

```bash
# Vercel CLI 설치
npm install -g vercel

# 프로젝트 폴더에서
cd meeting-scheduler
vercel login
vercel

# 환경변수 설정
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN

# 프로덕션 배포
vercel --prod
```

### 4단계: 사용 시작!

배포된 URL(예: `https://when-meeting.vercel.app`)에 접속해서 회의를 만들어보세요.
회의 생성 후 받은 링크를 동료들에게 카톡/이메일/문자로 공유하면 됩니다.

## 🔧 로컬에서 테스트하기

```bash
# Vercel CLI 설치 (전역)
npm install -g vercel

# 환경변수 설정 (.env.local 파일 생성)
echo "UPSTASH_REDIS_REST_URL=YOUR_URL" > .env.local
echo "UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN" >> .env.local

# 로컬 서버 실행
vercel dev

# 브라우저에서 http://localhost:3000 접속
```

## 💰 비용

- **Vercel Hobby (무료)**: 개인 프로젝트는 충분
  - 월 100GB 대역폭
  - 서버리스 함수 100GB-시간
- **Upstash Redis Free**:
  - 일일 10,000 요청
  - 256MB 저장공간
  - 회의 수백 개 운영 가능

소규모 팀에서는 무료 티어로 충분합니다.

## 📞 참고

- Vercel 문서: https://vercel.com/docs
- Upstash 문서: https://docs.upstash.com/redis

---

**Built by 엔디에스 전략기획팀**
