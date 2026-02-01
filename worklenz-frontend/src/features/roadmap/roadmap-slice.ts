import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Task } from 'gantt-task-react';
import { colors } from '../../styles/colors';

export interface NewTaskType extends Task {
  subTasks?: Task[];
  isExpanded?: boolean;
}

// Helper function to get dates relative to today
const getRelativeDate = (daysFromNow: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
};

const tasks: NewTaskType[] = [
  {
    start: getRelativeDate(0),
    end: getRelativeDate(4),
    name: 'Planning Phase',
    id: 'Task_1',
    progress: 50,
    type: 'task',
    styles: {
      progressColor: '#1890ff80',
      progressSelectedColor: colors.skyBlue,
    },
    isExpanded: false,
    subTasks: [
      {
        start: getRelativeDate(0),
        end: getRelativeDate(1),
        name: 'Initial Meeting',
        id: 'Task_1_1',
        progress: 80,
        type: 'task',
        dependencies: ['Task_1'],
        styles: {
          progressColor: '#1890ff80',
          progressSelectedColor: colors.skyBlue,
        },
      },
      {
        start: getRelativeDate(2),
        end: getRelativeDate(4),
        name: 'Resource Allocation',
        id: 'Task_1_2',
        progress: 20,
        type: 'task',
        dependencies: ['Task_1'],
        styles: {
          progressColor: '#1890ff80',
          progressSelectedColor: colors.skyBlue,
        },
      },
    ],
  },
  {
    start: getRelativeDate(5),
    end: getRelativeDate(9),
    name: 'Development Phase',
    id: 'Task_2',
    progress: 30,
    type: 'task',
    styles: {
      progressColor: '#1890ff80',
      progressSelectedColor: colors.skyBlue,
    },
    isExpanded: false,
    subTasks: [
      {
        start: getRelativeDate(5),
        end: getRelativeDate(7),
        name: 'Coding',
        id: 'Task_2_1',
        progress: 40,
        type: 'task',
        dependencies: ['Task_2'],
        styles: {
          progressColor: '#1890ff80',
          progressSelectedColor: colors.skyBlue,
        },
      },
      {
        start: getRelativeDate(8),
        end: getRelativeDate(9),
        name: 'Code Review',
        id: 'Task_2_2',
        progress: 60,
        type: 'task',
        dependencies: ['Task_2'],
        styles: {
          progressColor: '#1890ff80',
          progressSelectedColor: colors.skyBlue,
        },
      },
    ],
  },
  {
    start: getRelativeDate(10),
    end: getRelativeDate(11),
    name: 'Design Phase',
    id: 'Task_3',
    progress: 70,
    type: 'task',
    styles: {
      progressColor: '#1890ff80',
      progressSelectedColor: colors.skyBlue,
    },
    isExpanded: false,
  },
  {
    start: getRelativeDate(12),
    end: getRelativeDate(16),
    name: 'Testing Phase',
    id: 'Task_4',
    progress: 20,
    type: 'task',
    styles: {
      progressColor: '#1890ff80',
      progressSelectedColor: colors.skyBlue,
    },
    isExpanded: false,
    subTasks: [
      {
        start: getRelativeDate(12),
        end: getRelativeDate(13),
        name: 'Unit Testing',
        id: 'Task_4_1',
        progress: 50,
        type: 'task',
        dependencies: ['Task_4'],
        styles: {
          progressColor: '#1890ff80',
          progressSelectedColor: colors.skyBlue,
        },
      },
      {
        start: getRelativeDate(14),
        end: getRelativeDate(16),
        name: 'Integration Testing',
        id: 'Task_4_2',
        progress: 30,
        type: 'task',
        dependencies: ['Task_4'],
        styles: {
          progressColor: '#1890ff80',
          progressSelectedColor: colors.skyBlue,
        },
      },
    ],
  },
  {
    start: getRelativeDate(17),
    end: getRelativeDate(19),
    name: 'Deployment Phase',
    id: 'Task_5',
    progress: 90,
    type: 'task',
    styles: {
      progressColor: '#1890ff80',
      progressSelectedColor: colors.skyBlue,
    },
    isExpanded: false,
  },
];

type RoadmapState = {
  tasksList: NewTaskType[];
};

const initialState: RoadmapState = {
  tasksList: tasks,
};

const roadmapSlice = createSlice({
  name: 'roadmap',
  initialState,
  reducers: {
    updateTaskDate: (state, action: PayloadAction<{ taskId: string; start: Date; end: Date }>) => {
      const { taskId, start, end } = action.payload;

      const updateTask = (tasks: NewTaskType[]): NewTaskType[] => {
        return tasks.map(task => {
          if (task.id === taskId) {
            return {
              ...task,
              start,
              end,
            };
          }

          if (task.subTasks) {
            return {
              ...task,
              subTasks: updateTask(task.subTasks),
            };
          }

          return task;
        });
      };

      state.tasksList = updateTask(state.tasksList);
    },
    updateTaskProgress: (
      state,
      action: PayloadAction<{
        taskId: string;
        progress: number;
        totalTasksCount: number;
        completedCount: number;
      }>
    ) => {
      const { taskId, progress, totalTasksCount, completedCount } = action.payload;
      const updateTask = (tasks: NewTaskType[]) => {
        tasks.forEach(task => {
          if (task.id === taskId) {
            task.progress = progress;
          } else if (task.subTasks) {
            updateTask(task.subTasks);
          }
        });
      };
      updateTask(state.tasksList);
    },
    toggleTaskExpansion: (state, action: PayloadAction<string>) => {
      const index = state.tasksList.findIndex(task => task.id === action.payload);

      if (index !== -1) {
        state.tasksList[index] = {
          ...state.tasksList[index],
          isExpanded: !state.tasksList[index].isExpanded,
        };
      }
    },
  },
});

export const { toggleTaskExpansion, updateTaskDate, updateTaskProgress } = roadmapSlice.actions;
export default roadmapSlice.reducer;
