-- ── TST Database Schema (Idempotent) ──────────────────────────
-- Este script pode ser executado várias vezes sem gerar erros ou duplicidades.

create extension if not exists "pgcrypto";

-- 1. Criação segura de Enums (se não existirem)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_type') then
    create type public.user_type as enum ('aluno', 'administrador', 'instrutor');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type public.user_status as enum ('ativo', 'inativo');
  end if;
  if not exists (select 1 from pg_type where typname = 'training_status') then
    create type public.training_status as enum ('rascunho', 'publicado', 'arquivado');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('pendente', 'em_andamento', 'aprovado', 'reprovado', 'vencido');
  end if;
  if not exists (select 1 from pg_type where typname = 'media_provider') then
    create type public.media_provider as enum ('supabase_storage', 'youtube_privado', 'vimeo');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_audience') then
    create type public.notification_audience as enum ('aluno', 'administrador');
  end if;
end$$;

-- 2. Tabelas (CREATE TABLE IF NOT EXISTS)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null,
  cpf text unique,
  matricula text,
  cargo text,
  setor text,
  empresa text not null default 'TST',
  unidade text,
  email text not null,
  telefone text,
  tipo public.user_type not null default 'aluno',
  status public.user_status not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nr text,
  descricao text,
  created_at timestamptz not null default now()
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  objetivo text,
  category_id uuid references public.training_categories(id) on delete set null,
  nr text,
  carga_horaria_minutos integer not null check (carga_horaria_minutos > 0),
  instructor_id uuid references public.profiles(id) on delete set null,
  nota_minima numeric(5,2) not null default 70 check (nota_minima between 0 and 100),
  max_tentativas integer not null default 3 check (max_tentativas > 0),
  validade_meses integer not null default 12 check (validade_meses > 0),
  exigir_video_100 boolean not null default true,
  permitir_avanco_video boolean not null default false,
  bloquear_avanco_video boolean not null default true,
  status public.training_status not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_media (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  provider public.media_provider not null default 'supabase_storage',
  storage_path text,
  external_url text,
  duracao_segundos integer,
  created_at timestamptz not null default now(),
  constraint media_source_check check (storage_path is not null or external_url is not null)
);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  status public.assignment_status not null default 'pendente',
  unique (student_id, training_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  pergunta text not null,
  peso numeric(6,2) not null default 1 check (peso > 0),
  explicacao text,
  ordem integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.alternatives (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  letra char(1) not null check (letra in ('A', 'B', 'C', 'D')),
  texto text not null,
  correta boolean not null default false,
  unique (question_id, letra)
);

-- Garantir índice único para uma alternativa correta por pergunta
do $$
begin
  if not exists (select 1 from pg_class where relname = 'one_correct_alternative_per_question') then
    create unique index one_correct_alternative_per_question
      on public.alternatives(question_id)
      where correta = true;
  end if;
end$$;

create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.training_assignments(id) on delete cascade,
  started_at timestamptz,
  finished_at timestamptz,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  watched_percent numeric(5,2) not null default 0 check (watched_percent between 0 and 100),
  pause_count integer not null default 0 check (pause_count >= 0),
  seek_attempts integer not null default 0 check (seek_attempts >= 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.training_assignments(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  score numeric(5,2) not null check (score between 0 and 100),
  status public.assignment_status not null check (status in ('aprovado', 'reprovado')),
  submitted_at timestamptz not null default now(),
  unique (assignment_id, attempt_number)
);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  alternative_id uuid not null references public.alternatives(id) on delete cascade,
  correta boolean not null,
  peso_obtido numeric(6,2) not null default 0,
  unique (attempt_id, question_id)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.training_assignments(id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  codigo_validacao text not null unique,
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  qr_payload text not null,
  storage_path text,
  signed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  audience public.notification_audience not null,
  titulo text not null,
  mensagem text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. Índices (CREATE INDEX IF NOT EXISTS)
create index if not exists profiles_tipo_status_idx on public.profiles(tipo, status);
create index if not exists training_assignments_student_idx on public.training_assignments(student_id, status);
create index if not exists training_assignments_training_idx on public.training_assignments(training_id, status);
create index if not exists certificates_codigo_idx on public.certificates(codigo_validacao);
create index if not exists notifications_profile_idx on public.notifications(profile_id, read_at);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

-- 4. Funções e Triggers Genéricos de Updated At
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace trigger trainings_set_updated_at
before update on public.trainings
for each row execute function public.set_updated_at();

create or replace trigger video_progress_set_updated_at
before update on public.video_progress
for each row execute function public.set_updated_at();

-- 5. Função Utilitária de Tipo do Usuário
create or replace function public.current_user_type()
returns public.user_type
language sql
security definer
set search_path = public
as $$
  select tipo from public.profiles where id = auth.uid();
$$;

-- Habilitar RLS nas Tabelas
alter table public.profiles enable row level security;
alter table public.training_categories enable row level security;
alter table public.trainings enable row level security;
alter table public.training_media enable row level security;
alter table public.training_assignments enable row level security;
alter table public.questions enable row level security;
alter table public.alternatives enable row level security;
alter table public.video_progress enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- 6. Políticas RLS (Exclui se existirem antes de criar)
do $$
begin
  drop policy if exists "admins manage profiles" on public.profiles;
  drop policy if exists "users read own profile" on public.profiles;
  drop policy if exists "users update own profile" on public.profiles;
  drop policy if exists "admins manage training catalog" on public.trainings;
  drop policy if exists "active users read published trainings" on public.trainings;
  drop policy if exists "admins manage categories" on public.training_categories;
  drop policy if exists "users read categories" on public.training_categories;
  drop policy if exists "admins manage media" on public.training_media;
  drop policy if exists "assigned students read media" on public.training_media;
  drop policy if exists "admins manage assignments" on public.training_assignments;
  drop policy if exists "students read own assignments" on public.training_assignments;
  drop policy if exists "admins manage questions" on public.questions;
  drop policy if exists "assigned students read questions" on public.questions;
  drop policy if exists "admins manage alternatives" on public.alternatives;
  drop policy if exists "assigned students read alternatives" on public.alternatives;
  drop policy if exists "students manage own video progress" on public.video_progress;
  drop policy if exists "admins read all video progress" on public.video_progress;
  drop policy if exists "students insert own attempts" on public.assessment_attempts;
  drop policy if exists "students read own attempts" on public.assessment_attempts;
  drop policy if exists "admins read all attempts" on public.assessment_attempts;
  drop policy if exists "students insert own answers" on public.assessment_answers;
  drop policy if exists "students read own answers" on public.assessment_answers;
  drop policy if exists "admins read all answers" on public.assessment_answers;
  drop policy if exists "students read own certificates" on public.certificates;
  drop policy if exists "admins manage certificates" on public.certificates;
  drop policy if exists "users read own notifications" on public.notifications;
  drop policy if exists "admins manage notifications" on public.notifications;
  drop policy if exists "admins read audit logs" on public.audit_logs;
end$$;

create policy "admins manage profiles" on public.profiles for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "admins manage training catalog" on public.trainings for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "active users read published trainings" on public.trainings for select using (status = 'publicado' and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.status = 'ativo'));

create policy "admins manage categories" on public.training_categories for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "users read categories" on public.training_categories for select using (auth.uid() is not null);

create policy "admins manage media" on public.training_media for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "assigned students read media" on public.training_media for select using (exists (select 1 from public.training_assignments ta where ta.training_id = training_media.training_id and ta.student_id = auth.uid()));

create policy "admins manage assignments" on public.training_assignments for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "students read own assignments" on public.training_assignments for select using (student_id = auth.uid());

create policy "admins manage questions" on public.questions for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "assigned students read questions" on public.questions for select using (exists (select 1 from public.training_assignments ta where ta.training_id = questions.training_id and ta.student_id = auth.uid()));

create policy "admins manage alternatives" on public.alternatives for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');
create policy "assigned students read alternatives" on public.alternatives for select using (exists (select 1 from public.questions q join public.training_assignments ta on ta.training_id = q.training_id where q.id = alternatives.question_id and ta.student_id = auth.uid()));

create policy "students manage own video progress" on public.video_progress for all using (exists (select 1 from public.training_assignments ta where ta.id = video_progress.assignment_id and ta.student_id = auth.uid())) with check (exists (select 1 from public.training_assignments ta where ta.id = video_progress.assignment_id and ta.student_id = auth.uid()));
create policy "admins read all video progress" on public.video_progress for select using (public.current_user_type() = 'administrador');

create policy "students insert own attempts" on public.assessment_attempts for insert with check (exists (select 1 from public.training_assignments ta where ta.id = assessment_attempts.assignment_id and ta.student_id = auth.uid()));
create policy "students read own attempts" on public.assessment_attempts for select using (exists (select 1 from public.training_assignments ta where ta.id = assessment_attempts.assignment_id and ta.student_id = auth.uid()));
create policy "admins read all attempts" on public.assessment_attempts for select using (public.current_user_type() = 'administrador');

create policy "students insert own answers" on public.assessment_answers for insert with check (exists (select 1 from public.assessment_attempts aa join public.training_assignments ta on ta.id = aa.assignment_id where aa.id = assessment_answers.attempt_id and ta.student_id = auth.uid()));
create policy "students read own answers" on public.assessment_answers for select using (exists (select 1 from public.assessment_attempts aa join public.training_assignments ta on ta.id = aa.assignment_id where aa.id = assessment_answers.attempt_id and ta.student_id = auth.uid()));
create policy "admins read all answers" on public.assessment_answers for select using (public.current_user_type() = 'administrador');

create policy "students read own certificates" on public.certificates for select using (exists (select 1 from public.training_assignments ta where ta.id = certificates.assignment_id and ta.student_id = auth.uid()));
create policy "admins manage certificates" on public.certificates for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');

create policy "users read own notifications" on public.notifications for select using (profile_id = auth.uid() or public.current_user_type() = 'administrador');
create policy "admins manage notifications" on public.notifications for all using (public.current_user_type() = 'administrador') with check (public.current_user_type() = 'administrador');

create policy "admins read audit logs" on public.audit_logs for select using (public.current_user_type() = 'administrador');

-- 7. Buckets de Storage
insert into storage.buckets (id, name, public)
values
  ('training-videos', 'training-videos', false),
  ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- 8. Gatilhos do Patch de Autenticação Automática e Vinculação

-- Criar perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    nome_completo,
    cpf,
    matricula,
    cargo,
    setor,
    empresa,
    unidade,
    email,
    tipo,
    status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_completo', 'Novo Aluno'),
    new.raw_user_meta_data->>'cpf',
    new.raw_user_meta_data->>'matricula',
    new.raw_user_meta_data->>'cargo',
    new.raw_user_meta_data->>'setor',
    coalesce(new.raw_user_meta_data->>'empresa', 'TST'),
    new.raw_user_meta_data->>'unidade',
    new.email,
    coalesce((new.raw_user_meta_data->>'tipo')::public.user_type, 'aluno'::public.user_type),
    'ativo'::public.user_status
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Associar todos os treinamentos publicados ao novo aluno
create or replace function public.handle_new_profile_assignments()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  t_record record;
begin
  if new.tipo = 'aluno' then
    for t_record in select id from public.trainings where status = 'publicado' loop
      insert into public.training_assignments (student_id, training_id, status)
      values (new.id, t_record.id, 'pendente')
      on conflict (student_id, training_id) do nothing;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_created_assign_trainings on public.profiles;
create trigger on_profile_created_assign_trainings
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile_assignments();

-- Associar novo treinamento publicado a todos os alunos ativos
create or replace function public.handle_new_published_training()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  s_record record;
begin
  if new.status = 'publicado' and (old.status is null or old.status <> 'publicado') then
    for s_record in select id from public.profiles where tipo = 'aluno' and status = 'ativo' loop
      insert into public.training_assignments (student_id, training_id, status)
      values (s_record.id, new.id, 'pendente')
      on conflict (student_id, training_id) do nothing;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists on_training_published_assign on public.trainings;
create trigger on_training_published_assign
  after insert or update on public.trainings
  for each row execute procedure public.handle_new_published_training();

-- Inicializar progresso de vídeo para novos assignments
create or replace function public.handle_new_assignment_video_progress()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.video_progress (assignment_id, watched_seconds, watched_percent)
  values (new.id, 0, 0)
  on conflict (assignment_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_assignment_created_create_video_progress on public.training_assignments;
create trigger on_assignment_created_create_video_progress
  after insert on public.training_assignments
  for each row execute procedure public.handle_new_assignment_video_progress();

-- Atualizar status do assignment ao submeter avaliação
create or replace function public.handle_assessment_attempt_submitted()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.training_assignments
  set status = case
    when new.status = 'aprovado' then 'aprovado'::public.assignment_status
    else 'reprovado'::public.assignment_status
  end
  where id = new.assignment_id;
  return new;
end;
$$;

drop trigger if exists on_assessment_attempt_submitted on public.assessment_attempts;
create trigger on_assessment_attempt_submitted
  after insert on public.assessment_attempts
  for each row execute procedure public.handle_assessment_attempt_submitted();

-- Gerar certificado automaticamente em caso de aprovação
create or replace function public.handle_approved_assessment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_category_name text;
begin
  if new.status = 'aprovado' then
    select tc.nome into v_category_name
    from public.training_assignments ta
    join public.trainings t on t.id = ta.training_id
    join public.training_categories tc on tc.id = t.category_id
    where ta.id = new.assignment_id;

    insert into public.certificates (
      assignment_id,
      attempt_id,
      codigo_validacao,
      qr_payload,
      valid_until
    )
    values (
      new.assignment_id,
      new.id,
      'TST-' || upper(replace(coalesce(v_category_name, 'GEN'), ' ', '')) || '-' || substring(md5(random()::text) from 1 for 6),
      'https://tst.com/valida/' || new.assignment_id,
      now() + interval '12 months'
    )
    on conflict (assignment_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_assessment_approved_generate_certificate on public.assessment_attempts;
create trigger on_assessment_approved_generate_certificate
  after insert on public.assessment_attempts
  for each row execute procedure public.handle_approved_assessment();
