import { create } from 'zustand';
import type { Project, WorkflowState, WorkflowEvent } from '../api/types.js';

export type Page =
  | { name: 'projects' }
  | { name: 'project-new' }
  | { name: 'project'; projectId: string }
  | { name: 'connectors'; projectId?: string }
  | { name: 'discovery'; projectId: string }
  | { name: 'review'; projectId: string }
  | { name: 'export'; projectId: string }
  | { name: 'admin' }
  | { name: 'catalogue' }
  | { name: 'lineage'; projectId?: string };

interface AppState {
  currentPage: Page;
  activeNav: string;
  currentProject: Project | null;
  workflowState: WorkflowState | null;
  workflowEvents: WorkflowEvent[];
  navigate: (page: Page) => void;
  setNav: (nav: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setWorkflowState: (state: WorkflowState | null) => void;
  setWorkflowEvents: (events: WorkflowEvent[]) => void;
  addWorkflowEvent: (event: WorkflowEvent) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: { name: 'projects' },
  activeNav: 'projects',
  currentProject: null,
  workflowState: null,
  workflowEvents: [],
  navigate: (page) => {
    const navMap: Record<string, string> = {
      projects: 'projects',
      'project-new': 'projects',
      project: 'projects',
      connectors: 'connectors',
      discovery: 'projects',
      review: 'projects',
      export: 'projects',
      admin: 'admin',
      catalogue: 'catalogue',
      lineage: 'lineage',
    };
    set({ currentPage: page, activeNav: navMap[page.name] || 'projects' });
  },
  setNav: (nav) => set({ activeNav: nav }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setWorkflowState: (state) => set({ workflowState: state }),
  setWorkflowEvents: (events) => set({ workflowEvents: events }),
  addWorkflowEvent: (event) =>
    set((s) => ({ workflowEvents: [...s.workflowEvents, event] })),
}));