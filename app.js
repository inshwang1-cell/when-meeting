// When? - 회의 일정 조율 앱 / 엔디에스 전략기획팀

// ── 전역 상태 ──────────────────────────────────────────────────
var currentMeeting = null;
var currentName = null;
var unavailable = new Set();
var dragMode = null;
var calYear, calMonth;
var selectedDates = new Set();

// ── 유틸 ───────────────────────────────────────────────────────
function genId() {
  return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);
}

function fmtDate(iso) {
  var d = new Date(iso);
  var days = ['일','월','화','수','목','금','토'];
  return (d.getMonth()+1)+'월 '+d.getDate()+'일 ('+days[d.getDay()]+')';
}

function fmtTime(slot) {
  var total = slot * 30;
  var h = Math.floor(total / 60);
  var m = total % 60;
  return ('0'+h).slice(-2)+':'+('0'+m).slice(-2);
}

function pad2(n) { return ('0'+n).slice(-2); }

// ── API ────────────────────────────────────────────────────────
async function apiGet(id) {
  var r = await fetch('/api/meetings?id='+encodeURIComponent(id));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('서버 오류 '+r.status);
  return r.json();
}

async function apiCreate(meeting) {
  var r = await fetch('/api/meetings', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(meeting)
  });
  if (!r.ok) throw new Error('생성 실패 '+r.status);
  return r.json();
}

async function apiSubmit(meetingId, name, slots) {
  var r = await fetch('/api/meetings', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({meetingId:meetingId, name:name, unavailableSlots:slots})
  });
  if (!r.ok) throw new Error('제출 실패 '+r.status);
  return r.json();
}

// ── URL ────────────────────────────────────────────────────────
function getMeetingIdFromUrl() {
  return new URLSearchParams(window.location.search).get('m');
}

function getShareUrl(id) {
  return location.origin + location.pathname + '?m=' + id;
}

// ── 화면 전환 ──────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
  var el = document.getElementById(name+'-view');
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

function navigate(name) {
  showView(name);
  if (name === 'create') initCalendar();
  if (name === 'organizer') renderDashboard();
}

function goHome() {
  currentMeeting = null;
  currentName = null;
  unavailable = new Set();
  selectedDates = new Set();
  history.pushState({}, '', location.pathname);
  showView('home');
}

// ── 초기 로드 ──────────────────────────────────────────────────
window.addEventListener('load', async function() {
  var id = getMeetingIdFromUrl();
  if (id) {
    showView('loading');
    try {
      var m = await apiGet(id);
      if (m) {
        currentMeeting = m;
        var isOrg = sessionStorage.getItem('org:'+id) === '1';
        if (isOrg) {
          navigate('organizer');
        } else {
          fillParticipantForm();
          showView('pname');
        }
      } else {
        alert('회의를 찾을 수 없습니다.');
        showView('home');
      }
    } catch(e) {
      alert('오류: '+e.message);
      showView('home');
    }
  } else {
    showView('home');
  }
});

// ── 캘린더 ────────────────────────────────────────────────────
function initCalendar() {
  var today = new Date();
  today.setHours(0,0,0,0);
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  selectedDates = new Set();
  renderCalendar();
  // 시간 옵션
  var sEl = document.getElementById('start-hour');
  var eEl = document.getElementById('end-hour');
  sEl.innerHTML = '';
  eEl.innerHTML = '';
  for (var i = 0; i < 48; i++) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = fmtTime(i);
    sEl.appendChild(opt);
  }
  for (var i = 1; i <= 48; i++) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = fmtTime(i);
    eEl.appendChild(opt);
  }
  sEl.value = 18; // 09:00
  eEl.value = 36; // 18:00
  document.getElementById('date-count').textContent = '0';
  document.getElementById('create-error').classList.add('hidden');
}

function renderCalendar() {
  var months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  document.getElementById('cal-title').textContent = calYear+'년 '+months[calMonth];

  var today = new Date(); today.setHours(0,0,0,0);
  var first = new Date(calYear, calMonth, 1);
  var last  = new Date(calYear, calMonth+1, 0);
  var startDow = first.getDay();
  var daysInMonth = last.getDate();

  var prevBtn = document.getElementById('cal-prev');
  prevBtn.disabled = (calYear === today.getFullYear() && calMonth <= today.getMonth())
                  || (calYear < today.getFullYear());

  var grid = document.getElementById('cal-days');
  grid.innerHTML = '';

  for (var i = 0; i < startDow; i++) {
    var empty = document.createElement('div');
    empty.className = 'date-btn empty';
    grid.appendChild(empty);
  }

  for (var day = 1; day <= daysInMonth; day++) {
    var d = new Date(calYear, calMonth, day);
    var iso = d.toISOString().slice(0,10);
    var isPast = d < today;
    var dow = d.getDay();

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-btn' + (isPast ? ' past' : '') + (selectedDates.has(iso) ? ' selected' : '');
    btn.textContent = day;
    btn.dataset.iso = iso;

    if (!isPast) {
      btn.onclick = function() {
        var isoVal = this.dataset.iso;
        if (selectedDates.has(isoVal)) {
          selectedDates.delete(isoVal);
          this.classList.remove('selected');
        } else {
          selectedDates.add(isoVal);
          this.classList.add('selected');
        }
        document.getElementById('date-count').textContent = selectedDates.size;
      };
    }
    grid.appendChild(btn);
  }
}

function changeMonth(delta) {
  var today = new Date();
  if (delta < 0 && calYear === today.getFullYear() && calMonth <= today.getMonth()) return;
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

// ── 회의 생성 ─────────────────────────────────────────────────
async function handleCreate(e) {
  e.preventDefault();
  var errEl = document.getElementById('create-error');
  errEl.classList.add('hidden');

  var title = document.getElementById('meeting-title').value.trim();
  var orgName = document.getElementById('organizer-name').value.trim();
  var duration = Number(document.getElementById('duration').value);
  var startSlot = Number(document.getElementById('start-hour').value);
  var endSlot = Number(document.getElementById('end-hour').value);
  var dates = Array.from(selectedDates).sort();

  if (!title) { errEl.textContent='회의 제목을 입력해주세요.'; errEl.classList.remove('hidden'); return; }
  if (!orgName) { errEl.textContent='주최자 이름을 입력해주세요.'; errEl.classList.remove('hidden'); return; }
  if (dates.length === 0) { errEl.textContent='날짜를 선택해주세요.'; errEl.classList.remove('hidden'); return; }
  if (endSlot <= startSlot) { errEl.textContent='종료 시간이 시작 시간보다 늦어야 합니다.'; errEl.classList.remove('hidden'); return; }

  var btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = '생성 중...';

  try {
    var id = genId();
    var meeting = { id:id, title:title, organizerName:orgName, duration:duration,
                    startSlot:startSlot, endSlot:endSlot, dates:dates,
                    createdAt:Date.now(), participants:{} };
    var result = await apiCreate(meeting);
    currentMeeting = result;
    sessionStorage.setItem('org:'+id, '1');
    history.pushState({}, '', '?m='+id);
    navigate('organizer');
  } catch(err) {
    errEl.textContent = '생성 실패: '+err.message;
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = '회의 만들기 →';
  }
}

// ── 대시보드 ──────────────────────────────────────────────────
function renderDashboard() {
  if (!currentMeeting) return;
  var m = currentMeeting;
  m.startSlot = Number(m.startSlot);
  m.endSlot = Number(m.endSlot);
  m.duration = Number(m.duration);
  document.getElementById('org-title').textContent = m.title;
  document.getElementById('org-info').textContent =
    m.organizerName+' · '+m.duration+'분 · 후보 '+m.dates.length+'일 · '+fmtTime(m.startSlot)+' - '+fmtTime(m.endSlot);
  document.getElementById('org-link').textContent = getShareUrl(m.id);
  renderResults();
}

async function refreshDashboard() {
  if (!currentMeeting) return;
  try {
    var fresh = await apiGet(currentMeeting.id);
    if (fresh) { currentMeeting = fresh; renderDashboard(); }
  } catch(e) { /* 조용히 실패 */ }
}

function renderResults() {
  var m = currentMeeting;
  var participants = Object.entries(m.participants || {});
  var total = participants.length;
  document.getElementById('org-count').textContent = total;

  if (total === 0) {
    document.getElementById('org-empty').classList.remove('hidden');
    document.getElementById('org-content').classList.add('hidden');
    return;
  }
  document.getElementById('org-empty').classList.add('hidden');
  document.getElementById('org-content').classList.remove('hidden');

  // 슬롯 점수 계산
  var slotMap = {};
  for (var date of m.dates) {
    for (var s = m.startSlot; s < m.endSlot; s++) {
      var sid = date+'_'+s;
      var cnt = participants.filter(function(p){ return (p[1].unavailableSlots||[]).includes(sid); }).length;
      slotMap[sid] = { available: total-cnt, names: participants.filter(function(p){ return (p[1].unavailableSlots||[]).includes(sid); }).map(function(p){ return p[0]; }) };
    }
  }

  renderRecommendations(m, slotMap, total, participants);
  renderHeatmap(m, slotMap, total);
  renderParticipants(participants);
}

function renderRecommendations(m, slotMap, total, participants) {
  var need = m.duration / 30;
  var recs = [];
  for (var date of m.dates) {
    for (var s = m.startSlot; s <= m.endSlot - need; s++) {
      var unavailSet = new Set();
      for (var j = 0; j < need; j++) {
        var sid = date+'_'+(s+j);
        if (slotMap[sid]) slotMap[sid].names.forEach(function(n){ unavailSet.add(n); });
      }
      recs.push({ date:date, start:s, end:s+need, avail:total-unavailSet.size, unavail:Array.from(unavailSet) });
    }
  }
  recs.sort(function(a,b){ return b.avail-a.avail || new Date(a.date)-new Date(b.date) || a.start-b.start; });

  var html = '';
  recs.slice(0,5).forEach(function(r,i){
    var perfect = r.avail === total;
    var cls = perfect ? 'rec-perfect' : (i===0 ? 'rec-top' : '');
    html += '<div class="rec-item '+cls+'">';
    html += '<div class="rec-rank">#'+(i+1)+'</div>';
    html += '<div class="rec-info">';
    html += '<div class="rec-time">'+fmtDate(r.date)+' · '+fmtTime(r.start)+' - '+fmtTime(r.end)+'</div>';
    html += '<div class="rec-desc">'+r.avail+'/'+total+'명 가능';
    if (r.unavail.length) html += ' · 불가: '+r.unavail.join(', ');
    html += '</div></div>';
    if (perfect) html += '<div class="rec-badge">✓ 전원 가능</div>';
    html += '</div>';
  });
  document.getElementById('org-recs').innerHTML = html;
}

function renderHeatmap(m, slotMap, total) {
  var dayNames = ['일','월','화','수','목','금','토'];
  var html = '<div class="grid-table">';
  // 헤더
  html += '<div class="grid-row">';
  html += '<div class="grid-time-label"></div>';
  for (var date of m.dates) {
    var d = new Date(date);
    var dow = d.getDay();
    var cls = dow===0?' dow-sun':dow===6?' dow-sat':'';
    html += '<div class="grid-col-header'+cls+'">'+(d.getMonth()+1)+'월<br><strong>'+d.getDate()+'</strong><br><span>'+dayNames[dow]+'</span></div>';
  }
  html += '</div>';
  // 슬롯
  for (var s = m.startSlot; s < m.endSlot; s++) {
    var isHour = s%2 === 0;
    html += '<div class="grid-row'+(isHour?' row-hour':'')+'">';
    html += '<div class="grid-time-label'+(isHour?' lbl-hour':' lbl-half')+'">'+fmtTime(s)+'</div>';
    for (var date of m.dates) {
      var sid = date+'_'+s;
      var info = slotMap[sid] || {available:total, names:[]};
      var ratio = total > 0 ? info.available/total : 1;
      var cls = ratio===1?'c5':ratio>=.75?'c4':ratio>=.5?'c3':ratio>=.25?'c2':'c1';
      var tip = info.names.length ? '불가: '+info.names.join(', ') : '전원 가능';
      html += '<div class="heat-cell '+cls+'" title="'+tip+'">'+info.available+'/'+total+'</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('org-heatmap').innerHTML = html;
}

function renderParticipants(participants) {
  var html = '';
  participants.forEach(function(p){
    html += '<div class="p-card">';
    html += '<div class="p-avatar">'+p[0].charAt(0)+'</div>';
    html += '<div><div class="p-name">'+p[0]+'</div>';
    html += '<div class="p-info">불가 '+(p[1].unavailableSlots||[]).length+'개 슬롯</div></div>';
    html += '</div>';
  });
  document.getElementById('org-participants').innerHTML = html;
}

function copyLink() {
  var link = document.getElementById('org-link').textContent;
  navigator.clipboard.writeText(link).then(function(){
    var btn = document.getElementById('copy-btn');
    btn.textContent = '✓ 복사됨!';
    btn.style.background = '#22c55e';
    setTimeout(function(){ btn.textContent='링크 복사'; btn.style.background=''; }, 2000);
  });
}

// ── 참여자 폼 ─────────────────────────────────────────────────
function fillParticipantForm() {
  var m = currentMeeting;
  // 문자열로 저장된 경우 숫자로 변환
  m.startSlot = Number(m.startSlot);
  m.endSlot = Number(m.endSlot);
  m.duration = Number(m.duration);
  document.getElementById('pname-title').textContent = m.title || '회의';
  document.getElementById('pname-desc').textContent =
    (m.organizerName||'주최자')+'님이 회의 일정을 조율 중입니다. '+m.duration+'분 · '+fmtTime(m.startSlot)+' - '+fmtTime(m.endSlot);
  document.getElementById('pname-input').value = '';
}

function proceedToSelect() {
  var name = document.getElementById('pname-input').value.trim();
  if (!name) return;
  currentName = name;
  // 숫자 변환 보장
  currentMeeting.startSlot = Number(currentMeeting.startSlot);
  currentMeeting.endSlot = Number(currentMeeting.endSlot);
  currentMeeting.duration = Number(currentMeeting.duration);
  var existing = (currentMeeting.participants||{})[name];
  unavailable = new Set(existing ? existing.unavailableSlots : []);
  document.getElementById('psel-name').textContent = name;
  document.getElementById('psel-title').textContent = currentMeeting.title;
  renderSelectGrid();
  showView('pselect');
}

// ── 시간 선택 그리드 ──────────────────────────────────────────
function renderSelectGrid() {
  var m = currentMeeting;
  var dayNames = ['일','월','화','수','목','금','토'];
  var html = '<div class="grid-table">';
  // 헤더
  html += '<div class="grid-row">';
  html += '<div class="grid-time-label"></div>';
  for (var date of m.dates) {
    var d = new Date(date);
    var dow = d.getDay();
    var cls = dow===0?' dow-sun':dow===6?' dow-sat':'';
    html += '<div class="grid-col-header'+cls+'">'+(d.getMonth()+1)+'월<br><strong>'+d.getDate()+'</strong><br><span class="dow-label'+(dow===0?' sun':dow===6?' sat':'')+'">'+dayNames[dow]+'</span></div>';
  }
  html += '</div>';
  // 슬롯
  for (var s = m.startSlot; s < m.endSlot; s++) {
    var isHour = s%2 === 0;
    html += '<div class="grid-row'+(isHour?' row-hour':'')+'">';
    html += '<div class="grid-time-label'+(isHour?' lbl-hour':' lbl-half')+'">'+fmtTime(s)+'</div>';
    for (var date of m.dates) {
      var sid = date+'_'+s;
      var dow = new Date(date).getDay();
      var isUnavail = unavailable.has(sid);
      var colCls = dow===0?' slot-sun':dow===6?' slot-sat':'';
      html += '<button type="button" class="time-slot'+(isUnavail?' unavail':colCls)+'" data-sid="'+sid+'" onmousedown="slotDown(\''+sid+'\')" onmouseenter="slotEnter(\''+sid+'\')" ontouchstart="slotDown(\''+sid+'\');event.preventDefault();">'+(isUnavail?'✕':'')+'</button>';
    }
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('psel-grid').innerHTML = html;
  updateCount();
}

function slotDown(sid) {
  dragMode = unavailable.has(sid) ? 'remove' : 'add';
  toggleSlot(sid);
}

function slotEnter(sid) {
  if (!dragMode) return;
  if (dragMode === 'add' && !unavailable.has(sid)) { unavailable.add(sid); updateSlot(sid); updateCount(); }
  if (dragMode === 'remove' && unavailable.has(sid)) { unavailable.delete(sid); updateSlot(sid); updateCount(); }
}

function toggleSlot(sid) {
  if (unavailable.has(sid)) unavailable.delete(sid);
  else unavailable.add(sid);
  updateSlot(sid);
  updateCount();
}

function updateSlot(sid) {
  var btn = document.querySelector('[data-sid="'+sid+'"]');
  if (!btn) return;
  var date = sid.split('_')[0];
  var dow = new Date(date).getDay();
  if (unavailable.has(sid)) {
    btn.className = 'time-slot unavail';
    btn.textContent = '✕';
  } else {
    var colCls = dow===0?' slot-sun':dow===6?' slot-sat':'';
    btn.className = 'time-slot'+colCls;
    btn.textContent = '';
  }
}

function updateCount() {
  document.getElementById('psel-count').textContent = unavailable.size;
}

function clearSlots() {
  unavailable.clear();
  renderSelectGrid();
}

async function submitResponse() {
  var btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = '제출 중...';
  try {
    var result = await apiSubmit(currentMeeting.id, currentName, Array.from(unavailable));
    currentMeeting = result;
    document.getElementById('done-name').textContent = currentName+'님의 응답이 저장되었습니다.';
    document.getElementById('done-count').textContent = unavailable.size+'개의 시간을 불가능으로 표시했습니다.';
    showView('done');
  } catch(e) {
    alert('제출 실패: '+e.message);
    btn.disabled = false; btn.textContent = '응답 제출';
  }
}

// ── 글로벌 이벤트 ─────────────────────────────────────────────
document.addEventListener('mouseup', function(){ dragMode = null; });
document.addEventListener('touchend', function(){ dragMode = null; });

// 5초마다 대시보드 새로고침
setInterval(function(){
  if (document.getElementById('organizer-view') &&
      document.getElementById('organizer-view').classList.contains('active')) {
    refreshDashboard();
  }
}, 5000);
