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
