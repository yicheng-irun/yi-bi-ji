import { EventEmitter } from 'node:events'

export interface NoteUpdatedEvent {
  type: 'note-updated'
  noteId: number
  draftTitle: string
  draftContent: string
  draftContentVersion: number
  draftTitleVersion: number
  source: 'ai' | 'user'
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
