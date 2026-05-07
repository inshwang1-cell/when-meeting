// ═══════════════════════════════════════════════════════════════
//  Vercel Serverless Function - 회의 데이터 API
//  Upstash Redis를 데이터 저장소로 사용
// ═══════════════════════════════════════════════════════════════

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Redis REST API 호출 헬퍼
async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  return await res.json();
}

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 환경변수 체크
  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({
      error: '서버 설정이 완료되지 않았습니다. Upstash Redis 환경변수를 확인하세요.'
    });
  }

  try {
    // ─── GET: 회의 조회 ───
    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'id가 필요합니다.' });
      }

      const data = await redisGet(`meeting:${id}`);
      if (!data) {
        return res.status(404).json({ error: '회의를 찾을 수 없습니다.' });
      }

      const meeting = typeof data === 'string' ? JSON.parse(data) : data;
      return res.status(200).json(meeting);
    }

    // ─── POST: 회의 생성 ───
    if (req.method === 'POST') {
      const meeting = req.body;

      if (!meeting.id || !meeting.title || !meeting.dates) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
      }

      await redisSet(`meeting:${meeting.id}`, JSON.stringify(meeting));

      return res.status(201).json(meeting);
    }

    // ─── PUT: 참여자 응답 추가/수정 ───
    if (req.method === 'PUT') {
      const { meetingId, name, unavailableSlots } = req.body;

      if (!meetingId || !name) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
      }

      const data = await redisGet(`meeting:${meetingId}`);
      if (!data) {
        return res.status(404).json({ error: '회의를 찾을 수 없습니다.' });
      }

      const meeting = typeof data === 'string' ? JSON.parse(data) : data;
      meeting.participants = meeting.participants || {};
      meeting.participants[name] = {
        unavailableSlots: unavailableSlots || [],
        submittedAt: Date.now()
      };

      await redisSet(`meeting:${meetingId}`, JSON.stringify(meeting));

      return res.status(200).json(meeting);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', details: error.message });
  }
}
