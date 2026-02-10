import apiClient from '@/api/api-client';

const API_BASE_URL = '/api/v1/roadmap-gannt';

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
  private client: typeof apiClient;

  constructor() {
    this.client = apiClient;
  }

  /**
   * Fetch date range and calendar data for Gantt chart timeline
   */
  async getChartDates(params: { projectId: string; timeZone: string }): Promise<ChartDateRange> {
    const response = await this.client.get<ChartDateRange>(
      `${API_BASE_URL}/chart-dates/${params.projectId}`,
      { params: { timeZone: params.timeZone } }
    );
    return response.body;
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
    return response.body;
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
    return response.body;
  }
}

export const roadmapApiService = new RoadmapApiService();