// Vercel Serverless Function - meetings API

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  // Upstash는 결과를 { result: "..." } 형태로 반환
  if (data.result === null || data.result === undefined) return null;
  const val = data.result;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(JSON.stringify(value))
  });
  return await res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: '환경변수가 설정되지 않았습니다.' });
  }

  try {
    // GET - 회의 조회
    if (req.method === 'GET') {
      const id = req.query.id;
      if (!id || id === 'undefined') {
        return res.status(400).json({ error: 'id가 필요합니다.' });
      }
      const meeting = await redisGet(`meeting:${id}`);
      if (!meeting) {
        return res.status(404).json({ error: '회의를 찾을 수 없습니다.' });
      }
      return res.status(200).json(meeting);
    }

    // POST - 회의 생성
    if (req.method === 'POST') {
      const meeting = req.body;
      if (!meeting || !meeting.id || !meeting.title) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
      }
      await redisSet(`meeting:${meeting.id}`, meeting);
      return res.status(201).json(meeting);
    }

    // PUT - 참여자 응답
    if (req.method === 'PUT') {
      const { meetingId, name, unavailableSlots } = req.body;
      if (!meetingId || !name) {
        return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
      }
      const meeting = await redisGet(`meeting:${meetingId}`);
      if (!meeting) {
        return res.status(404).json({ error: '회의를 찾을 수 없습니다.' });
      }
      meeting.participants = meeting.participants || {};
      meeting.participants[name] = {
        unavailableSlots: unavailableSlots || [],
        submittedAt: Date.now()
      };
      await redisSet(`meeting:${meetingId}`, meeting);
      return res.status(200).json(meeting);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
