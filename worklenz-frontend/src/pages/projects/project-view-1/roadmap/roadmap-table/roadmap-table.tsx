import React from 'react';
import { DatePicker, Typography } from '@/shared/antd-imports';
import dayjs, { Dayjs } from 'dayjs';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  updateTaskDate,
  toggleGroupExpansion,
  IRoadmapTask,
  IRoadmapGroup,
} from '@features/roadmap/roadmap-slice';
import { colors } from '@/styles/colors';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';

const RoadmapTable = () => {
  // Get task groups from roadmap slice
  const taskGroups = useAppSelector(state => state.roadmapReducer.taskGroups);

  // Get theme data from theme slice
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const dispatch = useAppDispatch();

  // Function to handle date changes
  const handleDateChange = (
    taskId: string,
    dateType: 'start' | 'end',
    date: Dayjs,
    currentTask: IRoadmapTask
  ) => {
    const updatedDate = date.toDate();
    const currentStart = currentTask.start_date ? new Date(currentTask.start_date) : new Date();
    const currentEnd = currentTask.end_date ? new Date(currentTask.end_date) : new Date();

    dispatch(
      updateTaskDate({
        taskId,
        start: dateType === 'start' ? updatedDate : currentStart,
        end: dateType === 'end' ? updatedDate : currentEnd,
      })
    );
  };

  // Function to handle task click - open task drawer
  const handleTaskClick = (taskId: string) => {
    dispatch(setSelectedTaskId(taskId));
    dispatch(setShowTaskDrawer(true));
  };

  // Function to toggle group expansion
  const handleGroupToggle = (groupId: string) => {
    dispatch(toggleGroupExpansion(groupId));
  };

  // Column definitions
  const columns: { key: string; title: React.ReactNode; width: number }[] = [
    {
      key: 'name',
      title: 'Task Name',
      width: 240,
    },
    {
      key: 'start',
      title: 'Start Date',
      width: 130,
    },
    {
      key: 'end',
      title: 'End Date',
      width: 130,
    },
  ];

  // Function to render the column content based on column key
  const renderColumnContent = (columnKey: string, task: IRoadmapTask) => {
    switch (columnKey) {
      case 'name':
        return (
          <div
            className="cursor-pointer truncate hover:text-blue-500"
            onClick={() => handleTaskClick(task.id)}
            title={task.name}
          >
            {task.name}
          </div>
        );
      case 'start':
        const startDayjs = task.start_date ? dayjs(task.start_date) : null;
        return (
          <DatePicker
            placeholder="Set Start Date"
            value={startDayjs}
            format={'MMM DD, YYYY'}
            suffixIcon={null}
            onChange={date => date && handleDateChange(task.id, 'start', date, task)}
            style={{
              backgroundColor: colors.transparent,
              border: 'none',
              boxShadow: 'none',
            }}
          />
        );
      case 'end':
        const endDayjs = task.end_date ? dayjs(task.end_date) : null;
        return (
          <DatePicker
            placeholder="Set End Date"
            value={endDayjs}
            format={'MMM DD, YYYY'}
            suffixIcon={null}
            onChange={date => date && handleDateChange(task.id, 'end', date, task)}
            style={{
              backgroundColor: colors.transparent,
              border: 'none',
              boxShadow: 'none',
            }}
          />
        );
      default:
        return null;
    }
  };

  // Layout styles for table and columns
  const customHeaderColumnStyles = `border px-2 h-[50px] text-left z-10 after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:h-[42px] after:w-1.5 after:bg-transparent after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent ${themeMode === 'dark' ? 'bg-[#1d1d1d] border-[#303030]' : 'bg-[#fafafa]'}`;

  const customBodyColumnStyles = `border px-2 h-[50px] z-10 after:content after:absolute after:top-0 after:-right-1 after:-z-10 after:min-h-[40px] after:w-1.5 after:bg-transparent after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent ${themeMode === 'dark' ? 'bg-transparent border-[#303030]' : 'bg-transparent'}`;

  const rowBackgroundStyles =
    themeMode === 'dark' ? 'even:bg-[#1b1b1b] odd:bg-[#141414]' : 'even:bg-[#f4f4f4] odd:bg-white';

  const groupHeaderStyles =
    themeMode === 'dark' ? 'bg-[#252525] border-[#303030]' : 'bg-[#e8e8e8]';

  // Get all tasks from all groups
  const getVisibleTasks = () => {
    const rows: { type: 'group' | 'task'; data: IRoadmapGroup | IRoadmapTask; group?: IRoadmapGroup }[] = [];

    for (const group of taskGroups) {
      // Add group header
      rows.push({ type: 'group', data: group });

      // Add all tasks if group is expanded
      if (group.is_expanded) {
        for (const task of group.tasks) {
          rows.push({ type: 'task', data: task, group });
        }
      }
    }

    return rows;
  };

  const visibleRows = getVisibleTasks();

  return (
    <div className="relative w-full max-w-[1000px]">
      <table className={`rounded-2 w-full min-w-max border-collapse`}>
        <thead className="h-[50px]">
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className={`${customHeaderColumnStyles}`}
                style={{ width: column.width, fontWeight: 500 }}
              >
                <Typography.Text style={{ fontWeight: 500 }}>{column.title}</Typography.Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-4">
                No tasks with dates available
              </td>
            </tr>
          ) : (
            visibleRows.map((row, index) => {
              if (row.type === 'group') {
                const group = row.data as IRoadmapGroup;
                const tasksWithDates = group.tasks.filter(t => t.start_date && t.end_date);
                return (
                  <tr
                    key={`group-${group.id}`}
                    className={`h-[40px] cursor-pointer ${groupHeaderStyles}`}
                    onClick={() => handleGroupToggle(group.id)}
                  >
                    <td colSpan={columns.length} className="px-2 border">
                      <div className="flex items-center gap-2">
                        {group.is_expanded ? (
                          <CaretDownOutlined style={{ fontSize: 12 }} />
                        ) : (
                          <CaretRightOutlined style={{ fontSize: 12 }} />
                        )}
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ backgroundColor: group.color_code }}
                        />
                        <Typography.Text strong>{group.name}</Typography.Text>
                        <Typography.Text type="secondary">({tasksWithDates.length})</Typography.Text>
                      </div>
                    </td>
                  </tr>
                );
              } else {
                const task = row.data as IRoadmapTask;
                return (
                  <tr
                    key={`task-${task.id}`}
                    className={`group cursor-pointer h-[50px] ${rowBackgroundStyles}`}
                  >
                    {columns.map(column => (
                      <td
                        key={column.key}
                        className={`${customBodyColumnStyles}`}
                        style={{ width: column.width }}
                      >
                        {renderColumnContent(column.key, task)}
                      </td>
                    ))}
                  </tr>
                );
              }
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RoadmapTable;
