import fs from 'node:fs'
import path from 'node:path'
import { DataTypes, Sequelize, type ModelAttributes, type Model } from 'sequelize'
import { sequelize as source } from '../db/index.js'
import { env } from '../env.js'
import { getSettings, type Settings } from './settings.js'

const TABLES = ['notes', 'chat_threads', 'chat_messages', 'ai_change_logs', 'app_settings', 'memories']

/** 目标库建表结构（跨 dialect 通用，由 Sequelize 生成 DDL） */
const TABLE_SCHEMA: Record<string, ModelAttributes<Model, any>> = {
  notes: {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    committedTitle: { type: DataTypes.TEXT, allowNull: false },
    committedContent: DataTypes.TEXT,
    draftTitle: DataTypes.TEXT,
    draftContent: DataTypes.TEXT,
    draftContentVersion: { type: DataTypes.INTEGER, allowNull: false },
    draftTitleVersion: { type: DataTypes.INTEGER, allowNull: false },
    tags: DataTypes.TEXT,
    deletedAt: DataTypes.DATE,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  chat_threads: {
    id: { type: DataTypes.STRING(64), primaryKey: true },
    title: DataTypes.TEXT,
    metadata: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  chat_messages: {
    id: { type: DataTypes.STRING(64), primaryKey: true },
    threadId: { type: DataTypes.STRING(64), allowNull: false },
    role: { type: DataTypes.STRING(32), allowNull: false },
    parts: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  ai_change_logs: {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    noteId: DataTypes.INTEGER,
    threadId: DataTypes.STRING(64),
    action: { type: DataTypes.STRING(64), allowNull: false },
    summary: DataTypes.TEXT,
    beforeContent: DataTypes.TEXT,
    afterContent: DataTypes.TEXT,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  app_settings: {
    key: { type: DataTypes.STRING(128), primaryKey: true },
    value: { type: DataTypes.TEXT, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  memories: {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    kind: { type: DataTypes.STRING(32), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING(32), allowNull: false },
    tags: DataTypes.TEXT,
    sourceThreadId: DataTypes.STRING(64),
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
}

const SOURCE_STORAGE = path.join(env.dataDir, 'notes.db')

function buildMysqlConnection(config: Settings) {
  return new Sequelize(config.backupDatabase, config.backupUser, config.backupPassword, {
    host: config.backupHost,
    port: Number(config.backupPort) || 3306,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { connectTimeout: 8000 },
  })
}

function buildSqliteConnection(config: Settings) {
  if (config.backupPath) fs.mkdirSync(path.dirname(config.backupPath), { recursive: true })
  return new Sequelize({ dialect: 'sqlite', storage: config.backupPath, logging: false })
}

export function buildBackupConnection(config: Settings): Sequelize {
  if (config.backupType === 'mysql') return buildMysqlConnection(config)
  return buildSqliteConnection(config)
}

function validateConfig(config: Settings) {
  if (config.backupType === 'mysql') {
    if (!config.backupHost || !config.backupDatabase) {
      throw new Error('请先填写并保存备份配置（MySQL：Host / 数据库名）')
    }
    return
  }
  if (!config.backupPath) throw new Error('请先填写并保存备份文件路径')
  if (path.resolve(config.backupPath) === path.resolve(SOURCE_STORAGE)) {
    throw new Error('备份文件不能是业务库本身（data/notes.db），请换一个路径')
  }
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

function defineTargetModels(target: Sequelize) {
  for (const [name, attributes] of Object.entries(TABLE_SCHEMA)) {
    target.define(name, attributes, {
      timestamps: false,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
    })
  }
}

export async function testBackupConnection(config: Settings) {
  validateConfig(config)
  const target = buildBackupConnection(config)
  try {
    await target.authenticate()
    return { ok: true as const }
  } finally {
    await target.close().catch(() => {})
  }
}

export async function syncBackup(config: Settings) {
  validateConfig(config)
  const target = buildBackupConnection(config)
  const counts: Record<string, number> = {}
  try {
    await target.authenticate()
    defineTargetModels(target)
    await target.sync({ force: true })
    await target.transaction(async (t) => {
      for (const table of TABLES) {
        const model = target.models[table]
        const [rows] = (await source.query(`SELECT * FROM \`${table}\``)) as [Record<string, unknown>[], unknown]
        if (rows.length > 0) {
          const normalized = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, normalizeValue(v)])))
          await model.bulkCreate(normalized as Record<string, any>[], { transaction: t })
        }
        counts[table] = rows.length
      }
    })
    return { ok: true as const, counts }
  } finally {
    await target.close().catch(() => {})
  }
}

export function getBackupConfig(): Settings {
  return getSettings()
}
