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
    eventName: "",
    batchSize: 25,
    numBatteries: 2,
    alertThreshold: 5,
    qualifiedPerBatch: 10,
    totalFinalists: 10,
    totalAwarded: 5,
    isSaved: false
  },
  trios: {}
};

// --- FUNÇÃO AUXILIAR: Obter lista de todas as categorias cadastradas ---
function getUniqueCategories() {
  const categoriesSet = new Set();
  Object.values(state.trios).forEach(trio => {
    if (trio.category && trio.category.trim() !== '') {
      categoriesSet.add(trio.category.trim());
    }
  });
  return Array.from(categoriesSet).sort();
}

// Atualiza todas as listas suspensas (dropdowns) e datalists do sistema
function populateCategoryDropdowns() {
  const categories = getUniqueCategories();

  // 1. Datalist para autocompletar Categoria Principal
  const datalist = document.getElementById('categories-datalist');
  if (datalist) {
    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
  }

  // 2. Select Categoria Embutida
  const catEmbutidaSelect = document.getElementById('catEmbutidaSelect');
  if (catEmbutidaSelect) {
    const currentVal = catEmbutidaSelect.value;
    catEmbutidaSelect.innerHTML = `<option value="">-- Nenhuma (Sem Embutida) --</option>` +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
    catEmbutidaSelect.value = currentVal;
  }

  // 3. Select Sorteio / Start List
  updateSelectOptions('drawCategorySelect', categories);
  // 4. Select Pista 1ª Passada
  updateSelectOptions('pistaCategorySelect', categories);
  // 5. Select Placar Classificação
  updateSelectOptions('filterCategory', categories, true);
  // 6. Checkboxes na Semifinal
  renderSemiCategoryCheckboxes(categories);
  // 7. Select Grande Final
  updateSelectOptions('finalCategorySelect', categories);
}

function updateSelectOptions(selectId, categories, includeAllOption = false) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const currentVal = select.value;
  let html = includeAllOption 
    ? `<option value="ALL">Todas as Categorias</option><option value="LOCAL_ONLY">Apenas Categoria Embutida (Local)</option>`
    : `<option value="">-- Selecione uma Categoria --</option>`;

  html += categories.map(c => `<option value="${c}">${c}</option>`).join('');
  select.innerHTML = html;

  if (currentVal && (categories.includes(currentVal) || currentVal === 'ALL' || currentVal === 'LOCAL_ONLY')) {
    select.value = currentVal;
  }
}

function renderSemiCategoryCheckboxes(categories) {
  const container = document.getElementById('semi-category-checkboxes');
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = `<em>Nenhuma categoria cadastrada ainda.</em>`;
    return;
  }

  container.innerHTML = categories.map(cat => `
    <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
      <input type="checkbox" class="semi-cat-cb" value="${cat}"> <strong>${cat}</strong>
    </label>
  `).join('');
}

// --- HELPER: Calcula o número do Lote considerando a quantidade de baterias ---
function calculateBatchNumber(startOrder) {
  if (!startOrder) return '-';
  const batchSize = state.config.batchSize || 25;
  const numBatteries = state.config.numBatteries || 1;

  const blockIndex = Math.floor((startOrder - 1) / batchSize);
  return (blockIndex % numBatteries) + 1;
}

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const targetBtn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
  if (targetBtn) targetBtn.classList.add('active');
  
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');

  populateCategoryDropdowns();

  if (tabId === 'inscricoes') renderStartList();
  if (tabId === 'pista') updatePistaUI();
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

window.onDrawCategoryChange = function() { renderStartList(); };
window.onSemiCategoryChange = function() { updateSemifinalUI(); renderSemifinalLeaderboard(); };
window.onFinalCategoryChange = function() { updateGrandeFinalUI(); renderGrandFinalLeaderboard(); };

// --- OBSERVADORES FIREBASE ---
onValue(ref(db, 'config'), (snapshot) => {
  if (snapshot.exists()) {
    state.config = { ...state.config, ...snapshot.val() };
    
    document.getElementById('eventName').value = state.config.eventName || '';
    document.getElementById('batchSize').value = state.config.batchSize || 25;
    document.getElementById('numBatteries').value = state.config.numBatteries || 2;
    document.getElementById('alertThreshold').value = state.config.alertThreshold || 5;
    document.getElementById('qualifiedPerBatch').value = state.config.qualifiedPerBatch || 10;
    
    if (state.config.totalFinalists) {
      document.getElementById('semiFinalistsCount').value = state.config.totalFinalists;
    }
    if (state.config.totalAwarded) {
      document.getElementById('finalAwardedCount').value = state.config.totalAwarded;
    }

    if (state.config.eventName) {
      document.getElementById('header-event-title').innerText = `🏁 ${state.config.eventName}`;
    }

    renderConfigSummary();
    updatePistaUI();
  }
});

onValue(ref(db, 'trios'), (snapshot) => {
  state.trios = snapshot.val() || {};
  populateCategoryDropdowns();
  renderStartList();
  updatePistaUI();
  updateSemifinalUI();
  renderSemifinalLeaderboard();
  updateGrandeFinalUI();
  renderGrandFinalLeaderboard();
});

// --- SALVAR E EDITAR CONFIGURAÇÕES ---
document.getElementById('config-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const configData = {
    eventName: document.getElementById('eventName').value,
    batchSize: parseInt(document.getElementById('batchSize').value),
    numBatteries: parseInt(document.getElementById('numBatteries').value),
    alertThreshold: parseInt(document.getElementById('alertThreshold').value),
    qualifiedPerBatch: parseInt(document.getElementById('qualifiedPerBatch').value),
    totalFinalists: parseInt(document.getElementById('semiFinalistsCount')?.value || 10),
    totalAwarded: parseInt(document.getElementById('finalAwardedCount')?.value || 5),
    isSaved: true
  };

  set(ref(db, 'config'), configData).then(() => {
    alert('Configurações do Evento salvas com sucesso!');
  });
});

function renderConfigSummary() {
  const form = document.getElementById('config-form');
  const summaryCard = document.getElementById('config-summary-card');

  if (state.config.isSaved) {
    document.getElementById('sum-eventName').innerText = state.config.eventName || 'Não informado';
    document.getElementById('sum-batchSize').innerText = state.config.batchSize;
    document.getElementById('sum-numBatteries').innerText = state.config.numBatteries;
    document.getElementById('sum-alertThreshold').innerText = state.config.alertThreshold;
    document.getElementById('sum-qualifiedPerBatch').innerText = state.config.qualifiedPerBatch;

    form.classList.add('hidden');
    summaryCard.classList.remove('hidden');
  } else {
    form.classList.remove('hidden');
    summaryCard.classList.add('hidden');
  }
}

window.enableConfigEdit = function() {
  document.getElementById('config-form').classList.remove('hidden');
  document.getElementById('config-summary-card').classList.add('hidden');
};

// --- INSCRIÇÃO DE TRIOS ---
document.getElementById('trio-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const totalTrios = Object.keys(state.trios).length;
  const newSenha = totalTrios + 1;

  const catPrincipal = document.getElementById('categoriaPrincipal').value.trim();
  const catEmbutida = document.getElementById('catEmbutidaSelect').value;

  const trioData = {
    senha: newSenha,
    startOrder: null,
    r1: document.getElementById('r1').value,
    r2: document.getElementById('r2').value,
    r3: document.getElementById('r3').value,
    category: catPrincipal,
    catEmbutida: catEmbutida,
    result: null,
    semiOrder: null,
    semiResult: null,
    finalOrder: null,
    finalResult: null
  };

  const newRef = push(ref(db, 'trios'));
  set(newRef, trioData).then(() => {
    document.getElementById('trio-form').reset();
    populateCategoryDropdowns();
  });
});

// --- SORTEIO E START LIST ---
window.gerarStartList = function() {
  const selectedCat = document.getElementById('drawCategorySelect').value;
  if (!selectedCat) return alert('Selecione uma categoria para realizar o sorteio!');

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

  update(ref(db), updates).then(() => {
    alert(`Sorteio da Categoria "${selectedCat}" realizado com sucesso!`);
    renderStartList();
  });
};

function renderStartList() {
  const tbody = document.querySelector('#table-startlist tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const selectedCat = document.getElementById('drawCategorySelect')?.value;

  if (!selectedCat) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 15px;">Selecione uma categoria acima para visualizar a lista de largada.</td></tr>`;
    return;
  }

  const list = Object.values(state.trios)
    .filter(trio => trio.category === selectedCat)
    .sort((a, b) => {
      if (a.startOrder && b.startOrder) return a.startOrder - b.startOrder;
      return a.senha - b.senha;
    });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 15px;">Nenhum trio cadastrado na categoria <strong>${selectedCat}</strong>.</td></tr>`;
    return;
  }

  list.forEach(trio => {
    const batchNum = calculateBatchNumber(trio.startOrder);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${trio.startOrder ? `<strong>#${trio.startOrder}</strong>` : 'Aguardando Sorteio'}</td>
      <td>Senha #${trio.senha}</td>
      <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
      <td>${trio.category}</td>
      <td>${trio.catEmbutida ? `<span class="badge-qualified">${trio.catEmbutida}</span>` : 'Não'}</td>
      <td><span class="tag-lote">Lote ${batchNum}</span></td>
    `;
    tbody.appendChild(row);
  });
}

// --- PISTA 1ª PASSADA ---
window.updatePistaUI = function() {
  const selectedCat = document.getElementById('pistaCategorySelect')?.value;

  if (!selectedCat) {
    document.getElementById('current-run-num').innerText = "--";
    document.getElementById('current-trio-names').innerText = "Selecione uma categoria acima.";
    document.getElementById('current-lote-tag').innerText = "--";
    document.getElementById('current-trio-cat').innerText = "--";
    document.getElementById('batch-alert').classList.add('hidden');
    renderPistaSequence([]);
    return;
  }

  const sortedTrios = Object.entries(state.trios)
    .filter(([_, t]) => t.category === selectedCat && t.startOrder !== null)
    .sort((a, b) => a[1].startOrder - b[1].startOrder);

  const pending = sortedTrios.find(([_, t]) => !t.result);

  if (!pending) {
    document.getElementById('current-run-num').innerText = sortedTrios.length > 0 ? "Fim da Passada" : "--";
    document.getElementById('current-trio-names').innerText = sortedTrios.length > 0 ? `Todas as corridas de ${selectedCat} foram concluídas.` : `Nenhum trio sorteado nesta categoria.`;
    document.getElementById('current-lote-tag').innerText = "--";
    document.getElementById('current-trio-cat').innerText = selectedCat;
    document.getElementById('batch-alert').classList.add('hidden');
    document.getElementById('run-result-form').dataset.currentKey = "";
  } else {
    const [key, trio] = pending;
    const runNum = trio.startOrder;
    const batchSize = state.config.batchSize;

    const currentBatchNum = calculateBatchNumber(runNum);
    const runsLeftInBatch = batchSize - ((runNum - 1) % batchSize);

    document.getElementById('current-run-num').innerText = `#${runNum}`;
    document.getElementById('current-lote-tag').innerText = `Lote ${currentBatchNum}`;
    document.getElementById('current-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
    document.getElementById('current-trio-cat').innerText = `${trio.category} ${trio.catEmbutida ? '(Embutida: ' + trio.catEmbutida + ')' : ''}`;

    const alertBanner = document.getElementById('batch-alert');
    if (runsLeftInBatch <= state.config.alertThreshold) {
      document.getElementById('runs-left-count').innerText = runsLeftInBatch;
      alertBanner.classList.remove('hidden');
    } else {
      alertBanner.classList.add('hidden');
    }

    document.getElementById('run-result-form').dataset.currentKey = key;
  }

  renderPistaSequence(sortedTrios);
};

function renderPistaSequence(sortedTrios) {
  const container = document.getElementById('pista-sequence-container');
  if (!container) return;

  const pendingTrios = sortedTrios.filter(([_, trio]) => !trio.result);

  let html = `
    <div class="card-form" style="margin-top: 25px;">
      <h3>📋 Ordem de Entrada em Pista (Próximos a Correr)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ordem</th>
            <th>Senha</th>
            <th>Integrantes do Trio</th>
            <th>Lote</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>`;

  if (pendingTrios.length === 0) {
    html += `<tr><td colspan="5" style="text-align:center; padding: 15px;">Nenhum trio pendente para corrida nesta categoria.</td></tr>`;
  } else {
    pendingTrios.forEach(([key, trio], index) => {
      const isCurrentInPista = index === 0;
      const batchNum = calculateBatchNumber(trio.startOrder);

      html += `
        <tr style="${isCurrentInPista ? 'background-color: #e6f4ff; font-weight: bold; border-left: 5px solid #007bff;' : ''}">
          <td><strong>#${trio.startOrder}</strong></td>
          <td>Senha #${trio.senha}</td>
          <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
          <td>Lote ${batchNum}</td>
          <td>${isCurrentInPista ? '🤠 <strong>EM PISTA</strong>' : '⏳ Aguardando'}</td>
        </tr>`;
    });
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

document.getElementById('run-result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = e.target.dataset.currentKey;
  if (!key) return alert('Selecione uma categoria com corridas pendentes!');

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

// --- CLASSIFICAÇÃO DA 1ª PASSADA ---
window.renderLeaderboard = function() {
  const container = document.getElementById('leaderboard-results');
  if (!container) return;
  container.innerHTML = '';

  const filterCat = document.getElementById('filterCategory').value;
  const filterMode = document.getElementById('filterMode').value;

  let allTrios = Object.values(state.trios).filter(t => t.result !== undefined && t.result !== null);

  if (filterCat === 'LOCAL_ONLY') {
    allTrios = allTrios.filter(t => t.catEmbutida && t.catEmbutida !== '');
  } else if (filterCat !== 'ALL') {
    allTrios = allTrios.filter(t => t.category === filterCat || t.catEmbutida === filterCat);
  }

  const sortFn = (a, b) => {
    if (a.result.bois !== b.result.bois) return b.result.bois - a.result.bois;
    return a.result.time - b.result.time;
  };

  if (filterMode === 'BY_BATCH') {
    const batches = {};
    allTrios.forEach(t => {
      const bNum = calculateBatchNumber(t.startOrder);
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
          <th>Categoria</th>
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
        <td>${trio.category}</td>
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

// --- SEMIFINAL (2ª PASSADA E AGRUPAMENTO) ---
function getQualifiedTriosFromCategories(selectedCategories) {
  const batches = {};

  Object.entries(state.trios).forEach(([key, t]) => {
    if (t.result && selectedCategories.includes(t.category)) {
      const bNum = calculateBatchNumber(t.startOrder);
      const batchKey = `${t.category}_Lote_${bNum}`;
      if (!batches[batchKey]) batches[batchKey] = [];
      batches[batchKey].push({ key, ...t });
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

window.gerarOrdemSemifinalAgrupada = function() {
  const checkedBoxes = document.querySelectorAll('.semi-cat-cb:checked');
  const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);

  if (selectedCategories.length === 0) {
    return alert('Selecione pelo menos uma categoria para gerar a Semifinal!');
  }

  const qualified = getQualifiedTriosFromCategories(selectedCategories);

  if (qualified.length === 0) {
    return alert(`Nenhum trio classificado encontrado para as categorias selecionadas!`);
  }

  const inverted = [...qualified].reverse();

  const updates = {};
  inverted.forEach((trio, index) => {
    updates[`trios/${trio.key}/semiOrder`] = index + 1;
    updates[`trios/${trio.key}/semiGroup`] = selectedCategories.join(', ');
  });

  update(ref(db), updates).then(() => {
    alert(`Ordem da Semifinal gerada com sucesso para ${inverted.length} trios!`);
    updateSemifinalUI();
  });
};

function updateSemifinalUI() {
  const sortedSemi = Object.entries(state.trios)
    .filter(([_, t]) => t.semiOrder !== undefined && t.semiOrder !== null)
    .sort((a, b) => a[1].semiOrder - b[1].semiOrder);

  const pending = sortedSemi.find(([_, t]) => !t.semiResult);

  if (!pending) {
    document.getElementById('semi-run-num').innerText = sortedSemi.length > 0 ? "Fim da Semifinal" : "--";
    document.getElementById('semi-trio-names').innerText = sortedSemi.length > 0 ? "Passadas da semifinal concluídas!" : "Aguardando geração da ordem.";
    document.getElementById('semi-trio-pass1').innerText = "--";
    document.getElementById('semi-result-form').dataset.currentKey = "";
  } else {
    const [key, trio] = pending;
    document.getElementById('semi-run-num').innerText = `#${trio.semiOrder}`;
    document.getElementById('semi-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
    document.getElementById('semi-trio-pass1').innerText = `${trio.result.bois} boi(s) - ${trio.result.time.toFixed(3)}s (${trio.category})`;
    document.getElementById('semi-result-form').dataset.currentKey = key;
  }

  renderSemiSequence(sortedSemi);
}

function renderSemiSequence(sortedSemi) {
  const container = document.getElementById('semi-sequence-container');
  if (!container) return;

  const pendingSemi = sortedSemi.filter(([_, trio]) => !trio.semiResult);

  let html = `
    <div class="card-form" style="margin-top: 25px;">
      <h3>📋 Sequência da Semifinal (Próximos a Correr)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ordem Semi</th>
            <th>Trio</th>
            <th>Categoria Origem</th>
            <th>Ref. 1ª Passada</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>`;

  if (pendingSemi.length === 0) {
    html += `<tr><td colspan="5" style="text-align:center; padding: 15px;">Nenhum trio pendente na semifinal.</td></tr>`;
  } else {
    pendingSemi.forEach(([key, trio], index) => {
      const isCurrentInPista = index === 0;

      html += `
        <tr style="${isCurrentInPista ? 'background-color: #e6f4ff; font-weight: bold; border-left: 5px solid #007bff;' : ''}">
          <td><strong>#${trio.semiOrder}</strong></td>
          <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
          <td>${trio.category}</td>
          <td>${trio.result.bois}b / ${trio.result.isSAT ? 'SAT' : trio.result.time.toFixed(3) + 's'}</td>
          <td>${isCurrentInPista ? '🤠 <strong>EM PISTA</strong>' : '⏳ Aguardando'}</td>
        </tr>`;
    });
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

document.getElementById('semi-result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = e.target.dataset.currentKey;
  if (!key) return alert('Nenhum trio em pista na semifinal!');

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

function getSemiLeaderboard() {
  const list = [];
  Object.entries(state.trios).forEach(([key, t]) => {
    if (t.semiOrder && t.semiResult) {
      list.push({ key, ...t });
    }
  });

  return list.sort((a, b) => {
    if (a.semiResult.bois !== b.semiResult.bois) return b.semiResult.bois - a.semiResult.bois;
    return a.semiResult.time - b.semiResult.time;
  });
}

function renderSemifinalLeaderboard() {
  const container = document.getElementById('semi-leaderboard-results');
  if (!container) return;
  container.innerHTML = '';

  const sorted = getSemiLeaderboard();
  const totalFinalists = parseInt(document.getElementById('semiFinalistsCount')?.value || state.config.totalFinalists || 10);

  const card = document.createElement('div');
  card.className = 'card-form';

  let html = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Colocação</th>
          <th>Trio</th>
          <th>Categoria</th>
          <th>1ª Passada (Ref)</th>
          <th>Bois (2ª Passada)</th>
          <th>Tempo (2ª Passada)</th>
          <th>Status Final</th>
        </tr>
      </thead>
      <tbody>`;

  sorted.forEach((trio, index) => {
    const pos = index + 1;
    const isQualified = pos <= totalFinalists && !trio.semiResult.isSAT;

    html += `
      <tr class="${isQualified ? 'qualified-row' : ''}">
        <td><strong>${pos}º Lugar</strong></td>
        <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
        <td>${trio.category}</td>
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

// --- GRANDE FINAL (3ª PASSADA) ---
window.gerarOrdemGrandeFinal = function() {
  const semiRanking = getSemiLeaderboard();
  const totalFinalists = parseInt(document.getElementById('semiFinalistsCount')?.value || 10);

  if (semiRanking.length === 0) return alert(`Nenhum trio concluiu a semifinal!`);

  const finalists = semiRanking.slice(0, totalFinalists);
  const inverted = [...finalists].reverse();

  const updates = {};
  inverted.forEach((trio, index) => {
    updates[`trios/${trio.key}/finalOrder`] = index + 1;
  });

  update(ref(db), updates).then(() => {
    alert(`Ordem da Grande Final gerada com os Top ${finalists.length} trios!`);
    updateGrandeFinalUI();
  });
};

function updateGrandeFinalUI() {
  const sortedFinal = Object.entries(state.trios)
    .filter(([_, t]) => t.finalOrder !== undefined && t.finalOrder !== null)
    .sort((a, b) => a[1].finalOrder - b[1].finalOrder);

  const pending = sortedFinal.find(([_, t]) => !t.finalResult);

  if (!pending) {
    document.getElementById('final-run-num').innerText = sortedFinal.length > 0 ? "Fim da Prova!" : "--";
    document.getElementById('final-trio-names').innerText = sortedFinal.length > 0 ? "Grande Final concluída!" : "Aguardando geração da ordem.";
    document.getElementById('final-trio-acumulado').innerText = "--";
    document.getElementById('final-result-form').dataset.currentKey = "";
  } else {
    const [key, trio] = pending;
    document.getElementById('final-run-num').innerText = `#${trio.finalOrder}`;
    document.getElementById('final-trio-names').innerText = `${trio.r1} | ${trio.r2} | ${trio.r3}`;
    document.getElementById('final-trio-acumulado').innerText = `1ª: ${trio.result.time.toFixed(3)}s | 2ª: ${trio.semiResult.time.toFixed(3)}s`;
    document.getElementById('final-result-form').dataset.currentKey = key;
  }

  renderFinalSequence(sortedFinal);
}

function renderFinalSequence(sortedFinal) {
  const container = document.getElementById('final-sequence-container');
  if (!container) return;

  const pendingFinal = sortedFinal.filter(([_, trio]) => !trio.finalResult);

  let html = `
    <div class="card-form" style="margin-top: 25px;">
      <h3>📋 Sequência da Grande Final (Próximos a Correr)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ordem Final</th>
            <th>Trio</th>
            <th>1ª Passada</th>
            <th>2ª Passada</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>`;

  if (pendingFinal.length === 0) {
    html += `<tr><td colspan="5" style="text-align:center; padding: 15px;">Nenhum trio pendente na grande final.</td></tr>`;
  } else {
    pendingFinal.forEach(([key, trio], index) => {
      const isCurrentInPista = index === 0;

      html += `
        <tr style="${isCurrentInPista ? 'background-color: #e6f4ff; font-weight: bold; border-left: 5px solid #007bff;' : ''}">
          <td><strong>#${trio.finalOrder}</strong></td>
          <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
          <td>${trio.result ? trio.result.time.toFixed(3) + 's' : '-'}</td>
          <td>${trio.semiResult ? trio.semiResult.time.toFixed(3) + 's' : '-'}</td>
          <td>${isCurrentInPista ? '🤠 <strong>EM PISTA</strong>' : '⏳ Aguardando'}</td>
        </tr>`;
    });
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

document.getElementById('final-result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = e.target.dataset.currentKey;
  if (!key) return alert('Nenhum trio em pista na final!');

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

  const finalTrios = Object.values(state.trios).filter(t => t.finalOrder && t.finalResult);
  const awardedLimit = parseInt(document.getElementById('finalAwardedCount')?.value || 5);

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
          <th>Categoria</th>
          <th>1ª Passada (Ref)</th>
          <th>2ª Passada (Ref)</th>
          <th>Bois (3ª Passada)</th>
          <th>Tempo (3ª Passada)</th>
          <th>Premiação</th>
        </tr>
      </thead>
      <tbody>`;

  finalTrios.forEach((trio, index) => {
    const pos = index + 1;
    const isAwarded = pos <= awardedLimit && !trio.finalResult.isSAT;

    html += `
      <tr class="${isAwarded ? 'qualified-row' : ''}">
        <td><strong>${pos}º Lugar</strong> ${pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : ''}</td>
        <td>${trio.r1}, ${trio.r2}, ${trio.r3}</td>
        <td>${trio.category}</td>
        <td>${trio.result.bois}b / ${trio.result.isSAT ? 'SAT' : trio.result.time.toFixed(3) + 's'}</td>
        <td>${trio.semiResult.bois}b / ${trio.semiResult.isSAT ? 'SAT' : trio.semiResult.time.toFixed(3) + 's'}</td>
        <td><strong>${trio.finalResult.bois} boi(s)</strong></td>
        <td><strong>${trio.finalResult.isSAT ? 'SAT' : trio.finalResult.time.toFixed(3) + 's'}</strong></td>
        <td>${isAwarded ? '🎁 <strong style="color: #28a745;">PREMIADO</strong>' : '-'}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  card.innerHTML = html;
  container.appendChild(card);
}