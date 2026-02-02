import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Task } from 'gantt-task-react';
import {
  roadmapApiService,
  IRoadmapConfig,
  IRoadmapGroup,
  IRoadmapDateRange,
  IRoadmapTask,
} from '@/api/roadmap/roadmap.api.service';
import { colors } from '../../styles/colors';

// Keep this type for backward compatibility with existing components
export interface NewTaskType extends Task {
  subTasks?: Task[];
  isExpanded?: boolean;
}

// Re-export types from API service for convenience
export type { IRoadmapGroup, IRoadmapTask, IRoadmapDateRange };

interface RoadmapState {
  taskGroups: IRoadmapGroup[];
  chartDates: IRoadmapDateRange | null;
  loading: boolean;
  error: string | null;
  groupBy: 'status' | 'priority' | 'phase';
}

const initialState: RoadmapState = {
  taskGroups: [],
  chartDates: null,
  loading: false,
  error: null,
  groupBy: 'status',
};

// Async thunk to fetch chart dates
export const fetchChartDates = createAsyncThunk(
  'roadmap/fetchChartDates',
  async ({ projectId, timeZone }: { projectId: string; timeZone: string }, { rejectWithValue }) => {
    try {
      const response = await roadmapApiService.getChartDates(projectId, timeZone);
      return response.body;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch chart dates');
    }
  }
);

// Async thunk to fetch task groups
export const fetchRoadmapTasks = createAsyncThunk(
  'roadmap/fetchRoadmapTasks',
  async (config: IRoadmapConfig, { rejectWithValue }) => {
    try {
      const response = await roadmapApiService.getTaskGroups(config);
      return response.body;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch roadmap tasks');
    }
  }
);

// Helper to calculate progress from status category
export const calculateProgress = (statusCategory: {
  is_done: boolean;
  is_doing: boolean;
  is_todo: boolean;
}): number => {
  if (statusCategory.is_done) return 100;
  if (statusCategory.is_doing) return 50;
  return 0;
};

// Helper to transform backend tasks to Gantt tasks
export const transformToGanttTasks = (groups: IRoadmapGroup[]): Task[] => {
  const tasks: Task[] = [];

  for (const group of groups) {
    for (const task of group.tasks) {
      // Skip tasks without dates (Gantt requires both start and end)
      if (!task.start_date || !task.end_date) continue;

      const startDate = new Date(task.start_date);
      let endDate = new Date(task.end_date);

      // Ensure end date is after start date (Gantt requirement)
      if (endDate <= startDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
      }

      tasks.push({
        id: task.id,
        name: task.name,
        start: startDate,
        end: endDate,
        progress: calculateProgress(task.status_category),
        type: 'task',
        styles: {
          progressColor: group.color_code,
          progressSelectedColor: group.color_code,
        },
      });
    }
  }

  return tasks;
};

const roadmapSlice = createSlice({
  name: 'roadmap',
  initialState,
  reducers: {
    toggleGroupExpansion: (state, action: PayloadAction<string>) => {
      const group = state.taskGroups.find(g => g.id === action.payload);
      if (group) {
        group.is_expanded = !group.is_expanded;
      }
    },
    setGroupBy: (state, action: PayloadAction<'status' | 'priority' | 'phase'>) => {
      state.groupBy = action.payload;
    },
    clearRoadmapData: state => {
      state.taskGroups = [];
      state.chartDates = null;
      state.error = null;
      state.loading = false;
    },
    // Keep these for backward compatibility if needed
    updateTaskDate: (
      state,
      action: PayloadAction<{ taskId: string; start: Date; end: Date }>
    ) => {
      const { taskId, start, end } = action.payload;
      for (const group of state.taskGroups) {
        const task = group.tasks.find(t => t.id === taskId);
        if (task) {
          task.start_date = start.toISOString();
          task.end_date = end.toISOString();
          break;
        }
      }
    },
    updateTaskProgress: (
      state,
      action: PayloadAction<{ taskId: string; progress: number }>
    ) => {
      // Progress is derived from status, so this is a no-op for now
      // In the future, could call API to update task status
    },
    toggleTaskExpansion: (state, action: PayloadAction<string>) => {
      // This was for the old demo data structure
      // Now we use toggleGroupExpansion for group-level expansion
    },
  },
  extraReducers: builder => {
    builder
      // Chart dates
      .addCase(fetchChartDates.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChartDates.fulfilled, (state, action) => {
        state.chartDates = action.payload;
        state.loading = false;
      })
      .addCase(fetchChartDates.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      })
      // Task groups
      .addCase(fetchRoadmapTasks.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoadmapTasks.fulfilled, (state, action) => {
        state.taskGroups = action.payload;
        state.loading = false;
      })
      .addCase(fetchRoadmapTasks.rejected, (state, action) => {
        state.error = action.payload as string;
        state.loading = false;
      });
  },
});

export const {
  toggleGroupExpansion,
  setGroupBy,
  clearRoadmapData,
  updateTaskDate,
  updateTaskProgress,
  toggleTaskExpansion,
} = roadmapSlice.actions;

export default roadmapSlice.reducer;
