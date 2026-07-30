import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize'
import { sequelize } from './index.js'

export class Note extends Model<InferAttributes<Note>, InferCreationAttributes<Note>> {
  declare id: CreationOptional<number>
  declare committedTitle: string
  declare committedContent: string
  declare draftTitle: string
  declare draftContent: string
  declare draftContentVersion: CreationOptional<number>
  declare draftTitleVersion: CreationOptional<number>
  declare tags: CreationOptional<string>
  declare deletedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

Note.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    committedTitle: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    committedContent: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    draftTitle: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    draftContent: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    draftContentVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    draftTitleVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    tags: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' },
    deletedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  },
  {
    sequelize,
    tableName: 'notes',
    indexes: [{ name: 'idx_notes_updated_at', fields: ['updatedAt'] }],
  },
)

export class AiChangeLog extends Model<InferAttributes<AiChangeLog>, InferCreationAttributes<AiChangeLog>> {
  declare id: CreationOptional<number>
  declare noteId: CreationOptional<number | null>
  declare threadId: CreationOptional<string | null>
  declare action: string
  declare summary: CreationOptional<string>
  declare beforeContent: CreationOptional<string>
  declare afterContent: CreationOptional<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

AiChangeLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    noteId: { type: DataTypes.INTEGER, allowNull: true },
    threadId: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    summary: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    beforeContent: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    afterContent: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    createdAt: { type: DataTypes.DATE },
    updatedAt: { type: DataTypes.DATE },
  },
  {
    sequelize,
    tableName: 'ai_change_logs',
    indexes: [
      { name: 'idx_ai_logs_note_id', fields: ['noteId'] },
      { name: 'idx_ai_logs_created_at', fields: ['createdAt'] },
    ],
  },
)
