import { BackendTask, TaskGroup } from '@/api/roadmap/roadmap.api.service';

/**
 * SVAR Gantt task format
 */
export interface SvarTask {
  id: string | number;
  text: string;
  start?: string; // YYYY-MM-DD format
  end?: string; // YYYY-MM-DD format
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

  // Normalize subtask count and presence
  const subCount = Number((task as any).sub_tasks_count || 0);
  const hasSubtasks = Array.isArray((task as any).subtasks) && (task as any).subtasks.length > 0;

  // Calculate progress percentage
  let progress = 0;
  if (subCount > 0) {
    progress = subCount > 0 ? Math.round(((task.completed_sub_tasks || 0) / subCount) * 100) : 0;
  } else if (task.status_category?.is_done) {
    progress = 100;
  }

  // Determine task type
  let type: 'task' | 'summary' | 'milestone' = 'task';
  if (subCount > 0) {
    type = 'summary';
  } else if (duration === 1) {
    type = 'milestone';
  }

  return {
    id: task.id,
    text: task.name,
    start: startDate ? startDate.toISOString().split('T')[0] : null, // Use null for undated tasks to show in grid
    end: endDate ? endDate.toISOString().split('T')[0] : null, // Use null for undated tasks to show in grid
    duration,
    progress,
    type,
    parent: task.parent_task_id || groupId || 0,
    open: hasSubtasks, // Only open when actual subtasks are present to avoid SVAR iterating null
    lazy: subCount > 0 && !hasSubtasks, // Enable lazy loading when there are subtasks but they are not inlined
    details: `Priority: ${task.priority_value}, Status: ${task.status}`,

    // Custom Worklenz fields
    status_id: task.status,
    priority: task.priority,
    priority_value: task.priority_value,
    phase_id: task.phase_id,
    status_category: task.status_category,
    color_code: colorCode,
    sub_tasks_count: subCount,
    completed_sub_tasks: task.completed_sub_tasks
  };
}

/**
 * Transform task groups from backend into flat SVAR task array with group headers
 * Now handles hierarchical task structure within groups
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
      // Only mark as a summary if the group actually contains tasks; empty groups become regular tasks
      type: group.tasks && group.tasks.length > 0 ? 'summary' : 'task',
      parent: 0,
      // Only open groups with actual child data to avoid SVAR recursing into null
      open: !!(group.is_expanded && group.tasks && group.tasks.length > 0),
      color_code: group.color_code,
      // No dates for group headers
    };
    svarTasks.push(groupHeaderTask);

    // Add all tasks in this group (now handles hierarchy recursively)
    group.tasks.forEach((task) => {
      addTaskWithHierarchyToSvar(task, svarTasks, `group-${group.id}`, group.color_code);
    });
  });

  return svarTasks;
}

/**
 * Recursively add task and its subtasks to SVAR format
 */
function addTaskWithHierarchyToSvar(
  task: any,
  svarTasks: SvarTask[],
  parentId: string,
  colorCode?: string
): void {
  // Add the main task
  const svarTask = transformBackendTaskToSvar(task, parentId, colorCode);
  svarTasks.push(svarTask);

  // Recursively add subtasks if they exist
  if (task.subtasks && Array.isArray(task.subtasks)) {
    task.subtasks.forEach((subtask: any) => {
      addTaskWithHierarchyToSvar(subtask, svarTasks, task.id, colorCode);
    });
  }
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
    start: svarTask.start ? new Date(svarTask.start).toISOString() : undefined,
    end: svarTask.end ? new Date(svarTask.end).toISOString() : undefined,
    progress: svarTask.progress
  };
}
