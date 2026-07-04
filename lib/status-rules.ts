import { Status } from '@prisma/client'

export type Transition = {
  from: Status
  to: Status
  noteRequired: boolean
}

export const ALLOWED_TRANSITIONS: Transition[] = [
  { from: 'OPEN', to: 'IN_PROGRESS', noteRequired: false },
  { from: 'IN_PROGRESS', to: 'RESOLVED', noteRequired: true },
  { from: 'OPEN', to: 'REJECTED', noteRequired: true },
  { from: 'IN_PROGRESS', to: 'REJECTED', noteRequired: true },
  { from: 'RESOLVED', to: 'OPEN', noteRequired: true }
]

export function getTransitionRule(from: Status, to: Status): Transition | null {
  const rule = ALLOWED_TRANSITIONS.find(t => t.from === from && t.to === to)
  return rule || null
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; status: number; message: string }

export function validateTransition(
  from: Status,
  to: Status,
  note?: string | null
): ValidationResult {
  const rule = getTransitionRule(from, to)
  if (!rule) {
    return {
      valid: false,
      status: 400,
      message: `Invalid status transition:\n${from} → ${to} is not allowed`
    }
  }

  if (rule.noteRequired) {
    if (!note || note.trim() === '') {
      return {
        valid: false,
        status: 400,
        message: 'A note is required for this transition'
      }
    }
  }

  return { valid: true }
}
