// teampenning-service.js - VERSÃO 1.6 (Espelhamento 100% Dinâmico)
import { 
  db, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from "./firebase-config.js";

/**
 * Cadastrar um novo Trio na Categoria Principal e replicar na Categoria Embutida (se existir vínculo)
 */
export async function cadastrarTrioComEspelho(userId, compId, dadosTrio, vinculoEmbutido = null) {
  const triosRef = collection(db, "trios");
  
  // 1. Cadastra o Trio Principal
  const docRefPai = await addDoc(triosRef, {
    ...dadosTrio,
    status: "INSCRITO",
    tempo: null,
    boisCurralados: 0,
    boiSorteado: null,
    criadoEm: new Date()
  });

  // 2. Se houver Categoria Embutida vinculada (de qualquer nome), gera o registro espelho
  if (vinculoEmbutido && vinculoEmbutido.catPai === dadosTrio.categoria && vinculoEmbutido.catEspelho) {
    const docRefFilho = await addDoc(triosRef, {
      ...dadosTrio,
      categoria: vinculoEmbutido.catEspelho, // Define o nome genérico da categoria espelho
      categoriaEspelho: true,
      trioPaiId: docRefPai.id,
      status: "INSCRITO",
      tempo: null,
      boisCurralados: 0,
      boiSorteado: null,
      criadoEm: new Date()
    });

    // Atualiza a referência bidirecional
    await updateDoc(doc(db, "trios", docRefPai.id), { trioEspelhoId: docRefFilho.id });
  }

  return docRefPai;
}