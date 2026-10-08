-- ============================================================
-- Supabase 테이블 생성 및 권한 설정 SQL
-- Supabase 대시보드 > SQL Editor 에서 붙여넣고 실행(Run)하세요.
-- ============================================================

-- 1. 팀원(members) 테이블 생성
create table if not exists public.members (
  id text primary key,
  name text not null,
  role text,
  color text not null default '#3b82f6',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 모니터링 일정(schedules) 테이블 생성
create table if not exists public.schedules (
  id text primary key,
  member_id text references public.members(id) on delete cascade,
  date text not null,
  type text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Row Level Security(RLS) 활성화
alter table public.members enable row level security;
alter table public.schedules enable row level security;

-- 4. 익명 사용자(anon) 읽기/쓰기/수정/삭제 정책 허용
-- (팀원 누구나 브라우저에서 바로 조회 및 편집할 수 있도록 허용)
drop policy if exists "Allow public access for members" on public.members;
create policy "Allow public access for members" 
  on public.members 
  for all 
  using (true) 
  with check (true);

drop policy if exists "Allow public access for schedules" on public.schedules;
create policy "Allow public access for schedules" 
  on public.schedules 
  for all 
  using (true) 
  with check (true);

-- 5. 실시간 동기화(Realtime) 활성화 (선택 사항)
alter publication supabase_realtime add table public.members;
alter publication supabase_realtime add table public.schedules;
