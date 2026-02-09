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
import { transformSvarTaskToBackend } from '@/features/roadmap/roadmap-transformers';
import { setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import apiClient from '@/api/api-client';
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
    return JSON.parse(JSON.stringify(rawTasks));
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
      if (start || end) {
        dispatch(updateTaskDate({
          taskId: String(id),
          start: new Date(start),
          end: new Date(end)
        }));

        // Persist to backend
        await apiClient.put(`/tasks/duration/${id}`, {
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString()
        });
      }

      if (progress !== undefined) {
        dispatch(updateTaskProgress({
          taskId: String(id),
          progress
        }));

        // Refresh progress on backend
        await apiClient.post(`/tasks/refresh-progress/${propProjectId}`);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      // TODO: Show error notification to user
      // TODO: Revert optimistic update
    }
  }, [dispatch, propProjectId]);

  /**
   * Handle lazy loading of subtasks
   */
  const handleRequestData = useCallback(async (event: any) => {
    const { id } = event;

    try {
      // Fetch subtasks from backend
      const result = await dispatch(fetchSubtasks({
        projectId: propProjectId,
        parentTaskId: String(id),
        timeZone
      })).unwrap();

      // Provide data back to SVAR
      if (api) {
        api.exec('provide-data', {
          id,
          data: result.subtasks
        });
      }
    } catch (error) {
      console.error('Failed to load subtasks:', error);
    }
  }, [dispatch, propProjectId, timeZone, api]);

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

      // Cleanup
      return () => {
        api.off('update-task', handleTaskUpdate);
        api.off('request-data', handleRequestData);
        api.off('select-task', handleTaskSelect);
      };
    }
  }, [api, handleTaskUpdate, handleRequestData, handleTaskSelect]);

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