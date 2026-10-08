// ============================================================
// 팀원 모니터링 일정 관리 대시보드 (Web App)
// Supabase 클라우드 DB 연동 & LocalStorage 하이브리드 지원
// ============================================================

// 프리셋 색상 팔레트
const PRESET_COLORS = [
  '#3b82f6', // 블루
  '#10b981', // 에메랄드
  '#8b5cf6', // 퍼플
  '#f59e0b', // 앰버
  '#ec4899', // 핑크
  '#06b6d4', // 시안
  '#ef4444', // 레드
  '#6366f1', // 인디고
  '#14b8a6', // 틸
  '#84cc16'  // 라임
];

// 기본 샘플 데이터 (초기 실행 시 안내용)
const INITIAL_MEMBERS = [
  { id: 'm1', name: '김민수', role: '시스템 / 인프라', color: '#3b82f6' },
  { id: 'm2', name: '이지원', role: '백엔드 엔지니어', color: '#10b981' },
  { id: 'm3', name: '박서준', role: '플랫폼 운영', color: '#8b5cf6' },
  { id: 'm4', name: '최유진', role: '보안 / 네트워크', color: '#f59e0b' },
  { id: 'm5', name: '정현우', role: '데이터 엔지니어', color: '#ec4899' }
];

function generateSampleSchedules() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return [
    {
      id: 's1',
      memberId: 'm1',
      date: fmt(new Date(year, month, today.getDate())),
      type: '주간',
      notes: '오늘 주간 정기 모니터링'
    },
    {
      id: 's2',
      memberId: 'm2',
      date: fmt(new Date(year, month, today.getDate())),
      type: '야간',
      notes: '야간 서버 상태 점검 당번'
    },
    {
      id: 's3',
      memberId: 'm3',
      date: fmt(new Date(year, month, today.getDate() + 1)),
      type: '주간',
      notes: 'API 게이트웨이 트래픽 모니터링'
    },
    {
      id: 's4',
      memberId: 'm4',
      date: fmt(new Date(year, month, today.getDate() + 2)),
      type: '종일',
      notes: '정기 점검일 집중 모니터링'
    },
    {
      id: 's5',
      memberId: 'm5',
      date: fmt(new Date(year, month, today.getDate() + 3)),
      type: '비상대기',
      notes: '주말 1차 비상 연락망'
    },
    {
      id: 's6',
      memberId: 'm1',
      date: fmt(new Date(year, month, today.getDate() - 2)),
      type: '주간',
      notes: '배포 후 트래픽 안정화 확인'
    },
    {
      id: 's7',
      memberId: 'm2',
      date: fmt(new Date(year, month, today.getDate() - 1)),
      type: '주간',
      notes: 'DB 커넥션 모니터링'
    }
  ];
}

// SQL 스키마 텍스트 (모달에서 바로 복사 가능하도록 탑재)
const SQL_SCHEMA_TEXT = `-- 1. 팀원(members) 테이블
create table if not exists public.members (
  id text primary key,
  name text not null,
  role text,
  color text not null default '#3b82f6',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 모니터링 일정(schedules) 테이블
create table if not exists public.schedules (
  id text primary key,
  member_id text references public.members(id) on delete cascade,
  date text not null,
  type text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Row Level Security(RLS) 공개 읽기/쓰기 허용 정책
alter table public.members enable row level security;
alter table public.schedules enable row level security;

create policy "Allow public access for members" on public.members for all using (true) with check (true);
create policy "Allow public access for schedules" on public.schedules for all using (true) with check (true);`;

// 애플리케이션 클래스
class ScheduleApp {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'month'; // 'month' | 'week'
    this.selectedMemberFilter = null;
    this.selectedColor = PRESET_COLORS[0];

    this.members = [];
    this.schedules = [];

    this.cacheDom();
    this.initPresetColors();
    this.bindEvents();
    this.initData();
  }

  cacheDom() {
    // 헤더 컨트롤
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnToday = document.getElementById('btn-today');
    this.currentPeriodTitle = document.getElementById('current-period-title');
    this.viewMonthBtn = document.getElementById('view-month-btn');
    this.viewWeekBtn = document.getElementById('view-week-btn');

    // DB 상태 뱃지
    this.dbStatusPill = document.getElementById('db-status-pill');
    this.dbStatusText = document.getElementById('db-status-text');

    // 액션 버튼들
    this.btnAddSchedule = document.getElementById('btn-add-schedule');
    this.btnManageMembers = document.getElementById('btn-manage-members');
    this.btnSettingsData = document.getElementById('btn-settings-data');
    this.btnSupabaseModal = document.getElementById('btn-supabase-modal');

    // 상단 요약 및 필터
    this.todayDutyList = document.getElementById('today-duty-list');
    this.memberFilterChips = document.getElementById('member-filter-chips');

    // 메인 뷰
    this.monthView = document.getElementById('month-view');
    this.weekView = document.getElementById('week-view');
    this.monthGrid = document.getElementById('month-grid');
    this.weekHeaderRow = document.getElementById('week-header-row');
    this.weekBodyRow = document.getElementById('week-body-row');

    // 일정 모달
    this.scheduleModal = document.getElementById('schedule-modal');
    this.scheduleForm = document.getElementById('schedule-form');
    this.scheduleModalTitle = document.getElementById('schedule-modal-title');
    this.scheduleIdInput = document.getElementById('schedule-id');
    this.scheduleMemberSelect = document.getElementById('schedule-member');
    this.scheduleDateInput = document.getElementById('schedule-date');
    this.scheduleTypeSelect = document.getElementById('schedule-type');
    this.scheduleNotesInput = document.getElementById('schedule-notes');
    this.btnDeleteSchedule = document.getElementById('btn-delete-schedule');

    // 팀원 관리 모달
    this.memberModal = document.getElementById('member-modal');
    this.newMemberForm = document.getElementById('new-member-form');
    this.newMemberName = document.getElementById('new-member-name');
    this.newMemberRole = document.getElementById('new-member-role');
    this.presetColorsContainer = document.getElementById('preset-colors');
    this.memberListContainer = document.getElementById('member-list-container');
    this.memberCountSpan = document.getElementById('member-count');

    // Supabase 설정 모달
    this.supabaseModal = document.getElementById('supabase-modal');
    this.supabaseConfigForm = document.getElementById('supabase-config-form');
    this.inputSupabaseUrl = document.getElementById('input-supabase-url');
    this.inputSupabaseKey = document.getElementById('input-supabase-key');
    this.btnTestSupabase = document.getElementById('btn-test-supabase');
    this.btnDisconnectSupabase = document.getElementById('btn-disconnect-supabase');
    this.supabaseFeedback = document.getElementById('supabase-test-feedback');
    this.btnCopySql = document.getElementById('btn-copy-sql');

    // 데이터 백업/복원 모달
    this.dataModal = document.getElementById('data-modal');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.jsonFileInput = document.getElementById('json-file-input');
    this.btnLoadSample = document.getElementById('btn-load-sample');
    this.btnResetAll = document.getElementById('btn-reset-all');
  }

  initPresetColors() {
    this.presetColorsContainer.innerHTML = '';
    PRESET_COLORS.forEach((color, idx) => {
      const opt = document.createElement('div');
      opt.className = `color-option ${idx === 0 ? 'selected' : ''}`;
      opt.style.backgroundColor = color;
      opt.dataset.color = color;
      opt.addEventListener('click', () => {
        this.presetColorsContainer.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedColor = color;
      });
      this.presetColorsContainer.appendChild(opt);
    });
  }

  // 초기 데이터 비동기 로드
  async initData() {
    this.updateDbStatusPill();
    try {
      this.members = await window.dbService.getMembers(INITIAL_MEMBERS);
      this.schedules = await window.dbService.getSchedules(generateSampleSchedules());
    } catch (e) {
      console.warn('DB 로드 에러 (로컬 기본값 사용):', e);
      this.members = INITIAL_MEMBERS;
      this.schedules = generateSampleSchedules();
    }
    this.render();
  }

  // DB 상태 뱃지 업데이트
  updateDbStatusPill() {
    if (window.dbService && window.dbService.isSupabaseEnabled()) {
      this.dbStatusPill.classList.add('connected');
      this.dbStatusText.textContent = '🟢 Supabase 연결됨';
    } else {
      this.dbStatusPill.classList.remove('connected');
      this.dbStatusText.textContent = '⚡ 로컬 모드';
    }
  }

  bindEvents() {
    // 이전 / 다음 / 오늘
    this.btnPrev.addEventListener('click', () => this.navigate(-1));
    this.btnNext.addEventListener('click', () => this.navigate(1));
    this.btnToday.addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });

    // 뷰 전환
    this.viewMonthBtn.addEventListener('click', () => this.switchView('month'));
    this.viewWeekBtn.addEventListener('click', () => this.switchView('week'));

    // 모달 열기
    this.btnAddSchedule.addEventListener('click', () => this.openScheduleModal());
    this.btnManageMembers.addEventListener('click', () => this.openMemberModal());
    this.btnSettingsData.addEventListener('click', () => this.openDataModal());
    this.btnSupabaseModal.addEventListener('click', () => this.openSupabaseModal());
    this.dbStatusPill.addEventListener('click', () => this.openSupabaseModal());

    // 모달 닫기
    document.querySelectorAll('.modal-close-btn, .btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) {
          document.getElementById(modalId).classList.add('hidden');
        }
      });
    });

    // 배경 클릭 시 닫기
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // ESC 키로 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      }
    });

    // 일정 저장 / 삭제
    this.scheduleForm.addEventListener('submit', (e) => this.handleSaveSchedule(e));
    this.btnDeleteSchedule.addEventListener('click', () => this.handleDeleteSchedule());

    // 신규 팀원 등록
    this.newMemberForm.addEventListener('submit', (e) => this.handleAddMember(e));

    // Supabase 설정 관련
    this.supabaseConfigForm.addEventListener('submit', (e) => this.handleSaveSupabaseConfig(e));
    this.btnTestSupabase.addEventListener('click', () => this.handleTestSupabase());
    this.btnDisconnectSupabase.addEventListener('click', () => this.handleDisconnectSupabase());
    this.btnCopySql.addEventListener('click', () => this.handleCopySql());

    // 데이터 백업 / 복원
    this.btnExportJson.addEventListener('click', () => this.exportJson());
    this.jsonFileInput.addEventListener('change', (e) => this.importJson(e));
    this.btnLoadSample.addEventListener('click', () => this.loadSampleData());
    this.btnResetAll.addEventListener('click', () => this.resetAllData());
  }

  // 뷰 전환
  switchView(mode) {
    this.viewMode = mode;
    if (mode === 'month') {
      this.viewMonthBtn.classList.add('active');
      this.viewWeekBtn.classList.remove('active');
      this.monthView.classList.add('active');
      this.weekView.classList.remove('active');
    } else {
      this.viewWeekBtn.classList.add('active');
      this.viewMonthBtn.classList.remove('active');
      this.weekView.classList.add('active');
      this.monthView.classList.remove('active');
    }
    this.render();
  }

  navigate(direction) {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
    }
    this.render();
  }

  render() {
    this.updateHeaderTitle();
    this.renderTodayDuties();
    this.renderMemberFilters();

    if (this.viewMode === 'month') {
      this.renderMonthView();
    } else {
      this.renderWeekView();
    }
  }

  updateHeaderTitle() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;

    if (this.viewMode === 'month') {
      this.currentPeriodTitle.textContent = `${year}년 ${month}월`;
    } else {
      const startOfWeek = this.getStartOfWeek(this.currentDate);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const sM = startOfWeek.getMonth() + 1;
      const sD = startOfWeek.getDate();
      const eM = endOfWeek.getMonth() + 1;
      const eD = endOfWeek.getDate();

      this.currentPeriodTitle.textContent = `${year}년 ${sM}월 ${sD}일 ~ ${eM === sM ? '' : eM + '월 '}${eD}일`;
    }
  }

  renderTodayDuties() {
    const todayStr = this.formatDate(new Date());
    const todaySchedules = this.schedules.filter(s => s.date === todayStr);

    this.todayDutyList.innerHTML = '';
    if (todaySchedules.length === 0) {
      this.todayDutyList.innerHTML = '<span class="duty-empty">오늘 배정된 모니터링 일정이 없습니다.</span>';
      return;
    }

    todaySchedules.forEach(sc => {
      const member = this.members.find(m => m.id === sc.memberId);
      if (!member) return;

      const tag = document.createElement('div');
      tag.className = 'duty-tag';
      tag.style.backgroundColor = member.color;
      tag.innerHTML = `<span>${member.name}</span> <small style="opacity:0.9">(${sc.type})</small>`;
      tag.title = `${member.name} - ${sc.type}${sc.notes ? ` : ${sc.notes}` : ''}`;
      tag.addEventListener('click', () => this.openScheduleModal(sc));
      tag.style.cursor = 'pointer';
      this.todayDutyList.appendChild(tag);
    });
  }

  renderMemberFilters() {
    this.memberFilterChips.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = `chip-btn ${this.selectedMemberFilter === null ? 'active' : ''}`;
    allChip.textContent = '전체 보기';
    allChip.addEventListener('click', () => {
      this.selectedMemberFilter = null;
      this.render();
    });
    this.memberFilterChips.appendChild(allChip);

    this.members.forEach(member => {
      const chip = document.createElement('button');
      chip.className = `chip-btn ${this.selectedMemberFilter === member.id ? 'active' : ''}`;
      chip.innerHTML = `<span class="chip-dot" style="background-color: ${member.color}"></span>${member.name}`;
      chip.addEventListener('click', () => {
        this.selectedMemberFilter = (this.selectedMemberFilter === member.id) ? null : member.id;
        this.render();
      });
      this.memberFilterChips.appendChild(chip);
    });
  }

  renderMonthView() {
    this.monthGrid.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = this.formatDate(new Date());
    const totalCells = (firstDay + daysInMonth > 35) ? 42 : 35;

    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'month-cell';

      let cellDate;
      if (i < firstDay) {
        const d = daysInPrevMonth - firstDay + i + 1;
        cellDate = new Date(year, month - 1, d);
        cell.classList.add('other-month');
      } else if (i >= firstDay + daysInMonth) {
        const d = i - (firstDay + daysInMonth) + 1;
        cellDate = new Date(year, month + 1, d);
        cell.classList.add('other-month');
      } else {
        const d = i - firstDay + 1;
        cellDate = new Date(year, month, d);
      }

      const dateStr = this.formatDate(cellDate);
      const dayOfWeek = cellDate.getDay();

      if (dayOfWeek === 0) cell.classList.add('sunday');
      if (dayOfWeek === 6) cell.classList.add('saturday');
      if (dateStr === todayStr) cell.classList.add('is-today');

      const header = document.createElement('div');
      header.className = 'cell-header';

      const dateNum = document.createElement('span');
      dateNum.className = 'cell-date-num';
      dateNum.textContent = cellDate.getDate();

      const addBtn = document.createElement('button');
      addBtn.className = 'cell-add-btn';
      addBtn.innerHTML = '+';
      addBtn.title = '이 날짜에 모니터링 일정 추가';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openScheduleModal(null, dateStr);
      });

      header.appendChild(dateNum);
      header.appendChild(addBtn);
      cell.appendChild(header);

      const eventsList = document.createElement('div');
      eventsList.className = 'cell-events-list';

      const daySchedules = this.schedules.filter(s => {
        if (s.date !== dateStr) return false;
        if (this.selectedMemberFilter && s.memberId !== this.selectedMemberFilter) return false;
        return true;
      });

      daySchedules.forEach(schedule => {
        const member = this.members.find(m => m.id === schedule.memberId);
        if (!member) return;

        const badge = document.createElement('div');
        badge.className = 'schedule-badge';
        badge.style.backgroundColor = member.color;
        badge.innerHTML = `
          <span>
            <span class="badge-type">${schedule.type}</span>
            <span class="badge-name">${member.name}</span>
          </span>
          ${schedule.notes ? `<span class="badge-note" title="${schedule.notes}">${schedule.notes}</span>` : ''}
        `;

        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openScheduleModal(schedule);
        });

        eventsList.appendChild(badge);
      });

      cell.appendChild(eventsList);

      cell.addEventListener('click', () => {
        this.openScheduleModal(null, dateStr);
      });

      this.monthGrid.appendChild(cell);
    }
  }

  renderWeekView() {
    this.weekHeaderRow.innerHTML = '';
    this.weekBodyRow.innerHTML = '';

    const startOfWeek = this.getStartOfWeek(this.currentDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayStr = this.formatDate(new Date());

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateStr = this.formatDate(d);
      const isToday = (dateStr === todayStr);

      const headerCol = document.createElement('div');
      headerCol.className = `week-col-header-item ${isToday ? 'today' : ''}`;
      headerCol.innerHTML = `
        <div class="w-day-name ${i === 0 ? 'sun' : (i === 6 ? 'sat' : '')}">${dayNames[i]}요일</div>
        <div class="w-day-num">${d.getDate()}</div>
      `;
      this.weekHeaderRow.appendChild(headerCol);

      const bodyCol = document.createElement('div');
      bodyCol.className = `week-col-body-item ${isToday ? 'today' : ''}`;

      const daySchedules = this.schedules.filter(s => {
        if (s.date !== dateStr) return false;
        if (this.selectedMemberFilter && s.memberId !== this.selectedMemberFilter) return false;
        return true;
      });

      if (daySchedules.length === 0) {
        const emptyHint = document.createElement('div');
        emptyHint.style.color = '#94a3b8';
        emptyHint.style.fontSize = '0.8rem';
        emptyHint.style.textAlign = 'center';
        emptyHint.style.marginTop = '20px';
        emptyHint.textContent = '+ 클릭하여 추가';
        bodyCol.appendChild(emptyHint);
      } else {
        daySchedules.forEach(schedule => {
          const member = this.members.find(m => m.id === schedule.memberId);
          if (!member) return;

          const card = document.createElement('div');
          card.className = 'week-schedule-card';
          card.style.backgroundColor = member.color;
          card.innerHTML = `
            <div class="week-card-top">
              <span class="week-card-member">${member.name}</span>
              <span class="week-card-type">${schedule.type}</span>
            </div>
            ${schedule.notes ? `<div class="week-card-note">${schedule.notes}</div>` : ''}
          `;

          card.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openScheduleModal(schedule);
          });

          bodyCol.appendChild(card);
        });
      }

      bodyCol.addEventListener('click', () => {
        this.openScheduleModal(null, dateStr);
      });

      this.weekBodyRow.appendChild(bodyCol);
    }
  }

  // ============================================================
  // 일정 모달 처리 (비동기 DB 연동)
  // ============================================================
  openScheduleModal(schedule = null, targetDate = null) {
    this.scheduleMemberSelect.innerHTML = '';
    if (this.members.length === 0) {
      alert('먼저 팀원을 1명 이상 등록해 주세요.');
      this.openMemberModal();
      return;
    }

    this.members.forEach(member => {
      const opt = document.createElement('option');
      opt.value = member.id;
      opt.textContent = `${member.name} (${member.role || '팀원'})`;
      this.scheduleMemberSelect.appendChild(opt);
    });

    if (schedule) {
      this.scheduleModalTitle.textContent = '모니터링 일정 수정';
      this.scheduleIdInput.value = schedule.id;
      this.scheduleMemberSelect.value = schedule.memberId;
      this.scheduleDateInput.value = schedule.date;
      this.scheduleTypeSelect.value = schedule.type;
      this.scheduleNotesInput.value = schedule.notes || '';
      this.btnDeleteSchedule.classList.remove('hidden');
    } else {
      this.scheduleModalTitle.textContent = '모니터링 일정 추가';
      this.scheduleIdInput.value = '';
      this.scheduleMemberSelect.value = this.members[0].id;
      this.scheduleDateInput.value = targetDate || this.formatDate(new Date());
      this.scheduleTypeSelect.value = '주간';
      this.scheduleNotesInput.value = '';
      this.btnDeleteSchedule.classList.add('hidden');
    }

    this.scheduleModal.classList.remove('hidden');
  }

  async handleSaveSchedule(e) {
    e.preventDefault();
    const id = this.scheduleIdInput.value || ('s_' + Date.now());
    const memberId = this.scheduleMemberSelect.value;
    const date = this.scheduleDateInput.value;
    const type = this.scheduleTypeSelect.value;
    const notes = this.scheduleNotesInput.value.trim();

    if (!date || !memberId) {
      alert('날짜와 담당 팀원을 선택해 주세요.');
      return;
    }

    const payload = { id, memberId, date, type, notes };

    try {
      await window.dbService.saveSchedule(payload);
      // 로컬 배열 동기화
      const idx = this.schedules.findIndex(s => s.id === id);
      if (idx !== -1) {
        this.schedules[idx] = payload;
      } else {
        this.schedules.push(payload);
      }

      this.scheduleModal.classList.add('hidden');
      this.render();
    } catch (err) {
      alert('일정 저장 실패: ' + err.message);
    }
  }

  async handleDeleteSchedule() {
    const id = this.scheduleIdInput.value;
    if (!id) return;

    if (confirm('이 모니터링 일정을 삭제하시겠습니까?')) {
      try {
        await window.dbService.deleteSchedule(id);
        this.schedules = this.schedules.filter(s => s.id !== id);
        this.scheduleModal.classList.add('hidden');
        this.render();
      } catch (err) {
        alert('일정 삭제 실패: ' + err.message);
      }
    }
  }

  // ============================================================
  // 팀원 관리 모달 처리
  // ============================================================
  openMemberModal() {
    this.renderMemberList();
    this.newMemberName.value = '';
    this.newMemberRole.value = '';
    this.memberModal.classList.remove('hidden');
  }

  renderMemberList() {
    this.memberCountSpan.textContent = this.members.length;
    this.memberListContainer.innerHTML = '';

    this.members.forEach(member => {
      const card = document.createElement('div');
      card.className = 'member-card';

      const initial = member.name.charAt(0);

      card.innerHTML = `
        <div class="member-info-left">
          <div class="member-avatar-circle" style="background-color: ${member.color}">
            ${initial}
          </div>
          <div>
            <div class="member-name-text">${member.name}</div>
            <div class="member-role-text">${member.role || '팀원'}</div>
          </div>
        </div>
        <button class="member-del-btn" title="팀원 삭제">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      card.querySelector('.member-del-btn').addEventListener('click', () => {
        if (confirm(`'${member.name}' 팀원을 삭제하시겠습니까?\n해당 팀원의 일정도 함께 정리됩니다.`)) {
          this.deleteMember(member.id);
        }
      });

      this.memberListContainer.appendChild(card);
    });
  }

  async handleAddMember(e) {
    e.preventDefault();
    const name = this.newMemberName.value.trim();
    const role = this.newMemberRole.value.trim();

    if (!name) {
      alert('팀원 이름을 입력해 주세요.');
      return;
    }

    const newMember = {
      id: 'm_' + Date.now(),
      name,
      role: role || '팀원',
      color: this.selectedColor
    };

    try {
      await window.dbService.addMember(newMember);
      this.members.push(newMember);
      this.newMemberName.value = '';
      this.newMemberRole.value = '';
      this.renderMemberList();
      this.render();
    } catch (err) {
      alert('팀원 추가 실패: ' + err.message);
    }
  }

  async deleteMember(memberId) {
    try {
      await window.dbService.deleteMember(memberId);
      this.members = this.members.filter(m => m.id !== memberId);
      this.schedules = this.schedules.filter(s => s.memberId !== memberId);
      if (this.selectedMemberFilter === memberId) {
        this.selectedMemberFilter = null;
      }
      this.renderMemberList();
      this.render();
    } catch (err) {
      alert('팀원 삭제 실패: ' + err.message);
    }
  }

  // ============================================================
  // Supabase 모달 처리
  // ============================================================
  openSupabaseModal() {
    this.inputSupabaseUrl.value = window.SUPABASE_CONFIG.url || '';
    this.inputSupabaseKey.value = window.SUPABASE_CONFIG.anonKey || '';
    this.supabaseFeedback.className = 'connection-feedback hidden';
    this.supabaseFeedback.textContent = '';
    this.supabaseModal.classList.remove('hidden');
  }

  async handleTestSupabase() {
    const url = this.inputSupabaseUrl.value.trim();
    const key = this.inputSupabaseKey.value.trim();

    if (!url || !key) {
      this.showFeedback('error', 'URL과 anon Key를 모두 입력해 주세요.');
      return;
    }

    this.showFeedback('', '연결 테스트 중...');
    try {
      await window.dbService.testConnection(url, key);
      this.showFeedback('success', '✅ Supabase 연결 및 테이블 확인 성공!');
    } catch (err) {
      this.showFeedback('error', `❌ 연결 실패: ${err.message}\n(테이블 생성 SQL을 실행했는지 확인하세요)`);
    }
  }

  async handleSaveSupabaseConfig(e) {
    e.preventDefault();
    const url = this.inputSupabaseUrl.value.trim();
    const key = this.inputSupabaseKey.value.trim();

    if (!url || !key) {
      alert('URL과 anon Key를 입력해 주세요.');
      return;
    }

    try {
      this.showFeedback('', '연결 검증 중...');
      await window.dbService.testConnection(url, key);
      window.dbService.saveConfig(url, key);
      this.updateDbStatusPill();

      // 원격 데이터 로드 (만약 비어있다면 현재 로컬 데이터 업로드 제안)
      const remoteMembers = await window.dbService.getMembers([]);
      if (remoteMembers.length === 0 && this.members.length > 0) {
        if (confirm('새 Supabase DB가 비어있습니다. 현재 로컬에 있는 데이터를 Supabase로 이전(업로드)할까요?')) {
          await window.dbService.bulkSeedData(this.members, this.schedules);
        }
      }

      await this.initData();
      this.supabaseModal.classList.add('hidden');
      alert('🎉 Supabase 데이터베이스가 성공적으로 연동되었습니다!');
    } catch (err) {
      this.showFeedback('error', `❌ 연동 실패: ${err.message}`);
    }
  }

  handleDisconnectSupabase() {
    if (confirm('Supabase 연동을 해제하고 브라우저 로컬 저장소 모드로 전환하시겠습니까?')) {
      window.dbService.clearConfig();
      this.updateDbStatusPill();
      this.initData();
      this.supabaseModal.classList.add('hidden');
      alert('로컬 저장소 모드로 전환되었습니다.');
    }
  }

  handleCopySql() {
    navigator.clipboard.writeText(SQL_SCHEMA_TEXT).then(() => {
      this.btnCopySql.textContent = '✅ 복사 완료!';
      setTimeout(() => {
        this.btnCopySql.textContent = '📋 SQL 복사하기';
      }, 2500);
    }).catch(err => {
      alert('SQL 복사 실패: ' + err.message);
    });
  }

  showFeedback(type, message) {
    this.supabaseFeedback.className = `connection-feedback ${type}`;
    this.supabaseFeedback.textContent = message;
    this.supabaseFeedback.classList.remove('hidden');
  }

  // ============================================================
  // 데이터 백업 / 복원 처리
  // ============================================================
  openDataModal() {
    this.dataModal.classList.remove('hidden');
  }

  exportJson() {
    const data = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      isSupabase: window.dbService.isSupabaseEnabled(),
      members: this.members,
      schedules: this.schedules
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `모니터링_일정_백업_${this.formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.members && json.schedules) {
          if (confirm('백업 파일을 불러오시겠습니까? 현재 데이터베이스 내용이 덮어씌워집니다.')) {
            await window.dbService.bulkSeedData(json.members, json.schedules);
            this.members = json.members;
            this.schedules = json.schedules;
            this.dataModal.classList.add('hidden');
            this.render();
            alert('데이터가 성공적으로 복원되었습니다.');
          }
        } else {
          alert('올바른 백업 파일 형식이 아닙니다.');
        }
      } catch (err) {
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async loadSampleData() {
    if (confirm('예시 샘플 데이터로 다시 채우시겠습니까?')) {
      const sampleSchedules = generateSampleSchedules();
      await window.dbService.bulkSeedData(INITIAL_MEMBERS, sampleSchedules);
      this.members = INITIAL_MEMBERS;
      this.schedules = sampleSchedules;
      this.dataModal.classList.add('hidden');
      this.render();
    }
  }

  async resetAllData() {
    if (confirm('정말로 모든 팀원과 일정을 초기화(삭제)하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      await window.dbService.resetAll();
      this.members = [];
      this.schedules = [];
      this.selectedMemberFilter = null;
      this.dataModal.classList.add('hidden');
      this.render();
    }
  }

  // ============================================================
  // 유틸리티 함수
  // ============================================================
  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
  window.scheduleApp = new ScheduleApp();
});
