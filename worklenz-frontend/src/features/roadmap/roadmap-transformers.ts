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

  // Ensure taskGroups is an array
  if (!Array.isArray(taskGroups)) {
    console.warn('[Transform] taskGroups is not an array:', taskGroups);
    return svarTasks;
  }

  console.log('[Transform] Processing taskGroups:', taskGroups.length, 'groups');

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