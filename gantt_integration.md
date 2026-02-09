Integration Plan: SVAR React Gantt with Worklenz Backend API
Context
Worklenz currently has a roadmap view that uses an iframe-based SVAR external app with hardcoded demo data. The application also has a fully functional backend API at /roadmap-gannt/* endpoints that is production-ready but not integrated with the frontend.

Current State:

Frontend: Iframe wrapper at src/pages/projects/project-view-1/roadmap/ using postMessage communication
Backend: Complete API implementation at src/controllers/project-roadmap/roadmap-tasks-controller-v2.ts
Data: Hardcoded demo data in Redux slice (src/features/roadmap/roadmap-slice.ts)
Legacy: Unused gantt-task-react@0.3.9 implementation exists but is not active
Goal:
Replace the iframe-based roadmap with a native SVAR React Gantt implementation that:

Integrates directly with the existing backend API
Provides a seamless, performant user experience
Maintains the current feature set (task editing, subtasks, filters, dark mode)
Follows Worklenz's existing architecture patterns (Redux, Ant Design, TypeScript)
Why SVAR React Gantt?

Modern, actively maintained library with MIT license
Event-driven API design for better control
Hierarchical task support with lazy loading
Theming and customization capabilities
No external iframe dependencies
Architecture Overview

User Interaction
    ↓
SVAR React Gantt Component
    ↓ (events via api.on())
Event Handlers
    ↓
Redux Actions (updateTaskDate, updateTaskProgress, etc.)
    ↓
API Service Layer (roadmap.api.service.ts)
    ↓
Backend API (/roadmap-gannt/*)
    ↓
PostgreSQL Database
Implementation Plan
Phase 1: Setup and Installation
Step 1.1: Install SVAR React Gantt
File: /home/lorenzo/worklenz/worklenz-frontend/package.json

Add dependency:


npm install @svar-ui/react-gantt
Expected addition to package.json:


{
  "dependencies": {
    "@svar-ui/react-gantt": "^1.0.0"
  }
}
Step 1.2: Create API Service Layer
File to create: /home/lorenzo/worklenz/worklenz-frontend/src/api/roadmap/roadmap.api.service.ts


import { APIClient } from '@/lib/api-client';

const API_BASE_URL = '/roadmap-gannt';

export interface ChartDateRange {
  date_data: Array<{
    month: string;
    weeks: any[];
    days: Array<{
      day: number;
      name: string;
      isWeekend: boolean;
      isToday: boolean;
    }>;
  }>;
  width: number;
  scroll_by: number;
  chart_start: string;
  chart_end: string;
}

export interface BackendTask {
  id: string;
  name: string;
  project_id: string;
  parent_task_id: string | null;
  is_sub_task: boolean;
  sub_tasks_count: number;
  status: string;
  archived: boolean;
  phase_id: string | null;
  status_category: {
    is_done: boolean;
    is_doing: boolean;
    is_todo: boolean;
  };
  parent_task_completed: number;
  completed_sub_tasks: number;
  priority: string;
  priority_value: number;
  start_date: string;
  end_date: string;
  offset_from: number;
  width: number;
  index: number;
  isVisible: boolean;
}

export interface TaskGroup {
  id: string;
  name: string;
  category_id?: string;
  color_code: string;
  is_expanded: boolean;
  tasks: BackendTask[];
}

export interface RoadmapApiParams {
  projectId: string;
  timeZone: string;
  group?: 'status' | 'priority' | 'phase' | 'labels';
  archived?: boolean;
  search?: string;
}

export class RoadmapApiService {
  private client: APIClient;

  constructor() {
    this.client = new APIClient();
  }

  /**
   * Fetch date range and calendar data for Gantt chart timeline
   */
  async getChartDates(params: { projectId: string; timeZone: string }): Promise<ChartDateRange> {
    const response = await this.client.get<ChartDateRange>(
      `${API_BASE_URL}/chart-dates/${params.projectId}`,
      { params: { timeZone: params.timeZone } }
    );
    return response.data;
  }

  /**
   * Fetch tasks grouped by status, priority, phase, or labels
   */
  async getTaskGroups(params: RoadmapApiParams): Promise<TaskGroup[]> {
    const { projectId, timeZone, group = 'status', archived = false, search } = params;

    const response = await this.client.get<TaskGroup[]>(
      `${API_BASE_URL}/task-groups/${projectId}`,
      {
        params: {
          group,
          archived: archived ? 'true' : 'false',
          search,
          timezone: timeZone
        }
      }
    );
    return response.data;
  }

  /**
   * Fetch subtasks for a specific parent task
   */
  async getSubtasks(params: {
    projectId: string;
    parentTaskId: string;
    timeZone: string;
  }): Promise<BackendTask[]> {
    const response = await this.client.get<BackendTask[]>(
      `${API_BASE_URL}/task-groups/${params.projectId}`,
      {
        params: {
          parent_task: params.parentTaskId,
          timezone: params.timeZone
        }
      }
    );
    return response.data;
  }
}

export const roadmapApiService = new RoadmapApiService();
Phase 2: Data Transformation Layer
Step 2.1: Create Data Transformers
File to create: /home/lorenzo/worklenz/worklenz-frontend/src/features/roadmap/roadmap-transformers.ts


import { BackendTask, TaskGroup } from '@/api/roadmap/roadmap.api.service';

/**
 * SVAR Gantt task format
 */
export interface SvarTask {
  id: string | number;
  text: string;
  start?: Date;
  end?: Date;
  duration?: number;
  progress?: number;
  type?: 'task' | 'summary' | 'milestone';
  parent?: string | number;
  open?: boolean;
  lazy?: boolean;
  details?: string;

  // Custom Worklenz fields
  status_id?: string;
  priority?: string;
  priority_value?: number;
  phase_id?: string | null;
  status_category?: {
    is_done: boolean;
    is_doing: boolean;
    is_todo: boolean;
  };
  color_code?: string;
  sub_tasks_count?: number;
  completed_sub_tasks?: number;
}

/**
 * SVAR Gantt link format (for task dependencies)
 */
export interface SvarLink {
  id: string | number;
  source: string | number;
  target: string | number;
  type: string; // "e2e" (end-to-end), "e2s", "s2s", "s2e"
}

/**
 * Transform backend task to SVAR Gantt task format
 */
export function transformBackendTaskToSvar(
  task: BackendTask,
  groupId?: string,
  colorCode?: string
): SvarTask {
  const startDate = task.start_date ? new Date(task.start_date) : undefined;
  const endDate = task.end_date ? new Date(task.end_date) : undefined;

  // Calculate duration in days if both dates exist
  let duration: number | undefined;
  if (startDate && endDate) {
    duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  // Calculate progress percentage
  let progress = 0;
  if (task.sub_tasks_count > 0) {
    progress = Math.round((task.completed_sub_tasks / task.sub_tasks_count) * 100);
  } else if (task.status_category.is_done) {
    progress = 100;
  }

  // Determine task type
  let type: 'task' | 'summary' | 'milestone' = 'task';
  if (task.sub_tasks_count > 0) {
    type = 'summary';
  } else if (duration === 1) {
    type = 'milestone';
  }

  return {
    id: task.id,
    text: task.name,
    start: startDate,
    end: endDate,
    duration,
    progress,
    type,
    parent: task.parent_task_id || groupId || 0,
    open: true, // Expand by default
    lazy: task.sub_tasks_count > 0, // Enable lazy loading for tasks with subtasks
    details: `Priority: ${task.priority_value}, Status: ${task.status}`,

    // Custom Worklenz fields
    status_id: task.status,
    priority: task.priority,
    priority_value: task.priority_value,
    phase_id: task.phase_id,
    status_category: task.status_category,
    color_code: colorCode,
    sub_tasks_count: task.sub_tasks_count,
    completed_sub_tasks: task.completed_sub_tasks
  };
}

/**
 * Transform task groups from backend into flat SVAR task array with group headers
 */
export function transformTaskGroupsToSvar(taskGroups: TaskGroup[]): SvarTask[] {
  const svarTasks: SvarTask[] = [];

  taskGroups.forEach((group) => {
    // Add group header as a summary task
    const groupHeaderTask: SvarTask = {
      id: `group-${group.id}`,
      text: group.name,
      type: 'summary',
      parent: 0,
      open: group.is_expanded,
      color_code: group.color_code,
      // No dates for group headers
    };
    svarTasks.push(groupHeaderTask);

    // Add all tasks in this group
    group.tasks.forEach((task) => {
      const svarTask = transformBackendTaskToSvar(
        task,
        `group-${group.id}`,
        group.color_code
      );
      svarTasks.push(svarTask);
    });
  });

  return svarTasks;
}

/**
 * Extract task dependencies and transform to SVAR links
 * Note: Backend currently doesn't return dependency data, so this is prepared for future use
 */
export function extractTaskLinks(tasks: BackendTask[]): SvarLink[] {
  const links: SvarLink[] = [];

  // Placeholder: When backend adds dependency support, extract them here
  // tasks.forEach((task) => {
  //   if (task.dependencies) {
  //     task.dependencies.forEach((depId, index) => {
  //       links.push({
  //         id: `${task.id}-${depId}-${index}`,
  //         source: depId,
  //         target: task.id,
  //         type: "e2e"
  //       });
  //     });
  //   }
  // });

  return links;
}

/**
 * Transform SVAR task update event to backend API format
 */
export function transformSvarTaskToBackend(
  svarTask: Partial<SvarTask>
): {
  taskId: string;
  start?: string;
  end?: string;
  progress?: number;
} {
  return {
    taskId: String(svarTask.id),
    start: svarTask.start ? svarTask.start.toISOString() : undefined,
    end: svarTask.end ? svarTask.end.toISOString() : undefined,
    progress: svarTask.progress
  };
}
Phase 3: Redux Integration
Step 3.1: Update Redux Slice
File to modify: /home/lorenzo/worklenz/worklenz-frontend/src/features/roadmap/roadmap-slice.ts

Replace the current implementation with:


import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { roadmapApiService, TaskGroup, BackendTask } from '@/api/roadmap/roadmap.api.service';
import { SvarTask, transformTaskGroupsToSvar } from './roadmap-transformers';

interface RoadmapState {
  // SVAR tasks (transformed from backend)
  tasks: SvarTask[];

  // Original backend data (for reference)
  taskGroups: TaskGroup[];

  // UI state
  loading: boolean;
  error: string | null;
  viewMode: 'day' | 'week' | 'month';
  groupBy: 'status' | 'priority' | 'phase' | 'labels';
  showArchived: boolean;
  searchTerm: string;

  // Date range from backend
  chartStart: string | null;
  chartEnd: string | null;
}

const initialState: RoadmapState = {
  tasks: [],
  taskGroups: [],
  loading: false,
  error: null,
  viewMode: 'week',
  groupBy: 'status',
  showArchived: false,
  searchTerm: '',
  chartStart: null,
  chartEnd: null
};

/**
 * Fetch roadmap data from backend
 */
export const fetchRoadmapData = createAsyncThunk(
  'roadmap/fetchData',
  async (params: {
    projectId: string;
    timeZone: string;
    groupBy?: 'status' | 'priority' | 'phase' | 'labels';
    archived?: boolean;
    search?: string;
  }) => {
    // Fetch both chart dates and task groups in parallel
    const [chartDates, taskGroups] = await Promise.all([
      roadmapApiService.getChartDates({
        projectId: params.projectId,
        timeZone: params.timeZone
      }),
      roadmapApiService.getTaskGroups({
        projectId: params.projectId,
        timeZone: params.timeZone,
        group: params.groupBy || 'status',
        archived: params.archived || false,
        search: params.search
      })
    ]);

    return {
      taskGroups,
      chartStart: chartDates.chart_start,
      chartEnd: chartDates.chart_end,
      dateData: chartDates.date_data
    };
  }
);

/**
 * Fetch subtasks for lazy loading
 */
export const fetchSubtasks = createAsyncThunk(
  'roadmap/fetchSubtasks',
  async (params: {
    projectId: string;
    parentTaskId: string;
    timeZone: string;
  }) => {
    const subtasks = await roadmapApiService.getSubtasks(params);
    return {
      parentTaskId: params.parentTaskId,
      subtasks
    };
  }
);

const roadmapSlice = createSlice({
  name: 'roadmap',
  initialState,
  reducers: {
    setViewMode(state, action: PayloadAction<'day' | 'week' | 'month'>) {
      state.viewMode = action.payload;
    },

    setGroupBy(state, action: PayloadAction<'status' | 'priority' | 'phase' | 'labels'>) {
      state.groupBy = action.payload;
    },

    setShowArchived(state, action: PayloadAction<boolean>) {
      state.showArchived = action.payload;
    },

    setSearchTerm(state, action: PayloadAction<string>) {
      state.searchTerm = action.payload;
    },

    /**
     * Update task dates locally (optimistic update)
     */
    updateTaskDate(state, action: PayloadAction<{
      taskId: string;
      start: Date;
      end: Date;
    }>) {
      const task = state.tasks.find(t => t.id === action.payload.taskId);
      if (task) {
        task.start = action.payload.start;
        task.end = action.payload.end;

        // Recalculate duration
        const duration = Math.ceil(
          (action.payload.end.getTime() - action.payload.start.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        task.duration = duration;
      }
    },

    /**
     * Update task progress locally (optimistic update)
     */
    updateTaskProgress(state, action: PayloadAction<{
      taskId: string;
      progress: number;
    }>) {
      const task = state.tasks.find(t => t.id === action.payload.taskId);
      if (task) {
        task.progress = action.payload.progress;
      }
    },

    /**
     * Toggle task expansion
     */
    toggleTaskExpansion(state, action: PayloadAction<string>) {
      const task = state.tasks.find(t => t.id === action.payload);
      if (task) {
        task.open = !task.open;
      }
    },

    /**
     * Clear error state
     */
    clearError(state) {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch roadmap data
    builder.addCase(fetchRoadmapData.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchRoadmapData.fulfilled, (state, action) => {
      state.loading = false;
      state.taskGroups = action.payload.taskGroups;
      state.tasks = transformTaskGroupsToSvar(action.payload.taskGroups);
      state.chartStart = action.payload.chartStart;
      state.chartEnd = action.payload.chartEnd;
    });
    builder.addCase(fetchRoadmapData.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch roadmap data';
    });

    // Fetch subtasks
    builder.addCase(fetchSubtasks.fulfilled, (state, action) => {
      const { parentTaskId, subtasks } = action.payload;

      // Find the parent task and insert subtasks after it
      const parentIndex = state.tasks.findIndex(t => t.id === parentTaskId);
      if (parentIndex !== -1) {
        const parentTask = state.tasks[parentIndex];
        const colorCode = parentTask.color_code;

        // Transform subtasks to SVAR format
        const svarSubtasks = subtasks.map(subtask =>
          transformBackendTaskToSvar(subtask, parentTaskId, colorCode)
        );

        // Insert subtasks after parent
        state.tasks.splice(parentIndex + 1, 0, ...svarSubtasks);
      }
    });
  }
});

export const {
  setViewMode,
  setGroupBy,
  setShowArchived,
  setSearchTerm,
  updateTaskDate,
  updateTaskProgress,
  toggleTaskExpansion,
  clearError
} = roadmapSlice.actions;

export default roadmapSlice.reducer;
Phase 4: SVAR Gantt Component
Step 4.1: Create Main Gantt Component
File to create: /home/lorenzo/worklenz/worklenz-frontend/src/components/roadmap/SvarGanttChart.tsx


import React, { useEffect, useState, useCallback } from 'react';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
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
import { apiClient } from '@/lib/api-client';
import './SvarGanttChart.css';

interface SvarGanttChartProps {
  projectId: string;
}

export const SvarGanttChart: React.FC<SvarGanttChartProps> = ({ projectId }) => {
  const dispatch = useAppDispatch();
  const [api, setApi] = useState<any>(null);

  // Redux state
  const tasks = useAppSelector(state => state.roadmapReducer.tasks);
  const viewMode = useAppSelector(state => state.roadmapReducer.viewMode);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const timeZone = useAppSelector(state => state.userReducer.timezone || 'UTC');

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
        await apiClient.post(`/tasks/refresh-progress/${projectId}`);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      // TODO: Show error notification to user
      // TODO: Revert optimistic update
    }
  }, [dispatch, projectId]);

  /**
   * Handle lazy loading of subtasks
   */
  const handleRequestData = useCallback(async (event: any) => {
    const { id } = event;

    try {
      // Fetch subtasks from backend
      const result = await dispatch(fetchSubtasks({
        projectId,
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
  }, [dispatch, projectId, timeZone, api]);

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
    }
  }, [dispatch]);

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

  return (
    <div className="svar-gantt-wrapper">
      {themeMode === 'dark' ? (
        <WillowDark>{GanttComponent}</WillowDark>
      ) : (
        <Willow>{GanttComponent}</Willow>
      )}
    </div>
  );
};
Step 4.2: Create Component Styles
File to create: /home/lorenzo/worklenz/worklenz-frontend/src/components/roadmap/SvarGanttChart.css


.svar-gantt-wrapper {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* Customize SVAR Gantt colors to match Worklenz theme */
.wx-willow {
  --wx-color-primary: #1890ff;
  --wx-color-primary-hover: #40a9ff;
  --wx-color-font: #181818;
  --wx-color-font-alt: #8c8c8c;
  --wx-background: #ffffff;
  --wx-background-alt: #fafafa;
  --wx-border: #e0e0e0;
}

.wx-willow-dark {
  --wx-color-primary: #177ddc;
  --wx-color-primary-hover: #1890ff;
  --wx-color-font: #ffffff;
  --wx-color-font-alt: #8c8c8c;
  --wx-background: #141414;
  --wx-background-alt: #1d1d1d;
  --wx-border: #505050;
}

/* Customize progress bar colors based on status */
.task-status-todo .wx-bar {
  background-color: #a9a9a9;
}

.task-status-doing .wx-bar {
  background-color: #70a6f3;
}

.task-status-done .wx-bar {
  background-color: #75c997;
}

/* Adjust grid column widths for better readability */
.wx-grid-cell {
  padding: 8px 12px;
}

/* Today indicator */
.wx-today-line {
  stroke: rgba(64, 150, 255, 0.4);
  stroke-width: 2;
}
Phase 5: Page Integration
Step 5.1: Update Roadmap Page Component
File to modify: /home/lorenzo/worklenz/worklenz-frontend/src/pages/projects/project-view-1/roadmap/project-view-roadmap.tsx

Replace the current iframe implementation with:


import React, { useEffect } from 'react';
import { Spin, Alert, Space, Select, Input, Checkbox } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchRoadmapData,
  setViewMode,
  setGroupBy,
  setShowArchived,
  setSearchTerm,
  clearError
} from '@/features/roadmap/roadmap-slice';
import { SvarGanttChart } from '@/components/roadmap/SvarGanttChart';
import TimeFilter from './time-filter';
import './project-view-roadmap.css';

const ProjectViewRoadmap: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux state
  const projectId = useAppSelector(state => state.projectViewReducer.selectedProject?.id);
  const timeZone = useAppSelector(state => state.userReducer.timezone || 'UTC');
  const loading = useAppSelector(state => state.roadmapReducer.loading);
  const error = useAppSelector(state => state.roadmapReducer.error);
  const viewMode = useAppSelector(state => state.roadmapReducer.viewMode);
  const groupBy = useAppSelector(state => state.roadmapReducer.groupBy);
  const showArchived = useAppSelector(state => state.roadmapReducer.showArchived);
  const searchTerm = useAppSelector(state => state.roadmapReducer.searchTerm);

  /**
   * Fetch roadmap data on mount and when filters change
   */
  useEffect(() => {
    if (projectId) {
      dispatch(fetchRoadmapData({
        projectId,
        timeZone,
        groupBy,
        archived: showArchived,
        search: searchTerm
      }));
    }
  }, [dispatch, projectId, timeZone, groupBy, showArchived, searchTerm]);

  /**
   * Handle view mode change
   */
  const handleViewModeChange = (mode: 'day' | 'week' | 'month') => {
    dispatch(setViewMode(mode));
  };

  /**
   * Handle group by change
   */
  const handleGroupByChange = (value: 'status' | 'priority' | 'phase' | 'labels') => {
    dispatch(setGroupBy(value));
  };

  /**
   * Handle search input
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchTerm(e.target.value));
  };

  /**
   * Handle archived toggle
   */
  const handleArchivedToggle = (checked: boolean) => {
    dispatch(setShowArchived(checked));
  };

  if (!projectId) {
    return (
      <div className="roadmap-container">
        <Alert
          message="No project selected"
          description="Please select a project to view the roadmap."
          type="info"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="roadmap-container">
      {/* Toolbar */}
      <div className="roadmap-toolbar">
        <Space>
          {/* View mode selector */}
          <TimeFilter
            view={viewMode}
            onViewChange={handleViewModeChange}
          />

          {/* Group by selector */}
          <Select
            value={groupBy}
            onChange={handleGroupByChange}
            style={{ width: 150 }}
          >
            <Select.Option value="status">By Status</Select.Option>
            <Select.Option value="priority">By Priority</Select.Option>
            <Select.Option value="phase">By Phase</Select.Option>
            <Select.Option value="labels">By Labels</Select.Option>
          </Select>

          {/* Search input */}
          <Input.Search
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ width: 250 }}
            allowClear
          />

          {/* Show archived checkbox */}
          <Checkbox
            checked={showArchived}
            onChange={(e) => handleArchivedToggle(e.target.checked)}
          >
            Show Archived
          </Checkbox>
        </Space>
      </div>

      {/* Error display */}
      {error && (
        <Alert
          message="Error loading roadmap"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => dispatch(clearError())}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Gantt chart */}
      <div className="roadmap-gantt-container">
        {loading ? (
          <div className="roadmap-loading">
            <Spin size="large" tip="Loading roadmap..." />
          </div>
        ) : (
          <SvarGanttChart projectId={projectId} />
        )}
      </div>
    </div>
  );
};

export default ProjectViewRoadmap;
Step 5.2: Update Styles
File to modify: /home/lorenzo/worklenz/worklenz-frontend/src/pages/projects/project-view-1/roadmap/project-view-roadmap.css


.roadmap-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 16px;
  background: var(--wx-background);
}

.roadmap-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--wx-background-alt);
  border: 1px solid var(--wx-border);
  border-radius: 4px;
  margin-bottom: 16px;
}

.roadmap-gantt-container {
  flex: 1;
  overflow: hidden;
  border: 1px solid var(--wx-border);
  border-radius: 4px;
  background: var(--wx-background);
}

.roadmap-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

/* Theme-specific styles */
:root {
  --wx-background: #ffffff;
  --wx-background-alt: #fafafa;
  --wx-border: #e0e0e0;
}

.dark-theme {
  --wx-background: #141414;
  --wx-background-alt: #1d1d1d;
  --wx-border: #505050;
}
Phase 6: Backend Integration Points
Step 6.1: Task Date Update API
Existing Backend Endpoint: PUT /tasks/duration/:taskId

File: /home/lorenzo/worklenz/worklenz-backend/src/controllers/tasks-controller-v2.ts

This endpoint already exists and handles task date updates. The frontend will call it when SVAR fires the update-task event.

Request Body:


{
  "start": "2026-02-01T00:00:00.000Z",
  "end": "2026-02-15T23:59:59.999Z"
}
Step 6.2: Task Progress Update API
Existing Backend Endpoint: POST /tasks/refresh-progress/:projectId

This endpoint recalculates task progress based on subtask completion. The frontend calls it after SVAR updates task progress.

Step 6.3: Subtask Query
Endpoint: GET /roadmap-gannt/task-groups/:projectId?parent_task=<parentTaskId>

This endpoint is already implemented for lazy loading subtasks. SVAR will call it when expanding a task with lazy: true.

Phase 7: Migration Strategy
Option A: Gradual Migration (Recommended)
Step 1: Deploy SVAR implementation alongside existing iframe (feature flag)
Step 2: Enable for beta users to gather feedback
Step 3: Fix any issues identified during beta testing
Step 4: Enable for all users
Step 5: Remove iframe implementation and cleanup
Feature Flag Implementation:


// In .env
VITE_ENABLE_SVAR_ROADMAP=false

// In project-view-roadmap.tsx
const enableSvarRoadmap = import.meta.env.VITE_ENABLE_SVAR_ROADMAP === 'true';

return enableSvarRoadmap ? <SvarGanttChart /> : <IframeRoadmap />;
Option B: Direct Replacement
Replace iframe implementation immediately
Deploy to staging for testing
Deploy to production after QA approval
Phase 8: Testing & Verification
Test Checklist
Functional Tests:

 Roadmap loads with correct project data
 Tasks display with proper dates, names, and progress
 Task grouping works (status, priority, phase, labels)
 Task date dragging updates backend correctly
 Task progress updates sync with backend
 Double-clicking task opens task drawer
 Subtasks load lazily when expanding parent tasks
 View mode switching (day/week/month) works
 Search filters tasks correctly
 Show archived checkbox includes/excludes archived tasks
 Dark mode theme applies correctly
Backend Integration Tests:


# Test chart dates endpoint
curl -X GET "http://localhost:3000/api/roadmap-gannt/chart-dates/<project-id>?timeZone=UTC"

# Test task groups endpoint
curl -X GET "http://localhost:3000/api/roadmap-gannt/task-groups/<project-id>?group=status&timezone=UTC"

# Test task date update
curl -X PUT "http://localhost:3000/api/tasks/duration/<task-id>" \
  -H "Content-Type: application/json" \
  -d '{"start": "2026-02-01T00:00:00.000Z", "end": "2026-02-15T23:59:59.999Z"}'

# Test progress refresh
curl -X POST "http://localhost:3000/api/tasks/refresh-progress/<project-id>"
Performance Tests:

 Roadmap loads within 2 seconds for projects with < 100 tasks
 Roadmap loads within 5 seconds for projects with < 500 tasks
 Lazy loading subtasks completes within 1 second
 Task updates persist to backend within 500ms
 No memory leaks after 10 minutes of usage
Browser Compatibility:

 Chrome (latest 2 versions)
 Firefox (latest 2 versions)
 Safari (latest 2 versions)
 Edge (latest 2 versions)
Phase 9: Documentation Updates
Update Files:
CLAUDE.md - Update roadmap section to reflect SVAR implementation
README.md (if exists) - Add SVAR React Gantt to dependencies
package.json - Ensure SVAR is documented in dependencies
Critical Files Summary
Files to Create:
/home/lorenzo/worklenz/worklenz-frontend/src/api/roadmap/roadmap.api.service.ts - API service layer
/home/lorenzo/worklenz/worklenz-frontend/src/features/roadmap/roadmap-transformers.ts - Data transformers
/home/lorenzo/worklenz/worklenz-frontend/src/components/roadmap/SvarGanttChart.tsx - Main Gantt component
/home/lorenzo/worklenz/worklenz-frontend/src/components/roadmap/SvarGanttChart.css - Component styles
Files to Modify:
/home/lorenzo/worklenz/worklenz-frontend/package.json - Add @svar-ui/react-gantt dependency
/home/lorenzo/worklenz/worklenz-frontend/src/features/roadmap/roadmap-slice.ts - Update Redux slice
/home/lorenzo/worklenz/worklenz-frontend/src/pages/projects/project-view-1/roadmap/project-view-roadmap.tsx - Replace iframe with SVAR
/home/lorenzo/worklenz/worklenz-frontend/src/pages/projects/project-view-1/roadmap/project-view-roadmap.css - Update page styles
Backend Files (No Changes Needed):
/home/lorenzo/worklenz/worklenz-backend/src/controllers/project-roadmap/roadmap-tasks-controller-v2.ts - Already functional
/home/lorenzo/worklenz/worklenz-backend/src/routes/apis/gannt-apis/roadmap-api-router.ts - Already configured
Implementation Order
Install package (5 minutes)
Create API service (30 minutes)
Create data transformers (45 minutes)
Update Redux slice (60 minutes)
Create SVAR component (90 minutes)
Update page component (45 minutes)
Update styles (30 minutes)
Testing (120 minutes)
Documentation (30 minutes)
Total Estimated Time: 7-8 hours

Rollback Plan
If issues arise after deployment:

Feature Flag Rollback: Set VITE_ENABLE_SVAR_ROADMAP=false in environment
Code Rollback: Revert to previous commit before SVAR integration
Database: No database changes are made, so no rollback needed
Backend: Backend API remains unchanged, so no backend rollback needed
Success Criteria
✅ Roadmap loads real data from backend API
✅ All CRUD operations sync with backend correctly
✅ Performance meets or exceeds current implementation
✅ Dark mode works correctly
✅ Task drawer integration works seamlessly
✅ No console errors or warnings
✅ Mobile responsive (optional stretch goal)
✅ 100% feature parity with current implementation