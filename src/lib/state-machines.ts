export type SessionState = 'CREATED' | 'LOGIN_PENDING' | 'VERIFICATION_PENDING' | 'VERIFIED' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED'
export type EventState = 'DRAFT' | 'REGISTRATION_OPEN' | 'LIVE' | 'PAUSED' | 'COMPLETED'
export type SubmissionState = 'DRAFT' | 'TESTING' | 'READY' | 'SUBMITTED' | 'EVALUATING' | 'EVALUATED' | 'ERROR'

export const SessionStateMachine = {
  initial: 'CREATED' as SessionState,
  transitions: {
    CREATED: ['LOGIN_PENDING'],
    LOGIN_PENDING: ['VERIFICATION_PENDING'],
    VERIFICATION_PENDING: ['VERIFIED', 'SUSPENDED'],
    VERIFIED: ['ACTIVE', 'SUSPENDED'],
    ACTIVE: ['COMPLETED', 'SUSPENDED'],
    COMPLETED: [],
    SUSPENDED: ['VERIFIED', 'ACTIVE'], // can be unsuspended
  },
  canTransition: (from: SessionState, to: SessionState) => {
    return SessionStateMachine.transitions[from]?.includes(to) ?? false
  }
}

export const EventStateMachine = {
  initial: 'DRAFT' as EventState,
  transitions: {
    DRAFT: ['REGISTRATION_OPEN', 'LIVE'],
    REGISTRATION_OPEN: ['LIVE', 'DRAFT'],
    LIVE: ['PAUSED', 'COMPLETED'],
    PAUSED: ['LIVE', 'COMPLETED'],
    COMPLETED: [],
  },
  canTransition: (from: EventState, to: EventState) => {
    return EventStateMachine.transitions[from]?.includes(to) ?? false
  }
}

export const SubmissionStateMachine = {
  initial: 'DRAFT' as SubmissionState,
  transitions: {
    DRAFT: ['TESTING', 'READY', 'SUBMITTED'],
    TESTING: ['DRAFT', 'READY', 'ERROR'],
    READY: ['SUBMITTED', 'DRAFT'],
    SUBMITTED: ['EVALUATING'],
    EVALUATING: ['EVALUATED', 'ERROR'],
    EVALUATED: [],
    ERROR: ['DRAFT', 'SUBMITTED'],
  },
  canTransition: (from: SubmissionState, to: SubmissionState) => {
    return SubmissionStateMachine.transitions[from]?.includes(to) ?? false
  }
}
