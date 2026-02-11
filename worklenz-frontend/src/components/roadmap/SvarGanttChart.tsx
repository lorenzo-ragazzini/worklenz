import React, { useEffect, useState, useCallback } from 'react';
import { Gantt, Willow, WillowDark, ContextMenu } from '@svar-ui/react-gantt';
import '@svar-ui/react-gantt/all.css';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchSubtasks,
  updateTaskDate,
  updateTaskProgress,
  setViewMode
} from '@/features/roadmap/roadmap-slice';
import { transformSvarTaskToBackend, transformBackendTaskToSvar } from '@/features/roadmap/roadmap-transformers';
import { setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import apiClient from '@/api/api-client';
import { taskDependenciesApiService } from '@/api/tasks/task-dependencies.api.service';
import { TaskContextMenu } from './TaskContextMenu';
import './SvarGanttChart.css';

interface SvarGanttChartProps {
  projectId: string;
}

export const SvarGanttChart: React.FC<SvarGanttChartProps> = ({ projectId: propProjectId }) => {
  const dispatch = useAppDispatch();
  const [api, setApi] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    task: any;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    task: null,
  });

  // Redux state
  const rawTasks = useAppSelector(state => state.roadmapReducer.tasks);
  const loading = useAppSelector(state => state.roadmapReducer.loading);
  const error = useAppSelector(state => state.roadmapReducer.error);
  const viewMode = useAppSelector(state => state.roadmapReducer.viewMode);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const timeZone = useAppSelector(state => state.userReducer.timezone || 'UTC');

  // Deep clone tasks to avoid SVAR trying to modify frozen Redux objects
  const tasks = React.useMemo(() => {
    // Create mutable shallow-cloned tasks and convert date strings/numbers to Date objects expected by SVAR.
    return (rawTasks || []).map((t: any) => {
      const task = { ...t } as any;
      // convert string or numeric dates to Date objects; remove null/invalids to avoid NaN in SVAR
      if (task.start !== undefined && task.start !== null) {
        if (typeof task.start === 'string' || typeof task.start === 'number') {
          const d = new Date(task.start);
          task.start = isNaN(d.getTime()) ? undefined : d;
        } else if (task.start instanceof Date) {
          // already Date
        } else {
          delete task.start;
        }
      } else {
        delete task.start;
      }

      if (task.end !== undefined && task.end !== null) {
        if (typeof task.end === 'string' || typeof task.end === 'number') {
          const d = new Date(task.end);
          task.end = isNaN(d.getTime()) ? undefined : d;
        } else if (task.end instanceof Date) {
          // already Date
        } else {
          delete task.end;
        }
      } else {
        delete task.end;
      }

      return task;
    });
  }, [rawTasks]);

  /**
   * Configure SVAR scales based on view mode
   */
  const scales = React.useMemo(() => {
    const scaleConfigs = {
      day: [
        { unit: 'month', step: 1, format: '%F %Y' },
        { unit: 'day', step: 1, format: '%d %D' }
      ],
      week: [
        { unit: 'month', step: 1, format: '%F %Y' },
        { unit: 'week', step: 1, format: 'Week %W' }
      ],
      month: [
        { unit: 'year', step: 1, format: '%Y' },
        { unit: 'month', step: 1, format: '%F' }
      ]
    };
    return scaleConfigs[viewMode];
  }, [viewMode]);

  /**
   * Configure grid columns
   */
  const columns = [
    { id: 'text', header: 'Task Name', width: 300, flexgrow: 1 },
    { id: 'start', header: 'Start Date', width: 100, align: 'center' },
    { id: 'end', header: 'End Date', width: 100, align: 'center' },
    { id: 'progress', header: 'Progress', width: 80, align: 'center' }
  ];

  /**
   * Handle task update events from SVAR
   */
  const handleTaskUpdate = useCallback(async (event: any) => {
    console.log('[SvarGantt] handleTaskUpdate event:', event);
    const id = event?.id;

    if (!id) {
      console.warn('[SvarGantt] update event missing id', event);
      return;
    }

    // Ignore group headers
    if (String(id).startsWith('group-')) {
      console.log('[SvarGantt] ignoring group header update for', id);
      return;
    }

    // Derive new dates/progress from possible event shapes
    let newStart: Date | null | undefined = undefined;
    let newEnd: Date | null | undefined = undefined;
    let newProgress: number | undefined = undefined;

    // Shape 1: event has direct start/end/progress
    if (event.start !== undefined || event.end !== undefined || event.progress !== undefined) {
      newStart = event.start !== undefined ? (event.start ? new Date(event.start) : null) : undefined;
      newEnd = event.end !== undefined ? (event.end ? new Date(event.end) : null) : undefined;
      newProgress = event.progress;

    // Shape 2: event.task contains updated values
    } else if (event.task) {
      const t = event.task;
      if (t.start !== undefined || t.end !== undefined || t.progress !== undefined) {
        newStart = t.start !== undefined ? (t.start ? new Date(t.start) : null) : undefined;
        newEnd = t.end !== undefined ? (t.end ? new Date(t.end) : null) : undefined;
        newProgress = t.progress;
      } else if (event.diff !== undefined) {
        // Some SVAR events provide a numeric diff (days moved). Compute from current task.
        const original = tasks.find((x: any) => String(x.id) === String(id));
        const diff = Number(event.diff) || 0;
        if (original) {
          if (original.start) newStart = new Date(original.start.getTime() + diff * 24 * 60 * 60 * 1000);
          if (original.end) newEnd = new Date(original.end.getTime() + diff * 24 * 60 * 60 * 1000);
        } else {
          console.warn('[SvarGantt] cannot compute dates from diff - original task not found', id);
        }
      }

    // Shape 3: event only has diff at top level
    } else if (event.diff !== undefined) {
      const original = tasks.find((x: any) => String(x.id) === String(id));
      const diff = Number(event.diff) || 0;
      if (original) {
        if (original.start) newStart = new Date(original.start.getTime() + diff * 24 * 60 * 60 * 1000);
        if (original.end) newEnd = new Date(original.end.getTime() + diff * 24 * 60 * 60 * 1000);
      } else {
        console.warn('[SvarGantt] cannot compute dates from diff - original task not found', id);
      }
    }

    try {
      // Optimistic update in Redux
      if (newStart !== undefined || newEnd !== undefined) {
        dispatch(updateTaskDate({
          taskId: String(id),
          start: newStart ?? null,
          end: newEnd ?? null
        }));

        // Persist to backend only if dates are provided
        if (newStart || newEnd) {
          console.log('[SvarGantt] Persisting dates to backend for', id, { start: newStart, end: newEnd });
          await apiClient.put(`/api/v1/tasks/duration/${id}`, {
            start: newStart ? newStart.toISOString() : null,
            end: newEnd ? newEnd.toISOString() : null
          });
        }
      }

      if (newProgress !== undefined) {
        console.log('[SvarGantt] Updating progress to', newProgress, 'for', id);
        dispatch(updateTaskProgress({
          taskId: String(id),
          progress: newProgress
        }));

        // Refresh progress on backend for the task's project
        const taskObj = tasks.find((t: any) => String(t.id) === String(id));
        const projectForTask = taskObj?.project_id || propProjectId;
        if (projectForTask) {
          await apiClient.post(`/api/v1/tasks/refresh-progress/${projectForTask}`);
        }
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, [dispatch, propProjectId, tasks]);

  /**
   * Handle lazy loading of subtasks
   */
  const handleRequestData = useCallback(async (event: any) => {
    console.log('[SvarGantt] handleRequestData event:', event);
    const { id } = event;

    try {
      // Ignore requests originating from group header rows (ids like 'group-...')
      if (String(id).startsWith('group-')) {
        return;
      }

      const taskObj = tasks.find((t: any) => String(t.id) === String(id));
      if (!taskObj) {
        console.warn('[SvarGantt] No matching task for request-data id', id);
        // No matching task to load subtasks for
        return;
      }

      const projectForTask = taskObj?.project_id || propProjectId;

      // Fetch subtasks from backend
      const result = await dispatch(fetchSubtasks({
        projectId: projectForTask,
        parentTaskId: String(id),
        timeZone
      })).unwrap();

      // Transform subtasks to SVAR format before providing to SVAR
      const transformedSubtasks = (result.subtasks || []).map((subtask: any) =>
        transformBackendTaskToSvar(subtask, String(id), result.subtasks[0]?.color_code || '#1890ff')
      );

      // Fetch dependency records for each subtask and convert to SVAR links
      const links: any[] = [];
      await Promise.all(transformedSubtasks.map(async (t) => {
        try {
          const depsResp: any = await taskDependenciesApiService.getTaskDependencies(String(t.id));
          const depsArray = depsResp?.body ?? depsResp?.data ?? depsResp;
          if (Array.isArray(depsArray)) {
            depsArray.forEach((d: any, idx: number) => {
              const source = d.related_task_id || d.relatedTaskId || d.related_task;
              const target = t.id;
              if (source) {
                links.push({ id: `${target}-${source}-${idx}`, source, target, type: 'e2e' });
              }
            });
          }
        } catch (err) {
          // ignore per-task dependency fetch failures
        }
      }));

      // Provide data back to SVAR (SVAR expects data.tasks and data.links)
      if (api && typeof api.exec === 'function') {
        console.log('[SvarGantt] Providing data for', id, { tasks: transformedSubtasks.length, links: links.length });
        api.exec('provide-data', {
          id,
          data: {
            tasks: transformedSubtasks,
            links
          }
        });
      } else {
        console.warn('[SvarGantt] API not ready or has no exec method to provide data', { api });
      }
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    }
  }, [dispatch, propProjectId, timeZone, api, tasks]);

  /**
   * Handle task selection (double-click to open drawer)
   */
  const handleTaskSelect = useCallback((event: any) => {
    console.log('[SvarGantt] handleTaskSelect event:', event);
    if (event.action === 'dblclick') {
      // Open task drawer with the selected task
      dispatch(setShowTaskDrawer({
        show: true,
        taskId: String(event.id)
      }));
    } else if (event.action === 'contextmenu') {
      // Handle right-click context menu
      event.event.preventDefault();
      const task = tasks.find(t => String(t.id) === String(event.id));
      if (task) {
        setContextMenu({
          visible: true,
          position: { x: event.event.clientX, y: event.event.clientY },
          task,
        });
      }
    }
  }, [dispatch, tasks]);

  /**
   * Handle context menu close
   */
  const handleContextMenuClose = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  /**
   * Set up event listeners when API is ready
   */
  useEffect(() => {
    if (api) {
      console.log('[SvarGantt] API ready', { hasOn: typeof api.on, hasExec: typeof api.exec, api });
      const attach = (name: string, handler: any) => {
        try {
          if (typeof api.on === 'function') {
            api.on(name, handler);
            console.log('[SvarGantt] attached listener', name);
          } else if (typeof api.addEventListener === 'function') {
            api.addEventListener(name, handler);
            console.log('[SvarGantt] attached with addEventListener', name);
          } else if (typeof api.addListener === 'function') {
            api.addListener(name, handler);
            console.log('[SvarGantt] attached with addListener', name);
          } else {
            console.warn('[SvarGantt] no known attach method for', name);
          }
        } catch (err) {
          console.error('[SvarGantt] failed to attach listener', name, err);
        }
      };

      const detach = (name: string, handler: any) => {
        try {
          if (typeof api.off === 'function') {
            api.off(name, handler);
          } else if (typeof api.removeEventListener === 'function') {
            api.removeEventListener(name, handler);
          } else if (typeof api.removeListener === 'function') {
            api.removeListener(name, handler);
          }
        } catch (err) {
          // ignore
        }
      };

      const updateNames = ['update-task', 'updateTask', 'task:update', 'task-updated'];
      updateNames.forEach(n => attach(n, handleTaskUpdate));

      const requestNames = ['request-data', 'requestData', 'request-data'];
      requestNames.forEach(n => attach(n, handleRequestData));

      const selectNames = ['select-task', 'selectTask', 'task-select', 'select-task'];
      selectNames.forEach(n => attach(n, handleTaskSelect));

      return () => {
        updateNames.forEach(n => detach(n, handleTaskUpdate));
        requestNames.forEach(n => detach(n, handleRequestData));
        selectNames.forEach(n => detach(n, handleTaskSelect));
      };
    }
  }, [api, handleTaskUpdate, handleRequestData, handleTaskSelect]);

  // When the SVAR API is ready, fetch dependencies for currently-loaded tasks and provide links so relationships render
  useEffect(() => {
    if (!api) return;
    let mounted = true;

    (async () => {
      try {
        const links: any[] = [];

        // Fetch dependencies for each top-level task (ignore group headers and failures per-task)
        const tasksToQuery = (tasks || []).filter((t: any) => !String(t.id).startsWith('group-'));

        await Promise.all(tasksToQuery.map(async (t: any) => {
          try {
            const depsResp: any = await taskDependenciesApiService.getTaskDependencies(String(t.id));
            const depsArray = depsResp?.body ?? depsResp?.data ?? depsResp;
            if (Array.isArray(depsArray)) {
              depsArray.forEach((d: any, idx: number) => {
                const source = d.related_task_id || d.relatedTaskId || d.related_task;
                const target = t.id;
                if (source) {
                  links.push({ id: `${target}-${source}-${idx}`, source, target, type: 'e2e' });
                }
              });
            }
          } catch (err) {
            // ignore per-task dependency fetch failures
          }
        }));

        if (!mounted) return;
        if (links.length > 0) {
          try {
            api.exec('provide-data', { data: { links } });
          } catch (err) {
            console.error('Failed to provide dependency links to SVAR API', err);
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial task dependencies', err);
      }
    })();

    return () => { mounted = false; };
  }, [api, tasks]);

  /**
   * Render with appropriate theme
   */
  const GanttComponent = (
    <Gantt
      tasks={tasks}
      scales={scales}
      columns={columns}
      init={(api) => { setApi(api); console.log('SvarGantt API:', api); }}
    />
  );

  // Show loading state if still loading
  if (loading) {
    return (
      <div className="svar-gantt-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
        <div>Loading Gantt Chart...</div>
      </div>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="svar-gantt-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'red' }}>
        <div>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="svar-gantt-wrapper">
      {themeMode === 'dark' ? (
        <WillowDark>{GanttComponent}</WillowDark>
      ) : (
        <Willow>{GanttComponent}</Willow>
      )}

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.task && (
        <TaskContextMenu
          task={contextMenu.task}
          projectId={propProjectId}
          position={contextMenu.position}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
};