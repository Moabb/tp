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

// --- FUNÇÃO PARA ACTIVAR TELA NO PAINEL.HTML ---
window.activarPainel = function(mode, category = '') {
  // Se a categoria não for passada explicitamente, busca a categoria selecionada na aba ativa
  if (!category) {
    if (mode === 'semifinal') {
      const checked = Array.from(document.querySelectorAll('.semi-cat-cb:checked')).map(cb => cb.value);
      category = checked.join(', ');
    } else if (mode === 'grandefinal') {
      category = document.getElementById('finalCategorySelect')?.value || '';
    }
  }

  const panelData = {
    mode: mode,
    category: category || '',
    updatedAt: Date.now()
  };

  set(ref(db, 'activePanel'), panelData).then(() => {
    alert(`📺 Tela ativada no Painel/Telão com sucesso! (Modo: ${mode.toUpperCase()} - Cat: ${category || 'Geral'})`);
  });
};

// --- FUNÇÃO PARA IMPRIMIR OU SALVAR EM PDF A LISTA SORTEADA ---
window.gerarPDFListaSorteio = function(titulo = "Lista de Largada Sorteada") {
  window.print();
};

// --- SEMIFINAL: SORTEIO ALEATÓRIO (NÃO INVERTIDO) ---
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

  // ALGORITMO DE SORTEIO ALEATÓRIO (Fisher-Yates) EM VEZ DE ORDEM INVERTIDA
  const shuffled = [...qualified];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const updates = {};
  shuffled.forEach((trio, index) => {
    updates[`trios/${trio.key}/semiOrder`] = index + 1;
    updates[`trios/${trio.key}/semiGroup`] = selectedCategories.join(', ');
  });

  update(ref(db), updates).then(() => {
    alert(`Sorteio da Semifinal realizado com sucesso para ${shuffled.length} trios!`);
    updateSemifinalUI();
  });
};

// --- RENDERIZAR RESULTADO DA SEMIFINAL (FILTRADO POR CATEGORIA ATIVA) ---
function renderSemifinalLeaderboard() {
  const container = document.getElementById('semi-leaderboard-results');
  if (!container) return;
  container.innerHTML = '';

  const checkedBoxes = document.querySelectorAll('.semi-cat-cb:checked');
  const selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);

  // Filtrar resultados apenas das categorias selecionadas na semifinal
  let sorted = getSemiLeaderboard();
  if (selectedCategories.length > 0) {
    sorted = sorted.filter(trio => selectedCategories.includes(trio.category));
  }

  const totalFinalists = parseInt(document.getElementById('semiFinalistsCount')?.value || state.config.totalFinalists || 10);

  const card = document.createElement('div');
  card.className = 'card-form';

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin:0;">📊 Resultado da Semifinal ${selectedCategories.length > 0 ? `(${selectedCategories.join(', ')})` : ''}</h3>
      <button class="btn btn-primary" onclick="gerarPDFListaSorteio()">📄 Gerar PDF / Imprimir Lista</button>
    </div>
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

  if (sorted.length === 0) {
    html += `<tr><td colspan="7" style="text-align:center; padding: 15px;">Nenhum resultado registrado na Semifinal para a categoria selecionada.</td></tr>`;
  } else {
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
  }

  html += `</tbody></table>`;
  card.innerHTML = html;
  container.appendChild(card);
}

// --- GRANDE FINAL: SORTEIO ALEATÓRIO (NÃO INVERTIDO) ---
window.gerarOrdemGrandeFinal = function() {
  const selectedCat = document.getElementById('finalCategorySelect')?.value;
  if (!selectedCat) return alert('Selecione uma categoria para a Grande Final!');

  let semiRanking = getSemiLeaderboard().filter(t => t.category === selectedCat);
  const totalFinalists = parseInt(document.getElementById('semiFinalistsCount')?.value || 10);

  if (semiRanking.length === 0) return alert(`Nenhum trio concluiu a semifinal para a categoria: ${selectedCat}!`);

  const finalists = semiRanking.slice(0, totalFinalists);

  // ALGORITMO DE SORTEIO ALEATÓRIO (Fisher-Yates)
  const shuffled = [...finalists];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const updates = {};
  shuffled.forEach((trio, index) => {
    updates[`trios/${trio.key}/finalOrder`] = index + 1;
  });

  update(ref(db), updates).then(() => {
    alert(`Sorteio da Grande Final realizado com sucesso para ${shuffled.length} trios!`);
    updateGrandeFinalUI();
  });
};

// --- RENDERIZAR PÓDIO DA GRANDE FINAL (FILTRADO POR CATEGORIA SELECIONADA) ---
function renderGrandFinalLeaderboard() {
  const container = document.getElementById('grand-final-leaderboard');
  if (!container) return;
  container.innerHTML = '';

  const selectedCat = document.getElementById('finalCategorySelect')?.value;
  
  let finalTrios = Object.values(state.trios).filter(t => t.finalOrder && t.finalResult);
  if (selectedCat) {
    finalTrios = finalTrios.filter(t => t.category === selectedCat);
  }

  const awardedLimit = parseInt(document.getElementById('finalAwardedCount')?.value || 5);

  finalTrios.sort((a, b) => {
    if (a.finalResult.bois !== b.finalResult.bois) return b.finalResult.bois - a.finalResult.bois;
    return a.finalResult.time - b.finalResult.time;
  });

  const card = document.createElement('div');
  card.className = 'card-form';

  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <h3 style="margin:0;">🥇 PÓDIO DA GRANDE FINAL ${selectedCat ? `(${selectedCat})` : ''}</h3>
      <button class="btn btn-primary" onclick="gerarPDFListaSorteio()">📄 Gerar PDF / Imprimir Pódio</button>
    </div>
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

  if (finalTrios.length === 0) {
    html += `<tr><td colspan="8" style="text-align:center; padding: 15px;">Nenhum resultado registrado na Grande Final para a categoria selecionada.</td></tr>`;
  } else {
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
  }

  html += `</tbody></table>`;
  card.innerHTML = html;
  container.appendChild(card);
}