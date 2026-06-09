'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Layers, 
  CheckSquare, 
  Square, 
  Plus, 
  Edit, 
  Trash2, 
  Archive, 
  History, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Clock, 
  X, 
  Terminal, 
  PlusCircle, 
  ChevronRight,
  FolderSync,
  AlertTriangle,
  FolderSearch,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useProductivityStore } from '@/stores/productivityStore';
import { sounds } from '@/lib/sounds';
import { db, Project, ProjectPhase, ProjectIssue, TaskGroup, TaskCategory, TaskPeriod } from '@/lib/db';

export default function ProjectsPage() {
  const [isClient, setIsClient] = useState(false);
  const { settings, refreshData } = useProductivityStore();

  // Local state for Projects, Phases, Issues
  const [projects, setProjects] = useState<Project[]>([]);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  
  // UI Selection Contexts
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Form Mediate States
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');

  const [isNewPhaseModalOpen, setIsNewPhaseModalOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseDesc, setNewPhaseDesc] = useState('');

  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editPhaseName, setEditPhaseName] = useState('');
  const [editPhaseDesc, setEditPhaseDesc] = useState('');

  const [newIssueTitles, setNewIssueTitles] = useState<Record<string, string>>({}); // phaseId -> text
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editIssueTitle, setEditIssueTitle] = useState('');
  const [editIssueDesc, setEditIssueDesc] = useState('');

  // TASKS GENERATOR STATES
  const [activeIssueForTaskGen, setActiveIssueForTaskGen] = useState<ProjectIssue | null>(null);
  const [generatedSubTasks, setGeneratedSubTasks] = useState<string[]>([]);
  const [newSubTaskInput, setNewSubTaskInput] = useState('');
  
  const [taskGroupSelect, setTaskGroupSelect] = useState<string>('');
  const [taskCategorySelect, setTaskCategorySelect] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState<string>('');
  const [taskUrgency, setTaskUrgency] = useState<'low' | 'moderate' | 'urgent'>('moderate');

  // Metadata loaders
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);

  // Prevent server hydration mismatches
  useEffect(() => {
    const handle = setTimeout(() => {
      setIsClient(true);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  // Sync internal datasets
  const syncLocalState = useCallback(() => {
    const allProj = db.getProjects(true);
    setProjects(allProj);

    // Auto select first project if none is active or active is deleted
    if (allProj.length > 0) {
      const activeExists = allProj.some(p => p.id === selectedProjectId && (!p.is_archived || showArchived));
      if (!activeExists) {
        const firstVisible = allProj.find(p => p.is_archived === showArchived);
        if (firstVisible) {
          setSelectedProjectId(firstVisible.id);
        } else if (allProj.length > 0 && selectedProjectId === '') {
          setSelectedProjectId(allProj[0].id);
        }
      }
    }

    if (selectedProjectId) {
      setPhases(db.getProjectPhases(selectedProjectId));
      setIssues(db.getProjectIssues(selectedProjectId));
    } else {
      setPhases([]);
      setIssues([]);
    }

    // Refresh groups, categories
    setGroups(db.getGroups());
    setCategories(db.getCategories());
  }, [selectedProjectId, showArchived]);

  // Handle db reactivity broadcasts
  useEffect(() => {
    const handle = setTimeout(() => {
      syncLocalState();
    }, 0);
    const unsub = db.subscribeDataRefresh(() => {
      syncLocalState();
    });
    return () => {
      clearTimeout(handle);
      unsub();
    };
  }, [syncLocalState]);

  // Project select change handler
  const handleSelectProject = (id: string) => {
    sounds.playButtonSwitch();
    setSelectedProjectId(id);
  };

  // Create Project
  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    sounds.playSuccessIndicator();
    const p = await db.saveProject(newProjectName.trim(), newProjectDesc.trim() || null);
    setSelectedProjectId(p.id);

    setNewProjectName('');
    setNewProjectDesc('');
    setIsNewProjectModalOpen(false);
  };

  // Edit Project
  const handleEditProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjectName.trim() || !selectedProjectId) return;

    sounds.playSuccessIndicator();
    await db.updateProject(selectedProjectId, {
      name: editProjectName.trim(),
      description: editProjectDesc.trim() || null
    });
    setIsEditProjectModalOpen(false);
  };

  // Archive Project Toggle
  const handleToggleArchiveProject = async (id: string, currentArchiveState: boolean) => {
    sounds.playButtonSwitch();
    await db.updateProject(id, { is_archived: !currentArchiveState });
    db.addLog(`PROJECT_STATE: PROJECT ${!currentArchiveState ? 'ARCHIVED' : 'RESTORED'}.`, 'system');
    syncLocalState();
  };

  // Delete Project Command
  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("CONFIRMAR EXCLUSÃO CRÍTICA? Isso apagará todas as fases e pendências permanentemente.")) return;
    sounds.playAlarmBreak();
    await db.deleteProject(id);
    db.addLog(`SYS_SCRUB: PROJECT DATABASE PURGED COMPLETELY.`, 'warning');
    if (selectedProjectId === id) {
      setSelectedProjectId('');
    }
  };

  // Create Phase
  const handleCreatePhaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhaseName.trim() || !selectedProjectId) return;

    sounds.playSuccessIndicator();
    await db.saveProjectPhase(selectedProjectId, newPhaseName.trim(), newPhaseDesc.trim() || null);
    
    setNewPhaseName('');
    setNewPhaseDesc('');
    setIsNewProjectModalOpen(false);
    setIsNewPhaseModalOpen(false);
  };

  // Update Phase
  const handleEditPhaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhaseId || !editPhaseName.trim()) return;

    sounds.playSuccessIndicator();
    await db.updateProjectPhase(editingPhaseId, {
      name: editPhaseName.trim(),
      description: editPhaseDesc.trim() || null
    });
    setEditingPhaseId(null);
  };

  // Delete Phase
  const handleDeletePhase = async (phaseId: string) => {
    if (!window.confirm("Deletar esta fase e todas as suas pendências?")) return;
    sounds.playAlarmBreak();
    await db.deleteProjectPhase(phaseId);
  };

  // Reordering phases
  const handleMovePhase = async (phaseId: string, direction: 'up' | 'down') => {
    sounds.playButtonSwitch();
    const currentPhases = [...phases];
    const index = currentPhases.findIndex(p => p.id === phaseId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentPhases.length) return;

    // Swap elements
    const temp = currentPhases[index];
    currentPhases[index] = currentPhases[targetIndex];
    currentPhases[targetIndex] = temp;

    await db.reorderProjectPhases(selectedProjectId, currentPhases);
  };

  // Create Issue
  const handleCreateIssue = async (phaseId: string) => {
    const titleText = newIssueTitles[phaseId];
    if (!titleText || !titleText.trim() || !selectedProjectId) return;

    sounds.playButtonKeyboard();
    await db.saveProjectIssue(selectedProjectId, phaseId, titleText.trim());
    
    // Clear input
    setNewIssueTitles(prev => ({ ...prev, [phaseId]: '' }));
  };

  // Toggle Issue State
  const handleToggleIssue = async (id: string, currentState: boolean) => {
    sounds.playCheckCompleted();
    await db.updateProjectIssue(id, { is_completed: !currentState });
  };

  // Edit Issue Submit
  const handleEditIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssueId || !editIssueTitle.trim()) return;

    sounds.playSuccessIndicator();
    await db.updateProjectIssue(editingIssueId, {
      title: editIssueTitle.trim(),
      description: editIssueDesc.trim() || null
    });
    setEditingIssueId(null);
  };

  // Delete Issue
  const handleDeleteIssue = async (issueId: string) => {
    sounds.playAlarmBreak();
    await db.deleteProjectIssue(issueId);
  };

  // Start task generation sequence
  const startTaskGeneration = (issue: ProjectIssue) => {
    sounds.playButtonSwitch();
    setActiveIssueForTaskGen(issue);
    // Seed with the issue name as a default subtask
    setGeneratedSubTasks([issue.title]);
    setNewSubTaskInput('');
    setTaskDueDate('');
    
    // Default select first available metadata
    if (groups.length > 0) {
      setTaskGroupSelect(groups[0].id);
      const groupCategories = categories.filter(c => c.group_id === groups[0].id);
      setTaskCategorySelect(groupCategories.length > 0 ? groupCategories[0].id : '');
    } else {
      setTaskGroupSelect('');
      setTaskCategorySelect('');
    }
  };

  // Add a task to batch generator lists
  const handleAddSubTaskToList = () => {
    if (!newSubTaskInput.trim()) return;
    sounds.playButtonKeyboard();
    setGeneratedSubTasks(prev => [...prev, newSubTaskInput.trim()]);
    setNewSubTaskInput('');
  };

  const handleRemoveSubTaskFromList = (index: number) => {
    sounds.playAlarmBreak();
    setGeneratedSubTasks(prev => prev.filter((_, idx) => idx !== index));
  };

  // batch generate tasks in core adapters
  const submitGenerateTasks = async () => {
    if (!activeIssueForTaskGen || generatedSubTasks.length === 0 || !taskGroupSelect) return;

    sounds.playSuccessIndicator();
    
    const tasksToPush = generatedSubTasks.map(title => ({
      title,
      description: `Task gerada a partir do projeto: ${activeProject?.name || ''} // Pendência: ${activeIssueForTaskGen.title}`,
      groupId: taskGroupSelect,
      categoryId: taskCategorySelect || null,
      taskPeriodId: null,
      dueDate: taskDueDate || null,
      timePeriod: null
    }));

    await db.generateTasksFromIssue(activeIssueForTaskGen.id, tasksToPush);
    setActiveIssueForTaskGen(null);
  };

  // Calculations for current project statistics
  const activeProject = projects.find(p => p.id === selectedProjectId);
  const currentProjectIssues = issues.filter(iss => iss.project_id === selectedProjectId);
  const completedIssuesCount = currentProjectIssues.filter(iss => iss.is_completed).length;
  const totalIssuesCount = currentProjectIssues.length;
  const progressPercent = totalIssuesCount > 0 ? Math.round((completedIssuesCount / totalIssuesCount) * 100) : 0;

  // Aesthetic configs
  const borderStyle = settings.theme_mode === 'AMBER' 
    ? 'border-[#ffb347] amber-glow-border' 
    : settings.theme_mode === 'GREEN' 
      ? 'border-[#33ff33] green-glow-border'
      : 'border-[#00e5ff] cobalt-glow-border';

  const textStyle = settings.theme_mode === 'AMBER' 
    ? 'text-[#ffb347] amber-glow-text'
    : settings.theme_mode === 'GREEN'
      ? 'text-[#33ff33] green-glow-text'
      : 'text-[#00e5ff] cobalt-glow-text';

  const activeGlowBg = settings.theme_mode === 'AMBER'
    ? 'bg-[#ffb347]/10'
    : settings.theme_mode === 'GREEN'
      ? 'bg-[#33ff33]/15'
      : 'bg-[#00e5ff]/10';

  const secondaryBtnStyle = "border-dashed hover:bg-[var(--color-amber)]/15 border-[var(--color-amber)] text-[var(--color-amber)] bg-transparent";

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[400px]">
        <Terminal className="w-8 h-8 animate-spin text-[var(--color-amber)] mb-4" />
        <p className="font-mono text-center text-xs tracking-widest text-[var(--color-amber)] animate-pulse">
          INITIALIZING OPERATIONS SCHEMATICS MODULE...
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch min-h-[500px]">
      
      {/* 1. LEFT SIDE - PROJECT ORGANIZER COLUMN */}
      <div className={`md:col-span-4 border-2 p-4 rounded-xl flex flex-col gap-4 ${borderStyle} bg-black/40`}>
        <div className="flex items-center justify-between border-b pb-2.5 border-[var(--color-amber)]/20">
          <h2 className={`font-black tracking-widest text-xs uppercase flex items-center gap-2 ${textStyle}`}>
            <Briefcase className="w-4 h-4" />
            {showArchived ? "Projetos Histórico" : "Projetos Ativos"}
          </h2>
          
          <button
            onClick={() => { sounds.playButtonSwitch(); setShowArchived(!showArchived); }}
            title={showArchived ? "Mostrar Projetos Ativos" : "Mostrar Arquivados"}
            className="p-1 px-2 border border-[var(--color-amber)]/30 hover:border-[var(--color-amber)] rounded text-xxs tracking-wider uppercase transition-all"
          >
            {showArchived ? <FolderSync className="w-3.5 h-3.5" /> : <History className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Action controls */}
        <button
          onClick={() => { sounds.playButtonSwitch(); setIsNewProjectModalOpen(true); }}
          className="w-full py-2 border border-dashed rounded text-xs tracking-widest font-black uppercase flex items-center justify-center gap-2 hover:bg-[var(--color-amber)]/10 text-[var(--color-amber)] border-[var(--color-amber)]/60 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Registrar Projeto
        </button>

        {/* Projects Listing scrolling feed */}
        <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[350px] pr-1">
          {projects.filter(p => p.is_archived === showArchived).length === 0 ? (
            <div className="text-center p-8 border border-[var(--color-amber)]/10 rounded border-dashed text-xxs tracking-wider text-[var(--color-amber)] opacity-60">
              <FolderSearch className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhum projeto {showArchived ? 'arquivado' : 'ativo'} localizado.
            </div>
          ) : (
            projects.filter(p => p.is_archived === showArchived).map(proj => {
              const projIssues = issues.filter(iss => iss.project_id === proj.id);
              const compCount = projIssues.filter(i => i.is_completed).length;
              const totalCount = projIssues.length;
              const percent = totalCount > 0 ? Math.round((compCount / totalCount) * 100) : 0;
              const isActive = selectedProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => handleSelectProject(proj.id)}
                  className={`p-3 rounded border text-left cursor-pointer transition-all ${
                    isActive 
                      ? `${activeGlowBg} border-[var(--color-amber)] font-bold shadow-sm` 
                      : 'border-[var(--color-amber)]/25 hover:border-[var(--color-amber)]/60 bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase font-bold tracking-wider truncate max-w-[150px]">
                      {proj.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-amber)] opacity-80">
                      {compCount}/{totalCount} PND
                    </span>
                  </div>
                  
                  {proj.description && (
                    <p className="text-[10px] opacity-75 line-clamp-1 mb-2.5">
                      {proj.description}
                    </p>
                  )}

                  {/* Retro Mini Progress visualizer */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/60 h-2 border border-[var(--color-amber)]/20 rounded overflow-hidden p-0.5">
                      <div 
                        className="bg-[var(--color-amber)] h-full rounded-sm" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono font-black">{percent}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. RIGHT SIDE - PHASE SCRIPTS & ISSUES BOARD */}
      <div className={`md:col-span-8 border-2 p-5 rounded-xl flex flex-col gap-5 ${borderStyle} bg-black/30`}>
        {activeProject ? (
          <>
            {/* Project HUD Header information */}
            <div className="border-b pb-4 border-[var(--color-amber)]/20 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-normal border px-1.5 py-0.5 rounded text-[var(--color-amber)] border-[var(--color-amber)]/30 font-semibold bg-[var(--color-amber)]/5">
                  OPERATING: ACTIVE_MATRIX
                </span>
                <h1 className={`text-xl md:text-2xl font-black mt-2 tracking-wider ${textStyle}`}>
                  {activeProject.name}
                </h1>
                {activeProject.description && (
                  <p className="text-xs mt-1 text-[var(--color-amber)] opacity-80">
                    {activeProject.description}
                  </p>
                )}
              </div>

              {/* Functional progress hud and commands */}
              <div className="flex flex-col sm:items-end gap-2.5 w-full sm:w-auto">
                <div className="flex items-center gap-3">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase opacity-75">Progresso Global:</span>
                    <div className="text-xs font-mono font-black flex items-center gap-2">
                      <span className="text-md">{completedIssuesCount}/{totalIssuesCount} PND</span>
                      <span className={textStyle}>({progressPercent}%)</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { sounds.playButtonSwitch(); setEditProjectName(activeProject.name); setEditProjectDesc(activeProject.description || ''); setIsEditProjectModalOpen(true); }}
                    className="p-1 px-2 border border-[var(--color-amber)]/30 hover:border-var-color-amber hover:bg-[var(--color-amber)]/10 text-xxs tracking-wider uppercase rounded"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleArchiveProject(activeProject.id, activeProject.is_archived)}
                    className="p-1 px-2 border border-blue-900 border-blue-500/30 text-xs rounded hover:bg-blue-950/20"
                    title={activeProject.is_archived ? "Restaurar Projeto" : "Arquivar Projeto"}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteProject(activeProject.id)}
                    className="p-1 px-2 border border-rose-950 text-rose-500 rounded hover:bg-rose-950/20"
                    title="Excluir Projeto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                {/* Visual ASCII Bar */}
                <div className="w-full sm:w-44 text-[10px] font-mono leading-none tracking-tighter text-[var(--color-amber)] truncate">
                  {`[${"█".repeat(Math.round(progressPercent / 10))}${".".repeat(10 - Math.round(progressPercent / 10))}]`}
                </div>
              </div>
            </div>

            {/* PHASES CAROUSEL FEED */}
            <div className="flex flex-col gap-5 overflow-y-auto max-h-[600px] pr-1">
              
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-black tracking-widest text-[var(--color-amber)]/80 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Fases de Desenvolvimento
                </span>
                
                <button
                  onClick={() => { sounds.playButtonSwitch(); setIsNewPhaseModalOpen(true); }}
                  className="py-1 px-3 border border-dashed rounded text-xxs uppercase tracking-wider font-bold hover:bg-[var(--color-amber)]/10 text-[var(--color-amber)] border-[var(--color-amber)]/40 cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Adicionar Fase
                </button>
              </div>

              {phases.length === 0 ? (
                <div className="text-center p-12 border border-[var(--color-amber)]/10 rounded-xl border-dashed">
                  <Terminal className="w-10 h-10 mx-auto text-[var(--color-amber)] opacity-40 mb-3 animate-pulse" />
                  <p className="text-xs text-[var(--color-amber)] opacity-80 uppercase font-black tracking-widest">
                    Sem Fases Registradas
                  </p>
                  <p className="text-xxs text-[var(--color-amber)] opacity-60 mt-1 max-w-sm mx-auto">
                    Crie uma fase de entrega (ex: &#39;Sistema de Tarefas&#39;, &#39;Dashboard&#39;, &#39;Fase 1&#39;) para organizar as pendências de desenvolvimento.
                  </p>
                </div>
              ) : (
                phases.map((phase, phaseIndex) => {
                  const phaseIssues = issues.filter(iss => iss.phase_id === phase.id);
                  const pCompCount = phaseIssues.filter(i => i.is_completed).length;
                  const pTotalCount = phaseIssues.length;
                  const canMoveUp = phaseIndex > 0;
                  const canMoveDown = phaseIndex < phases.length - 1;

                  return (
                    <div 
                      key={phase.id} 
                      className="border border-[var(--color-amber)]/20 rounded-xl p-4 bg-[#110d0a]/40 flex flex-col gap-3 relative"
                    >
                      {/* Phase metadata header */}
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-[var(--color-amber)]/10 pb-2">
                        <div className="flex items-start gap-2.5">
                          <span className="bg-[var(--color-amber)] text-black font-black text-xs px-2 py-0.5 rounded-md">
                            #{phaseIndex + 1}
                          </span>
                          <div>
                            <h3 className="text-xs uppercase font-bold tracking-wider">{phase.name}</h3>
                            {phase.description && (
                              <p className="text-[10px] text-[var(--color-amber)] opacity-70 mt-0.5">
                                {phase.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Order sequences and commands */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <span className="text-[10px] font-mono underline mr-2 opacity-80">
                            {pCompCount}/{pTotalCount} Concluído
                          </span>
                          
                          <div className="flex border border-[var(--color-amber)]/30 rounded overflow-hidden">
                            <button
                              disabled={!canMoveUp}
                              onClick={() => handleMovePhase(phase.id, 'up')}
                              className={`p-1 px-2 border-r border-[var(--color-amber)]/30 text-xxs ${
                                canMoveUp ? 'hover:bg-[var(--color-amber)]/10 text-[var(--color-amber)]' : 'opacity-30 text-gray-500'
                              }`}
                              title="Subir Ordem de Prioridade"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              disabled={!canMoveDown}
                              onClick={() => handleMovePhase(phase.id, 'down')}
                              className={`p-1 px-2 text-xxs ${
                                canMoveDown ? 'hover:bg-[var(--color-amber)]/10 text-[var(--color-amber)]' : 'opacity-30 text-gray-500'
                              }`}
                              title="Descer Ordem de Prioridade"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => { sounds.playButtonSwitch(); setEditingPhaseId(phase.id); setEditPhaseName(phase.name); setEditPhaseDesc(phase.description || ''); }}
                            className="p-1 px-1.5 border border-[var(--color-amber)]/20 hover:border-[var(--color-amber)] text-xxs rounded"
                            title="Editar Fase"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          
                          <button
                            onClick={() => handleDeletePhase(phase.id)}
                            className="p-1 px-1.5 border border-rose-950 hover:bg-rose-950/25 rounded text-rose-500"
                            title="Remover Fase"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* PHASE ISSUES (PENDÊNCIAS LIST) */}
                      <div className="flex flex-col gap-2">
                        {phaseIssues.length === 0 ? (
                          <div className="text-[10px] text-center border p-4 rounded border-dashed border-[var(--color-amber)]/10 opacity-70">
                            Sem pendências nesta fase. Digite uma abaixo e pressione enter.
                          </div>
                        ) : (
                          phaseIssues.map(iss => (
                            <div 
                              key={iss.id} 
                              className={`p-2 border rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition-colors ${
                                iss.is_completed 
                                  ? 'border-green-950 bg-green-950/10 text-green-500 opacity-80' 
                                  : 'border-[var(--color-amber)]/15 bg-black/20 text-[var(--color-amber)] hover:border-[var(--color-amber)]/40'
                              }`}
                            >
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                  onClick={() => handleToggleIssue(iss.id, iss.is_completed)}
                                  className="text-[var(--color-amber)] flex-shrink-0 cursor-pointer hover:scale-105 transition-all text-xs focus:outline-none"
                                >
                                  {iss.is_completed ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                                <span className={`font-mono leading-tight ${iss.is_completed ? 'line-through' : ''}`}>
                                  {iss.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                                {/* GENERATE TASKS OPERATIONAL COMMAND BUTTON */}
                                <button
                                  onClick={() => startTaskGeneration(iss)}
                                  className="py-1 px-2 border border-blue-900 border-blue-500/40 text-[9px] hover:bg-blue-950/20 text-blue-400 font-black tracking-widest uppercase rounded flex items-center gap-1 cursor-pointer"
                                  title="Gerar tarefas operacionais no sistema"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Gerar Tarefa
                                </button>

                                <button
                                  onClick={() => { sounds.playButtonSwitch(); setEditingIssueId(iss.id); setEditIssueTitle(iss.title); setEditIssueDesc(iss.description || ''); }}
                                  className="p-1 border border-[var(--color-amber)]/10 hover:border-[var(--color-amber)]/40 text-[10px] rounded"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteIssue(iss.id)}
                                  className="p-1 border border-rose-950 text-rose-500 hover:bg-rose-950/10 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        
                        {/* Inline issue quick builder input */}
                        <div className="flex gap-2.5 mt-1.5 items-center">
                          <input
                            type="text"
                            placeholder="Cadastrar nova pendência nesta fase..."
                            value={newIssueTitles[phase.id] || ''}
                            onChange={(e) => setNewIssueTitles(prev => ({ ...prev, [phase.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateIssue(phase.id); }}
                            className="flex-1 bg-black/60 border border-[var(--color-amber)]/30 px-3 py-1.5 text-xs rounded-md text-[var(--color-amber)] placeholder:text-[var(--color-amber)]/40 focus:border-[var(--color-amber)] select-all"
                          />
                          <button
                            onClick={() => handleCreateIssue(phase.id)}
                            className="p-1.5 border border-[var(--color-amber)] border-[var(--color-amber)] text-black rounded-md flex hover:bg-transparent hover:text-[var(--color-amber)] focus:outline-none"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-20 min-h-[300px]">
            <Briefcase className="w-12 h-12 text-[var(--color-amber)] opacity-30 mb-4 animate-bounce" />
            <h2 className="text-md tracking-wider font-extrabold uppercase">SOLICITAÇÃO DE OPERAÇÕES</h2>
            <p className="text-xs text-center text-[var(--color-amber)] opacity-60 mt-1 max-w-sm">
              Por favor selecione ou crie um projeto no menu esquerdo para iniciar o mapeamento de fases e pendências.
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. MODALS AND FORMS OVERLAYS */}
      {/* ========================================================= */}

      {/* MODAL: NEW PROJECT */}
      <AnimatePresence>
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`border-2 rounded-xl p-5 max-w-md w-full bg-black ${borderStyle} flex flex-col gap-4 relative`}
            >
              <button 
                onClick={() => { sounds.playButtonSwitch(); setIsNewProjectModalOpen(false); }}
                className="absolute top-4 right-4 text-[var(--color-amber)] hover:scale-105"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-md font-black uppercase tracking-widest ${textStyle} flex items-center gap-2`}>
                <Terminal className="w-4 h-4" /> Registrar Novo Projeto
              </h3>
              
              <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Título do Projeto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: TVA Android APK, Dashboard Analytics"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2.5 rounded text-[var(--color-amber)] focus:border-[var(--color-amber)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Descrição Opcional</label>
                  <textarea
                    placeholder="Mapeamento das pendências técnicas e operacionais..."
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2.5 rounded text-[var(--color-amber)] focus:border-[var(--color-amber)] h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="px-4 py-2 border rounded border-gray-500 text-gray-400 uppercase tracking-widest text-xxs font-black"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border rounded font-black text-black bg-[var(--color-amber)] border-[var(--color-amber)] uppercase tracking-widest text-xxs"
                  >
                    Compilar Projeto
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT PROJECT */}
      <AnimatePresence>
        {isEditProjectModalOpen && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`border-2 rounded-xl p-5 max-w-md w-full bg-black ${borderStyle} flex flex-col gap-4 relative`}
            >
              <button 
                onClick={() => { sounds.playButtonSwitch(); setIsEditProjectModalOpen(false); }}
                className="absolute top-4 right-4 text-[var(--color-amber)]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-md font-black uppercase tracking-widest ${textStyle} flex items-center gap-2`}>
                <Terminal className="w-4 h-4" /> Editar Atributos de Projeto
              </h3>
              
              <form onSubmit={handleEditProjectSubmit} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Nome do Projeto</label>
                  <input
                    type="text"
                    required
                    value={editProjectName}
                    onChange={(e) => setEditProjectName(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2.5 text-[var(--color-amber)] focus:border-[var(--color-amber)] rounded"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Descrição</label>
                  <textarea
                    value={editProjectDesc}
                    onChange={(e) => setEditProjectDesc(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2.5 text-[var(--color-amber)] focus:border-[var(--color-amber)] rounded h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditProjectModalOpen(false)}
                    className="px-4 py-2 border rounded border-gray-500 text-gray-400 uppercase tracking-widest text-xxs font-black"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border rounded font-black text-black bg-[var(--color-amber)] border-[var(--color-amber)] uppercase tracking-widest text-xxs"
                  >
                    Salvar Mudanças
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: NEW PHASE */}
      <AnimatePresence>
        {isNewPhaseModalOpen && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`border-2 rounded-xl p-5 max-w-md w-full bg-black ${borderStyle} flex flex-col gap-4 relative`}
            >
              <button 
                onClick={() => { sounds.playButtonSwitch(); setIsNewPhaseModalOpen(false); }}
                className="absolute top-4 right-4 text-[var(--color-amber)]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-md font-black uppercase tracking-widest ${textStyle} flex items-center gap-2`}>
                <Layers className="w-4 h-4" /> Integrar Nova Fase
              </h3>
              
              <form onSubmit={handleCreatePhaseSubmit} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Nome da Fase *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Banco de Dados SQL, API Integration"
                    value={newPhaseName}
                    onChange={(e) => setNewPhaseName(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2.5 rounded text-[var(--color-amber)] focus:border-[var(--color-amber)]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Descrição da Fase</label>
                  <textarea
                    placeholder="Breve direcionamento das entregas dessa etapa..."
                    value={newPhaseDesc}
                    onChange={(e) => setNewPhaseDesc(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2.5 rounded text-[var(--color-amber)] focus:border-[var(--color-amber)] h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewPhaseModalOpen(false)}
                    className="px-4 py-2 border rounded border-gray-500 text-gray-400 uppercase tracking-widest text-xxs font-black"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border rounded font-black text-black bg-[var(--color-amber)] border-[var(--color-amber)] uppercase tracking-widest text-xxs"
                  >
                    Conectar Fase
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT PHASE */}
      <AnimatePresence>
        {editingPhaseId && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`border-2 rounded-xl p-5 max-w-md w-full bg-black ${borderStyle} flex flex-col gap-4 relative`}
            >
              <button 
                onClick={() => { sounds.playButtonSwitch(); setEditingPhaseId(null); }}
                className="absolute top-4 right-4 text-[var(--color-amber)]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-md font-black uppercase tracking-widest ${textStyle} flex items-center gap-2`}>
                <Layers className="w-4 h-4" /> Alterar Atributos de Fase
              </h3>
              
              <form onSubmit={handleEditPhaseSubmit} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Título da Fase</label>
                  <input
                    type="text"
                    required
                    value={editPhaseName}
                    onChange={(e) => setEditPhaseName(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/45 p-2.5 text-[var(--color-amber)] rounded"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Descrição</label>
                  <textarea
                    value={editPhaseDesc}
                    onChange={(e) => setEditPhaseDesc(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/45 p-2.5 text-[var(--color-amber)] rounded h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPhaseId(null)}
                    className="px-4 py-2 border rounded border-gray-500 text-gray-400 uppercase tracking-widest text-xxs font-black"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border rounded font-black text-black bg-[var(--color-amber)] border-[var(--color-amber)] uppercase tracking-widest text-xxs"
                  >
                    Atualizar Fase
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDIT ISSUE */}
      <AnimatePresence>
        {editingIssueId && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 font-mono">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`border-2 rounded-xl p-5 max-w-md w-full bg-black ${borderStyle} flex flex-col gap-4 relative`}
            >
              <button 
                onClick={() => { sounds.playButtonSwitch(); setEditingIssueId(null); }}
                className="absolute top-4 right-4 text-[var(--color-amber)]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-md font-black uppercase tracking-widest ${textStyle} flex items-center gap-2`}>
                <CheckSquare className="w-4 h-4" /> Alterar Dados de Pendência
              </h3>
              
              <form onSubmit={handleEditIssueSubmit} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Título da Pendência</label>
                  <input
                    type="text"
                    required
                    value={editIssueTitle}
                    onChange={(e) => setEditIssueTitle(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/45 p-2.5 text-[var(--color-amber)] rounded"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-bold">Notas / Descrição</label>
                  <textarea
                    value={editIssueDesc}
                    onChange={(e) => setEditIssueDesc(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/45 p-2.5 text-[var(--color-amber)] rounded h-20 resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingIssueId(null)}
                    className="px-4 py-2 border rounded border-gray-500 text-gray-400 uppercase tracking-widest text-xxs font-black"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border rounded font-black text-black bg-[var(--color-amber)] border-[var(--color-amber)] uppercase tracking-widest text-xxs"
                  >
                    Atualizar Pendência
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SYSTEM TASK BATCH GENERATOR */}
      <AnimatePresence>
        {activeIssueForTaskGen && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 font-mono overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`border-2 rounded-xl p-5 max-w-xl w-full bg-black ${borderStyle} flex flex-col gap-4 relative my-8`}
            >
              <button 
                onClick={() => { sounds.playButtonSwitch(); setActiveIssueForTaskGen(null); }}
                className="absolute top-4 right-4 text-[var(--color-amber)]"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className={`text-sm md:text-md font-black uppercase tracking-widest ${textStyle} flex items-center gap-2`}>
                <Sparkles className="w-4 h-4" /> Gerador de Tarefas Operacionais
              </h3>

              <div className="border p-2.5 rounded border-blue-900 bg-blue-950/10 text-[10px] text-blue-400 uppercase">
                <span className="font-bold">PENDÊNCIA ORIGEM:</span> {activeIssueForTaskGen.title}
              </div>

              {/* Subtasks batch collector layout */}
              <div className="flex flex-col gap-2 border-t border-b py-3 border-[var(--color-amber)]/10 text-xs">
                <label className="uppercase tracking-widest font-black text-[11px] text-[var(--color-amber)]">
                  1. LISTAR TAREFAS À GERAR (LOTE INTEGRADO)
                </label>
                <p className="text-[10px] opacity-75">
                  Adicione uma ou mais tarefas operacionais que serão sincronizadas diretamente no seu painel principal de rotina:
                </p>

                {/* Subtask list view */}
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto bg-black p-2 border border-[var(--color-amber)]/25 rounded-md">
                  {generatedSubTasks.map((t, index) => (
                    <div key={index} className="flex justify-between items-center p-1.5 border border-[var(--color-amber)]/10 bg-[#16120e] rounded text-xxs">
                      <span className="truncate max-w-[350px]">{t}</span>
                      <button 
                        onClick={() => handleRemoveSubTaskFromList(index)}
                        className="text-rose-500 hover:text-rose-400 font-bold"
                      >
                        REMOVER
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5 mt-1">
                  <input
                    type="text"
                    placeholder="Adicionar tarefa operativa ao lote (Ex: 'Criar tabela SQL')"
                    value={newSubTaskInput}
                    onChange={(e) => setNewSubTaskInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubTaskToList(); } }}
                    className="flex-1 bg-black/60 border border-[var(--color-amber)]/30 px-3 py-1.5 rounded-md text-[var(--color-amber)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubTaskToList}
                    className="px-3 border border-[var(--color-amber)] bg-[var(--color-amber)] text-black font-bold py-1 rounded"
                  >
                    ADD [+]
                  </button>
                </div>
              </div>

              {/* Parameters settings block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-black text-[11px] text-[var(--color-amber)]">Grupo de Cores *</label>
                  <select
                    value={taskGroupSelect}
                    required
                    onChange={(e) => {
                      setTaskGroupSelect(e.target.value);
                      const relatedCats = categories.filter(c => c.group_id === e.target.value);
                      setTaskCategorySelect(relatedCats.length > 0 ? relatedCats[0].id : '');
                    }}
                    className="bg-black border border-[var(--color-amber)]/40 p-2 text-[var(--color-amber)] rounded outline-none"
                  >
                    <option value="" disabled>--- Selecione o Grupo ---</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name.toUpperCase()} ({g.color})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-black text-[11px] text-[var(--color-amber)]">Categoria</label>
                  <select
                    value={taskCategorySelect}
                    onChange={(e) => setTaskCategorySelect(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2 text-[var(--color-amber)] rounded outline-none"
                  >
                    <option value="">Nenhuma Categoria</option>
                    {categories.filter(c => c.group_id === taskGroupSelect).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>
                    ))}
                  </select>
                </div>


                <div className="flex flex-col gap-1.5">
                  <label className="uppercase tracking-widest font-black text-[11px] text-[var(--color-amber)] font-bold">Prazo Limite / Deadline</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="bg-black border border-[var(--color-amber)]/40 p-2 text-[var(--color-amber)] rounded outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="uppercase tracking-widest font-black text-[11px] text-[var(--color-amber)] font-bold">Nível de Urgência</label>
                  <div className="flex gap-4 p-1 border border-[var(--color-amber)]/20 rounded bg-black/60">
                    {(['low', 'moderate', 'urgent'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setTaskUrgency(level)}
                        className={`flex-1 py-1 px-2.5 rounded font-bold uppercase text-[9px] tracking-wider border transition-all ${
                          taskUrgency === level
                            ? level === 'urgent'
                              ? 'bg-rose-950 border-rose-500 text-rose-500'
                              : level === 'moderate'
                                ? 'bg-amber-950/40 border-amber-500 text-amber-500'
                                : 'bg-green-950/40 border-green-500 text-green-500'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {level === 'low' ? 'Baixa' : level === 'moderate' ? 'Moderada' : 'Urgente'}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              <div className="flex gap-3 justify-end mt-4 border-t border-[var(--color-amber)]/10 pt-4">
                <button
                  type="button"
                  onClick={() => setActiveIssueForTaskGen(null)}
                  className="px-4 py-2 border rounded border-gray-500 text-gray-400 uppercase tracking-widest text-xxs font-black"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={generatedSubTasks.length === 0 || !taskGroupSelect}
                  onClick={submitGenerateTasks}
                  className={`px-4 py-2 border rounded font-black text-black uppercase tracking-widest text-xxs ${
                    generatedSubTasks.length > 0 && taskGroupSelect
                      ? 'bg-blue-500 border-blue-500 text-white cursor-pointer hover:bg-blue-600'
                      : 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800 text-gray-500'
                  }`}
                >
                  Gerar {generatedSubTasks.length} Tarefa(s) no HUD
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
