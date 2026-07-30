import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. CONFIGURAÇÃO DO FIREBASE (Com a databaseURL corrigida)
const firebaseConfig = {
  apiKey: "AIzaSyDVZSlNvtLOER3YdotvGi-G7VvDtSQwV7M",
  authDomain: "sistema-team-penning.firebaseapp.com",
  databaseURL: "https://sistema-team-penning-default-rtdb.firebaseio.com", // <-- ADICIONADO AQUI
  projectId: "sistema-team-penning",
  storageBucket: "sistema-team-penning.firebasestorage.app",
  messagingSenderId: "1025888364244",
  appId: "1:1025888364244:web:d4c5d0582899a855ddbd41"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Estado Local em Tempo Real
let state = {
  config: {
    batchSize: 24,
    alertThreshold: 5,
    qualifiedPerBatch: 3,
    totalFinalists: 10
  },
  trios: {},
  runs: [],
  currentRunIndex: 0
};

// --- NAVEGAÇÃO DE ABAS ---
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');

  if (tabId === 'placar') renderLeaderboard();
};

// --- ESCUTADORES EM TEMPO REAL (FIREBASE) ---
onValue(ref(db, 'config'), (snapshot) => {
  if (snapshot.exists()) {
    state.config = snapshot.val();
    document.getElementById('batchSize').value = state.config.batchSize;
    document.getElementById('alertThreshold').value = state.config.alertThreshold;
    document.getElementById('qualifiedPerBatch').value = state.config.qualifiedPerBatch;
    document.getElementById('totalFinalists').value = state.config.totalFinalists;
    updatePistaUI();
  }
});

onValue(ref(db, 'trios'), (snapshot) => {
  state.trios = snapshot.val() || {};
  renderStartList();
  updatePistaUI();
});

// --- SALVAR CONFIGURAÇÕES ---
document.getElementById('config-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const configData = {
    batchSize: parseInt(document.getElementById('batchSize').value),
    alertThreshold: parseInt(document.getElementById('alertThreshold').value),
    qualifiedPerBatch: parseInt(document.getElementById('qualifiedPerBatch').value),
    totalFinalists: parseInt(document.getElementById('totalFinalists').value)
  };
  set(ref(db, 'config'), configData).then(() => alert('Configurações salvas!'));
});

// --- CADASTRAR TRIO & SENHA ---
document.getElementById('trio-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const totalTrios = Object.keys(state.trios).length;
  const newSenha = totalTrios + 1;

  const trioData = {
    senha: newSenha,
    startOrder: null, // Sorteio definirá depois
    r1: document.getElementById('r1').value,
    r2: document.getElementById('r2').value,
    r3: document.getElementById('r3').value,
    category: document.getElementById('categoriaPrincipal').value,
    catEmbutida: document.getElementById('catEmbutida').checked,
    result: null // { time: float, bois: int, isSAT: bool }
  };

  const newRef = push(ref(db, 'trios'));
  set(newRef, trioData).then(() => {
    document.getElementById('trio-form').reset();
  });
});

// --- SORTEIO ELETRÔNICO DA ORDEM DE ENTRADA (START LIST) ---
window.gerarStartList = function() {
  const keys = Object.keys(state.trios);
  if (keys.length === 0) return alert('Nenhum trio cadastrado para sortear!');

  // Embaralhamento (Fisher-Yates Shuffle)
  const shuffledKeys = [...keys];
  for (let i = shuffledKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
  }

  const updates = {};
  shuffledKeys.forEach((key, index) => {
    updates[`trios/${key}/startOrder`] = index + 1;
  });

  update(ref(db), updates).then(() => {
    alert('Sorteio da Ordem de Entrada realizado com sucesso!');
  });
};

// --- RENDERIZAR TABELA DE START LIST ---
function renderStartList() {
  const tbody = document.querySelector('#table-startlist tbody');
  tbody.innerHTML = '';

  const list = Object.values(state.trios).sort((a, b) => {
    if (a.startOrder && b.startOrder) return a.startOrder - b.startOrder;
    return a.senha - b.senha;
  });

  list.forEach(trio => {
    const batchNum = trio.startOrder ? Math.ceil(trio.startOrder / state.config.batchSize) : '-';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${trio.startOrder ? `<strong>#${trio.startOrder}</strong>` : 'Aguardando Sorteio'}</td>
      <td>Senha #${trio.senha}</td>
      <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
      <td>${trio.category}</td>
      <td>${trio.catEmbutida ? 'Sim (Local)' : 'Não'}</td>
      <td><span class="tag-lote">Lote ${batchNum}</span></td>
    `;
    tbody.appendChild(row);
  });
}

// --- LÓGICA DA PISTA & ALERTA DE TROCA DE GADO ---
function updatePistaUI() {
  const sortedTrios = Object.entries(state.trios)
    .filter(([_, t]) => t.startOrder !== null)
    .sort((a, b) => a[1].startOrder - b[1].startOrder);

  // Acha a primeira corrida sem resultado
  const pending = sortedTrios.find(([_, t]) => !t.result);

  if (!pending) {
    document.getElementById('current-run-num').innerText = "Fim da Prova";
    document.getElementById('current-trio-names').innerText = "Todas as corridas foram concluídas.";
    document.getElementById('batch-alert').classList.add('hidden');
    return;
  }

  const [key, trio] = pending;
  const runNum = trio.startOrder;
  const batchSize = state.config.batchSize;
  const alertThreshold = state.config.alertThreshold;

  const currentBatchNum = Math.ceil(runNum / batchSize);
  const nextBatchFirstRun = currentBatchNum * batchSize;
  const runsLeftInBatch = nextBatchFirstRun - runNum + 1;

  // Atualiza dados na tela de Pista
  document.getElementById('current-run-num').innerText = `#${runNum}`;
  document.getElementById('current-lote-tag').innerText = `Lote ${currentBatchNum}`;
  document.getElementById('current-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
  document.getElementById('current-trio-cat').innerText = `${trio.category} ${trio.catEmbutida ? '(+ Local)' : ''}`;

  // REGRA DO ALERTA: Avisar 5 corridas antes da troca
  const alertBanner = document.getElementById('batch-alert');
  if (runsLeftInBatch <= alertThreshold) {
    document.getElementById('runs-left-count').innerText = runsLeftInBatch;
    alertBanner.classList.remove('hidden');
  } else {
    alertBanner.classList.add('hidden');
  }

  // Atribui ID do trio atual ao form para envio
  document.getElementById('run-result-form').dataset.currentKey = key;
}

// --- LANÇAMENTO DE RESULTADO DA CORRIDA ---
document.getElementById('run-result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = e.target.dataset.currentKey;
  if (!key) return;

  const isSAT = document.getElementById('isSAT').checked;
  const timeSeconds = parseFloat(document.getElementById('timeSeconds').value) || 999.999;
  const boisPenning = parseInt(document.getElementById('boisPenning').value);

  const resultData = {
    isSAT: isSAT,
    bois: isSAT ? 0 : boisPenning,
    time: isSAT ? 999.999 : timeSeconds,
    timestamp: Date.now()
  };

  set(ref(db, `trios/${key}/result`), resultData).then(() => {
    document.getElementById('run-result-form').reset();
    updatePistaUI();
  });
});

// --- RENDERIZAR CLASSIFICAÇÃO / LEADERBOARD ---
window.renderLeaderboard = function() {
  const container = document.getElementById('leaderboard-results');
  container.innerHTML = '';

  const filterCat = document.getElementById('filterCategory').value;
  const filterMode = document.getElementById('filterMode').value;

  let allTrios = Object.values(state.trios).filter(t => t.result !== undefined && t.result !== null);

  // Filtragem de Categoria
  if (filterCat === 'Local') {
    allTrios = allTrios.filter(t => t.catEmbutida === true);
  } else if (filterCat !== 'ALL') {
    allTrios = allTrios.filter(t => t.category === filterCat);
  }

  // Ordenação Padrão: 1º Mais Bois Penning, 2º Menor Tempo
  const sortFn = (a, b) => {
    if (a.result.bois !== b.result.bois) return b.result.bois - a.result.bois;
    return a.result.time - b.result.time;
  };

  if (filterMode === 'BY_BATCH') {
    // Agrupa trios por Lote de Gado
    const batches = {};
    allTrios.forEach(t => {
      const bNum = Math.ceil(t.startOrder / state.config.batchSize);
      if (!batches[bNum]) batches[bNum] = [];
      batches[bNum].push(t);
    });

    Object.keys(batches).sort((a, b) => a - b).forEach(bNum => {
      const batchTrios = batches[bNum].sort(sortFn);
      buildBatchTable(container, `Lote de Gado ${bNum}`, batchTrios, state.config.qualifiedPerBatch);
    });

  } else {
    // Ranking Geral Corrido
    const sorted = allTrios.sort(sortFn);
    buildBatchTable(container, `Ranking Geral (${filterCat})`, sorted, state.config.totalFinalists);
  }
};

function buildBatchTable(container, title, triosList, topQualifiedLimit) {
  const card = document.createElement('div');
  card.className = 'card-form';

  let html = `<h3>${title}</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>Pos.</th>
          <th>Start #</th>
          <th>Trio</th>
          <th>Bois</th>
          <th>Tempo</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>`;

  triosList.forEach((trio, index) => {
    const isQualified = index < topQualifiedLimit && !trio.result.isSAT;
    const pos = index + 1;

    html += `
      <tr class="${isQualified ? 'qualified-row' : ''}">
        <td><strong>${pos}º</strong></td>
        <td>#${trio.startOrder}</td>
        <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
        <td>${trio.result.bois} boi(s)</td>
        <td>${trio.result.isSAT ? 'SAT' : trio.result.time.toFixed(3) + 's'}</td>
        <td>${isQualified ? '<span class="badge-qualified">CLASSIFICADO</span>' : '-'}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  card.innerHTML = html;
  container.appendChild(card);
}