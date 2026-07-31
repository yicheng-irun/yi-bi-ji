import fs from 'node:fs'
import path from 'node:path'
import { Sequelize } from 'sequelize'
import { env } from '../env.js'

fs.mkdirSync(env.dataDir, { recursive: true })

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(env.dataDir, 'notes.db'),
  logging: false,
})

async function cleanupLeftoverBackupTables() {
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name GLOB '*_backup'",
  )
  const tables = (rows as { name: string }[]).map((r) => r.name)
  for (const name of tables) {
    await sequelize.query(`DROP TABLE IF EXISTS \`${name}\``).catch(() => {})
  }
}

export async function initDb() {
  const { Note, AiChangeLog } = await import('./models.js')
  // 清理 sequelize sqlite `sync({alter:true})` 中断后遗留的 *_backup 临时表，避免下次 alter 时报唯一约束冲突
  await cleanupLeftoverBackupTables()
  await sequelize.sync({ alter: true })
  return { Note, AiChangeLog }
}
