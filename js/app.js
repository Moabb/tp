// js/app.js - Gerenciador Central do Team Penning
// js/app.js - Conexão Firebase & Gerenciador do Team Penning

// 1. COLE SUAS CHAVES DO FIREBASE AQUI:
const firebaseConfig = {
  apiKey: "AIzaSyDVZSlNvtLOER3YdotvGi-G7VvDtSQwV7M",
  authDomain: "sistema-team-penning.firebaseapp.com",
  projectId: "sistema-team-penning",
  storageBucket: "sistema-team-penning.firebasestorage.app",
  messagingSenderId: "1025888364244",
  appId: "1:1025888364244:web:d4c5d0582899a855ddbd41"
};

// 2. Inicialização dos serviços do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DB_KEY = 'tp_database';

// Estrutura Inicial do Banco de Dados
function getDB() {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
        const initialDB = {
            competicao: {
                nome: "10º TEAM PENNING",
                data: "2026-07-30",
                categorias: [
                    { id: "cat_1", nome: "SOMA 3", baterias: 2, corridasLote: 25, classificados: 10 }
                ]
            },
            trios: [
                { id: "t_1", senha: 1, c1: "DANILO", c2: "MOABB", c3: "SILVA", obs: "Haras SV" },
                { id: "t_2", senha: 2, c1: "DANILO", c2: "MOABB", c3: "JOSE", obs: "Trio Ouro" }
            ],
            corridas: [], // Fila de corridas gerada pelo sorteio
            painelAtivo: { categoriaId: "cat_1", fase: "CLASSIFICACAO", emAndamentoIndex: 0 }
        };
        localStorage.setItem(DB_KEY, JSON.stringify(initialDB));
        return initialDB;
    }
    return JSON.parse(data);
}

function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Notifica outras janelas/abas (como o Painel TV)
    window.dispatchEvent(new Event('storage'));
}

// Sorteio de Ordem de Pista (Start List)
function gerarSorteioPista() {
    const db = getDB();
    if (db.trios.length === 0) return alert("Nenhum trio cadastrado para sortear!");

    // Embaralha os trios
    const triosEmbaralhados = [...db.trios].sort(() => Math.random() - 0.5);
    
    db.corridas = triosEmbaralhados.map((trio, index) => ({
        ordem: index + 1,
        trioId: trio.id,
        bateria: 1, // Padrão Bateria 1
        tempo: null,
        boi: "",
        curral: "3 Bois",
        status: "PENDENTE" // PENDENTE, CONCLUIDO, SAT, DO
    }));

    db.painelAtivo.emAndamentoIndex = 0;
    saveDB(db);
    alert("Sorteio de pista realizado com sucesso!");
}

// Lançamento de Tempo / Status pelo Juiz
function registrarResultado(corridaIndex, tempo, boi, curral, status) {
    const db = getDB();
    if (!db.corridas[corridaIndex]) return;

    db.corridas[corridaIndex].tempo = status === 'CONCLUIDO' ? parseFloat(tempo) : null;
    db.corridas[corridaIndex].boi = boi;
    db.corridas[corridaIndex].curral = curral;
    db.corridas[corridaIndex].status = status;

    // Avança para o próximo da fila se houver
    if (corridaIndex + 1 < db.corridas.length) {
        db.painelAtivo.emAndamentoIndex = corridaIndex + 1;
    }

    saveDB(db);
}