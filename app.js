/* ═══════════════════════════════════════════════════════════════
   TST – Sistema de Treinamentos | Cursos e Certificados
   Integrado com Supabase Auth & Real Database
   ═══════════════════════════════════════════════════════════════ */

// ── Supabase Config ──────────────────────────────────────────
const SUPABASE_URL = "https://svavwwfjnyhzmkviwnwx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YXZ3d2Zqbnloem1rdml3bnd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA2NzczNiwiZXhwIjoyMDk3NjQzNzM2fQ.f15LVsGWfvf_g2UN-YNDL5JD9Vtk8dvPtSUUc-OZrOo";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Local Storage Keys ───────────────────────────────────────
const STORAGE_KEY = "tst-state-v8";

const adminMenu = [
  ["dashboard", "Dashboard", "D"],
  ["students", "Alunos", "A"],
  ["trainings", "Treinamentos", "T"],
  ["categories", "Categorias", "C"],
  ["questions", "Perguntas", "P"],
  ["certificates", "Certificados", "S"],
  ["reports", "Relatórios", "R"],
  ["notifications", "Notificações", "N"],
  ["users", "Usuários", "U"],
  ["settings", "Configurações", "G"],
];

// ── Global State ─────────────────────────────────────────────
let trainings = [];
let currentUser = null;
let myAssignments = [];
let adminStudents = [];
let adminAssignments = [];

let state = defaultState();
let watchTimer = null;
let toastTimer = null;
let videoPlayerNode = null;
let isLoading = true;

// Auth Screen States
let authState = "login"; // 'login', 'register', 'forgot', 'reset'
let authError = "";
let authSuccess = "";
let registeredEmail = "";


let newTrainingDraft = {
  title: "", category: "", hours: "", validity: "",
  videos: [{ id: "v1", title: "Aula 1", url: "" }],
  questions: [{ id: "q1", text: "Pergunta 1", weight: 10, options: ["Correta", "Errada 1", "Errada 2", "Errada 3"], correct: 0 }]
};

// ── Supabase Data Loading ────────────────────────────────────
async function loadTrainingsFromSupabase() {
  try {
    const { data, error } = await sb
      .from("trainings")
      .select(`
        *,
        training_categories(*),
        training_media(*),
        questions(*, alternatives(*))
      `)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map(t => {
      const sortedQuestions = (t.questions || []).sort((a, b) => a.ordem - b.ordem);
      const sortedMedia = (t.training_media || []).sort((a, b) =>
        new Date(a.created_at) - new Date(b.created_at)
      );

      return {
        id: t.id,
        dbId: t.id,
        title: t.titulo,
        category: t.training_categories?.nome || t.nr || "Geral",
        categoryId: t.category_id,
        hours: formatHours(t.carga_horaria_minutos),
        hoursMinutes: t.carga_horaria_minutos,
        instructor: "Instrutor TST",
        dueDate: "Indeterminado",
        validity: `${t.validade_meses} meses`,
        validityMonths: t.validade_meses,
        minScore: Number(t.nota_minima),
        attempts: t.max_tentativas,
        defaultProgress: 0,
        description: t.descricao || "",
        objective: t.objetivo || "",
        status: t.status,
        videos: sortedMedia.map((m, i) => ({
          id: m.id,
          title: `Aula ${i + 1}`,
          url: m.external_url || m.storage_path || ""
        })),
        questions: sortedQuestions.map(q => {
          const sortedAlts = (q.alternatives || []).sort((a, b) =>
            a.letra.localeCompare(b.letra)
          );
          return {
            id: q.id,
            text: q.pergunta,
            weight: Number(q.peso),
            options: sortedAlts.map(a => a.texto),
            correct: sortedAlts.findIndex(a => a.correta),
            alternativeIds: sortedAlts.map(a => a.id)
          };
        })
      };
    });
  } catch (e) {
    console.error("Supabase load error:", e);
    return [];
  }
}

function formatHours(minutes) {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}min` : `${h} horas`;
  }
  return `${minutes} min`;
}

async function saveTrainingToSupabase(draft) {
  try {
    // 1. Find or create category
    let catId = null;
    const { data: existingCats } = await sb
      .from("training_categories")
      .select("id")
      .eq("nome", draft.category)
      .limit(1);

    if (existingCats && existingCats.length > 0) {
      catId = existingCats[0].id;
    } else {
      const { data: newCat, error: catErr } = await sb
        .from("training_categories")
        .insert({ nome: draft.category, nr: draft.category })
        .select();
      if (catErr) throw catErr;
      catId = newCat[0].id;
    }

    // 2. Create training
    const validityMonths = parseInt(draft.validity) || 12;
    const hoursMinutes = parseHoursToMinutes(draft.hours);

    const { data: newTraining, error: tErr } = await sb
      .from("trainings")
      .insert({
        titulo: draft.title,
        descricao: `Treinamento cadastrado via painel`,
        objetivo: "Objetivo personalizado",
        category_id: catId,
        nr: draft.category,
        carga_horaria_minutos: hoursMinutes,
        nota_minima: 70,
        max_tentativas: 3,
        validade_meses: validityMonths,
        status: "publicado"
      })
      .select();
    if (tErr) throw tErr;
    const tId = newTraining[0].id;

    // 3. Create media
    for (const v of draft.videos) {
      if (!v.url) continue;
      const { error: mErr } = await sb.from("training_media").insert({
        training_id: tId,
        provider: detectProvider(v.url),
        external_url: v.url
      });
      if (mErr) throw mErr;
    }

    // 4. Create questions + alternatives
    for (let i = 0; i < draft.questions.length; i++) {
      const q = draft.questions[i];
      const { data: newQ, error: qErr } = await sb
        .from("questions")
        .insert({
          training_id: tId,
          pergunta: q.text,
          peso: q.weight || 10,
          ordem: i + 1
        })
        .select();
      if (qErr) throw qErr;

      const letters = ["A", "B", "C", "D"];
      const alts = q.options.map((text, idx) => ({
        question_id: newQ[0].id,
        letra: letters[idx],
        texto: text,
        correta: idx === q.correct
      }));

      const { error: aErr } = await sb.from("alternatives").insert(alts);
      if (aErr) throw aErr;
    }

    return tId;
  } catch (e) {
    console.error("Error saving to Supabase:", e);
    throw e;
  }
}

function parseHoursToMinutes(hoursStr) {
  const str = String(hoursStr).toLowerCase().trim();
  const hMatch = str.match(/(\d+)\s*h/);
  const mMatch = str.match(/(\d+)\s*min/);
  let total = 0;
  if (hMatch) total += parseInt(hMatch[1]) * 60;
  if (mMatch) total += parseInt(mMatch[1]);
  if (total === 0) {
    const num = parseInt(str);
    if (!isNaN(num)) total = num > 24 ? num : num * 60;
  }
  return Math.max(total, 30);
}

function detectProvider(url) {
  if (/youtube|youtu\.be/i.test(url)) return "youtube_privado";
  if (/vimeo/i.test(url)) return "vimeo";
  return "supabase_storage";
}

// ── Admin Database Loaders ───────────────────────────────────
async function loadAllStudentsForAdmin() {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("tipo", "aluno")
    .order("nome_completo", { ascending: true });
  if (!error && data) {
    return data.map(p => ({
      id: p.id,
      name: p.nome_completo,
      initials: getInitials(p.nome_completo),
      company: p.empresa || "TST",
      role: p.cargo || "Colaborador",
      registration: p.matricula || "0000",
      unit: p.unidade || "CD Sumaré",
      sector: p.setor || "Logística",
      email: p.email,
      status: p.status === "ativo" ? "Ativo" : "Inativo"
    }));
  }
  return [];
}

async function loadAdminData() {
  try {
    adminStudents = await loadAllStudentsForAdmin();
    const { data: assignments, error } = await sb
      .from("training_assignments")
      .select(`
        id,
        student_id,
        training_id,
        status,
        video_progress(watched_percent),
        assessment_attempts(score, status, submitted_at, attempt_number),
        certificates(codigo_validacao)
      `);
    if (!error && assignments) {
      adminAssignments = assignments;
    }
  } catch (e) {
    console.error("Error loading admin data:", e);
  }
}

// ── Auth Handling ────────────────────────────────────────────
window.setAuthState = function (mode) {
  authState = mode;
  authError = "";
  authSuccess = "";
  render();
};

window.handleLogin = async function () {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  authError = "";
  authSuccess = "";

  isLoading = true;
  render();

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    authError = error.message;
    isLoading = false;
    render();
  }
};

window.handleRegister = async function () {
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const nome_completo = document.getElementById("regName").value;
  const cpf = document.getElementById("regCpf").value;
  const matricula = document.getElementById("regMatricula").value;
  const cargo = document.getElementById("regCargo").value;
  const setor = document.getElementById("regSetor").value;
  const empresa = document.getElementById("regEmpresa").value;
  const tipo = "aluno"; // Cadastro público é sempre do tipo Aluno

  authError = "";
  authSuccess = "";
  isLoading = true;
  render();

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome_completo,
        cpf,
        matricula,
        cargo,
        setor,
        empresa,
        tipo
      }
    }
  });

  if (error) {
    authError = error.message;
    isLoading = false;
    render();
  } else {
    registeredEmail = email;
    authSuccess = "Cadastro realizado! Insira o código de 6 dígitos enviado para seu e-mail.";
    authState = "otp";
    isLoading = false;
    render();
  }
};

window.handleVerifyOtp = async function () {
  const token = document.getElementById("otpCode").value;
  authError = "";
  authSuccess = "";
  isLoading = true;
  render();

  const { error } = await sb.auth.verifyOtp({
    email: registeredEmail,
    token: token,
    type: "signup"
  });

  if (error) {
    authError = error.message;
    isLoading = false;
    render();
  } else {
    authSuccess = "Conta confirmada com sucesso! Você já pode entrar.";
    authState = "login";
    isLoading = false;
    render();
  }
};

window.handleResendOtp = async function () {
  authError = "";
  authSuccess = "";
  isLoading = true;
  render();

  const { error } = await sb.auth.resend({
    type: "signup",
    email: registeredEmail
  });

  if (error) {
    authError = error.message;
  } else {
    authSuccess = "Um novo código foi enviado para o seu e-mail.";
  }
  isLoading = false;
  render();
};


window.handleForgotPassword = async function () {
  const email = document.getElementById("forgotEmail").value;
  authError = "";
  authSuccess = "";
  isLoading = true;
  render();

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    authError = error.message;
  } else {
    authSuccess = "Link de recuperação enviado com sucesso para o seu e-mail!";
  }
  isLoading = false;
  render();
};

window.handleResetPasswordSubmit = async function () {
  const password = document.getElementById("resetPassword").value;
  authError = "";
  authSuccess = "";
  isLoading = true;
  render();

  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    authError = error.message;
    isLoading = false;
    render();
  } else {
    authSuccess = "Senha redefinida com sucesso! Você já pode entrar.";
    state.resetMode = false;
    saveState();
    authState = "login";
    isLoading = false;
    render();
  }
};

window.handleLogout = async function () {
  isLoading = true;
  render();
  await sb.auth.signOut();
};

// ── Local State Management ───────────────────────────────────
function defaultState() {
  return {
    portal: "student",
    selectedVideoId: null,
    selectedTrainingId: null,
    adminTab: "dashboard",
    selectedStudentId: null,
    resetMode: false,
    filters: {
      studentSearch: "",
      status: "Todos",
      training: "Todos",
      period: "30 dias",
    },
    progress: {},
    answers: {},
    results: {},
    videoStats: {},
    infractions: []
  };
}

function loadState() {
  const base = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...base,
      ...saved,
      filters: { ...base.filters, ...(saved.filters || {}) },
      progress: { ...base.progress, ...(saved.progress || {}) },
      answers: { ...base.answers, ...(saved.answers || {}) },
      results: { ...base.results, ...(saved.results || {}) },
      videoStats: { ...base.videoStats, ...(saved.videoStats || {}) },
      infractions: saved.infractions || []
    };
  } catch {
    return base;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Utilities ────────────────────────────────────────────────
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function findTraining(id) {
  const searchId = id || state.selectedTrainingId;
  return trainings.find(t => t.id === searchId) || trainings[0];
}

function findAssignmentForTraining(trainingId) {
  return myAssignments.find(a => a.training_id === trainingId);
}

function getProgress(trainingId) {
  const t = findTraining(trainingId);
  if (!t || !t.videos || t.videos.length === 0) return 0;
  const pMap = state.progress[trainingId] || {};
  let total = 0;
  t.videos.forEach(v => { total += Number(pMap[v.id] || 0); });
  return Math.min(100, Math.round(total / t.videos.length));
}

function getVideoProgress(trainingId, videoId) {
  return Number((state.progress[trainingId] || {})[videoId] || 0);
}

function getStatus(trainingId) {
  const result = state.results[trainingId];
  const progress = getProgress(trainingId);
  if (result?.approved) return "Aprovado";
  if (result && !result.approved) return "Reprovado";
  if (progress >= 100) return "Avaliação disponível";
  if (progress > 0) return "Em andamento";
  return "Pendente";
}

function statusClass(status) {
  if (["Aprovado", "Concluído"].includes(status)) return "green";
  if (["Em andamento", "Avaliação disponível"].includes(status)) return "amber";
  if (["Reprovado", "Vencido", "Pendente"].includes(status)) return "red";
  return "blue";
}

function nowStamp() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date());
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function clearWatchTimer() {
  if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
}

function getInitials(name) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

// ── Render Engine ────────────────────────────────────────────
function render() {
  clearWatchTimer();

  const app = document.querySelector("#app");
  if (!app) return;

  // 1. Loading screen
  if (isLoading) {
    app.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:16px;">
        <div style="width:48px; height:48px; border:4px solid #dbe2dc; border-top-color:#197b55; border-radius:50%; animation: spin 0.8s linear infinite;"></div>
        <p style="color:#555; font-size:16px;">Carregando dados...</p>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    `;
    return;
  }

  // 2. Auth Screen
  if (!currentUser) {
    // Hide top bar user pill and portal switcher
    const switcher = document.querySelector(".portal-switch");
    if (switcher) switcher.style.display = "none";
    const profilePill = document.querySelector(".profile-pill");
    if (profilePill) profilePill.style.display = "none";
    
    app.innerHTML = renderAuthScreen();
    return;
  }

  // 3. User is Logged In
  // Set profile header
  const profilePill = document.querySelector(".profile-pill");
  if (profilePill) {
    const initials = getInitials(currentUser.nome_completo);
    profilePill.innerHTML = `
      <span class="avatar">${initials}</span>
      <span>
        <strong>${escapeHtml(currentUser.nome_completo)}</strong>
        <small>${escapeHtml(currentUser.cargo || "Colaborador")} | Mat. ${escapeHtml(currentUser.matricula || "0000")}</small>
      </span>
      <button class="btn ghost" style="margin-left: 10px; padding: 4px 8px; min-height: 28px; font-size: 11px;" onclick="window.handleLogout()">Sair</button>
    `;
    profilePill.style.display = "inline-flex";
  }

  // Handle portal switch visibility (strictly hide from ordinary students)
  const switcher = document.querySelector(".portal-switch");
  if (switcher) {
    if (currentUser.tipo === "aluno") {
      switcher.style.display = "none";
      state.portal = "student";
    } else {
      switcher.style.display = "inline-flex";
    }
  }

  document.querySelectorAll(".portal-button").forEach(btn => {
    btn.classList.toggle("is-active", btn.dataset.portal === state.portal);
  });

  if (trainings.length === 0) {
    app.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:16px;">
        <div style="font-size:48px;">📋</div>
        <h2 style="color:#17211d;">Nenhum treinamento disponível</h2>
        <p style="color:#555;">Você não está associado a treinamentos ou não existem cursos publicados.</p>
        ${currentUser.tipo !== "aluno" ? '<button class="btn primary" data-portal="admin" type="button">Ir para Admin</button>' : ""}
      </div>
    `;
    return;
  }

  // Ensure a training is selected
  if (!state.selectedTrainingId || !findTraining(state.selectedTrainingId)) {
    state.selectedTrainingId = trainings[0].id;
  }

  app.innerHTML = state.portal === "student" ? renderStudentPortal() : renderAdminPortal();

  // Setup video player
  videoPlayerNode = document.getElementById("real-video-player");
  if (videoPlayerNode && videoPlayerNode.dataset.type === "native") {
    const id = state.selectedTrainingId;
    const vid = videoPlayerNode.dataset.videoId;

    videoPlayerNode.addEventListener("timeupdate", async () => {
      if (!videoPlayerNode.duration) return;
      let p = Math.round((videoPlayerNode.currentTime / videoPlayerNode.duration) * 100);
      const currentMax = getVideoProgress(id, vid);

      if (p > currentMax + 2 && currentMax < 100) {
        videoPlayerNode.currentTime = (currentMax / 100) * videoPlayerNode.duration;
        showToast("Avanço de vídeo bloqueado.");
        p = currentMax;
      }
      if (p > currentMax) {
        state.progress[id] = state.progress[id] || {};
        state.progress[id][vid] = p;
        saveState();

        // Update database video progress at key increments or end
        const assignment = findAssignmentForTraining(id);
        if (assignment && (p % 10 === 0 || p === 100)) {
          await sb
            .from("video_progress")
            .upsert({
              assignment_id: assignment.id,
              watched_percent: p,
              watched_seconds: Math.round((p / 100) * videoPlayerNode.duration),
              updated_at: new Date()
            }, { onConflict: "assignment_id" });
        }
      }
      if (p >= 100 && currentMax < 100) {
        state.progress[id][vid] = 100;
        saveState();
        showToast("Vídeo concluído.");
        render();
      }
    });

    videoPlayerNode.addEventListener("play", () => {
      const stats = state.videoStats[id] || {};
      if (!stats.startedAt) {
        stats.startedAt = nowStamp();
        state.videoStats[id] = stats;
        saveState();
      }
    });
  }
}

// ── Auth Screen HTML ─────────────────────────────────────────
function renderAuthScreen() {
  if (state.resetMode) {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1>Nova Senha</h1>
            <p>Digite sua nova senha de acesso.</p>
          </div>
          ${authError ? `<div style="padding:10px; background:var(--red-2); color:var(--red); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authError)}</div>` : ""}
          ${authSuccess ? `<div style="padding:10px; background:var(--green-2); color:var(--green); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authSuccess)}</div>` : ""}
          <form class="auth-form" onsubmit="event.preventDefault(); window.handleResetPasswordSubmit();">
            <div class="field">
              <label for="resetPassword">Nova Senha</label>
              <input id="resetPassword" type="password" required placeholder="Mínimo 6 caracteres" />
            </div>
            <button class="btn primary" type="submit" style="width:100%; margin-top:8px;">Salvar Senha</button>
          </form>
          <div class="auth-footer">
            <button class="auth-link" type="button" onclick="window.setAuthState('login')">Voltar para o Login</button>
          </div>
        </div>
      </div>
    `;
  }

  if (authState === "login") {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1>Treinamentos TST</h1>
            <p>Plataforma de Treinamentos e Certificados</p>
          </div>
          <div class="auth-tabs">
            <button class="auth-tab is-active" type="button">Entrar</button>
            <button class="auth-tab" type="button" onclick="window.setAuthState('register')">Cadastrar</button>
          </div>
          ${authError ? `<div style="padding:10px; background:var(--red-2); color:var(--red); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authError)}</div>` : ""}
          ${authSuccess ? `<div style="padding:10px; background:var(--green-2); color:var(--green); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authSuccess)}</div>` : ""}
          <form class="auth-form" onsubmit="event.preventDefault(); window.handleLogin();">
            <div class="field">
              <label for="loginEmail">E-mail</label>
              <input id="loginEmail" type="email" required placeholder="seu.email@empresa.com" />
            </div>
            <div class="field">
              <label for="loginPassword">Senha</label>
              <input id="loginPassword" type="password" required placeholder="Sua senha" />
            </div>
            <button class="btn primary" type="submit" style="width:100%; margin-top:8px;">Entrar no Portal</button>
          </form>
          <div class="auth-footer">
            <button class="auth-link" type="button" onclick="window.setAuthState('forgot')">Esqueceu sua senha?</button>
          </div>
        </div>
      </div>
    `;
  } else if (authState === "register") {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1>Criar Conta</h1>
            <p>Cadastre-se para acessar os treinamentos.</p>
          </div>
          <div class="auth-tabs">
            <button class="auth-tab" type="button" onclick="window.setAuthState('login')">Entrar</button>
            <button class="auth-tab is-active" type="button">Cadastrar</button>
          </div>
          ${authError ? `<div style="padding:10px; background:var(--red-2); color:var(--red); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authError)}</div>` : ""}
          <form class="auth-form" onsubmit="event.preventDefault(); window.handleRegister();">
            <div class="field">
              <label for="regName">Nome Completo</label>
              <input id="regName" type="text" required placeholder="Seu nome" />
            </div>
            <div class="auth-form-row">
              <div class="field">
                <label for="regCpf">CPF</label>
                <input id="regCpf" type="text" required placeholder="000.000.000-00" />
              </div>
              <div class="field">
                <label for="regMatricula">Matrícula</label>
                <input id="regMatricula" type="text" placeholder="Mat. Ex: 0842" />
              </div>
            </div>
            <div class="auth-form-row">
              <div class="field">
                <label for="regCargo">Cargo</label>
                <input id="regCargo" type="text" placeholder="Ex: Operador" />
              </div>
              <div class="field">
                <label for="regSetor">Setor</label>
                <input id="regSetor" type="text" placeholder="Ex: Expedição" />
              </div>
            </div>
            <div class="field">
              <label for="regEmpresa">Empresa</label>
              <input id="regEmpresa" type="text" value="TST" placeholder="Nome da empresa" />
            </div>
            <div class="field">
              <label for="regEmail">E-mail</label>
              <input id="regEmail" type="email" required placeholder="seu.email@empresa.com" />
            </div>
            <div class="field">
              <label for="regPassword">Senha</label>
              <input id="regPassword" type="password" required placeholder="Mínimo 6 caracteres" />
            </div>
            <button class="btn primary" type="submit" style="width:100%; margin-top:8px;">Criar Conta</button>
          </form>
        </div>
      </div>
    `;
  } else if (authState === "otp") {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1>Confirmar Código</h1>
            <p>Digite o código de 6 dígitos enviado para seu e-mail.</p>
          </div>
          ${authError ? `<div style="padding:10px; background:var(--red-2); color:var(--red); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authError)}</div>` : ""}
          ${authSuccess ? `<div style="padding:10px; background:var(--green-2); color:var(--green); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authSuccess)}</div>` : ""}
          <form class="auth-form" onsubmit="event.preventDefault(); window.handleVerifyOtp();">
            <div class="field">
              <label for="otpCode" style="text-align:center;">Código de Confirmação</label>
              <input id="otpCode" class="otp-input-field" type="text" maxlength="6" placeholder="000000" required />
            </div>
            <button class="btn primary" type="submit" style="width:100%; margin-top:8px;">Confirmar Código</button>
          </form>
          <div class="auth-footer" style="display:flex; flex-direction:column; gap:10px; align-items:center;">
            <button class="auth-link" type="button" onclick="window.handleResendOtp()">Reenviar código</button>
            <button class="auth-link" type="button" onclick="window.setAuthState('login')">Voltar para o Login</button>
          </div>
        </div>
      </div>
    `;
  } else if (authState === "forgot") {
    return `
      <div class="auth-wrapper">
        <div class="auth-card">
          <div class="auth-header">
            <h1>Recuperar Senha</h1>
            <p>Enviaremos um link para criar uma nova senha.</p>
          </div>
          ${authError ? `<div style="padding:10px; background:var(--red-2); color:var(--red); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authError)}</div>` : ""}
          ${authSuccess ? `<div style="padding:10px; background:var(--green-2); color:var(--green); border-radius:6px; font-size:14px; text-align:center;">${escapeHtml(authSuccess)}</div>` : ""}
          <form class="auth-form" onsubmit="event.preventDefault(); window.handleForgotPassword();">
            <div class="field">
              <label for="forgotEmail">E-mail</label>
              <input id="forgotEmail" type="email" required placeholder="seu.email@empresa.com" />
            </div>
            <button class="btn primary" type="submit" style="width:100%; margin-top:8px;">Enviar Link</button>
          </form>
          <div class="auth-footer">
            <button class="auth-link" type="button" onclick="window.setAuthState('login')">Voltar para o Login</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

// ── Student Portal ───────────────────────────────────────────
function renderStudentPortal() {
  const completed = trainings.filter(t => state.results[t.id]?.approved).length;
  const inProgress = trainings.filter(t => {
    const p = getProgress(t.id);
    return p > 0 && !state.results[t.id]?.approved;
  }).length;
  const pending = trainings.length - completed - inProgress;

  return `
    <section class="student-grid">
      <aside class="student-sidebar">
        <div class="student-hero">
          <h1>Bem-vindo(a), ${escapeHtml(currentUser.nome_completo)}</h1>
          <p>${escapeHtml(currentUser.cargo || "Colaborador")} em ${escapeHtml(currentUser.unidade || "TST")}</p>
          <div class="student-meta">
            <div class="meta-row"><span>Empresa</span><strong>${escapeHtml(currentUser.empresa || "TST")}</strong></div>
            <div class="meta-row"><span>Matrícula</span><strong>${escapeHtml(currentUser.matricula || "0000")}</strong></div>
            <div class="meta-row"><span>Setor</span><strong>${escapeHtml(currentUser.setor || "Logística")}</strong></div>
            <div class="meta-row"><span>Situação</span><strong>${completed}/${trainings.length} concluídos</strong></div>
          </div>
        </div>
        <div class="status-strip">
          <div class="status-tile"><strong>${completed}</strong><span>Concluídos</span></div>
          <div class="status-tile"><strong>${inProgress}</strong><span>Em andamento</span></div>
          <div class="status-tile"><strong>${pending}</strong><span>Pendentes</span></div>
        </div>
        <div class="training-list">
          <p class="section-label">Lista de treinamentos <span>${trainings.length}</span></p>
          ${trainings.map(renderTrainingCard).join("")}
        </div>
      </aside>
      ${renderTrainingDetail(findTraining())}
    </section>
  `;
}

function renderTrainingCard(training) {
  const progress = getProgress(training.id);
  const status = getStatus(training.id);
  const result = state.results[training.id];

  return `
    <button class="training-card ${training.id === state.selectedTrainingId ? "is-selected" : ""}" type="button" data-training="${training.id}">
      <h2>${escapeHtml(training.title)}</h2>
      <div class="card-meta">
        <span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>
        <span>${progress}% assistido</span>
        <span>Nota: ${result ? result.score.toFixed(1).replace(".", ",") : "não realizada"}</span>
      </div>
      <div class="progress-line" aria-label="Progresso do vídeo">
        <span style="width: ${progress}%"></span>
      </div>
    </button>
  `;
}

function getPlayerHTML(url, vid) {
  if (!url) return '<p>Nenhum vídeo configurado.</p>';

  const ytMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `<iframe id="real-video-player" data-video-id="${vid}" data-type="iframe" src="https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&showinfo=0" style="width:100%; height:400px; border:none; border-radius:8px; background:#000;" allowfullscreen allow="autoplay; encrypted-media"></iframe>
            <div style="margin-top:12px; padding:12px; background:#fff3cd; border-radius:4px; font-size:13px; color:#856404;">
               <strong>Aviso:</strong> Por ser um vídeo externo (YouTube), clique no botão abaixo quando terminar de assistir para marcar como concluído.
            </div>
            <button class="btn primary" style="margin-top:8px; width:100%" onclick="window.markIframeCompleted('${vid}')">✔️ Marcar Aula como Concluída</button>`;
  }

  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([-\w]+)/i);
  if (driveMatch && driveMatch[1]) {
    return `<iframe id="real-video-player" data-video-id="${vid}" data-type="iframe" src="https://drive.google.com/file/d/${driveMatch[1]}/preview" style="width:100%; height:400px; border:none; border-radius:8px; background:#000;" allowfullscreen></iframe>
            <div style="margin-top:12px; padding:12px; background:#fff3cd; border-radius:4px; font-size:13px; color:#856404;">
               <strong>Aviso:</strong> Por ser um vídeo externo (Google Drive), clique no botão abaixo quando terminar de assistir para marcar como concluído.
            </div>
            <button class="btn primary" style="margin-top:8px; width:100%" onclick="window.markIframeCompleted('${vid}')">✔️ Marcar Aula como Concluída</button>`;
  }

  return `<video id="real-video-player" data-video-id="${vid}" data-type="native" src="${escapeHtml(url)}" controls disablePictureInPicture controlsList="nodownload" style="width: 100%; max-height: 400px; border-radius: 8px; background: #000;"></video>`;
}

window.markIframeCompleted = async function (vid) {
  const id = state.selectedTrainingId;
  state.progress[id] = state.progress[id] || {};
  state.progress[id][vid] = 100;
  saveState();

  const assignment = findAssignmentForTraining(id);
  if (assignment) {
    await sb
      .from("video_progress")
      .upsert({
        assignment_id: assignment.id,
        watched_percent: 100,
        watched_seconds: 600,
        updated_at: new Date()
      }, { onConflict: "assignment_id" });
  }

  showToast("Aula marcada como concluída!");
  await reloadStudentState();
};

function renderTrainingDetail(training) {
  if (!training) return '<p style="padding:40px; color:#555;">Selecione um treinamento.</p>';

  const progress = getProgress(training.id);
  const status = getStatus(training.id);
  const stats = state.videoStats[training.id] || {};
  const locked = progress < 100;

  const currentVideo = training.videos && training.videos.length > 0
    ? training.videos.find(v => v.id === state.selectedVideoId) || training.videos[0]
    : null;

  return `
    <article class="training-detail">
      <header class="training-head">
        <div class="training-title">
          <h1>${escapeHtml(training.title)}</h1>
          <p>${escapeHtml(training.description)}</p>
          <div class="badge-row">
            <span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>
            <span class="badge blue">${escapeHtml(training.hours)}</span>
            <span class="badge violet">${escapeHtml(training.category)}</span>
            <span class="badge amber">Validade: ${escapeHtml(training.validity)}</span>
          </div>
        </div>
        <div class="training-actions">
          <button class="btn ghost" type="button" data-action="reset-video">
            <span class="button-icon">↺</span> Reiniciar
          </button>
          <button class="btn primary" type="button" data-action="watch-video">
            <span class="button-icon">▶</span> ${progress >= 100 ? "Rever" : "Assistir"}
          </button>
        </div>
      </header>

      <section class="video-stage">
        <div class="video-frame">
          ${currentVideo ? getPlayerHTML(currentVideo.url, currentVideo.id) : '<p style="padding:20px; color:#888;">Nenhum vídeo configurado para este treinamento.</p>'}
        </div>

        ${training.videos && training.videos.length > 1 ? `
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
            ${training.videos.map((v, i) => {
              const vp = getVideoProgress(training.id, v.id);
              const isCurrent = currentVideo && v.id === currentVideo.id;
              return `<button class="btn ${isCurrent ? 'primary' : ''}" data-action="select-video" data-vid="${v.id}" style="font-size:12px; padding:6px 12px;">
                ${escapeHtml(v.title)} ${vp >= 100 ? '✓' : `(${vp}%)`}
              </button>`;
            }).join("")}
          </div>
        ` : ""}

        <div class="detail-stack">
          <div class="info-panel">
            <h3>Descrição</h3>
            <ul class="info-list">
              <li><span>Objetivo</span><strong>${escapeHtml(training.objective)}</strong></li>
              <li><span>Carga horária</span><strong>${escapeHtml(training.hours)}</strong></li>
              <li><span>Instrutor</span><strong>${escapeHtml(training.instructor)}</strong></li>
              <li><span>Vencimento</span><strong>${escapeHtml(training.dueDate)}</strong></li>
            </ul>
          </div>

          <div class="info-panel">
            <h3>Controle do vídeo</h3>
            <ul class="info-list">
              <li><span>Início</span><strong>${escapeHtml(stats.startedAt || "-")}</strong></li>
              <li><span>Término</span><strong>${escapeHtml(stats.finishedAt || "-")}</strong></li>
              <li><span>Pausas</span><strong>${Number(stats.pauses || 0)}</strong></li>
              <li><span>Tentativas de avanço</span><strong>${Number(stats.skipped || 0)}</strong></li>
            </ul>
          </div>

          <div class="info-panel">
            <h3>Regras</h3>
            <ul class="info-list">
              <li><span>Assistir 100%</span><strong>Obrigatório</strong></li>
              <li><span>Avanço do vídeo</span><strong>Bloqueado</strong></li>
              <li><span>Nota mínima</span><strong>${training.minScore}%</strong></li>
              <li><span>Tentativas</span><strong>${training.attempts}</strong></li>
            </ul>
          </div>
        </div>
      </section>

      ${training.questions && training.questions.length > 0 ? renderAssessment(training, locked) : '<p style="padding:20px; color:#888;">Nenhuma avaliação configurada para este treinamento.</p>'}
    </article>
  `;
}

// ── Assessment ───────────────────────────────────────────────
function renderAssessment(training, locked) {
  const answers = state.answers[training.id] || {};
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= training.questions.length;
  const result = state.results[training.id];
  const statusLabel = locked
    ? "Bloqueada"
    : result
      ? result.approved ? "Aprovada" : "Reprovada"
      : `${answeredCount}/${training.questions.length} respondidas`;

  return `
    <section class="assessment">
      <div class="assessment-head">
        <div>
          <h2>Avaliação</h2>
          <span class="badge ${locked ? "red" : result?.approved ? "green" : "amber"}">${statusLabel}</span>
        </div>
        <button class="btn primary" type="button" data-action="submit-assessment" ${locked || !allAnswered ? "disabled" : ""}>
          <span class="button-icon">✓</span> Finalizar avaliação
        </button>
      </div>
      ${training.questions.map((q, i) => renderQuestion(training, q, i, locked)).join("")}
      ${result ? renderResult(training, result) : ""}
    </section>
  `;
}

function renderQuestion(training, question, index, locked) {
  const selected = state.answers[training.id]?.[question.id];
  return `
    <fieldset class="question-card" ${locked ? "disabled" : ""}>
      <legend>${index + 1}. ${escapeHtml(question.text)}</legend>
      <div class="options-grid">
        ${question.options.map((option, optIdx) => {
          const id = `${training.id}-${question.id}-${optIdx}`;
          const checked = Number(selected) === optIdx ? "checked" : "";
          return `
            <label class="question-option" for="${id}">
              <input id="${id}" type="radio" name="${training.id}-${question.id}" value="${optIdx}" data-question="${question.id}" ${checked} ${locked ? "disabled" : ""} />
              <span>${escapeHtml(option)}</span>
            </label>
          `;
        }).join("")}
      </div>
    </fieldset>
  `;
}

function renderResult(training, result) {
  const situation = result.approved ? "APROVADO" : "REPROVADO";
  const badgeClass = result.approved ? "green" : "red";
  const code = result.certificateCode || "Aguardando aprovação";

  return `
    <div class="result-panel">
      <div>
        <span class="badge ${badgeClass}">${situation}</span>
        <p class="score-number">${result.score.toFixed(1).replace(".", ",")}</p>
        ${result.approved ? `
          <p>Certificado disponível para emissão.</p>
        ` : `
          <div class="result-box failed">
            <h3>Você não atingiu a nota mínima.</h3>
            <p>Sua nota: <strong>${result.score}%</strong></p>
            <button class="btn primary" data-action="retake-assessment" style="margin-top:12px;">Refazer Avaliação</button>
          </div>
        `}
      </div>
      <div class="certificate-preview">
        <div class="qr-box" aria-hidden="true"></div>
        <h3>Certificado TST</h3>
        <p>${escapeHtml(currentUser.nome_completo)} | ${escapeHtml(training.title)}</p>
        <p>Código: <strong>${escapeHtml(code)}</strong></p>
      </div>
    </div>
  `;
}

// ── Actions ──────────────────────────────────────────────────
async function resetVideo() {
  const id = state.selectedTrainingId;
  state.progress[id] = {};
  state.answers[id] = {};
  delete state.results[id];
  state.videoStats[id] = { startedAt: null, finishedAt: null, pauses: 0, skipped: 0 };
  saveState();

  const assignment = findAssignmentForTraining(id);
  if (assignment) {
    // Delete progress and attempts from DB to reset
    await sb.from("video_progress").upsert({ assignment_id: assignment.id, watched_percent: 0, watched_seconds: 0 });
    await sb.from("assessment_attempts").delete().eq("assignment_id", assignment.id);
  }

  showToast("Treinamento reiniciado.");
  await reloadStudentState();
}

async function retakeAssessment() {
  const id = state.selectedTrainingId;
  state.answers[id] = {};
  delete state.results[id];
  saveState();

  const assignment = findAssignmentForTraining(id);
  if (assignment) {
    // Reset DB attempts
    await sb.from("assessment_attempts").delete().eq("assignment_id", assignment.id);
  }

  showToast("Você pode refazer a avaliação agora.");
  await reloadStudentState();
}

async function submitAssessment() {
  const training = findTraining();
  if (!training) return;
  const answers = state.answers[training.id] || {};
  const totalWeight = training.questions.reduce((s, q) => s + q.weight, 0);
  const earnedWeight = training.questions.reduce((s, q) => {
    return Number(answers[q.id]) === q.correct ? s + q.weight : s;
  }, 0);
  const score = Math.round((earnedWeight / totalWeight) * 1000) / 10;
  const approved = score >= training.minScore;

  const assignment = findAssignmentForTraining(training.id);
  if (!assignment) {
    showToast("Erro: Vinculação de treinamento não encontrada.");
    return;
  }

  isLoading = true;
  render();

  try {
    // Calculate attempt number
    const { count } = await sb
      .from("assessment_attempts")
      .select("*", { count: "exact", head: true })
      .eq("assignment_id", assignment.id);
      
    const attemptNum = (count || 0) + 1;

    // Insert assessment attempt
    const { data: attemptData, error: attErr } = await sb
      .from("assessment_attempts")
      .insert({
        assignment_id: assignment.id,
        attempt_number: attemptNum,
        score: score,
        status: approved ? "aprovado" : "reprovado"
      })
      .select();

    if (attErr) throw attErr;

    const attemptId = attemptData[0].id;

    // Insert answers
    const answersToInsert = training.questions.map(q => {
      const selectedOptIdx = Number(answers[q.id]);
      const selectedAltId = q.alternativeIds[selectedOptIdx];
      return {
        attempt_id: attemptId,
        question_id: q.id,
        alternative_id: selectedAltId,
        correta: selectedOptIdx === q.correct,
        peso_obtido: selectedOptIdx === q.correct ? q.weight : 0
      };
    });

    const { error: ansErr } = await sb.from("assessment_answers").insert(answersToInsert);
    if (ansErr) console.error("Error inserting answers:", ansErr);

    showToast(approved ? "Avaliação aprovada. Certificado liberado." : "Nota registrada. Nova tentativa necessária.");
  } catch (e) {
    showToast("Erro ao enviar avaliação: " + e.message);
  }

  await reloadStudentState();
}

function downloadCertificate() {
  const training = findTraining();
  const result = state.results[training.id];
  if (!result?.approved) return;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Certificado - ${escapeHtml(training.title)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #17211d; background: #f6f7f4; }
    .certificate { width: 960px; min-height: 680px; margin: 30px auto; padding: 46px; border: 12px solid #197b55; background: #fff; box-sizing: border-box; }
    .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #dbe2dc; padding-bottom: 22px; }
    .mark { width: 88px; height: 88px; border-radius: 18px; background: #173d2e; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 26px; }
    h1 { margin: 42px 0 8px; font-size: 46px; }
    h2 { margin: 0; color: #197b55; font-size: 30px; }
    p { font-size: 19px; line-height: 1.6; }
    .name { font-size: 34px; font-weight: 900; border-bottom: 2px solid #dbe2dc; padding-bottom: 8px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 28px; }
    .box { border: 1px solid #dbe2dc; padding: 14px; }
    .qr { width: 90px; height: 90px; background: repeating-linear-gradient(90deg, #111 0 8px, #fff 8px 16px), repeating-linear-gradient(0deg, rgba(17,17,17,.5) 0 8px, transparent 8px 16px); border: 8px solid #fff; box-shadow: 0 0 0 1px #dbe2dc; }
    .footer { display: flex; justify-content: space-between; align-items: end; margin-top: 42px; }
    .sign { width: 280px; border-top: 2px solid #17211d; text-align: center; padding-top: 8px; }
  </style>
</head>
<body>
  <main class="certificate">
    <div class="top">
      <div class="mark">TST</div>
      <div><strong>Plataforma TST</strong><br />Sistema de Treinamentos e Certificados</div>
    </div>
    <h1>Certificado</h1>
    <p>Certificamos que</p>
    <div class="name">${escapeHtml(currentUser.nome_completo)}</div>
    <p>concluiu com aproveitamento o treinamento <strong>${escapeHtml(training.title)}</strong>, com carga horária de <strong>${escapeHtml(training.hours)}</strong>.</p>
    <div class="grid">
      <div class="box"><strong>Empresa</strong><br />${escapeHtml(currentUser.empresa)}</div>
      <div class="box"><strong>Data</strong><br />${escapeHtml(result.date)}</div>
      <div class="box"><strong>Nota</strong><br />${result.score.toFixed(1).replace(".", ",")}</div>
      <div class="box"><strong>Código de validação</strong><br />${escapeHtml(result.certificateCode)}</div>
    </div>
    <div class="footer">
      <div class="qr" aria-label="QR Code"></div>
      <div class="sign">Responsável TST</div>
    </div>
  </main>
</body>
</html>`;

  downloadFile(`certificado-${training.id}.html`, html, "text/html;charset=utf-8");
  showToast("Certificado gerado.");
}

// ── Admin Portal ─────────────────────────────────────────────
function renderAdminPortal() {
  const active = adminMenu.find(i => i[0] === state.adminTab) || adminMenu[0];
  return `
    <section class="admin-layout">
      <nav class="side-menu" aria-label="Menu administrativo">
        ${adminMenu.map(([key, label, glyph]) => `
          <button type="button" class="${key === state.adminTab ? "is-active" : ""}" data-admin-tab="${key}">
            <span class="menu-glyph">${glyph}</span> ${label}
          </button>
        `).join("")}
      </nav>
      <article class="admin-panel">
        <header class="admin-head">
          <div class="admin-title">
            <h1>${active[1]}</h1>
            <p>${adminSubtitle(state.adminTab)}</p>
          </div>
          <div class="row-actions">
            <button class="btn" type="button" data-action="export-csv"><span class="button-icon">↓</span> Exportar CSV</button>
            <button class="btn primary" type="button" data-action="admin-primary"><span class="button-icon">+</span> Novo registro</button>
          </div>
        </header>
        <div class="admin-content">
          ${renderAdminContent(state.adminTab)}
        </div>
      </article>
    </section>
  `;
}

function adminSubtitle(tab) {
  const subtitles = {
    dashboard: "Indicadores de conformidade, aprovação e certificados emitidos.",
    students: "Cadastro, situação individual e linha do tempo de treinamentos.",
    trainings: "Cursos, vídeos, regras, validade e tentativas por treinamento.",
    categories: "Organização por NR, tema, área e criticidade.",
    questions: "Banco de perguntas com alternativas, pesos e respostas corretas.",
    certificates: "Certificados emitidos, validade, reemissão e código de validação.",
    reports: "Filtros gerenciais para auditorias e comprovação de conformidade.",
    notifications: "Avisos internos para alunos e administradores.",
    users: "Perfis, permissões e acesso administrativo.",
    settings: "Regras globais, autenticação e parâmetros do portal.",
  };
  return subtitles[tab] || subtitles.dashboard;
}

function renderAdminContent(tab) {
  if (tab === "new-training") return renderNewTrainingAdmin();
  if (tab === "dashboard") return renderDashboard();
  if (tab === "students") return renderStudentsAdmin();
  if (tab === "trainings") return renderTrainingsAdmin();
  if (tab === "certificates") return renderCertificatesAdmin();
  if (tab === "reports") return renderReportsAdmin();
  if (tab === "notifications") return renderNotificationsAdmin();
  if (tab === "settings") return renderSettingsAdmin();
  if (tab === "questions") return renderQuestionsAdmin();
  if (tab === "categories") return renderCategoriesAdmin();
  if (tab === "users") return renderUsersAdmin();
  return renderDashboard();
}

function currentRecords() {
  if (state.portal === "student") {
    return trainings.map(t => {
      const result = state.results[t.id];
      return {
        studentId: currentUser?.id,
        trainingId: t.id,
        progress: getProgress(t.id),
        score: result?.score ?? null,
        status: getStatus(t.id),
        date: result?.date?.slice(0, 10) || (getProgress(t.id) > 0 ? nowStamp().slice(0, 10) : "-"),
      };
    });
  }

  // Admin Portal Records Mapping
  const list = [];
  adminAssignments.forEach(a => {
    const t = trainings.find(tr => tr.id === a.training_id);
    if (!t) return;
    
    const attempts = a.assessment_attempts || [];
    attempts.sort((x, y) => y.attempt_number - x.attempt_number);
    const lastAttempt = attempts[0];
    const progressPercent = Number(a.video_progress?.watched_percent || 0);

    let status = "Pendente";
    if (lastAttempt) {
      status = lastAttempt.status === "aprovado" ? "Aprovado" : "Reprovado";
    } else if (progressPercent >= 100) {
      status = "Avaliação disponível";
    } else if (progressPercent > 0) {
      status = "Em andamento";
    }

    list.push({
      studentId: a.student_id,
      trainingId: a.training_id,
      progress: progressPercent,
      score: lastAttempt ? Number(lastAttempt.score) : null,
      status: status,
      date: lastAttempt ? new Date(lastAttempt.submitted_at).toLocaleDateString("pt-BR") : "-"
    });
  });
  return list;
}

function adminMetrics() {
  const records = currentRecords();
  const approved = records.filter(r => r.status === "Aprovado");
  const failed = records.filter(r => r.status === "Reprovado");
  const overdue = records.filter(r => r.status === "Vencido");
  const completed = records.filter(r => ["Aprovado", "Reprovado"].includes(r.status));
  const scores = records.filter(r => Number.isFinite(r.score)).map(r => r.score);
  const average = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  return {
    students: adminStudents.length,
    trainings: trainings.length,
    completed: completed.length,
    overdue: overdue.length,
    certificates: approved.length,
    average,
    approvalRate: completed.length ? Math.round((approved.length / completed.length) * 100) : 0,
    failed: failed.length,
  };
}

function renderDashboard() {
  const m = adminMetrics();
  return `
    <div class="metric-grid">
      ${renderMetric("Alunos cadastrados", m.students, "Ativos no portal")}
      ${renderMetric("Treinamentos", m.trainings, "NRs e cursos internos")}
      ${renderMetric("Treinamentos concluídos", m.completed, "Com nota registrada")}
      ${renderMetric("Treinamentos vencidos", m.overdue, "Ação necessária")}
      ${renderMetric("Certificados emitidos", m.certificates, "Aprovados")}
      ${renderMetric("Média geral", `${m.average}%`, "Notas consolidadas")}
      ${renderMetric("Taxa de aprovação", `${m.approvalRate}%`, "Base concluída")}
      ${renderMetric("Reprovações", m.failed, "Novas tentativas")}
    </div>

    <div class="dashboard-grid">
      <section class="admin-card">
        <h2>Conformidade por treinamento</h2>
        <div class="chart-bars">
          ${trainings.map(t => {
            const records = currentRecords().filter(r => r.trainingId === t.id);
            const compliant = records.filter(r => r.status === "Aprovado").length;
            const percent = records.length ? Math.round((compliant / records.length) * 100) : 0;
            return `
              <div class="bar-row">
                <span>${escapeHtml(t.category)}</span>
                <div class="bar-track"><div class="bar-fill" style="width: ${percent}%"></div></div>
                <strong>${percent}%</strong>
              </div>
            `;
          }).join("")}
        </div>
      </section>
      <section class="admin-card">
        <h2>Aprovação geral</h2>
        <div class="donut-wrap">
          <div class="donut"><span>${m.approvalRate}%</span></div>
          <ul class="legend-list">
            <li><span class="legend-swatch"></span> Aprovados</li>
            <li><span class="legend-swatch amber"></span> Em andamento</li>
            <li><span class="legend-swatch red"></span> Reprovados ou vencidos</li>
          </ul>
        </div>
      </section>
    </div>

    <section class="data-panel">
      <div class="table-toolbar">
        <div class="table-title">
          <h2>Movimentações recentes</h2>
          <p>Conclusões, certificados e pendências geradas automaticamente.</p>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Aluno</th><th>Treinamento</th><th>Status</th><th>Progresso</th><th>Data</th></tr></thead>
          <tbody>
            ${currentRecords().slice(0, 8).map(r => renderRecordRow(r)).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMetric(label, value, hint) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></div>`;
}

function renderRecordRow(record) {
  const person = adminStudents.find(s => s.id === record.studentId);
  const training = findTraining(record.trainingId);
  if (!training) return "";
  return `
    <tr>
      <td><div class="row-title"><strong>${escapeHtml(person?.name || "Desconhecido")}</strong><small>${escapeHtml(person?.role || "")}</small></div></td>
      <td>${escapeHtml(training.title)}</td>
      <td><span class="badge ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
      <td>${record.progress}%</td>
      <td>${escapeHtml(record.date)}</td>
    </tr>
  `;
}

function studentSummaries() {
  return adminStudents.map(person => {
    const records = currentRecords().filter(r => r.studentId === person.id);
    const approved = records.filter(r => r.status === "Aprovado").length;
    const status = records.some(r => r.status === "Vencido") ? "Vencido"
      : approved === trainings.length ? "Concluído"
      : records.some(r => ["Em andamento", "Avaliação disponível"].includes(r.status)) ? "Em andamento"
      : "Pendente";
    const scores = records.filter(r => Number.isFinite(r.score)).map(r => r.score);
    const average = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : "-";
    return { ...person, approved, status, average };
  });
}

function renderStudentsAdmin() {
  const search = state.filters.studentSearch.toLowerCase();
  const statusFilter = state.filters.status;
  const summaries = studentSummaries().filter(i => {
    const matchesSearch = [i.name, i.role, i.sector, i.registration].join(" ").toLowerCase().includes(search);
    const matchesStatus = statusFilter === "Todos" || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!state.selectedStudentId && adminStudents.length > 0) {
    state.selectedStudentId = adminStudents[0].id;
  }
  const selected = adminStudents.find(p => p.id === state.selectedStudentId) || adminStudents[0];
  const records = selected ? currentRecords().filter(r => r.studentId === selected.id) : [];

  return `
    <section class="data-panel">
      <div class="table-toolbar">
        <div class="table-title"><h2>Cadastro de alunos</h2><p>${summaries.length} aluno(s) encontrados.</p></div>
        <div class="filters">
          <div class="field">
            <label for="studentSearch">Busca</label>
            <input id="studentSearch" value="${escapeHtml(state.filters.studentSearch)}" data-filter="studentSearch" placeholder="Nome, cargo, matrícula" />
          </div>
          <div class="field">
            <label for="statusFilter">Status</label>
            <select id="statusFilter" data-filter="status">
              ${["Todos", "Concluído", "Em andamento", "Pendente", "Vencido"].map(o => `<option ${o === statusFilter ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Cargo</th><th>Setor</th><th>Status</th><th>Média</th><th>Ações</th></tr></thead>
          <tbody>
            ${summaries.map(i => `
              <tr>
                <td><div class="row-title"><strong>${escapeHtml(i.name)}</strong><small>Mat. ${escapeHtml(i.registration)} | ${escapeHtml(i.email)}</small></div></td>
                <td>${escapeHtml(i.role)}</td>
                <td>${escapeHtml(i.sector)}</td>
                <td><span class="badge ${statusClass(i.status)}">${escapeHtml(i.status)}</span></td>
                <td>${escapeHtml(i.average)}${Number.isFinite(i.average) ? "%" : ""}</td>
                <td><button class="btn" type="button" data-student="${i.id}">Histórico</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    ${selected ? `
    <section class="admin-card">
      <h2>${escapeHtml(selected.name)}</h2>
      <div class="badge-row">
        <span class="badge blue">${escapeHtml(selected.company)}</span>
        <span class="badge violet">${escapeHtml(selected.role)}</span>
        <span class="badge amber">Mat. ${escapeHtml(selected.registration)}</span>
      </div>
      <div class="timeline" style="margin-top:24px;">
        <h3>Eventos Anti-Cola (Mudança de Tela)</h3>
        ${state.infractions.filter(i => i.studentId === selected.id).map(i => `<p style="color:#d32f2f; padding: 8px; background: #ffebee; border-radius: 4px;">⚠️ <strong>${escapeHtml(i.date)}</strong>: ${escapeHtml(i.reason)}</p>`).join("") || "<p>Nenhuma infração registrada.</p>"}
      </div>
      <div class="timeline" style="margin-top:24px;">
        <h3>Progresso</h3>
        ${records.map(r => {
          const t = findTraining(r.trainingId);
          if (!t) return "";
          const score = Number.isFinite(r.score) ? `Nota ${r.score}` : "Nota pendente";
          return `
            <div class="timeline-item">
              <span class="timeline-dot"></span>
              <p><strong>${escapeHtml(t.category)}</strong> | ${r.progress}% assistido | ${score} | ${escapeHtml(r.status)} | ${escapeHtml(r.date)}</p>
            </div>
          `;
        }).join("")}
      </div>
    </section>
    ` : ""}
  `;
}

function renderTrainingsAdmin() {
  return `
    <section class="data-panel">
      <div class="table-toolbar">
        <div class="table-title"><h2>Cadastro de treinamentos</h2><p>Vídeo, perguntas e regras de conclusão por treinamento.</p></div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Título</th><th>Categoria</th><th>Carga</th><th>Instrutor</th><th>Nota mínima</th><th>Validade</th><th>Regras</th></tr></thead>
          <tbody>
            ${trainings.map(t => `
              <tr>
                <td><div class="row-title"><strong>${escapeHtml(t.title)}</strong><small>${escapeHtml(t.description)}</small></div></td>
                <td>${escapeHtml(t.category)}</td>
                <td>${escapeHtml(t.hours)}</td>
                <td>${escapeHtml(t.instructor)}</td>
                <td>${t.minScore}%</td>
                <td>${escapeHtml(t.validity)}</td>
                <td><span class="badge green">100% obrigatório</span> <span class="badge red">avanço bloqueado</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderQuestionsAdmin() {
  return `
    <section class="data-panel">
      <div class="table-toolbar">
        <div class="table-title"><h2>Banco de perguntas</h2><p>${trainings.reduce((s, t) => s + (t.questions?.length || 0), 0)} perguntas cadastradas.</p></div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Treinamento</th><th>Pergunta</th><th>Alternativas</th><th>Peso</th><th>Resposta correta</th></tr></thead>
          <tbody>
            ${trainings.flatMap(t =>
              (t.questions || []).map(q => `
                <tr>
                  <td>${escapeHtml(t.category)}</td>
                  <td>${escapeHtml(q.text)}</td>
                  <td>${q.options?.length || 0}</td>
                  <td>${q.weight}</td>
                  <td>${escapeHtml(q.options?.[q.correct] || "-")}</td>
                </tr>
              `)
            ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCategoriesAdmin() {
  return `
    <div class="metric-grid">
      ${trainings.map(t => renderMetric(t.category, t.title.replace(`${t.category} - `, ""), `${t.hours} | ${t.validity}`)).join("")}
    </div>
  `;
}

function certificates() {
  // Map certificates from admin assignments
  const list = [];
  adminAssignments.forEach(a => {
    if (a.certificates && a.certificates.length > 0) {
      const studentProfile = adminStudents.find(s => s.id === a.student_id);
      const t = findTraining(a.training_id);
      if (!t) return;
      
      a.certificates.forEach(c => {
        const attempts = a.assessment_attempts || [];
        attempts.sort((x, y) => new Date(y.submitted_at) - new Date(x.submitted_at));
        const lastAttempt = attempts[0];
        
        list.push({
          code: c.codigo_validacao,
          student: studentProfile?.name || "Desconhecido",
          training: t.title,
          date: new Date(c.issued_at).toLocaleDateString("pt-BR"),
          validity: t.validity
        });
      });
    }
  });
  return list;
}

function renderCertificatesAdmin() {
  const rows = certificates();
  return `
    <section class="data-panel">
      <div class="table-toolbar">
        <div class="table-title"><h2>Certificados</h2><p>${rows.length} certificado(s) registrado(s).</p></div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Código</th><th>Aluno</th><th>Treinamento</th><th>Data</th><th>Validade</th><th>Ações</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.code)}</strong></td>
                <td>${escapeHtml(r.student)}</td>
                <td>${escapeHtml(r.training)}</td>
                <td>${escapeHtml(r.date)}</td>
                <td>${escapeHtml(r.validity)}</td>
                <td><button class="btn" type="button" data-action="reissue-certificate">Reemitir</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderReportsAdmin() {
  return `
    <section class="data-panel">
      <div class="table-toolbar">
        <div class="table-title"><h2>Relatórios</h2><p>Filtros por empresa, setor, cargo, treinamento, período, aluno e status.</p></div>
        <div class="filters">
          <div class="field">
            <label for="reportTraining">Treinamento</label>
            <select id="reportTraining" data-filter="training">
              ${["Todos", ...trainings.map(t => t.category)].map(o => `<option ${o === state.filters.training ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="reportPeriod">Período</label>
            <select id="reportPeriod" data-filter="period">
              ${["7 dias", "30 dias", "90 dias", "12 meses"].map(o => `<option ${o === state.filters.period ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="reportStatus">Status</label>
            <select id="reportStatus" data-filter="status">
              ${["Todos", "Aprovado", "Reprovado", "Em andamento", "Pendente", "Vencido"].map(o => `<option ${o === state.filters.status ? "selected" : ""}>${o}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Aluno</th><th>Setor</th><th>Cargo</th><th>Treinamento</th><th>Status</th><th>Progresso</th><th>Nota</th></tr></thead>
          <tbody>
            ${filteredReportRecords().map(r => renderReportRow(r)).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function filteredReportRecords() {
  return currentRecords().filter(r => {
    const t = findTraining(r.trainingId);
    if (!t) return false;
    const trainingMatch = state.filters.training === "Todos" || t.category === state.filters.training;
    const statusMatch = state.filters.status === "Todos" || r.status === state.filters.status;
    return trainingMatch && statusMatch;
  });
}

function renderReportRow(record) {
  const person = adminStudents.find(s => s.id === record.studentId);
  const t = findTraining(record.trainingId);
  if (!t) return "";
  return `
    <tr>
      <td>${escapeHtml(person?.name || "Desconhecido")}</td>
      <td>${escapeHtml(person?.sector || "-")}</td>
      <td>${escapeHtml(person?.role || "-")}</td>
      <td>${escapeHtml(t.category)}</td>
      <td><span class="badge ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
      <td>${record.progress}%</td>
      <td>${Number.isFinite(record.score) ? record.score : "-"}</td>
    </tr>
  `;
}

function renderNotificationsAdmin() {
  const notifications = [
    ["Aluno", "Você possui treinamento pendente.", "NR 11 para novos colaboradores"],
    ["Aluno", "Seu certificado vencerá em 30 dias.", "Renovação NR 11"],
    ["Aluno", "Novo treinamento disponível.", "NR 35 para equipe de manutenção"],
    ["Administrador", "Alunos estão com treinamento pendente.", "Ação de regularização"],
  ];
  return `
    <section class="data-panel">
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Destinatário</th><th>Mensagem</th><th>Contexto</th><th>Status</th></tr></thead>
          <tbody>
            ${notifications.map(([target, msg, ctx], i) => `
              <tr>
                <td>${target}</td>
                <td>${msg}</td>
                <td>${ctx}</td>
                <td><span class="badge ${i % 2 ? "blue" : "green"}">${i % 2 ? "Agendada" : "Enviada"}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderUsersAdmin() {
  const users = [
    ["Administrador TST", "admin.tst@empresa.com", "Administrador", "Ativo"],
    [currentUser.nome_completo, currentUser.email, currentUser.tipo, "Ativo"],
  ];
  return `
    <section class="data-panel">
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th></tr></thead>
          <tbody>
            ${users.map(([name, email, role, status]) => `
              <tr>
                <td>${escapeHtml(name)}</td>
                <td>${escapeHtml(email)}</td>
                <td>${escapeHtml(role)}</td>
                <td><span class="badge green">${escapeHtml(status)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSettingsAdmin() {
  const settings = [
    ["Login autenticado (Supabase Auth)", true],
    ["Controle por perfil corporativo", true],
    ["Bloquear avanço do vídeo", true],
    ["Exigir 100% assistido", true],
    ["Gerar certificados com QR Code", true],
    ["Notificar vencimento em 30 dias", true],
  ];
  return `
    <div class="settings-grid">
      ${settings.map(([label, checked]) => `
        <label class="switch-line">
          <strong>${escapeHtml(label)}</strong>
          <input type="checkbox" ${checked ? "checked" : ""} />
        </label>
      `).join("")}
    </div>
  `;
}

// ── New Training Form ────────────────────────────────────────
function renderNewTrainingAdmin() {
  const d = newTrainingDraft;
  return `
    <section class="admin-card">
      <h2>Construtor de Treinamentos</h2>
      <p style="margin-bottom:20px; color:#555;">Monte a estrutura do curso livremente. Dados são salvos diretamente no banco de dados Supabase.</p>

      <form id="new-training-form" onsubmit="event.preventDefault(); window.saveNewTraining();">
        <div class="filters" style="display:flex; flex-direction:column; gap:12px; background:#f6f7f4; padding:16px; border-radius:8px;">
          <h3>1. Informações Básicas</h3>
          <div class="field"><label>Título do Treinamento</label><input required style="width:100%; padding:8px;" value="${escapeHtml(d.title)}" onchange="updateDraft('title', this.value)" /></div>
          <div class="field"><label>Categoria (Ex: NR 12)</label><input required style="width:100%; padding:8px;" value="${escapeHtml(d.category)}" onchange="updateDraft('category', this.value)" /></div>
          <div class="field"><label>Carga Horária (Ex: 8 horas)</label><input required style="width:100%; padding:8px;" value="${escapeHtml(d.hours)}" onchange="updateDraft('hours', this.value)" /></div>
          <div class="field"><label>Validade em meses (Ex: 12)</label><input type="number" required style="width:100%; padding:8px;" value="${escapeHtml(d.validity)}" onchange="updateDraft('validity', this.value)" /></div>
        </div>

        <div style="margin-top:24px; padding:16px; border:1px solid #dbe2dc; border-radius:8px;">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
             <h3>2. Playlist de Vídeos</h3>
             <button type="button" class="btn primary" onclick="addDraftVideo()">+ Adicionar Vídeo</button>
           </div>
           ${d.videos.map((v, i) => `
             <div style="display:flex; gap:8px; margin-bottom:8px; background:#fff; padding:8px; border:1px solid #eee;">
                <div style="flex:1">
                  <label style="font-size:12px;">Título da Aula</label>
                  <input required style="width:100%; padding:6px;" value="${escapeHtml(v.title)}" onchange="updateDraft('videos', this.value, ${i}, 'title')" />
                </div>
                <div style="flex:2">
                  <label style="font-size:12px;">URL do Vídeo (YouTube/MP4/Drive)</label>
                  <input required style="width:100%; padding:6px;" value="${escapeHtml(v.url)}" onchange="updateDraft('videos', this.value, ${i}, 'url')" />
                </div>
                <button type="button" class="btn red" style="align-self:flex-end;" onclick="removeDraftVideo(${i})">X</button>
             </div>
           `).join("")}
        </div>

        <div style="margin-top:24px; padding:16px; border:1px solid #dbe2dc; border-radius:8px;">
           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
             <h3>3. Banco de Perguntas</h3>
             <button type="button" class="btn primary" onclick="addDraftQuestion()">+ Adicionar Pergunta</button>
           </div>
           ${d.questions.map((q, i) => `
             <div style="background:#fff; padding:12px; border:1px solid #eee; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between;">
                  <strong>Pergunta ${i + 1}</strong>
                  <button type="button" class="btn red" onclick="removeDraftQuestion(${i})">X</button>
                </div>
                <input required style="width:100%; padding:6px; margin-top:8px;" value="${escapeHtml(q.text)}" onchange="updateDraft('questions', this.value, ${i}, 'text')" placeholder="Enunciado da pergunta" />
                <div style="margin-top:8px; display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                   ${q.options.map((opt, oIdx) => `
                     <div style="display:flex; align-items:center; gap:4px;">
                        <input type="radio" name="draft-correct-${i}" ${q.correct === oIdx ? "checked" : ""} onchange="updateDraft('questions', ${oIdx}, ${i}, 'correct')" />
                        <input required style="width:100%; padding:4px;" value="${escapeHtml(opt)}" onchange="updateDraft('questions', this.value, ${i}, 'options', ${oIdx})" />
                     </div>
                   `).join("")}
                </div>
             </div>
           `).join("")}
        </div>

        <br/>
        <button class="btn primary" type="submit" id="save-training-btn" style="width:100%; padding:12px; font-size:16px;">Salvar Treinamento no Banco de Dados</button>
      </form>
    </section>
  `;
}

// ── Draft Helpers (global) ───────────────────────────────────
window.updateDraft = function (field, value, idx, subfield, subidx) {
  if (idx !== undefined && subfield !== undefined && subidx !== undefined) {
    newTrainingDraft[field][idx][subfield][subidx] = value;
  } else if (idx !== undefined && subfield !== undefined) {
    newTrainingDraft[field][idx][subfield] = value;
  } else {
    newTrainingDraft[field] = value;
  }
};

window.addDraftVideo = function () {
  newTrainingDraft.videos.push({ id: "v" + Date.now(), title: "Nova Aula", url: "" });
  render();
};
window.removeDraftVideo = function (idx) {
  newTrainingDraft.videos.splice(idx, 1);
  render();
};
window.addDraftQuestion = function () {
  newTrainingDraft.questions.push({ id: "q" + Date.now(), text: "Nova Pergunta", weight: 10, options: ["Correta", "Errada", "Errada", "Errada"], correct: 0 });
  render();
};
window.removeDraftQuestion = function (idx) {
  newTrainingDraft.questions.splice(idx, 1);
  render();
};

window.saveNewTraining = async function () {
  const btn = document.getElementById("save-training-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Salvando no banco de dados..."; }

  try {
    await saveTrainingToSupabase(newTrainingDraft);

    // Reset draft
    newTrainingDraft = {
      title: "", category: "", hours: "", validity: "",
      videos: [{ id: "v1", title: "Aula 1", url: "" }],
      questions: [{ id: "q1", text: "Pergunta 1", weight: 10, options: ["Correta", "Errada 1", "Errada 2", "Errada 3"], correct: 0 }]
    };

    state.adminTab = "trainings";
    saveState();
    showToast("Treinamento salvo no banco de dados com sucesso!");
    await reloadStudentState();
  } catch (e) {
    showToast("Erro ao salvar: " + e.message);
    if (btn) { btn.disabled = false; btn.textContent = "Salvar Treinamento no Banco de Dados"; }
  }
};

// ── Utility Functions ────────────────────────────────────────
function setPortal(portal) {
  state.portal = portal;
  saveState();
  render();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const headers = ["Aluno", "Empresa", "Setor", "Cargo", "Treinamento", "Status", "Progresso", "Nota", "Data"];
  const rows = filteredReportRecords().map(r => {
    const person = adminStudents.find(s => s.id === r.studentId);
    const t = findTraining(r.trainingId);
    return [
      person?.name || "", person?.company || "", person?.sector || "", person?.role || "",
      t?.title || "", r.status, `${r.progress}%`,
      Number.isFinite(r.score) ? r.score : "", r.date,
    ];
  });
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  downloadFile("relatorio-treinamentos-tst.csv", csv, "text/csv;charset=utf-8");
  showToast("Relatório CSV gerado.");
}

// ── Event Listeners ──────────────────────────────────────────
document.addEventListener("click", async (e) => {
  const portalBtn = e.target.closest("[data-portal]");
  if (portalBtn) { setPortal(portalBtn.dataset.portal); return; }

  const trainingCard = e.target.closest("[data-training]");
  if (trainingCard) {
    state.selectedTrainingId = trainingCard.dataset.training;
    saveState();
    render();
    return;
  }

  const adminTab = e.target.closest("[data-admin-tab]");
  if (adminTab) {
    state.adminTab = adminTab.dataset.adminTab;
    saveState();
    render();
    return;
  }

  const studentBtn = e.target.closest("[data-student]");
  if (studentBtn) {
    state.selectedStudentId = studentBtn.dataset.student;
    saveState();
    render();
    return;
  }

  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  if (action === "watch-video") { if (videoPlayerNode) videoPlayerNode.play(); }
  if (action === "reset-video") await resetVideo();
  if (action === "submit-assessment") await submitAssessment();
  if (action === "retake-assessment") await retakeAssessment();
  if (action === "download-certificate") downloadCertificate();
  if (action === "export-csv") exportCsv();
  if (action === "reissue-certificate") showToast("Reemissão registrada.");
  if (action === "select-video") {
    state.selectedVideoId = actionBtn.dataset.vid;
    saveState();
    render();
    return;
  }
  if (action === "admin-primary") {
    state.adminTab = "new-training";
    saveState();
    render();
  }
});

document.addEventListener("change", (e) => {
  const questionInput = e.target.closest("[data-question]");
  if (questionInput) {
    const tid = state.selectedTrainingId;
    state.answers[tid] = { ...(state.answers[tid] || {}), [questionInput.dataset.question]: Number(questionInput.value) };
    saveState();
    render();
    return;
  }
  const filter = e.target.closest("[data-filter]");
  if (filter) {
    state.filters[filter.dataset.filter] = filter.value;
    saveState();
    render();
  }
});

document.addEventListener("input", (e) => {
  const filter = e.target.closest("input[data-filter]");
  if (!filter) return;
  state.filters[filter.dataset.filter] = filter.value;
  saveState();
  render();
  const restored = document.querySelector(`#${filter.id}`);
  if (restored) {
    restored.focus();
    restored.setSelectionRange(restored.value.length, restored.value.length);
  }
});

// ── Anti-cheat ───────────────────────────────────────────────
document.addEventListener("visibilitychange", () => {
  if (state.portal !== "student" || !currentUser) return;
  if (document.visibilityState === "hidden") {
    state.infractions.push({
      date: nowStamp(),
      studentId: currentUser.id,
      training: state.selectedTrainingId,
      reason: "Perda de foco na janela (possível cola)"
    });
    saveState();
    if (videoPlayerNode && !videoPlayerNode.paused) videoPlayerNode.pause();
    showToast("Atenção: Mudança de aba detectada! Essa ação foi registrada no seu histórico.");
    render();
  }
});

// ── Reload Student / Admin State ─────────────────────────────
async function reloadStudentState(session) {
  isLoading = true;
  render();

  const currentSession = session || (await sb.auth.getSession()).data.session;
  if (!currentSession) {
    currentUser = null;
    isLoading = false;
    render();
    return;
  }

  try {
    // 1. Fetch profile
    const { data: profile, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", currentSession.user.id)
      .single();

    if (error || !profile) {
      console.warn("Profile not found for authenticated user. Retrying...");
      currentUser = null;
      isLoading = false;
      render();
      return;
    }

    currentUser = profile;

    // 2. Load trainings catalog
    trainings = await loadTrainingsFromSupabase();

    if (profile.tipo === "aluno") {
      // 3. Load student assignments
      const { data: assignments } = await sb
        .from("training_assignments")
        .select(`
          *,
          video_progress(*),
          assessment_attempts(*, assessment_answers(*)),
          certificates(*)
        `)
        .eq("student_id", profile.id);

      myAssignments = assignments || [];

      // Map progress & results to local state
      state.progress = {};
      state.results = {};
      state.answers = {};

      myAssignments.forEach(a => {
        const t = trainings.find(tr => tr.id === a.training_id);
        if (!t) return;

        // Map video progress
        if (t.videos && t.videos.length > 0 && a.video_progress) {
          state.progress[t.id] = {
            [t.videos[0].id]: Number(a.video_progress.watched_percent || 0)
          };
        }

        // Map last attempt
        const attempts = a.assessment_attempts || [];
        if (attempts.length > 0) {
          attempts.sort((x, y) => y.attempt_number - x.attempt_number);
          const lastAttempt = attempts[0];
          const cert = a.certificates;
          state.results[t.id] = {
            score: Number(lastAttempt.score),
            approved: lastAttempt.status === "aprovado",
            date: new Date(lastAttempt.submitted_at).toLocaleDateString("pt-BR"),
            attempt: lastAttempt.attempt_number,
            certificateCode: cert ? cert.codigo_validacao : null
          };
        }
      });

      state.portal = "student";
    } else {
      // Admin or Instructor
      await loadAdminData();
    }
  } catch (e) {
    console.error("Failed to load user data from Supabase:", e);
  }

  isLoading = false;
  render();
}

// ── Bootstrap ────────────────────────────────────────────────
(async function init() {
  state = loadState();
  
  // Listen to Auth changes
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      await reloadStudentState(session);
    } else if (event === "SIGNED_OUT") {
      currentUser = null;
      myAssignments = [];
      adminAssignments = [];
      trainings = [];
      state.portal = "student";
      isLoading = false;
      render();
    } else if (event === "PASSWORD_RECOVERY") {
      state.resetMode = true;
      saveState();
      isLoading = false;
      render();
    }
  });

  // Check if hash has access token (recovery redirect)
  const hash = window.location.hash;
  if (hash.includes("type=recovery")) {
    state.resetMode = true;
    saveState();
  }

  // Load initial session if exists
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await reloadStudentState(session);
  } else {
    isLoading = false;
    render();
  }
})();
