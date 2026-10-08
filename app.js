// ============================================================
// 팀원 모니터링 일정 관리 대시보드 (Web App)
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
  const month = today.getMonth(); // 0-indexed

  // YYYY-MM-DD 포맷터
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

// 애플리케이션 상태 (State)
class ScheduleApp {
  constructor() {
    this.currentDate = new Date(); // 현재 보고 있는 기준 날짜
    this.viewMode = 'month'; // 'month' | 'week'
    this.selectedMemberFilter = null; // null: 전체 보기, string: 특정 memberId
    this.selectedColor = PRESET_COLORS[0];

    // 데이터 로드
    this.members = this.loadStorage('app_members', INITIAL_MEMBERS);
    this.schedules = this.loadStorage('app_schedules', generateSampleSchedules());

    // DOM 요소 캐싱
    this.cacheDom();

    // 초기화 및 이벤트 리스너 등록
    this.initPresetColors();
    this.bindEvents();
    this.render();
  }

  // 스토리지 헬퍼
  loadStorage(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      console.warn('LocalStorage 로드 실패:', e);
      return defaultVal;
    }
  }

  saveStorage() {
    try {
      localStorage.setItem('app_members', JSON.stringify(this.members));
      localStorage.setItem('app_schedules', JSON.stringify(this.schedules));
    } catch (e) {
      console.error('LocalStorage 저장 실패:', e);
    }
  }

  cacheDom() {
    // 헤더 컨트롤
    this.btnPrev = document.getElementById('btn-prev');
    this.btnNext = document.getElementById('btn-next');
    this.btnToday = document.getElementById('btn-today');
    this.currentPeriodTitle = document.getElementById('current-period-title');
    this.viewMonthBtn = document.getElementById('view-month-btn');
    this.viewWeekBtn = document.getElementById('view-week-btn');

    // 액션 버튼들
    this.btnAddSchedule = document.getElementById('btn-add-schedule');
    this.btnManageMembers = document.getElementById('btn-manage-members');
    this.btnSettingsData = document.getElementById('btn-settings-data');

    // 상단 요약 및 필터
    this.todayDutyList = document.getElementById('today-duty-list');
    this.memberFilterChips = document.getElementById('member-filter-chips');

    // 메인 뷰
    this.monthView = document.getElementById('month-view');
    this.weekView = document.getElementById('week-view');
    this.monthGrid = document.getElementById('month-grid');
    this.weekHeaderRow = document.getElementById('week-header-row');
    this.weekBodyRow = document.getElementById('week-body-row');

    // 모달들
    this.scheduleModal = document.getElementById('schedule-modal');
    this.scheduleForm = document.getElementById('schedule-form');
    this.scheduleModalTitle = document.getElementById('schedule-modal-title');
    this.scheduleIdInput = document.getElementById('schedule-id');
    this.scheduleMemberSelect = document.getElementById('schedule-member');
    this.scheduleDateInput = document.getElementById('schedule-date');
    this.scheduleTypeSelect = document.getElementById('schedule-type');
    this.scheduleNotesInput = document.getElementById('schedule-notes');
    this.btnDeleteSchedule = document.getElementById('btn-delete-schedule');

    this.memberModal = document.getElementById('member-modal');
    this.newMemberForm = document.getElementById('new-member-form');
    this.newMemberName = document.getElementById('new-member-name');
    this.newMemberRole = document.getElementById('new-member-role');
    this.presetColorsContainer = document.getElementById('preset-colors');
    this.memberListContainer = document.getElementById('member-list-container');
    this.memberCountSpan = document.getElementById('member-count');

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

  bindEvents() {
    // 이전 / 다음 / 오늘 네비게이션
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

    // 모달 닫기 버튼들
    document.querySelectorAll('.modal-close-btn, .btn-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = btn.dataset.modal;
        if (modalId) {
          document.getElementById(modalId).classList.add('hidden');
        }
      });
    });

    // 모달 바깥 배경 클릭 시 닫기
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      }
    });

    // 일정 저장 폼
    this.scheduleForm.addEventListener('submit', (e) => this.handleSaveSchedule(e));
    this.btnDeleteSchedule.addEventListener('click', () => this.handleDeleteSchedule());

    // 신규 팀원 등록 폼
    this.newMemberForm.addEventListener('submit', (e) => this.handleAddMember(e));

    // 데이터 백업 및 복원
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

  // 날짜 이동
  navigate(direction) {
    if (this.viewMode === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + direction);
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
    }
    this.render();
  }

  // 전체 화면 렌더링
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
      // 주간 뷰의 경우 주차 표시
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

  // 오늘 모니터링 당번 렌더링
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

  // 팀원 필터 칩 렌더링
  renderMemberFilters() {
    this.memberFilterChips.innerHTML = '';

    // '전체' 칩
    const allChip = document.createElement('button');
    allChip.className = `chip-btn ${this.selectedMemberFilter === null ? 'active' : ''}`;
    allChip.textContent = '전체 보기';
    allChip.addEventListener('click', () => {
      this.selectedMemberFilter = null;
      this.render();
    });
    this.memberFilterChips.appendChild(allChip);

    // 각 팀원 칩
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

  // 월간 달력 렌더링
  renderMonthView() {
    this.monthGrid.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // 1일의 요일 (0: 일요일 ~ 6: 토요일)
    const firstDay = new Date(year, month, 1).getDay();
    // 이번 달 총 일수
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // 지난 달 마지막 날짜
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = this.formatDate(new Date());

    // 총 35칸 or 42칸 계산
    const totalCells = (firstDay + daysInMonth > 35) ? 42 : 35;

    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = 'month-cell';

      let cellDate;
      let isCurrentMonth = true;

      if (i < firstDay) {
        // 지난 달 날짜
        const d = daysInPrevMonth - firstDay + i + 1;
        cellDate = new Date(year, month - 1, d);
        isCurrentMonth = false;
        cell.classList.add('other-month');
      } else if (i >= firstDay + daysInMonth) {
        // 다음 달 날짜
        const d = i - (firstDay + daysInMonth) + 1;
        cellDate = new Date(year, month + 1, d);
        isCurrentMonth = false;
        cell.classList.add('other-month');
      } else {
        // 이번 달 날짜
        const d = i - firstDay + 1;
        cellDate = new Date(year, month, d);
      }

      const dateStr = this.formatDate(cellDate);
      const dayOfWeek = cellDate.getDay();

      if (dayOfWeek === 0) cell.classList.add('sunday');
      if (dayOfWeek === 6) cell.classList.add('saturday');
      if (dateStr === todayStr) cell.classList.add('is-today');

      // 셀 헤더 (날짜 번호 및 + 버튼)
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

      // 일정 리스트 컨테이너
      const eventsList = document.createElement('div');
      eventsList.className = 'cell-events-list';

      // 필터링 적용된 해당 날짜 일정
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

      // 빈 공간 클릭 시 일정 추가
      cell.addEventListener('click', () => {
        this.openScheduleModal(null, dateStr);
      });

      this.monthGrid.appendChild(cell);
    }
  }

  // 주간 달력 렌더링
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

      // 헤더 셀
      const headerCol = document.createElement('div');
      headerCol.className = `week-col-header-item ${isToday ? 'today' : ''}`;
      headerCol.innerHTML = `
        <div class="w-day-name ${i === 0 ? 'sun' : (i === 6 ? 'sat' : '')}">${dayNames[i]}요일</div>
        <div class="w-day-num">${d.getDate()}</div>
      `;
      this.weekHeaderRow.appendChild(headerCol);

      // 바디 컬럼
      const bodyCol = document.createElement('div');
      bodyCol.className = `week-col-body-item ${isToday ? 'today' : ''}`;

      // 해당 날짜 일정 찾기
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
  // 일정 모달 처리
  // ============================================================
  openScheduleModal(schedule = null, targetDate = null) {
    // 팀원 옵션 채우기
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
      // 수정 모드
      this.scheduleModalTitle.textContent = '모니터링 일정 수정';
      this.scheduleIdInput.value = schedule.id;
      this.scheduleMemberSelect.value = schedule.memberId;
      this.scheduleDateInput.value = schedule.date;
      this.scheduleTypeSelect.value = schedule.type;
      this.scheduleNotesInput.value = schedule.notes || '';
      this.btnDeleteSchedule.classList.remove('hidden');
    } else {
      // 신규 추가 모드
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

  handleSaveSchedule(e) {
    e.preventDefault();
    const id = this.scheduleIdInput.value;
    const memberId = this.scheduleMemberSelect.value;
    const date = this.scheduleDateInput.value;
    const type = this.scheduleTypeSelect.value;
    const notes = this.scheduleNotesInput.value.trim();

    if (!date || !memberId) {
      alert('날짜와 담당 팀원을 선택해 주세요.');
      return;
    }

    if (id) {
      // 기존 일정 수정
      const idx = this.schedules.findIndex(s => s.id === id);
      if (idx !== -1) {
        this.schedules[idx] = { id, memberId, date, type, notes };
      }
    } else {
      // 신규 일정 추가
      const newSchedule = {
        id: 's_' + Date.now(),
        memberId,
        date,
        type,
        notes
      };
      this.schedules.push(newSchedule);
    }

    this.saveStorage();
    this.scheduleModal.classList.add('hidden');
    this.render();
  }

  handleDeleteSchedule() {
    const id = this.scheduleIdInput.value;
    if (!id) return;

    if (confirm('이 모니터링 일정을 삭제하시겠습니까?')) {
      this.schedules = this.schedules.filter(s => s.id !== id);
      this.saveStorage();
      this.scheduleModal.classList.add('hidden');
      this.render();
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

      // 이니셜
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

  handleAddMember(e) {
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

    this.members.push(newMember);
    this.saveStorage();

    this.newMemberName.value = '';
    this.newMemberRole.value = '';
    this.renderMemberList();
    this.render();
  }

  deleteMember(memberId) {
    this.members = this.members.filter(m => m.id !== memberId);
    this.schedules = this.schedules.filter(s => s.memberId !== memberId);
    if (this.selectedMemberFilter === memberId) {
      this.selectedMemberFilter = null;
    }
    this.saveStorage();
    this.renderMemberList();
    this.render();
  }

  // ============================================================
  // 데이터 백업 / 복원 처리
  // ============================================================
  openDataModal() {
    this.dataModal.classList.remove('hidden');
  }

  exportJson() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
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
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.members && json.schedules) {
          if (confirm('백업 파일을 불러오시겠습니까? 현재 데이터가 덮어씌워집니다.')) {
            this.members = json.members;
            this.schedules = json.schedules;
            this.saveStorage();
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

  loadSampleData() {
    if (confirm('예시 샘플 데이터로 다시 채우시겠습니까?')) {
      this.members = INITIAL_MEMBERS;
      this.schedules = generateSampleSchedules();
      this.saveStorage();
      this.dataModal.classList.add('hidden');
      this.render();
    }
  }

  resetAllData() {
    if (confirm('정말로 모든 팀원과 일정을 초기화(삭제)하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      this.members = [];
      this.schedules = [];
      this.selectedMemberFilter = null;
      this.saveStorage();
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
    const day = d.getDay(); // 0(일요일) ~ 6(토요일)
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }
}

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
  window.scheduleApp = new ScheduleApp();
});
