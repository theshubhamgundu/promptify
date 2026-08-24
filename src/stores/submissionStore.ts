import { create } from 'zustand'

export interface SubmissionState {
  drafts: Record<string, string> // challengeId -> content
  submissions: Record<string, any> // challengeId -> submission data
  updateDraft: (challengeId: string, content: string) => void
  setSubmission: (challengeId: string, data: any) => void
}

export const useSubmissionStore = create<SubmissionState>((set) => ({
  drafts: {},
  submissions: {},
  updateDraft: (challengeId, content) => set((state) => ({
    drafts: { ...state.drafts, [challengeId]: content }
  })),
  setSubmission: (challengeId, data) => set((state) => ({
    submissions: { ...state.submissions, [challengeId]: data }
  })),
}))
