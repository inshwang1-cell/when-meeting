// ═══════════════════════════════════════════════════════════════
//  When? - 회의 일정 조율 앱
//  엔디에스 전략기획팀
// ═══════════════════════════════════════════════════════════════

// ─── 전역 상태 ───
let currentMeeting = null;
let currentParticipantName = null;
let selectedUnavailable = new Set();
let dragMode = null;
let calendarYear, calendarMonth;
let selectedDates = new Set();

// ─── 유틸리티 ───
const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const fmtDate = (iso) => {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const fmtTime = (slotKey) => {
  // slotKey: "0" = 00:00, "1" = 00:30, "18" = 09:00, "19" = 09:30
  const totalMinutes = slotKey * 30;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const showError = (id, msg) => {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }
};

const hideError = (id) => {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
};

// ─── API 호출 ───
const API_BASE = '/api';

async function apiCreateMeeting(meetingData) {
  const res = await fetch(`${API_BASE}/meetings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meetingData)
  });
  if (!res.ok) throw new Error('회의 생성 실패');
  return await res.json();
}

async function apiGetMeeting(id) {
  const res = await fetch(`${API_BASE}/meetings?id=${id}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('회의 불러오기 실패');
  }
  return await res.json();
}

async function apiSubmitResponse(meetingId, name, unavailableSlots) {
  const res = await fetch(`${API_BASE}/meetings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, name, unavailableSlots })
  });
  if (!res.ok) throw new Error('응답 저장 실패');
  return await res.json();
}

// ─── URL 관리 ───
const getShareUrl = (meetingId) => {
  return `${window.location.origin}${window.location.pathname}?m=${meetingId}`;
};

const getMeetingIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('m');
};

// ─── 초기화 ───
window.addEventListener('load', async () => {
  const meetingId = getMeetingIdFromUrl();
  console.log('[When?] 페이지 로드, meetingId:', meetingId, '| URL:', window.location.href);

  if (meetingId && meetingId !== 'undefined' && meetingId !== 'null') {
    navigate('loading');
    try {
      console.log('[When?] API 호출:', `/api/meetings?id=${meetingId}`);
      const meeting = await apiGetMeeting(meetingId);
      console.log('[When?] API 응답:', meeting);
      if (meeting && meeting.id) {
        currentMeeting = meeting;
        const isOrganizer = sessionStorage.getItem(`organizer:${meetingId}`) === '1';
        if (isOrganizer) {
          displayOrganizerDashboard();
          navigate('organizer');
        } else {
          displayParticipantNameForm();
          navigate('participant-name');
        }
      } else {
        alert('회의를 찾을 수 없습니다. 링크를 다시 확인해주세요.');
        navigate('home');
      }
    } catch (e) {
      console.error('[When?] 오류:', e);
      alert(`회의를 불러올 수 없습니다.\n오류: ${e.message}`);
      navigate('home');
    }
  } else {
    navigate('home');
  }
});

// ─── 네비게이션 ───
const navigate = (viewName) => {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const view = document.getElementById(viewName + "-view");
  if (view) view.classList.add("active");
  window.scrollTo(0, 0);

  if (viewName === "create") {
    initCreateForm();
  } else if (viewName === "organizer" && currentMeeting) {
    refreshOrganizerDashboard();
  }
};

const resetAndNavigateHome = () => {
  currentMeeting = null;
  currentParticipantName = null;
  selectedUnavailable = new Set();
  selectedDates = new Set();
  window.history.pushState({}, '', window.location.pathname);
  navigate('home');
};

// ═══════════════════════════════════════════════════════════════
//  회의 생성
// ═══════════════════════════════════════════════════════════════

const initCreateForm = () => {
  // 30분 단위 시간 옵션 (0:00 ~ 24:00)
  const startHourSelect = document.getElementById("start-hour");
  const endHourSelect = document.getElementById("end-hour");

  let startOptions = '';
  let endOptions = '';
  for (let i = 0; i < 48; i++) {
    const time = fmtTime(i);
    startOptions += `<option value="${i}">${time}</option>`;
    endOptions += `<option value="${i + 1}">${fmtTime(i + 1)}</option>`;
  }

  startHourSelect.innerHTML = startOptions;
  endHourSelect.innerHTML = endOptions;
  startHourSelect.value = 18; // 09:00
  endHourSelect.value = 36;   // 18:00

  // 캘린더 초기화 - 이번 달
  const today = new Date();
  calendarYear = today.getFullYear();
  calendarMonth = today.getMonth();
  selectedDates = new Set();

  renderCalendar();
};

const renderCalendar = () => {
  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  document.getElementById('calendar-month-year').textContent = `${calendarYear}년 ${monthNames[calendarMonth]}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 이전 달 버튼은 현재 달 이전으로 못 가게
  const prevBtn = document.getElementById('cal-prev');
  const isCurrentOrPast = (calendarYear < today.getFullYear()) ||
                          (calendarYear === today.getFullYear() && calendarMonth <= today.getMonth());
  prevBtn.disabled = isCurrentOrPast;

  // 해당 월의 첫 번째 날과 마지막 날
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startDayOfWeek = firstDay.getDay(); // 0 = 일요일
  const daysInMonth = lastDay.getDate();

  const calendarDays = document.getElementById('calendar-days');
  calendarDays.innerHTML = '';

  // 빈 칸 (이전 달의 마지막 날들)
  for (let i = 0; i < startDayOfWeek; i++) {
    const empty = document.createElement('div');
    empty.className = 'date-btn empty';
    calendarDays.appendChild(empty);
  }

  // 실제 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(calendarYear, calendarMonth, day);
    const iso = date.toISOString().slice(0, 10);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-btn';
    if (isPast) btn.classList.add('past');
    if (isToday) btn.classList.add('today');
    if (selectedDates.has(iso)) btn.classList.add('selected');
    btn.textContent = day;
    btn.dataset.date = iso;

    if (!isPast) {
      btn.onclick = () => {
        if (selectedDates.has(iso)) {
          selectedDates.delete(iso);
          btn.classList.remove('selected');
        } else {
          selectedDates.add(iso);
          btn.classList.add('selected');
        }
        updateDateCount();
      };
    }

    calendarDays.appendChild(btn);
  }
};

const changeMonth = (delta) => {
  const today = new Date();
  const newMonth = calendarMonth + delta;

  if (delta < 0) {
    // 과거로 못 가게
    if (calendarYear < today.getFullYear() ||
        (calendarYear === today.getFullYear() && calendarMonth <= today.getMonth())) {
      return;
    }
  }

  if (newMonth < 0) {
    calendarMonth = 11;
    calendarYear--;
  } else if (newMonth > 11) {
    calendarMonth = 0;
    calendarYear++;
  } else {
    calendarMonth = newMonth;
  }
  renderCalendar();
};

const updateDateCount = () => {
  document.getElementById("date-count").textContent = selectedDates.size;
};

const handleCreateMeeting = async (e) => {
  e.preventDefault();
  hideError("create-error");

  const title = document.getElementById("meeting-title").value.trim();
  const organizerName = document.getElementById("organizer-name").value.trim();
  const duration = Number(document.getElementById("duration").value);
  const startSlot = Number(document.getElementById("start-hour").value); // 30분 단위
  const endSlot = Number(document.getElementById("end-hour").value);
  const dates = Array.from(selectedDates).sort();

  if (!title) return showError("create-error", "회의 제목을 입력해주세요.");
  if (!organizerName) return showError("create-error", "주최자 이름을 입력해주세요.");
  if (dates.length === 0) return showError("create-error", "최소 1개 이상의 날짜를 선택해주세요.");
  if (endSlot <= startSlot) return showError("create-error", "종료 시간은 시작 시간보다 늦어야 합니다.");

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = '생성 중...';

  try {
    const id = genId();
    const meeting = {
      id, title, organizerName, duration,
      startSlot, endSlot, dates,
      createdAt: Date.now(),
      participants: {}
    };

    const result = await apiCreateMeeting(meeting);
    currentMeeting = result;

    // 이 사람이 주최자임을 표시
    sessionStorage.setItem(`organizer:${id}`, '1');

    document.getElementById("meeting-title").value = "";
    document.getElementById("organizer-name").value = "";
    selectedDates = new Set();

    displayOrganizerDashboard();
    window.history.pushState({}, '', `?m=${id}`);
    navigate("organizer");
  } catch (e) {
    console.error(e);
    showError("create-error", "회의 생성에 실패했습니다. 다시 시도해주세요.");
    submitBtn.disabled = false;
    submitBtn.innerHTML = '회의 만들기 <svg class="btn-icon" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  }
};

// ═══════════════════════════════════════════════════════════════
//  주최자 대시보드
// ═══════════════════════════════════════════════════════════════

const displayOrganizerDashboard = () => {
  if (!currentMeeting) return;
  const m = currentMeeting;

  document.getElementById("org-title").textContent = m.title;
  const startTime = fmtTime(m.startSlot);
  const endTime = fmtTime(m.endSlot);
  document.getElementById("org-info").textContent =
    `${m.organizerName} · ${m.duration}분 회의 · 후보 ${m.dates.length}일 · ${startTime} - ${endTime}`;
  document.getElementById("org-link").textContent = getShareUrl(m.id);
};

const refreshOrganizerDashboard = async () => {
  if (!currentMeeting) return;

  try {
    const fresh = await apiGetMeeting(currentMeeting.id);
    if (fresh) currentMeeting = fresh;
  } catch (e) {
    console.error(e);
  }

  displayOrganizerDashboard();

  const m = currentMeeting;
  const participants = Object.entries(m.participants || {});
  const total = participants.length;

  document.getElementById("org-count").textContent = total;

  const emptyState = document.getElementById("org-empty");
  const content = document.getElementById("org-content");

  if (total === 0) {
    emptyState.classList.remove("hidden");
    content.classList.add("hidden");
  } else {
    emptyState.classList.add("hidden");
    content.classList.remove("hidden");

    const slots = generateSlots(m.dates, m.startSlot, m.endSlot);
    const slotScores = slots.map(slot => {
      const unavailable = participants.filter(([_, p]) =>
        (p.unavailableSlots || []).includes(slot.id)
      );
      return {
        ...slot,
        availableCount: total - unavailable.length,
        unavailableNames: unavailable.map(([n]) => n)
      };
    });

    displayRecommendations(m, slotScores, total);
    displayHeatmap(m, slotScores, total);
    displayParticipants(participants);
  }
};

// 슬롯 ID: "2026-05-10_18" (날짜_30분슬롯번호)
const generateSlots = (dates, startSlot, endSlot) => {
  const slots = [];
  for (const date of dates) {
    for (let s = startSlot; s < endSlot; s++) {
      slots.push({ id: `${date}_${s}`, date, slot: s });
    }
  }
  return slots;
};

const displayRecommendations = (m, slotScores, total) => {
  // 회의 길이만큼 연속된 슬롯이 필요 (30분 단위)
  const slotsNeeded = m.duration / 30;
  const recommendations = [];

  for (const date of m.dates) {
    const dateSlots = slotScores.filter(s => s.date === date).sort((a, b) => a.slot - b.slot);
    for (let i = 0; i <= dateSlots.length - slotsNeeded; i++) {
      const window = dateSlots.slice(i, i + slotsNeeded);
      const allUnavailable = new Set();
      window.forEach(s => s.unavailableNames.forEach(n => allUnavailable.add(n)));
      recommendations.push({
        date,
        startSlot: window[0].slot,
        endSlot: window[window.length - 1].slot + 1,
        availableCount: total - allUnavailable.size,
        unavailableNames: Array.from(allUnavailable)
      });
    }
  }

  recommendations.sort((a, b) =>
    b.availableCount - a.availableCount ||
    new Date(a.date) - new Date(b.date) ||
    a.startSlot - b.startSlot
  );

  const container = document.getElementById("org-recommendations");
  container.innerHTML = recommendations.slice(0, 5).map((rec, i) => {
    const isPerfect = rec.availableCount === total;
    const isTop = i === 0;
    const className = isPerfect ? "perfect" : isTop ? "top" : "";

    return `
      <div class="recommendation-item ${className}">
        <div class="recommendation-rank">#${i + 1}</div>
        <div class="recommendation-info">
          <div class="recommendation-time">
            ${fmtDate(rec.date)} · ${fmtTime(rec.startSlot)} - ${fmtTime(rec.endSlot)}
          </div>
          <div class="recommendation-desc">
            ${rec.availableCount}/${total}명 가능
            ${rec.unavailableNames.length > 0 ? `· 불가: ${rec.unavailableNames.join(", ")}` : ""}
          </div>
        </div>
        ${isPerfect ? '<div class="recommendation-badge"><svg style="width: 0.75rem; height: 0.75rem; stroke: currentColor; fill: none; stroke-width: 3;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> 전원 가능</div>' : ""}
      </div>
    `;
  }).join("");
};

const getColorClass = (available, total) => {
  if (total === 0) return "color-stone-5";
  const ratio = available / total;
  if (ratio === 1) return "color-green-5";
  if (ratio >= 0.75) return "color-green-3";
  if (ratio >= 0.5) return "color-amber-2";
  if (ratio >= 0.25) return "color-orange-2";
  return "color-rose-2";
};

const renderTimeTable = (m, slotMap, mode) => {
  // mode: 'heatmap' (주최자) | 'select' (참여자)
  const slots = [];
  for (let s = m.startSlot; s < m.endSlot; s++) slots.push(s);

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  // 헤더 (날짜)
  let html = '<div class="time-table">';
  html += '<div class="time-row header-row">';
  html += '<div class="time-label"></div>';
  for (const date of m.dates) {
    const d = new Date(date);
    const dow = d.getDay();
    const colClass = dow === 0 ? 'sunday-col' : dow === 6 ? 'saturday-col' : '';
    const weekdayClass = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : '';
    html += `
      <div class="date-header ${colClass}">
        <div class="date-header-month">${d.getMonth() + 1}월</div>
        <div class="date-header-day">${d.getDate()}</div>
        <div class="date-header-weekday ${weekdayClass}">${dayNames[dow]}</div>
      </div>
    `;
  }
  html += '</div>';

  // 본문 (시간별)
  for (const s of slots) {
    const isHourMark = s % 2 === 0; // 짝수 슬롯이 정시 (0=00:00, 2=01:00)
    const labelClass = isHourMark ? 'hour-label' : 'half-hour-label';
    const rowClass = isHourMark ? 'hour-divider' : '';

    html += `<div class="time-row ${rowClass}">`;
    html += `<div class="time-label ${labelClass}">${fmtTime(s)}</div>`;

    for (const date of m.dates) {
      const dow = new Date(date).getDay();
      const colClass = dow === 0 ? 'sunday-col' : dow === 6 ? 'saturday-col' : '';
      const slotId = `${date}_${s}`;

      if (mode === 'heatmap') {
        const data = slotMap[slotId];
        const colorClass = getColorClass(data.availableCount, data.total);
        const title = data.unavailableNames.length > 0
          ? `불가: ${data.unavailableNames.join(", ")}`
          : "전원 가능";
        html += `<div class="heatmap-cell ${colorClass}" title="${title}">${data.availableCount}/${data.total}</div>`;
      } else {
        const isUnavail = selectedUnavailable.has(slotId);
        const slotClass = isUnavail ? 'time-slot-unavailable' : `time-slot-available ${colClass}`;
        html += `
          <button type="button"
            class="time-slot ${slotClass}"
            data-slot-id="${slotId}"
            onmousedown="handleSlotMouseDown('${slotId}')"
            onmouseenter="handleSlotMouseEnter('${slotId}')"
            ontouchstart="handleSlotMouseDown('${slotId}'); event.preventDefault();">
            ${isUnavail ? '<svg class="time-slot-x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>' : ''}
          </button>
        `;
      }
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
};

const displayHeatmap = (m, slotScores, total) => {
  const slotMap = {};
  slotScores.forEach(s => {
    slotMap[s.id] = { ...s, total };
  });

  let html = `
    <div class="heatmap-legend">
      <span>가능한 인원:</span>
      <div class="legend-item"><div class="legend-box color-green-5"></div> 전원</div>
      <div class="legend-item"><div class="legend-box color-green-3"></div> 75%+</div>
      <div class="legend-item"><div class="legend-box color-amber-2"></div> 50%+</div>
      <div class="legend-item"><div class="legend-box color-orange-2"></div> 25%+</div>
      <div class="legend-item"><div class="legend-box color-rose-2"></div> 적음</div>
    </div>
  `;

  html += renderTimeTable(m, slotMap, 'heatmap');
  document.getElementById("org-heatmap").innerHTML = html;
};

const displayParticipants = (participants) => {
  const container = document.getElementById("org-participants");
  container.innerHTML = participants.map(([name, p]) => `
    <div class="participant-card">
      <div class="participant-card-header">
        <div class="participant-avatar">${name.charAt(0)}</div>
        <span class="participant-name">${name}</span>
      </div>
      <div class="participant-info">불가 ${(p.unavailableSlots || []).length}개 슬롯</div>
    </div>
  `).join("");
};

const copyShareLink = () => {
  const link = document.getElementById("org-link").textContent;
  navigator.clipboard?.writeText(link);
  const btn = event.target.closest(".btn-copy");
  btn.classList.add("success");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> 복사됨!';
  setTimeout(() => {
    btn.classList.remove("success");
    btn.innerHTML = originalHTML;
  }, 2000);
};

// ═══════════════════════════════════════════════════════════════
//  참여자 화면
// ═══════════════════════════════════════════════════════════════

const displayParticipantNameForm = () => {
  if (!currentMeeting) return;
  const m = currentMeeting;
  document.getElementById("pname-title").textContent = m.title;
  document.getElementById("pname-desc").textContent =
    `${m.organizerName}님이 회의 일정을 조율하고 있습니다. ${m.duration}분 · 후보 ${m.dates.length}일 · ${fmtTime(m.startSlot)} - ${fmtTime(m.endSlot)}`;
  document.getElementById("participant-name").value = "";
};

const proceedToSelect = () => {
  const name = document.getElementById("participant-name").value.trim();
  if (!name) return;

  currentParticipantName = name;
  selectedUnavailable = new Set(currentMeeting.participants?.[name]?.unavailableSlots || []);

  displayParticipantSelectForm();
  navigate("participant-select");
};

const displayParticipantSelectForm = () => {
  if (!currentMeeting) return;
  const m = currentMeeting;

  document.getElementById("psel-name").textContent = currentParticipantName;
  document.getElementById("psel-title").textContent = m.title;

  document.getElementById("psel-grid").innerHTML = renderTimeTable(m, {}, 'select');
  updateSlotCount();
};

const handleSlotMouseDown = (slotId) => {
  const isCurrent = selectedUnavailable.has(slotId);
  dragMode = isCurrent ? "remove" : "add";
  toggleSlot(slotId);
};

const handleSlotMouseEnter = (slotId) => {
  if (!dragMode) return;
  const has = selectedUnavailable.has(slotId);
  if (dragMode === "add" && !has) {
    selectedUnavailable.add(slotId);
    updateSingleSlot(slotId);
  } else if (dragMode === "remove" && has) {
    selectedUnavailable.delete(slotId);
    updateSingleSlot(slotId);
  }
  updateSlotCount();
};

const toggleSlot = (slotId) => {
  if (selectedUnavailable.has(slotId)) {
    selectedUnavailable.delete(slotId);
  } else {
    selectedUnavailable.add(slotId);
  }
  updateSingleSlot(slotId);
  updateSlotCount();
};

const updateSingleSlot = (slotId) => {
  const btn = document.querySelector(`[data-slot-id="${slotId}"]`);
  if (!btn) return;

  const date = slotId.split('_')[0];
  const dow = new Date(date).getDay();
  const colClass = dow === 0 ? 'sunday-col' : dow === 6 ? 'saturday-col' : '';

  if (selectedUnavailable.has(slotId)) {
    btn.className = 'time-slot time-slot-unavailable';
    btn.innerHTML = '<svg class="time-slot-x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  } else {
    btn.className = `time-slot time-slot-available ${colClass}`;
    btn.innerHTML = '';
  }
};

const updateSlotCount = () => {
  document.getElementById("psel-count").textContent = selectedUnavailable.size;
};

const clearAllSlots = () => {
  selectedUnavailable.clear();
  // 모든 슬롯 새로고침
  if (currentMeeting) {
    document.getElementById("psel-grid").innerHTML = renderTimeTable(currentMeeting, {}, 'select');
  }
  updateSlotCount();
};

const submitParticipant = async () => {
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '제출 중...';

  try {
    const result = await apiSubmitResponse(
      currentMeeting.id,
      currentParticipantName,
      Array.from(selectedUnavailable)
    );
    currentMeeting = result;

    displayParticipantDone();
    navigate("participant-done");
  } catch (e) {
    console.error(e);
    alert('제출에 실패했습니다. 다시 시도해주세요.');
    btn.disabled = false;
    btn.innerHTML = '응답 제출 <svg class="btn-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  }
};

const displayParticipantDone = () => {
  document.getElementById("pdone-name").textContent = `${currentParticipantName}님의 응답이 저장되었습니다.`;
  document.getElementById("pdone-count").textContent = `${selectedUnavailable.size}개의 시간을 불가능으로 표시했습니다.`;
};

const backToSelect = () => {
  navigate("participant-select");
};

// ─── 글로벌 이벤트 ───
document.addEventListener("mouseup", () => { dragMode = null; });
document.addEventListener("touchend", () => { dragMode = null; });

// 5초마다 주최자 대시보드 자동 새로고침
setInterval(() => {
  if (document.getElementById("organizer-view").classList.contains("active")) {
    refreshOrganizerDashboard();
  }
}, 5000);
