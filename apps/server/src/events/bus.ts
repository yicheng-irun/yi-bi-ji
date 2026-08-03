import { EventEmitter } from 'node:events'

export interface NoteUpdatedEvent {
  type: 'note-updated'
  noteId: number
  draftTitle: string
  draftContentVersion: number
  draftTitleVersion: number
  source: 'ai' | 'user'
  /** 发起本次变更的前端实例 id，用于前端忽略自己产生的回声事件 */
  clientId?: string
}

export interface NoteCreatedEvent {
  type: 'note-created'
  noteId: number
  source: 'ai' | 'user'
}

export interface NoteCommittedEvent {
  type: 'note-committed'
  noteId: number
}

export interface NoteDeletedEvent {
  type: 'note-deleted'
  noteId: number
}

export type BusEvent = NoteUpdatedEvent | NoteCreatedEvent | NoteCommittedEvent | NoteDeletedEvent

export const bus = new EventEmitter()
bus.setMaxListeners(100)

export function emitEvent(event: BusEvent) {
  bus.emit('event', event)
}
