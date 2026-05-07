const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const json = await res.json();
  if (!json.result) return null;
  // 이중 stringify 방지
  let val = json.result;
  if (typeof val === 'string') {
    try { val = JSON.parse(val); } catch(e) {}
  }
  if (typeof val === 'string') {
    try { val = JSON.parse(val); } catch(e) {}
  }
  return val;
}

async function redisSet(key, obj) {
  // 한 번만 stringify
  const body = JSON.stringify({ value: JSON.stringify(obj) });
  await fetch(`${REDIS_URL}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(obj))
  });
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ error: '환경변수 없음' });
  }

  try {
    if (req.method === 'GET') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id 필요' });
      const data = await redisGet(`meeting:${id}`);
      if (!data) return res.status(404).json({ error: '없음' });
      // 숫자 필드 보정
      data.startSlot = Number(data.startSlot);
      data.endSlot = Number(data.endSlot);
      data.duration = Number(data.duration);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const m = req.body;
      if (!m || !m.id) return res.status(400).json({ error: '데이터 없음' });
      // 숫자 보정 후 저장
      m.startSlot = Number(m.startSlot);
      m.endSlot = Number(m.endSlot);
      m.duration = Number(m.duration);
      await redisSet(`meeting:${m.id}`, m);
      return res.status(201).json(m);
    }

    if (req.method === 'PUT') {
      const { meetingId, name, unavailableSlots } = req.body;
      if (!meetingId || !name) return res.status(400).json({ error: '데이터 없음' });
      const m = await redisGet(`meeting:${meetingId}`);
      if (!m) return res.status(404).json({ error: '없음' });
      m.startSlot = Number(m.startSlot);
      m.endSlot = Number(m.endSlot);
      m.duration = Number(m.duration);
      m.participants = m.participants || {};
      m.participants[name] = { unavailableSlots: unavailableSlots || [], submittedAt: Date.now() };
      await redisSet(`meeting:${meetingId}`, m);
      return res.status(200).json(m);
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
