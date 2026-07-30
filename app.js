import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVZSlNvtLOER3YdotvGi-G7VvDtSQwV7M",
  authDomain: "sistema-team-penning.firebaseapp.com",
  databaseURL: "https://sistema-team-penning-default-rtdb.firebaseio.com",
  projectId: "sistema-team-penning",
  storageBucket: "sistema-team-penning.firebasestorage.app",
  messagingSenderId: "1025888364244",
  appId: "1:1025888364244:web:d4c5d0582899a855ddbd41"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let state = {
  config: {
    batchSize: 24,
    alertThreshold: 5,
    qualifiedPerBatch: 3,
    totalFinalists: 10
  },
  trios: {}
};

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const targetBtn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
  if (targetBtn) targetBtn.classList.add('active');
  
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  if (tabId === 'placar') renderLeaderboard();
  if (tabId === 'semifinal') {
    updateSemifinalUI();
    renderSemifinalLeaderboard();
  }
  if (tabId === 'grandefinal') {
    updateGrandeFinalUI();
    renderGrandFinalLeaderboard();
  }
};

window.onSemiCategoryChange = function() {
  updateSemifinalUI();
  renderSemifinalLeaderboard();
};

window.onFinalCategoryChange = function() {
  updateGrandeFinalUI();
  renderGrandFinalLeaderboard();
};

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
  updateSemifinalUI();
  renderSemifinalLeaderboard();
  updateGrandeFinalUI();
  renderGrandFinalLeaderboard();
});

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

document.getElementById('trio-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const totalTrios = Object.keys(state.trios).length;
  const newSenha = totalTrios + 1;

  const trioData = {
    senha: newSenha,
    startOrder: null,
    r1: document.getElementById('r1').value,
    r2: document.getElementById('r2').value,
    r3: document.getElementById('r3').value,
    category: document.getElementById('categoriaPrincipal').value,
    catEmbutida: document.getElementById('catEmbutida').checked,
    result: null,
    semiOrder: null,
    semiResult: null,
    finalOrder: null,
    finalResult: null
  };

  const newRef = push(ref(db, 'trios'));
  set(newRef, trioData).then(() => {
    document.getElementById('trio-form').reset();
  });
});

// --- SORTEIO POR CATEGORIA (PRINT 1) ---
window.gerarStartList = function() {
  const selectedCat = document.getElementById('drawCategorySelect').value;
  const targetKeys = Object.keys(state.trios).filter(k => state.trios[k].category === selectedCat);

  if (targetKeys.length === 0) return alert(`Nenhum trio cadastrado para a categoria: ${selectedCat}!`);

  const shuffledKeys = [...targetKeys];
  for (let i = shuffledKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
  }

  const updates = {};
  shuffledKeys.forEach((key, index) => {
    updates[`trios/${key}/startOrder`] = index + 1;
  });

  update(ref(db), updates).then(() => alert(`Sorteio da Categoria ${selectedCat} realizado com sucesso!`));
};

function renderStartList() {
  const tbody = document.querySelector('#table-startlist tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const list = Object.values(state.trios).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
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

// --- PISTA 1ª PASSADA (SELEÇÃO DE CATEGORIA - PRINT 2) ---
function updatePistaUI() {
  const selectedCat = document.getElementById('pistaCategorySelect')?.value || 'Soma 3';

  const sortedTrios = Object.entries(state.trios)
    .filter(([_, t]) => t.startOrder !== null && t.category === selectedCat)
    .sort((a, b) => a[1].startOrder - b[1].startOrder);

  const pending = sortedTrios.find(([_, t]) => !t.result);

  if (!pending) {
    document.getElementById('current-run-num').innerText = sortedTrios.length > 0 ? "Fim da 1ª Passada" : "--";
    document.getElementById('current-trio-names').innerText = sortedTrios.length > 0 ? `Todas as corridas de ${selectedCat} foram concluídas.` : "Nenhum trio sorteado nesta categoria.";
    document.getElementById('batch-alert').classList.add('hidden');
    return;
  }

  const [key, trio] = pending;
  const runNum = trio.startOrder;
  const batchSize = state.config.batchSize;

  const currentBatchNum = Math.ceil(runNum / batchSize);
  const nextBatchFirstRun = currentBatchNum * batchSize;
  const runsLeftInBatch = nextBatchFirstRun - runNum + 1;

  document.getElementById('current-run-num').innerText = `#${runNum}`;
  document.getElementById('current-lote-tag').innerText = `Lote ${currentBatchNum}`;
  document.getElementById('current-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
  document.getElementById('current-trio-cat').innerText = `${trio.category} ${trio.catEmbutida ? '(+ Local)' : ''}`;

  const alertBanner = document.getElementById('batch-alert');
  if (runsLeftInBatch <= state.config.alertThreshold) {
    document.getElementById('runs-left-count').innerText = runsLeftInBatch;
    alertBanner.classList.remove('hidden');
  } else {
    alertBanner.classList.add('hidden');
  }

  document.getElementById('run-result-form').dataset.currentKey = key;
}

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

function getQualifiedTrios(category) {
  const batches = {};
  Object.entries(state.trios).forEach(([key, t]) => {
    if (t.result && t.category === category) {
      const bNum = Math.ceil(t.startOrder / state.config.batchSize);
      if (!batches[bNum]) batches[bNum] = [];
      batches[bNum].push({ key, ...t });
    }
  });

  const sortFn = (a, b) => {
    if (a.result.bois !== b.result.bois) return b.result.bois - a.result.bois;
    return a.result.time - b.result.time;
  };

  const qualifiedList = [];
  Object.values(batches).forEach(batchTrios => {
    const sorted = batchTrios.sort(sortFn);
    sorted.slice(0, state.config.qualifiedPerBatch).forEach(t => {
      if (!t.result.isSAT) qualifiedList.push(t);
    });
  });

  return qualifiedList.sort(sortFn);
}

window.renderLeaderboard = function() {
  const container = document.getElementById('leaderboard-results');
  if (!container) return;
  container.innerHTML = '';

  const filterCat = document.getElementById('filterCategory').value;
  const filterMode = document.getElementById('filterMode').value;

  let allTrios = Object.values(state.trios).filter(t => t.result !== undefined && t.result !== null);

  if (filterCat === 'Local') {
    allTrios = allTrios.filter(t => t.catEmbutida === true);
  } else if (filterCat !== 'ALL') {
    allTrios = allTrios.filter(t => t.category === filterCat);
  }

  const sortFn = (a, b) => {
    if (a.result.bois !== b.result.bois) return b.result.bois - a.result.bois;
    return a.result.time - b.result.time;
  };

  if (filterMode === 'BY_BATCH') {
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
    const sorted = allTrios.sort(sortFn);
    buildBatchTable(container, `Ranking Geral (1ª Passada)`, sorted, state.config.totalFinalists);
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

// --- LÓGICA DA SEMIFINAL (2ª PASSADA - MENOR TEMPO DA ETAPA - PRINT 4) ---
window.gerarOrdemSemifinal = function() {
  const selectedCat = document.getElementById('semiCategorySelect').value;
  const qualified = getQualifiedTrios(selectedCat);

  if (qualified.length === 0) return alert(`Nenhum trio classificado na categoria ${selectedCat}!`);

  const inverted = [...qualified].reverse();

  const updates = {};
  inverted.forEach((trio, index) => {
    updates[`trios/${trio.key}/semiOrder`] = index + 1;
  });

  update(ref(db), updates).then(() => {
    alert(`Ordem da Semifinal de ${selectedCat} gerada com ${inverted.length} trios!`);
  });
};

function updateSemifinalUI() {
  const selectedCat = document.getElementById('semiCategorySelect')?.value || 'Soma 3';

  const sortedSemi = Object.entries(state.trios)
    .filter(([_, t]) => t.semiOrder !== undefined && t.semiOrder !== null && t.category === selectedCat)
    .sort((a, b) => a[1].semiOrder - b[1].semiOrder);

  const pending = sortedSemi.find(([_, t]) => !t.semiResult);

  if (!pending) {
    document.getElementById('semi-run-num').innerText = sortedSemi.length > 0 ? "Fim da Semifinal" : "--";
    document.getElementById('semi-trio-names').innerText = sortedSemi.length > 0 ? "Passadas da semifinal concluídas para esta categoria!" : "Aguardando geração da ordem.";
    document.getElementById('semi-trio-pass1').innerText = "--";
    return;
  }

  const [key, trio] = pending;

  document.getElementById('semi-run-num').innerText = `#${trio.semiOrder}`;
  document.getElementById('semi-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
  document.getElementById('semi-trio-pass1').innerText = `${trio.result.bois} boi(s) - ${trio.result.time.toFixed(3)}s`;

  document.getElementById('semi-result-form').dataset.currentKey = key;
}

document.getElementById('semi-result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = e.target.dataset.currentKey;
  if (!key) return;

  const isSAT = document.getElementById('semiIsSAT').checked;
  const timeSeconds = parseFloat(document.getElementById('semiTimeSeconds').value) || 999.999;
  const boisPenning = parseInt(document.getElementById('semiBoisPenning').value);

  const resultData = {
    isSAT: isSAT,
    bois: isSAT ? 0 : boisPenning,
    time: isSAT ? 999.999 : timeSeconds,
    timestamp: Date.now()
  };

  set(ref(db, `trios/${key}/semiResult`), resultData).then(() => {
    document.getElementById('semi-result-form').reset();
    updateSemifinalUI();
    renderSemifinalLeaderboard();
  });
});

function getSemiLeaderboard(category) {
  const list = [];
  Object.entries(state.trios).forEach(([key, t]) => {
    if (t.semiOrder && t.semiResult && t.category === category) {
      list.push({ key, ...t });
    }
  });

  // ORDENAÇÃO EXCLUSIVAMENTE PELO MENOR TEMPO / MAIOR NÚMERO DE BOIS DA SEMIFINAL
  return list.sort((a, b) => {
    if (a.semiResult.bois !== b.semiResult.bois) return b.semiResult.bois - a.semiResult.bois;
    return a.semiResult.time - b.semiResult.time;
  });
}

function renderSemifinalLeaderboard() {
  const container = document.getElementById('semi-leaderboard-results');
  if (!container) return;
  container.innerHTML = '';

  const selectedCat = document.getElementById('semiCategorySelect')?.value || 'Soma 3';
  const sorted = getSemiLeaderboard(selectedCat);

  const card = document.createElement('div');
  card.className = 'card-form';

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Colocação</th>
          <th>Trio</th>
          <th>1ª Passada (Ref)</th>
          <th>Bois (2ª Passada)</th>
          <th>Tempo (2ª Passada)</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>`;

  sorted.forEach((trio, index) => {
    const pos = index + 1;
    const isQualified = pos <= state.config.totalFinalists && !trio.semiResult.isSAT;

    html += `
      <tr class="${isQualified ? 'qualified-row' : ''}">
        <td><strong>${pos}º Lugar</strong></td>
        <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
        <td>${trio.result.bois}b / ${trio.result.isSAT ? 'SAT' : trio.result.time.toFixed(3) + 's'}</td>
        <td><strong>${trio.semiResult.bois} boi(s)</strong></td>
        <td><strong>${trio.semiResult.isSAT ? 'SAT' : trio.semiResult.time.toFixed(3) + 's'}</strong></td>
        <td>${isQualified ? '<span class="badge-qualified">CLASSIFICADO FINAL</span>' : '-'}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  card.innerHTML = html;
  container.appendChild(card);
}

// --- LÓGICA DA GRANDE FINAL (3ª PASSADA - MENOR TEMPO DA FINAL - PRINT 5) ---
window.gerarOrdemGrandeFinal = function() {
  const selectedCat = document.getElementById('finalCategorySelect').value;
  const semiRanking = getSemiLeaderboard(selectedCat);

  if (semiRanking.length === 0) return alert(`Nenhum trio concluiu a semifinal na categoria ${selectedCat}!`);

  const finalists = semiRanking.slice(0, state.config.totalFinalists);
  const inverted = [...finalists].reverse();

  const updates = {};
  inverted.forEach((trio, index) => {
    updates[`trios/${trio.key}/finalOrder`] = index + 1;
  });

  update(ref(db), updates).then(() => {
    alert(`Ordem da Grande Final de ${selectedCat} gerada com os Top ${finalists.length} trios!`);
  });
};

function updateGrandeFinalUI() {
  const selectedCat = document.getElementById('finalCategorySelect')?.value || 'Soma 3';

  const sortedFinal = Object.entries(state.trios)
    .filter(([_, t]) => t.finalOrder !== undefined && t.finalOrder !== null && t.category === selectedCat)
    .sort((a, b) => a[1].finalOrder - b[1].finalOrder);

  const pending = sortedFinal.find(([_, t]) => !t.finalResult);

  if (!pending) {
    document.getElementById('final-run-num').innerText = sortedFinal.length > 0 ? "Fim da Prova!" : "--";
    document.getElementById('final-trio-names').innerText = sortedFinal.length > 0 ? "Grande Final concluída para esta categoria!" : "Aguardando geração da ordem.";
    document.getElementById('final-trio-acumulado').innerText = "--";
    return;
  }

  const [key, trio] = pending;

  document.getElementById('final-run-num').innerText = `#${trio.finalOrder}`;
  document.getElementById('final-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
  document.getElementById('final-trio-acumulado').innerText = `1ª: ${trio.result.time.toFixed(3)}s | 2ª: ${trio.semiResult.time.toFixed(3)}s`;

  document.getElementById('final-result-form').dataset.currentKey = key;
}

document.getElementById('final-result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = e.target.dataset.currentKey;
  if (!key) return;

  const isSAT = document.getElementById('finalIsSAT').checked;
  const timeSeconds = parseFloat(document.getElementById('finalTimeSeconds').value) || 999.999;
  const boisPenning = parseInt(document.getElementById('finalBoisPenning').value);

  const resultData = {
    isSAT: isSAT,
    bois: isSAT ? 0 : boisPenning,
    time: isSAT ? 999.999 : timeSeconds,
    timestamp: Date.now()
  };

  set(ref(db, `trios/${key}/finalResult`), resultData).then(() => {
    document.getElementById('final-result-form').reset();
    updateGrandeFinalUI();
    renderGrandFinalLeaderboard();
  });
});

function renderGrandFinalLeaderboard() {
  const container = document.getElementById('grand-final-leaderboard');
  if (!container) return;
  container.innerHTML = '';

  const selectedCat = document.getElementById('finalCategorySelect')?.value || 'Soma 3';
  const finalTrios = Object.values(state.trios).filter(t => t.finalOrder && t.finalResult && t.category === selectedCat);

  // ORDENAÇÃO EXCLUSIVAMENTE PELO MENOR TEMPO / MAIOR NÚMERO DE BOIS DA GRANDE FINAL (3ª PASSADA)
  finalTrios.sort((a, b) => {
    if (a.finalResult.bois !== b.finalResult.bois) return b.finalResult.bois - a.finalResult.bois;
    return a.finalResult.time - b.finalResult.time;
  });

  const card = document.createElement('div');
  card.className = 'card-form';

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Colocação</th>
          <th>Trio</th>
          <th>1ª Passada (Ref)</th>
          <th>2ª Passada (Ref)</th>
          <th>Bois (3ª Passada)</th>
          <th>Tempo (3ª Passada)</th>
        </tr>
      </thead>
      <tbody>`;

  finalTrios.forEach((trio, index) => {
    const pos = index + 1;

    html += `
      <tr class="${pos <= 3 ? 'qualified-row' : ''}">
        <td><strong>${pos}º Lugar</strong> ${pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : ''}</td>
        <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
        <td>${trio.result.bois}b / ${trio.result.isSAT ? 'SAT' : trio.result.time.toFixed(3) + 's'}</td>
        <td>${trio.semiResult.bois}b / ${trio.semiResult.isSAT ? 'SAT' : trio.semiResult.time.toFixed(3) + 's'}</td>
        <td><strong>${trio.finalResult.bois} boi(s)</strong></td>
        <td><strong>${trio.finalResult.isSAT ? 'SAT' : trio.finalResult.time.toFixed(3) + 's'}</strong></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  card.innerHTML = html;
  container.appendChild(card);
}