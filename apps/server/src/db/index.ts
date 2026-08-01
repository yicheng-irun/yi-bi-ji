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

/** sqlite `sync({alter:true})` 中断可能把数据留在 *_backup 临时表而真实表为空，清理前先把数据救回真实表 */
async function cleanupLeftoverBackupTables() {
  const [rows] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name GLOB '*_backup'",
  )
  const tables = (rows as { name: string }[]).map((r) => r.name)
  for (const name of tables) {
    const real = name.replace(/_backup$/, '')
    try {
      const [realCount] = (await sequelize.query(`SELECT COUNT(*) AS n FROM \`${real}\``)) as [{ n: number }[], unknown]
      const [bkCount] = (await sequelize.query(`SELECT COUNT(*) AS n FROM \`${name}\``)) as [{ n: number }[], unknown]
      if (bkCount[0].n > 0 && realCount[0].n === 0) {
        await sequelize.query(`INSERT INTO \`${real}\` SELECT * FROM \`${name}\``)
        console.log(`[db] 从遗留临时表 ${name} 恢复 ${bkCount[0].n} 行到 ${real}`)
      }
    } catch (e) {
      console.warn(`[db] 恢复 ${name} 失败，跳过：`, (e as Error).message)
    }
    await sequelize.query(`DROP TABLE IF EXISTS \`${name}\``).catch(() => {})
  }
}

/** `sync({alter:true})` 前对 db 文件做一次快照，alter 出问题时可从快照找回 */
function snapshotDbFile() {
  try {
    const storage = path.join(env.dataDir, 'notes.db')
    if (fs.existsSync(storage)) {
      fs.copyFileSync(storage, path.join(env.dataDir, 'notes.db.pre-sync.bak'))
    }
  } catch (e) {
    console.warn('[db] db 文件快照失败：', (e as Error).message)
  }
}

export async function initDb() {
  const { Note, AiChangeLog } = await import('./models.js')
  // 清理 sequelize sqlite `sync({alter:true})` 中断后遗留的 *_backup 临时表，避免下次 alter 时报唯一约束冲突
  await cleanupLeftoverBackupTables()
  snapshotDbFile()
  await sequelize.sync({ alter: true })
  return { Note, AiChangeLog }
}
