import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { roadmapApiService, TaskGroup, BackendTask } from '@/api/roadmap/roadmap.api.service';
import { SvarTask, transformTaskGroupsToSvar, transformBackendTaskToSvar } from './roadmap-transformers';

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
  selectedProjectIds?: string[];

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
  selectedProjectIds: [],
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
 * Fetch roadmap data for multiple projects (aggregated)
 */
export const fetchRoadmapsForProjects = createAsyncThunk(
  'roadmap/fetchForProjects',
  async (params: {
    projects: { id: string; name?: string }[];
    timeZone: string;
    groupBy?: 'status' | 'priority' | 'phase' | 'labels';
    archived?: boolean;
    search?: string;
  }) => {
    const projectIds = params.projects.map(p => p.id);

    // Call aggregated backend endpoints
    const [chartDates, aggregated] = await Promise.all([
      roadmapApiService.getChartDatesForProjects({ projectIds, timeZone: params.timeZone }),
      roadmapApiService.getTaskGroupsForProjects({ projectIds, timeZone: params.timeZone, group: params.groupBy || 'status', archived: params.archived || false, search: params.search })
    ]);

    // aggregated is expected to be an array of { projectId, projectName, taskGroups, tasks, color_code }
    const aggregatedTaskGroups: TaskGroup[] = (aggregated || []).map((r: any) => ({
      id: r.projectId,
      name: r.projectName || r.projectId,
      color_code: r.color_code,
      is_expanded: true,
      tasks: r.tasks || []
    }));

    const overallStart = chartDates?.chart_start || null;
    const overallEnd = chartDates?.chart_end || null;

    return {
      taskGroups: aggregatedTaskGroups,
      chartStart: overallStart,
      chartEnd: overallEnd
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

    setSelectedProjectIds(state, action: PayloadAction<string[]>) {
      state.selectedProjectIds = action.payload;
    },

    /**
     * Update task dates locally (optimistic update)
     */
    updateTaskDate(state, action: PayloadAction<{
      taskId: string;
      start: Date | null;
      end: Date | null;
    }>) {
      const task = state.tasks.find(t => t.id === action.payload.taskId);
      if (task) {
        task.start = action.payload.start ? action.payload.start.toISOString().split('T')[0] : null; // Convert to YYYY-MM-DD or null
        task.end = action.payload.end ? action.payload.end.toISOString().split('T')[0] : null; // Convert to YYYY-MM-DD or null

        // Recalculate duration if both dates exist
        if (action.payload.start && action.payload.end) {
          const duration = Math.ceil(
            (action.payload.end.getTime() - action.payload.start.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;
          task.duration = duration;
        } else {
          task.duration = undefined; // Clear duration for undated tasks
        }
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
      console.log('[Roadmap] Redux fulfilled - taskGroups:', action.payload.taskGroups);
      state.loading = false;
      state.taskGroups = action.payload.taskGroups;
      state.tasks = transformTaskGroupsToSvar(action.payload.taskGroups);
      console.log('[Roadmap] Redux fulfilled - transformed tasks:', state.tasks);
      state.chartStart = action.payload.chartStart;
      state.chartEnd = action.payload.chartEnd;
    });
    builder.addCase(fetchRoadmapData.rejected, (state, action) => {
      console.error('[Roadmap] Redux rejected - error:', action.error);
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch roadmap data';
    });

    // Fetch roadmap data for multiple projects
    builder.addCase(fetchRoadmapsForProjects.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchRoadmapsForProjects.fulfilled, (state, action) => {
      state.loading = false;
      state.taskGroups = action.payload.taskGroups;
      state.tasks = transformTaskGroupsToSvar(action.payload.taskGroups);
      state.chartStart = action.payload.chartStart;
      state.chartEnd = action.payload.chartEnd;
    });
    builder.addCase(fetchRoadmapsForProjects.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch roadmap data for projects';
    });

    // Fetch subtasks - handled by SVAR lazy loading, no Redux state update needed
    builder.addCase(fetchSubtasks.fulfilled, (state, action) => {
      // Subtasks are handled directly by SVAR via provide-data API
      // No need to update Redux state for lazy loaded subtasks
    });
  }
});

export const {
  setViewMode,
  setGroupBy,
  setShowArchived,
  setSearchTerm,
  setSelectedProjectIds,
  updateTaskDate,
  updateTaskProgress,
  toggleTaskExpansion,
  clearError
} = roadmapSlice.actions;

export default roadmapSlice.reducer;
