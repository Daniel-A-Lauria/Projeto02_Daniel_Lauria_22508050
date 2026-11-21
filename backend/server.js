// SERVIDOR API RESTful - RotaExpress 2.0
// Responsável pelas rotas HTTP, autenticação JWT, cálculo de frete e CRUD

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const conectarBanco = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "rotaexpress_chave_super_secreta_2026";

// Middlewares globais
app.use(cors()); // Libera requisições vindas do Front-end (evita erro de CORS)
app.use(express.json()); // Habilita o recebimento de dados em formato JSON

let db;

// Inicializa a conexão com o SQLite antes de subir o servidor
conectarBanco()
  .then((database) => {
    db = database;
    app.listen(PORT, () => {
      console.log(`Servidor RotaExpress rodando em http://localhost:${PORT}`);
    });
  })
  .catch((erro) => {
    console.error("Erro fatal ao conectar no banco de dados:", erro);
  });


// MIDDLEWARE DE SEGURANÇA (VALIDAÇÃO DO TOKEN JWT)
function autenticarToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  // O cabeçalho vem no formato: "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
  }

  jwt.verify(token, JWT_SECRET, (erro, usuario) => {
    if (erro) {
      return res.status(403).json({ erro: "Token inválido ou expirado." });
    }
    req.usuario = usuario;
    next(); // Autoriza a execução da rota
  });
}

// ROTA PÚBLICA: AUTENTICAÇÃO (POST /login)
app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: "Preencha e-mail e senha." });
    }

    // Busca o usuário cadastrado no SQLite
    const usuario = await db.get("SELECT * FROM usuarios WHERE email = ?", [email]);

    if (!usuario) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    // Compara a senha digitada com o hash criptografado salvo no banco
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: "E-mail ou senha inválidos." });
    }

    // Gera o Token JWT com validade de 2 horas
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ mensagem: "Login realizado com sucesso!", token });
  } catch (erro) {
    console.error("Erro no login:", erro);
    res.status(500).json({ erro: "Erro interno no servidor ao realizar login." });
  }
});

// ROTAS PROTEGIDAS: CRUD DE ENCOMENDAS (Exigem Token JWT válido)

// Listar todas as encomendas (GET /encomendas)
app.get("/encomendas", autenticarToken, async (req, res) => {
  try {
    const encomendas = await db.all("SELECT * FROM encomendas ORDER BY id DESC");
    res.json(encomendas);
  } catch (erro) {
    console.error("Erro ao listar encomendas:", erro);
    res.status(500).json({ erro: "Erro ao buscar encomendas no banco de dados." });
  }
});

// Cadastrar nova encomenda (POST /encomendas)
app.post("/encomendas", autenticarToken, async (req, res) => {
  try {
    const { destinatario, peso, modalidade, cep, logradouro, bairro, cidade, numero } = req.body;

    // Validação dos campos obrigatórios
    if (!destinatario || !peso || !modalidade || !cep || !logradouro || !numero) {
      return res.status(400).json({ erro: "Todos os campos obrigatórios devem ser preenchidos." });
    }

    // Cálculo de frete realizado no servidor para evitar manipulação no cliente
    const taxas = {
      normal: 1,
      expresso: 1.5,
      super: 2,
    };
    const multiplicador = taxas[modalidade] || 1;
    const frete = Number(peso) * (1.2 + multiplicador);

    const resultado = await db.run(
      `INSERT INTO encomendas 
       (destinatario, peso, modalidade, frete, status, cep, logradouro, bairro, cidade, numero) 
       VALUES (?, ?, ?, ?, 'Pendente', ?, ?, ?, ?, ?)`,
      [
        destinatario,
        Number(peso),
        modalidade,
        frete,
        cep,
        logradouro,
        bairro || "Não informado",
        cidade || "Não informado",
        numero,
      ]
    );

    res.status(201).json({
      id: resultado.lastID,
      mensagem: "Encomenda cadastrada com sucesso!",
    });
  } catch (erro) {
    console.error("Erro ao cadastrar encomenda:", erro);
    res.status(500).json({ erro: "Erro ao salvar encomenda no banco de dados." });
  }
});

// Avançar status da encomenda (PATCH /encomendas/:id)
app.patch("/encomendas/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const encomenda = await db.get("SELECT * FROM encomendas WHERE id = ?", [id]);

    if (!encomenda) {
      return res.status(404).json({ erro: "Encomenda não encontrada." });
    }

    let novoStatus = encomenda.status;
    if (encomenda.status === "Pendente") {
      novoStatus = "Em trânsito";
    } else if (encomenda.status === "Em trânsito") {
      novoStatus = "Entregue";
    }

    await db.run("UPDATE encomendas SET status = ? WHERE id = ?", [novoStatus, id]);

    res.json({ mensagem: "Status atualizado com sucesso!", status: novoStatus });
  } catch (erro) {
    console.error("Erro ao atualizar status:", erro);
    res.status(500).json({ erro: "Erro ao atualizar status da encomenda." });
  }
});

// Remover encomenda (DELETE /encomendas/:id)
app.delete("/encomendas/:id", autenticarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await db.run("DELETE FROM encomendas WHERE id = ?", [id]);

    if (resultado.changes === 0) {
      return res.status(404).json({ erro: "Encomenda não encontrada." });
    }

    res.json({ mensagem: "Encomenda excluída com sucesso." });
  } catch (erro) {
    console.error("Erro ao excluir encomenda:", erro);
    res.status(500).json({ erro: "Erro ao excluir encomenda do banco de dados." });
  }
});