const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const bcrypt = require("bcrypt");

/**
 * Inicializa a conexão com o banco SQLite, cria o esquema relacional
 * e garante a existência de um usuário administrador inicial.
 * @returns {Promise<import('sqlite').Database>} Instância ativa do banco de dados
 */
async function conectarBanco() {
  try {
    // Define o caminho absoluto do arquivo do banco dentro da pasta backend/
    const caminhoBanco = path.resolve(__dirname, "rotaexpress.sqlite");

    // Abre a conexão assíncrona usando o driver sqlite3
    const db = await open({
      filename: caminhoBanco,
      driver: sqlite3.Database,
    });

    // Ativa o suporte a chaves estrangeiras (boa prática em bancos SQLite)
    await db.exec("PRAGMA foreign_keys = ON;");

    // TABELA DE USUÁRIOS (Autenticação JWT + Bcrypt)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // TABELA DE ENCOMENDAS (Persistência do Sistema Logístico)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS encomendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        destinatario TEXT NOT NULL,
        peso REAL NOT NULL CHECK(peso > 0),
        modalidade TEXT NOT NULL,
        frete REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente',
        cep TEXT NOT NULL,
        logradouro TEXT NOT NULL,
        bairro TEXT NOT NULL,
        cidade TEXT NOT NULL,
        numero TEXT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // SEED INICIAL (Criação do usuário padrão caso não exista)
    const emailAdmin = "admin@rotaexpress.com";
    const senhaPadrao = "123456";

    const usuarioExistente = await db.get(
      "SELECT id FROM usuarios WHERE email = ?",
      [emailAdmin]
    );

    if (!usuarioExistente) {
      // Gera o hash criptografado da senha com custo de 10 rounds
      const saltRounds = 10;
      const senhaCriptografada = await bcrypt.hash(senhaPadrao, saltRounds);

      await db.run(
        "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
        ["Administrador RotaExpress", emailAdmin, senhaCriptografada]
      );

      console.log("==================================================");
      console.log("Banco SQLite inicializado com usuário padrão:");
      console.log(`E-mail: ${emailAdmin}`);
      console.log(`Senha:  ${senhaPadrao}`);
      console.log("==================================================");
    }

    return db;
  } catch (erro) {
    console.error("Falha crítica ao inicializar o banco de dados:", erro.message);
    throw erro;
  }
}

module.exports = conectarBanco;