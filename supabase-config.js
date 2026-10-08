// ============================================================
// Supabase 설정 및 데이터베이스 어댑터 (supabase-config.js)
// ============================================================

/**
 * 💡 Supabase 연동 방법:
 * 1. Supabase 프로젝트(https://supabase.com)를 생성합니다.
 * 2. SQL Editor에서 'schema.sql' 파일의 내용을 복사하여 실행합니다.
 * 3. Settings > API 에서 Project URL과 anon/public Key를 확인한 뒤
 *    아래 변수에 직접 입력하거나, 웹앱 화면의 [DB 설정] 버튼을 눌러 입력하세요.
 */

window.SUPABASE_CONFIG = {
  // 예: 'https://xyzcompany.supabase.co'
  url: '',
  // 예: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  anonKey: ''
};

// 스토리지에 저장된 설정이 있으면 우선 로드
(function loadSavedConfig() {
  const savedUrl = localStorage.getItem('supabase_url');
  const savedKey = localStorage.getItem('supabase_key');
  if (savedUrl) window.SUPABASE_CONFIG.url = savedUrl;
  if (savedKey) window.SUPABASE_CONFIG.anonKey = savedKey;
})();

// Supabase 클라이언트 인스턴스
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const { url, anonKey } = window.SUPABASE_CONFIG;
  if (url && anonKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(url, anonKey);
      return supabaseClient;
    } catch (e) {
      console.error('Supabase 클라이언트 초기화 실패:', e);
      return null;
    }
  }
  return null;
}

// ============================================================
// 통합 데이터 서비스 레이어 (dbService)
// Supabase가 설정되어 있으면 원격 DB 사용, 미설정 시 localStorage 사용
// ============================================================
window.dbService = {
  // 현재 Supabase 모드 활성화 여부
  isSupabaseEnabled() {
    return Boolean(window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey && window.supabase);
  },

  // 연결 테스트
  async testConnection(url, anonKey) {
    if (!window.supabase) {
      throw new Error('Supabase SDK 라이브러리를 불러오지 못했습니다.');
    }
    const testClient = window.supabase.createClient(url, anonKey);
    // 간단히 members 테이블 쿼리 시도
    const { data, error } = await testClient.from('members').select('id').limit(1);
    if (error) throw error;
    return true;
  },

  // 설정 저장
  saveConfig(url, anonKey) {
    window.SUPABASE_CONFIG.url = url.trim();
    window.SUPABASE_CONFIG.anonKey = anonKey.trim();
    localStorage.setItem('supabase_url', window.SUPABASE_CONFIG.url);
    localStorage.setItem('supabase_key', window.SUPABASE_CONFIG.anonKey);
    supabaseClient = null; // 재초기화 유도
  },

  // 설정 초기화 (로컬 모드로 전환)
  clearConfig() {
    window.SUPABASE_CONFIG.url = '';
    window.SUPABASE_CONFIG.anonKey = '';
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    supabaseClient = null;
  },

  // ----------------------------------------------------------
  // 1. 팀원(Members) CRUD
  // ----------------------------------------------------------
  async getMembers(defaultList = []) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('members')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('[Supabase] getMembers 에러:', error);
        throw error;
      }
      return data || [];
    }

    // 로컬 스토리지 모드
    try {
      const local = localStorage.getItem('app_members');
      return local ? JSON.parse(local) : defaultList;
    } catch (e) {
      return defaultList;
    }
  },

  async addMember(member) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('members')
        .insert([{
          id: member.id,
          name: member.name,
          role: member.role,
          color: member.color
        }])
        .select()
        .single();
      if (error) {
        console.error('[Supabase] addMember 에러:', error);
        throw error;
      }
      return data;
    }

    // 로컬 스토리지 모드
    const members = await this.getMembers();
    members.push(member);
    localStorage.setItem('app_members', JSON.stringify(members));
    return member;
  },

  async deleteMember(memberId) {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('members')
        .delete()
        .eq('id', memberId);
      if (error) {
        console.error('[Supabase] deleteMember 에러:', error);
        throw error;
      }
      return true;
    }

    // 로컬 스토리지 모드
    let members = await this.getMembers();
    members = members.filter(m => m.id !== memberId);
    localStorage.setItem('app_members', JSON.stringify(members));

    // 연결된 일정들도 로컬에서 삭제
    let schedules = await this.getSchedules();
    schedules = schedules.filter(s => s.memberId !== memberId && s.member_id !== memberId);
    localStorage.setItem('app_schedules', JSON.stringify(schedules));
    return true;
  },

  // ----------------------------------------------------------
  // 2. 모니터링 일정(Schedules) CRUD
  // ----------------------------------------------------------
  async getSchedules(defaultList = []) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('schedules')
        .select('*')
        .order('date', { ascending: true });
      if (error) {
        console.error('[Supabase] getSchedules 에러:', error);
        throw error;
      }
      // 필드명 통일 (member_id -> memberId)
      return (data || []).map(item => ({
        id: item.id,
        memberId: item.member_id || item.memberId,
        date: item.date,
        type: item.type,
        notes: item.notes || ''
      }));
    }

    // 로컬 스토리지 모드
    try {
      const local = localStorage.getItem('app_schedules');
      return local ? JSON.parse(local) : defaultList;
    } catch (e) {
      return defaultList;
    }
  },

  async saveSchedule(schedule) {
    const client = getSupabaseClient();
    if (client) {
      const payload = {
        id: schedule.id,
        member_id: schedule.memberId,
        date: schedule.date,
        type: schedule.type,
        notes: schedule.notes || ''
      };
      const { data, error } = await client
        .from('schedules')
        .upsert(payload)
        .select()
        .single();
      if (error) {
        console.error('[Supabase] saveSchedule 에러:', error);
        throw error;
      }
      return {
        id: data.id,
        memberId: data.member_id,
        date: data.date,
        type: data.type,
        notes: data.notes
      };
    }

    // 로컬 스토리지 모드
    const schedules = await this.getSchedules();
    const idx = schedules.findIndex(s => s.id === schedule.id);
    if (idx !== -1) {
      schedules[idx] = schedule;
    } else {
      schedules.push(schedule);
    }
    localStorage.setItem('app_schedules', JSON.stringify(schedules));
    return schedule;
  },

  async deleteSchedule(scheduleId) {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('schedules')
        .delete()
        .eq('id', scheduleId);
      if (error) {
        console.error('[Supabase] deleteSchedule 에러:', error);
        throw error;
      }
      return true;
    }

    // 로컬 스토리지 모드
    let schedules = await this.getSchedules();
    schedules = schedules.filter(s => s.id !== scheduleId);
    localStorage.setItem('app_schedules', JSON.stringify(schedules));
    return true;
  },

  // ----------------------------------------------------------
  // 3. 샘플 데이터 일괄 적재 및 초기화
  // ----------------------------------------------------------
  async bulkSeedData(members, schedules) {
    const client = getSupabaseClient();
    if (client) {
      // Supabase 테이블 비우고 새로 넣기
      await client.from('schedules').delete().neq('id', '___non_existent___');
      await client.from('members').delete().neq('id', '___non_existent___');

      if (members.length > 0) {
        await client.from('members').insert(members.map(m => ({
          id: m.id,
          name: m.name,
          role: m.role,
          color: m.color
        })));
      }

      if (schedules.length > 0) {
        await client.from('schedules').insert(schedules.map(s => ({
          id: s.id,
          member_id: s.memberId,
          date: s.date,
          type: s.type,
          notes: s.notes || ''
        })));
      }
      return true;
    }

    // 로컬 스토리지 모드
    localStorage.setItem('app_members', JSON.stringify(members));
    localStorage.setItem('app_schedules', JSON.stringify(schedules));
    return true;
  },

  async resetAll() {
    const client = getSupabaseClient();
    if (client) {
      await client.from('schedules').delete().neq('id', '___non_existent___');
      await client.from('members').delete().neq('id', '___non_existent___');
    }
    localStorage.removeItem('app_members');
    localStorage.removeItem('app_schedules');
    return true;
  }
};
