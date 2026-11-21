// CONFIGURAÇÃO DA API E AUTENTICAÇÃO (JWT)
const API_URL = "http://localhost:3000";

// Recupera o token JWT salvo no navegador
const obterToken = () => localStorage.getItem("token_rotaexpress");

// Monta o cabeçalho HTTP exigido pelas rotas protegidas do Back-end
const obterHeadersAuth = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${obterToken()}`
});

// SELEÇÃO DOS ELEMENTOS DA INTERFACE (DOM)

// Telas e autenticação 
const telaLogin = document.querySelector("#tela-login");
const telaDashboard = document.querySelector("#tela-dashboard");
const formLogin = document.querySelector("#form-login");
const inputLoginEmail = document.querySelector("#login-email");
const inputLoginSenha = document.querySelector("#login-senha");
const loginMsg = document.querySelector("#login-msg");
const btnLogout = document.querySelector("#btn-logout");
const infoUsuario = document.querySelector("#info-usuario");
const spanUsuarioEmail = document.querySelector("#usuario-email");

// Dados da encomenda
const formEndereco = document.querySelector("#form-endereco");
const inputDestinatario = document.querySelector("#destinatario");
const inputPeso = document.querySelector("#peso");
const selectModalidade = document.querySelector("#modalidade");

// Endereço
const inputCep = document.querySelector("#cep");
const inputLogradouro = document.querySelector("#logradouro");
const inputBairro = document.querySelector("#bairro");
const inputCidade = document.querySelector("#cidade");
const inputNumero = document.querySelector("#numero");

// Botões e feedback
const btnBuscar = document.querySelector("#btn-buscar");
const btnLimpar = document.querySelector("#btn-limpar");
const btnCadastrar = document.querySelector("#btn-cadastrar");
const statusMsg = document.querySelector("#status-msg");

// Métricas e listagem dinâmica
const elMetricaTotal = document.querySelector("#metrica-total");
const elMetricaFaturamento = document.querySelector("#metrica-faturamento");
const containerCards = document.querySelector("#lista-encomendas");

// FUNÇÕES AUXILIARES DA INTERFACE

// Alterna a visibilidade entre a tela de Login e o Dashboard principal
const alternarTelas = (autenticado) => {
  if (telaLogin && telaDashboard) {
    telaLogin.style.display = autenticado ? "none" : "block";
    telaDashboard.style.display = autenticado ? "block" : "none";
  }

  if (infoUsuario) {
    infoUsuario.style.display = autenticado ? "flex" : "none";
    if (autenticado && spanUsuarioEmail) {
      spanUsuarioEmail.textContent = `Logado como: ${localStorage.getItem("email_rotaexpress") || ""}`;
    }
  }
};

// Agrupa os valores preenchidos do endereço em um objeto
function obterEndereco() {
  return {
    cep: inputCep.value.trim(),
    logradouro: inputLogradouro.value.trim(),
    bairro: inputBairro.value.trim(),
    cidade: inputCidade.value.trim(),
    numero: inputNumero.value.trim()
  };
}

// Atualiza mensagem e classes de feedback visual no formulário
const exibirStatus = (texto, tipo) => {
  statusMsg.textContent = texto;
  statusMsg.className = `status ${tipo}`;
};

const limparStatus = () => {
  statusMsg.textContent = "";
  statusMsg.className = "status";
};

// Alterna o estado de carregamento durante a consulta de CEP
const alternarCarregamento = (ativo) => {
  btnBuscar.disabled = ativo;
  inputCep.disabled = ativo;
  if (ativo) {
    exibirStatus("Consultando base de dados...", "loading");
  }
};

// Limpa os campos de endereço
const limparCamposEndereco = () => {
  inputLogradouro.value = "";
  inputBairro.value = "";
  inputCidade.value = "";
  inputNumero.value = "";
};

// INTEGRAÇÃO COM API EXTERNA (ViaCEP)
const buscarEnderecoPorCep = async (cep) => {
  const cepLimpo = cep.replace(/\D/g, "");

  if (cepLimpo.length !== 8) {
    exibirStatus("O CEP deve conter exatamente 8 dígitos numéricos.", "error");
    return;
  }

  try {
    alternarCarregamento(true);
    limparCamposEndereco();

    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);

    if (!resposta.ok) {
      throw new Error(`Erro na conexão com o serviço: status ${resposta.status}`);
    }

    const dados = await resposta.json();

    if (dados.erro) {
      throw new Error("CEP não encontrado na base de dados nacional.");
    }

    inputLogradouro.value = dados.logradouro || "Não informado";
    inputBairro.value = dados.bairro || "Não informado";
    inputCidade.value = `${dados.localidade} - ${dados.uf}`;

    limparStatus();
  } catch (erro) {
    exibirStatus(erro.message, "error");
    limparCamposEndereco();
  } finally {
    alternarCarregamento(false);
  }
};

// COMUNICAÇÃO COM O BACK-END (API RESTful)

// Envia credenciais para /login e dá feedback visual
async function realizarLogin(evento) {
  evento.preventDefault();
  const email = inputLoginEmail.value.trim();
  const senha = inputLoginSenha.value.trim();

  if (loginMsg) {
    loginMsg.textContent = "Autenticando...";
    loginMsg.className = "status loading";
  }

  try {
    const resposta = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "E-mail ou senha inválidos.");
    }

    // Salva o token e o e-mail para exibir no cabeçalho
    localStorage.setItem("token_rotaexpress", dados.token);
    localStorage.setItem("email_rotaexpress", email);

    // Feedback positivo rápido antes de trocar para o dashboard
    if (loginMsg) {
      loginMsg.textContent = "Login efetuado! Carregando painel...";
      loginMsg.className = "status success";
    }

    setTimeout(async () => {
      if (loginMsg) loginMsg.textContent = "";
      alternarTelas(true);
      await carregarEncomendas();
      exibirStatus(`Bem-vindo(a), ${email}!`, "success");
    }, 600);

  } catch (erro) {
    if (loginMsg) {
      loginMsg.textContent = erro.message;
      loginMsg.className = "status error";
    }
  }
}

// Busca todas as encomendas salvas no banco de dados (GET)
async function carregarEncomendas() {
  try {
    const resposta = await fetch(`${API_URL}/encomendas`, {
      method: "GET",
      headers: obterHeadersAuth()
    });

    // Se o token expirou ou foi rejeitado pelo servidor, força novo login
    if (resposta.status === 401 || resposta.status === 403) {
      localStorage.removeItem("token_rotaexpress");
      alternarTelas(false);
      return;
    }

    const encomendas = await resposta.json();
    renderizarCards(encomendas);
  } catch (erro) {
    exibirStatus("Falha ao conectar com o servidor Node.js.", "error");
  }
}

// 6. RENDERIZAÇÃO DINÂMICA NO DOM
function renderizarCards(encomendas) {
  containerCards.innerHTML = "";
  let faturamentoTotal = 0;

  encomendas.forEach((encomenda) => {
    // Soma o frete já calculado e salvo pelo back-end
    faturamentoTotal += Number(encomenda.frete);

    const card = document.createElement("article");

    // Normaliza o status para gerar a classe CSS correspondente
    const statusFormatado = encomenda.status
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");

    card.className = `card modalidade-${encomenda.modalidade.toLowerCase()} status-${statusFormatado}`;

    const estaEntregue = encomenda.status === "Entregue";

    card.innerHTML = `
      <div class="card-cabecalho">
        <h3>Destinatário: ${encomenda.destinatario}</h3>
        <span class="badge-status">${encomenda.status}</span>
      </div>
      <div class="card-corpo">
        <p><strong>Peso:</strong> ${encomenda.peso} kg</p>
        <p><strong>Modalidade:</strong> ${encomenda.modalidade}</p>
        <p><strong>Frete Calculado:</strong> R$ ${Number(encomenda.frete).toFixed(2)}</p>
        <p><strong>Endereço:</strong> ${encomenda.logradouro}, nº ${encomenda.numero} - ${encomenda.bairro}, ${encomenda.cidade}</p>
        <p><strong>CEP:</strong> ${encomenda.cep}</p>
      </div>
      <div class="card-acoes">
        <button 
          type="button"
          class="btn-avancar" 
          data-id="${encomenda.id}" 
          ${estaEntregue ? "disabled" : ""}>
          ${estaEntregue ? "Finalizado" : "Avançar Status"}
        </button>
        <button type="button" class="btn-excluir" data-id="${encomenda.id}">Excluir</button>
      </div>
    `;
    containerCards.appendChild(card);
  });

  // Atualiza os indicadores do painel de métricas
  elMetricaTotal.textContent = encomendas.length;
  elMetricaFaturamento.textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
}

// EVENT LISTENERS

// Evento de Login e Logout
if (formLogin) {
  formLogin.addEventListener("submit", realizarLogin);
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("token_rotaexpress");
    alternarTelas(false);
  });
}

// Busca de CEP e limpeza
btnBuscar.addEventListener("click", () => {
  buscarEnderecoPorCep(inputCep.value);
});

btnLimpar.addEventListener("click", () => {
  limparCamposEndereco();
  inputCep.value = "";
  limparStatus();
});

inputCep.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    buscarEnderecoPorCep(inputCep.value);
  }
});

// Cadastro de nova encomenda no Back-end (POST)
btnCadastrar.addEventListener("click", async (evento) => {
  evento.preventDefault();

  const destinatario = inputDestinatario.value.trim();
  const peso = Number(inputPeso.value);
  const modalidade = selectModalidade.value;
  const numero = inputNumero.value.trim();
  const cep = inputCep.value.trim();
  const logradouro = inputLogradouro.value.trim();

  // Validações preliminares
  if (!destinatario) {
    exibirStatus("Por favor, preencha o nome do destinatário.", "error");
    inputDestinatario.focus();
    return;
  }

  if (isNaN(peso) || peso <= 0) {
    exibirStatus("Informe um peso numérico válido maior que zero.", "error");
    inputPeso.focus();
    return;
  }

  if (!cep || !logradouro) {
    exibirStatus("Consulte um CEP válido antes de cadastrar.", "error");
    inputCep.focus();
    return;
  }

  if (!numero) {
    exibirStatus("Digite o número do endereço.", "error");
    inputNumero.focus();
    return;
  }

  // Envia os dados para a API Node.js salvar no banco
  try {
    btnCadastrar.disabled = true;
    const enderecoAtualizado = obterEndereco();

    const resposta = await fetch(`${API_URL}/encomendas`, {
      method: "POST",
      headers: obterHeadersAuth(),
      body: JSON.stringify({
        destinatario,
        peso,
        modalidade,
        ...enderecoAtualizado
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Erro ao cadastrar encomenda.");
    }

    // Recarrega a lista diretamente do banco e limpa o formulário
    await carregarEncomendas();
    exibirStatus("Encomenda cadastrada com sucesso!", "success");
    formEndereco.reset();
    limparCamposEndereco();
  } catch (erro) {
    exibirStatus(erro.message, "error");
  } finally {
    btnCadastrar.disabled = false;
  }
});

// Delegação de eventos para Avançar Status (PATCH) e Excluir (DELETE)
containerCards.addEventListener("click", async (evento) => {
  const alvo = evento.target;
  const idEncomenda = alvo.dataset.id;

  if (!idEncomenda) return;

  try {
    if (alvo.classList.contains("btn-avancar")) {
      const resposta = await fetch(`${API_URL}/encomendas/${idEncomenda}`, {
        method: "PATCH",
        headers: obterHeadersAuth()
      });

      if (resposta.ok) {
        await carregarEncomendas();
      }
    }

    if (alvo.classList.contains("btn-excluir")) {
      const resposta = await fetch(`${API_URL}/encomendas/${idEncomenda}`, {
        method: "DELETE",
        headers: obterHeadersAuth()
      });

      if (resposta.ok) {
        await carregarEncomendas();
      }
    }
  } catch (erro) {
    exibirStatus("Erro de comunicação ao atualizar registro.", "error");
  }
});

// INICIALIZAÇÃO DA APLICAÇÃO
document.addEventListener("DOMContentLoaded", () => {
  if (obterToken()) {
    alternarTelas(true);
    carregarEncomendas();
  } else {
    alternarTelas(false);
  }
});