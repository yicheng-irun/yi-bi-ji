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

export async function initDb() {
  const { Note, AiChangeLog } = await import('./models.js')
  await sequelize.sync({ alter: true })
  return { Note, AiChangeLog }
}
