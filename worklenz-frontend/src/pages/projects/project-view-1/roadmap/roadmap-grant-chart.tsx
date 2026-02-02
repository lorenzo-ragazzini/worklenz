import { Gantt, Task, ViewMode } from 'gantt-task-react';
import { useMemo } from 'react';
import { colors } from '../../../../styles/colors';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import { evt_roadmap_drag_change_date } from '../../../../shared/worklenz-analytics-events';
import {
  updateTaskDate,
  updateTaskProgress,
  transformToGanttTasks,
} from '../../../../features/roadmap/roadmap-slice';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';

type RoadmapGrantChartProps = {
  view: ViewMode;
};

const RoadmapGrantChart = ({ view }: RoadmapGrantChartProps) => {
  // Get task groups from roadmap slice
  const taskGroups = useAppSelector(state => state.roadmapReducer.taskGroups);
  const { trackMixpanelEvent } = useMixpanelTracking();

  // Debug: log task groups to see what data we have
  console.log('[Roadmap] taskGroups:', taskGroups);
  console.log('[Roadmap] taskGroups with dates:', taskGroups.flatMap(g => g.tasks.filter(t => t.start_date && t.end_date)));

  const dispatch = useAppDispatch();

  // Column widths for each view mode
  let columnWidth = 60;
  if (view === ViewMode.Year) {
    columnWidth = 350;
  } else if (view === ViewMode.Month) {
    columnWidth = 300;
  } else if (view === ViewMode.Week) {
    columnWidth = 250;
  }

  // Function to handle double click - open task drawer
  const handleDoubleClick = (task: Task) => {
    dispatch(setSelectedTaskId(task.id));
    dispatch(setShowTaskDrawer(true));
  };

  // Function to handle date change
  const handleTaskDateChange = (task: Task) => {
    trackMixpanelEvent(evt_roadmap_drag_change_date);
    dispatch(updateTaskDate({ taskId: task.id, start: task.start, end: task.end }));
    // TODO: Call API to persist date change
  };

  // Function to handle progress change
  const handleTaskProgressChange = (task: Task) => {
    dispatch(updateTaskProgress({ taskId: task.id, progress: task.progress }));
    // TODO: Call API to persist progress change
  };

  // Transform task groups to Gantt tasks using memoization
  const ganttTasks = useMemo(() => {
    const tasks = transformToGanttTasks(taskGroups);

    // If no tasks with dates, create a placeholder to show the timeline
    if (tasks.length === 0) {
      const today = new Date();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return [
        {
          id: 'placeholder',
          name: '',
          start: today,
          end: endOfMonth,
          progress: 0,
          type: 'task' as const,
          isDisabled: true,
          styles: {
            progressColor: 'transparent',
            progressSelectedColor: 'transparent',
            backgroundColor: 'transparent',
            backgroundSelectedColor: 'transparent',
          },
        },
      ];
    }

    return tasks;
  }, [taskGroups]);

  return (
    <div className="w-full max-w-[900px] overflow-x-auto">
      <Gantt
        tasks={ganttTasks}
        viewMode={view}
        onDateChange={handleTaskDateChange}
        onProgressChange={handleTaskProgressChange}
        onDoubleClick={handleDoubleClick}
        listCellWidth={''}
        columnWidth={columnWidth}
        todayColor={`rgba(64, 150, 255, 0.2)`}
        projectProgressColor={colors.limeGreen}
        projectBackgroundColor={colors.lightGreen}
      />
    </div>
  );
};

export default RoadmapGrantChart;
