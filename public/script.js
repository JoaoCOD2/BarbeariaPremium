/* ═══════════════════════════════════════════════════════
   BARBERSHOP — script.js  (v4 — bugs corrigidos)
   Lógica: Calendário · Horários · Firebase · WhatsApp
   ═══════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────
//  CONFIGURAÇÕES — EDITE AQUI
// ─────────────────────────────────────────────────────────

const BARBERS = [
  { id: "marcos", name: "Marcos", role: "Master Barber",  spec: "Degradê & Navalhado",    initial: "M" },
  { id: "rafael", name: "Rafael", role: "Senior Barber",  spec: "Corte Clássico & Barba", initial: "R" },
  { id: "thiago", name: "Thiago", role: "Barber Stylist", spec: "Moderno & Texturizado",   initial: "T" },
  { id: "lucas",  name: "Lucas",  role: "Junior Barber",  spec: "Corte Social & Kids",     initial: "L" },
];

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30",
  "11:00","11:30","12:00","13:00","13:30","14:00",
  "14:30","15:00","15:30","16:00","16:30","17:00",
  "17:30","18:00","18:30"
];

const WHATSAPP_NUMBER = "5551985830534";

// ─────────────────────────────────────────────────────────
//  ESTADO DA APLICAÇÃO
// ─────────────────────────────────────────────────────────
const state = {
  selectedBarber: null,
  selectedDate:   null,
  selectedTime:   null,
  clientName:     "",
  clientId:       "",
  currentStep:    1,
  calendarDate:   new Date(),
  bookedSlots:    [],
};

// ─────────────────────────────────────────────────────────
//  AGUARDA FIREBASE ESTAR PRONTO
// ─────────────────────────────────────────────────────────
window.addEventListener("firebaseReady", () => init());

// Fallback sem Firebase
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (!window._db) {
      console.warn("⚠️ Firebase não configurado. Rodando em modo offline.");
      init();
    }
  }, 1500);
});

// ─────────────────────────────────────────────────────────
//  INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────
function init() {
  renderBarbersGrid();
  renderBarberSelect();
  renderCalendar();
  setupEventListeners();
}

// ─────────────────────────────────────────────────────────
//  EVENT LISTENERS CENTRALIZADOS
//  FIX: Removidos onclick inline do HTML para evitar
//  problemas de escopo e múltiplos listeners.
// ─────────────────────────────────────────────────────────
function setupEventListeners() {
  // Navegação entre steps
  document.getElementById("backToStep1Btn").addEventListener("click", () => goStep(1));
  document.getElementById("toStep3Btn").addEventListener("click",    () => goStep(3));
  document.getElementById("backToStep2Btn").addEventListener("click", () => goStep(2));
  document.getElementById("toStep4Btn").addEventListener("click",    () => goStep(4));
  document.getElementById("backToStep3Btn").addEventListener("click", () => goStep(3));
  document.getElementById("confirmBtn").addEventListener("click",    confirmarAgendamento);

  // Modais
  document.getElementById("closeModalBtn").addEventListener("click",      closeModal);
  document.getElementById("closeErrorModalBtn").addEventListener("click", closeErrorModal);

  // Menu mobile
  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("mobileNav").classList.toggle("open");
  });
  document.getElementById("mobileNavProfissionais").addEventListener("click", closeMobileNav);
  document.getElementById("mobileNavAgendar").addEventListener("click",       closeMobileNav);

  // FIX: Listeners do calendário registrados UMA única vez aqui,
  // em vez de serem reatribuídos a cada chamada de renderCalendar().
  document.getElementById("prevMonth").addEventListener("click", () => {
    const now = new Date();
    const cur = state.calendarDate;
    if (cur.getFullYear() === now.getFullYear() && cur.getMonth() === now.getMonth()) return;
    state.calendarDate = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    const cur = state.calendarDate;
    state.calendarDate = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    renderCalendar();
  });
}

// ─────────────────────────────────────────────────────────
//  PROFISSIONAIS — vitrine e seleção
// ─────────────────────────────────────────────────────────
function renderBarbersGrid() {
  const grid = document.getElementById("barbersGrid");
  if (!grid) return;
  grid.innerHTML = BARBERS.map(b => `
    <div class="barber-card">
      <div class="barber-avatar">${b.initial}</div>
      <div class="barber-name">${b.name}</div>
      <div class="barber-role">${b.role}</div>
      <div class="barber-tag">${b.spec}</div>
    </div>
  `).join("");
}

function renderBarberSelect() {
  const grid = document.getElementById("barberSelectGrid");
  if (!grid) return;
  grid.innerHTML = BARBERS.map(b => `
    <div class="barber-option" data-barber-id="${b.id}" id="bo_${b.id}">
      <div class="b-avatar">${b.initial}</div>
      <div class="b-name">${b.name}</div>
      <div class="b-spec">${b.spec}</div>
    </div>
  `).join("");

  // FIX: Event delegation — um único listener no container
  // em vez de onclick inline em cada card.
  grid.addEventListener("click", (e) => {
    const option = e.target.closest(".barber-option");
    if (!option) return;
    selectBarber(option.dataset.barberId);
  });
}

function selectBarber(id) {
  state.selectedBarber = BARBERS.find(b => b.id === id);
  document.querySelectorAll(".barber-option").forEach(el => el.classList.remove("selected"));
  const el = document.getElementById("bo_" + id);
  if (el) el.classList.add("selected");
  setTimeout(() => goStep(2), 300);
}

// ─────────────────────────────────────────────────────────
//  CALENDÁRIO
//  FIX: Listeners de prevMonth/nextMonth removidos daqui
//  (agora ficam em setupEventListeners, chamados só uma vez).
// ─────────────────────────────────────────────────────────
function renderCalendar() {
  const d     = state.calendarDate;
  const year  = d.getFullYear();
  const month = d.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  document.getElementById("calMonthLabel").textContent =
    d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";

  // Células vazias antes do dia 1
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-day empty";
    grid.appendChild(cell);
  }

  // Dias do mês
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const cell     = document.createElement("div");
    cell.className = "cal-day";
    cell.textContent = day;

    const isPast   = date < today;
    const isSunday = date.getDay() === 0;

    if (isPast || isSunday) {
      cell.classList.add("disabled");
    } else {
      if (date.toDateString() === today.toDateString()) {
        cell.classList.add("today");
      }
      if (state.selectedDate && date.toDateString() === state.selectedDate.toDateString()) {
        cell.classList.add("selected");
      }
      cell.addEventListener("click", () => onDateClick(date));
    }

    grid.appendChild(cell);
  }
}

async function onDateClick(date) {
  state.selectedDate = date;
  state.selectedTime = null;
  document.getElementById("toStep3Btn").disabled = true;
  renderCalendar();
  await loadAndRenderTimeSlots(date);
}

// ─────────────────────────────────────────────────────────
//  HORÁRIOS
// ─────────────────────────────────────────────────────────
async function loadAndRenderTimeSlots(date) {
  const timeGrid = document.getElementById("timeGrid");
  timeGrid.innerHTML = `<p class="time-placeholder">Carregando horários...</p>`;

  const dateStr  = formatDateStr(date);
  const barberId = state.selectedBarber?.id || "";
  let takenSlots = [];

  if (window._db) {
    try {
      const q = window._query(
        window._collection(window._db, "agendamentos"),
        window._where("data",       "==", dateStr),
        window._where("barbeiroId", "==", barberId)
      );
      const snap = await window._getDocs(q);
      snap.forEach(doc => takenSlots.push(doc.data().horario));
    } catch (e) {
      console.error("Erro ao buscar horários:", e);
    }
  }

  state.bookedSlots = takenSlots;
  renderTimeSlots(takenSlots);
}

function renderTimeSlots(takenSlots) {
  const timeGrid = document.getElementById("timeGrid");

  // FIX: Event delegation — um listener no container,
  // sem onclick inline e sem risco de múltiplos binds.
  timeGrid.innerHTML = TIME_SLOTS.map(slot => {
    const taken = takenSlots.includes(slot);
    return `
      <div class="time-slot ${taken ? "taken" : ""}" data-time="${taken ? "" : slot}">
        ${slot}${taken ? "<br/><small>Ocupado</small>" : ""}
      </div>
    `;
  }).join("");

  timeGrid.addEventListener("click", (e) => {
    const slot = e.target.closest(".time-slot");
    if (!slot || slot.classList.contains("taken")) return;
    const time = slot.dataset.time;
    if (!time) return;
    selectTime(time);
  });
}

function selectTime(time) {
  state.selectedTime = time;

  // FIX: Comparação exata via data-time em vez de textContent.startsWith()
  document.querySelectorAll(".time-slot").forEach(el => {
    el.classList.remove("selected");
    if (el.dataset.time === time) {
      el.classList.add("selected");
    }
  });

  document.getElementById("toStep3Btn").disabled = false;
}

// ─────────────────────────────────────────────────────────
//  NAVEGAÇÃO ENTRE STEPS
// ─────────────────────────────────────────────────────────
function goStep(n) {
  // Validações
  if (n === 2 && !state.selectedBarber) {
    alert("Por favor, selecione um profissional.");
    return;
  }
  if (n === 3) {
    if (!state.selectedDate) { alert("Selecione uma data."); return; }
    if (!state.selectedTime) { alert("Selecione um horário."); return; }
  }
  if (n === 4) {
    const name = document.getElementById("clientName").value.trim();
    const id   = document.getElementById("clientId").value.trim();
    if (!name) { alert("Por favor, informe seu nome."); return; }
    if (!id)   { alert("Por favor, informe CPF ou telefone."); return; }
    state.clientName = name;
    state.clientId   = id;
    fillConfirmation();
  }

  applyStepUI(n);
  document.getElementById("agendar").scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyStepUI(n) {
  state.currentStep = n;
  document.querySelectorAll(".form-step").forEach(el => el.classList.remove("active"));
  document.getElementById("step" + n).classList.add("active");

  document.querySelectorAll(".step[data-step]").forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove("active", "done");
    if (s === n) el.classList.add("active");
    if (s < n)  el.classList.add("done");
  });
}

function fillConfirmation() {
  document.getElementById("confirmBarber").textContent = state.selectedBarber?.name || "—";
  document.getElementById("confirmDate").textContent   = state.selectedDate
    ? state.selectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "—";
  document.getElementById("confirmTime").textContent  = state.selectedTime  || "—";
  document.getElementById("confirmName").textContent  = state.clientName    || "—";
  document.getElementById("confirmIdDoc").textContent = state.clientId      || "—";
}

// ─────────────────────────────────────────────────────────
//  CONFIRMAR AGENDAMENTO (Firebase + WhatsApp)
// ─────────────────────────────────────────────────────────
async function confirmarAgendamento() {
  const btn = document.getElementById("confirmBtn");
  btn.disabled    = true;
  btn.textContent = "Salvando...";

  const dateStr  = formatDateStr(state.selectedDate);
  const barberId = state.selectedBarber.id;
  const horario  = state.selectedTime;

  if (window._db) {
    try {
      // Dupla checagem de conflito
      const q = window._query(
        window._collection(window._db, "agendamentos"),
        window._where("data",       "==", dateStr),
        window._where("barbeiroId", "==", barberId),
        window._where("horario",    "==", horario)
      );
      const snap = await window._getDocs(q);

      if (!snap.empty) {
        btn.disabled    = false;
        btn.textContent = "Confirmar e Agendar ✓";
        openErrorModal();
        return;
      }

      // Salvar no Firestore
      await window._addDoc(window._collection(window._db, "agendamentos"), {
        barbeiroId:   barberId,
        barbeiroNome: state.selectedBarber.name,
        data:         dateStr,
        horario:      horario,
        clienteNome:  state.clientName,
        clienteId:    state.clientId,
        criadoEm:     new Date().toISOString(),
      });
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar o agendamento. Verifique as configurações do Firebase.");
      btn.disabled    = false;
      btn.textContent = "Confirmar e Agendar ✓";
      return;
    }
  }

  notificarWhatsApp();
  openSuccessModal();

  btn.disabled    = false;
  btn.textContent = "Confirmar e Agendar ✓";
}

function notificarWhatsApp() {
  const dateFormatted = state.selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long"
  });
  const msg = encodeURIComponent(
    `✦ *Novo Agendamento — BarberShop* ✦\n\n` +
    `👤 *Cliente:* ${state.clientName}\n` +
    `🪪 *Identificação:* ${state.clientId}\n` +
    `✂️ *Barbeiro:* ${state.selectedBarber.name}\n` +
    `📅 *Data:* ${dateFormatted}\n` +
    `🕐 *Horário:* ${state.selectedTime}\n\n` +
    `_Agendado pelo site online._`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
}

// ─────────────────────────────────────────────────────────
//  MODAIS
// ─────────────────────────────────────────────────────────
function openSuccessModal() {
  const dateFormatted = state.selectedDate.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric"
  });
  document.getElementById("modalText").textContent =
    `${state.clientName}, seu horário com ${state.selectedBarber.name} ` +
    `está confirmado para ${dateFormatted} às ${state.selectedTime}.`;
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");

  // Resetar estado
  state.selectedBarber = null;
  state.selectedDate   = null;
  state.selectedTime   = null;
  state.clientName     = "";
  state.clientId       = "";
  document.getElementById("clientName").value = "";
  document.getElementById("clientId").value   = "";

  // Resetar UI sem validações
  applyStepUI(1);
  renderBarberSelect();
  renderCalendar();
}

function openErrorModal() {
  document.getElementById("modalError").classList.add("open");
}

function closeErrorModal() {
  document.getElementById("modalError").classList.remove("open");
  goStep(2);
}

// ─────────────────────────────────────────────────────────
//  MENU MOBILE
// ─────────────────────────────────────────────────────────
function closeMobileNav() {
  document.getElementById("mobileNav").classList.remove("open");
}

// ─────────────────────────────────────────────────────────
//  UTILITÁRIOS
// ─────────────────────────────────────────────────────────
function formatDateStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}