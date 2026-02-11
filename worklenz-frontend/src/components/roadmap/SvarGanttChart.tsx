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
    // Create mutable shallow-cloned tasks and convert date strings to Date objects expected by SVAR.
    return (rawTasks || []).map((t: any) => {
      const task = { ...t } as any;
      // convert string dates to Date objects; remove nulls to avoid NaN in SVAR
      if (task.start && typeof task.start === 'string') {
        const d = new Date(task.start);
        task.start = isNaN(d.getTime()) ? undefined : d;
      } else if (task.start instanceof Date) {
        // already Date
      } else {
        delete task.start;
      }
      if (task.end && typeof task.end === 'string') {
        const d = new Date(task.end);
        task.end = isNaN(d.getTime()) ? undefined : d;
      } else if (task.end instanceof Date) {
        // already Date
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
    const { id, start, end, progress } = event;

    try {
      // Optimistic update in Redux
      if (start !== undefined || end !== undefined) {
        dispatch(updateTaskDate({
          taskId: String(id),
          start: start ? new Date(start) : null,
          end: end ? new Date(end) : null
        }));

        // Persist to backend only if dates are provided
        if (start || end) {
          await apiClient.put(`/tasks/duration/${id}`, {
            start: start ? new Date(start).toISOString() : null,
            end: end ? new Date(end).toISOString() : null
          });
        }
      }

      if (progress !== undefined) {
        dispatch(updateTaskProgress({
          taskId: String(id),
          progress
        }));

        // Refresh progress on backend for the task's project
        const taskObj = tasks.find((t: any) => String(t.id) === String(id));
        const projectForTask = taskObj?.project_id || propProjectId;
        if (projectForTask) {
          await apiClient.post(`/tasks/refresh-progress/${projectForTask}`);
        }
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      // TODO: Show error notification to user
    }
  }, [dispatch, propProjectId, tasks]);

  /**
   * Handle lazy loading of subtasks
   */
  const handleRequestData = useCallback(async (event: any) => {
    const { id } = event;

    try {
      // Ignore requests originating from group header rows (ids like 'group-...')
      if (String(id).startsWith('group-')) {
        return;
      }

      const taskObj = tasks.find((t: any) => String(t.id) === String(id));
      if (!taskObj) {
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
      if (api) {
        api.exec('provide-data', {
          id,
          data: {
            tasks: transformedSubtasks,
            links
          }
        });
      }
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    }
  }, [dispatch, propProjectId, timeZone, api, tasks]);

  /**
   * Handle task selection (double-click to open drawer)
   */
  const handleTaskSelect = useCallback((event: any) => {
    if (event.action === 'dblclick') {
      // Open task drawer with the selected task
      dispatch(setShowTaskDrawer({
        show: true,
        taskId: String(event.id)
      }));
    } else if (event.action === 'contextmenu') {
      // Handle right-click context menu
      event.event.preventDefault();
      const task = tasks.find(t => t.id === event.id);
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
      // Task update events
      api.on('update-task', handleTaskUpdate);

      // Lazy loading
      api.on('request-data', handleRequestData);

      // Task selection
      api.on('select-task', handleTaskSelect);

      // Cleanup - SVAR handles event listener cleanup automatically
      return () => {
        // Event listeners are automatically cleaned up by SVAR when component unmounts
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
      init={setApi}
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