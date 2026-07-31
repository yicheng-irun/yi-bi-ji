import { Sequelize, type Transaction } from 'sequelize'
import { sequelize as source } from '../db/index.js'
import { getSettings, type Settings } from './settings.js'

const MYSQL_TABLES = ['notes', 'chat_threads', 'chat_messages', 'ai_change_logs', 'app_settings']

const DDL: Record<string, string> = {
  notes: `CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    committedTitle TEXT NOT NULL,
    committedContent LONGTEXT NOT NULL,
    draftTitle TEXT NOT NULL,
    draftContent LONGTEXT NOT NULL,
    draftContentVersion INT NOT NULL DEFAULT 1,
    draftTitleVersion INT NOT NULL DEFAULT 1,
    tags TEXT NOT NULL,
    deletedAt DATETIME NULL,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL,
    INDEX idx_notes_updated_at (updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  chat_threads: `CREATE TABLE IF NOT EXISTS chat_threads (
    id VARCHAR(64) PRIMARY KEY,
    title TEXT NOT NULL,
    metadata TEXT NOT NULL,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL,
    INDEX idx_chat_threads_updated_at (updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  chat_messages: `CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    threadId VARCHAR(64) NOT NULL,
    role VARCHAR(32) NOT NULL,
    parts LONGTEXT NOT NULL,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL,
    INDEX idx_chat_messages_thread_id (threadId)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ai_change_logs: `CREATE TABLE IF NOT EXISTS ai_change_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    noteId INT NULL,
    threadId VARCHAR(64) NULL,
    action VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    beforeContent LONGTEXT NOT NULL,
    afterContent LONGTEXT NOT NULL,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL,
    INDEX idx_ai_logs_note_id (noteId),
    INDEX idx_ai_logs_created_at (createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  app_settings: `CREATE TABLE IF NOT EXISTS app_settings (
    \`key\` VARCHAR(128) PRIMARY KEY,
    \`value\` LONGTEXT NOT NULL,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
}

export function buildMysqlConnection(config: Settings) {
  return new Sequelize(config.backupDatabase, config.backupUser, config.backupPassword, {
    host: config.backupHost,
    port: Number(config.backupPort) || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { connectTimeout: 8000 },
  })
}

function fmtDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function normalizeValue(v: unknown) {
  if (v instanceof Date) return fmtDate(v)
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T ]/.test(v)) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return fmtDate(d)
  }
  return v
}

async function insertRows(mysql: Sequelize, transaction: Transaction, table: string, rows: Record<string, unknown>[]) {
  const cols = Object.keys(rows[0])
  const placeholders = cols.map(() => '?').join(', ')
  const values = rows.map((r) => cols.map((c) => normalizeValue(r[c])))
  const CHUNK = 500
  for (let i = 0; i < values.length; i += CHUNK) {
    const chunk = values.slice(i, i + CHUNK)
    const sql = `INSERT INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES ${chunk.map(() => `(${placeholders})`).join(', ')}`
    await mysql.query(sql, { transaction, replacements: chunk.flat() })
  }
}

export async function testMysqlConnection(config: Settings) {
  const mysql = buildMysqlConnection(config)
  try {
    await mysql.authenticate()
    return { ok: true as const }
  } finally {
    await mysql.close().catch(() => {})
  }
}

export async function syncToMysql(config: Settings) {
  const mysql = buildMysqlConnection(config)
  const counts: Record<string, number> = {}
  try {
    await mysql.authenticate()
    await mysql.transaction(async (t) => {
      for (const table of MYSQL_TABLES) {
        await mysql.query(DDL[table], { transaction: t })
      }
      for (const table of MYSQL_TABLES) {
        await mysql.query(`DELETE FROM \`${table}\``, { transaction: t })
        const [rows] = await source.query(`SELECT * FROM \`${table}\``) as [Record<string, unknown>[], unknown]
        if (rows.length > 0) await insertRows(mysql, t, table, rows)
        counts[table] = rows.length
      }
    })
    return { ok: true as const, counts }
  } finally {
    await mysql.close().catch(() => {})
  }
}

export function getBackupConfig(): Settings {
  return getSettings()
}
