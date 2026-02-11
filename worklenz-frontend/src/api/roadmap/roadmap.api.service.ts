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
    const response = await this.client.get(`${API_BASE_URL}/chart-dates/${params.projectId}`, { params: { timeZone: params.timeZone } });
    // Normalize response shape: support raw AxiosResponse, ServerResponse wrapper, or already-unwrapped payload
    const serverResp: any = (response as any)?.body ?? (response as any)?.data ?? response;
    const payload: any = serverResp?.body ?? serverResp;
    return payload as ChartDateRange;
  }

  /**
   * Fetch date range and calendar data for multiple projects (aggregated)
   */
  async getChartDatesForProjects(params: { projectIds: string[]; timeZone: string }): Promise<ChartDateRange> {
    const response = await this.client.get(`${API_BASE_URL}/chart-dates`, { params: { projectIds: params.projectIds.join(','), timeZone: params.timeZone } });
    const serverResp: any = (response as any)?.body ?? (response as any)?.data ?? response;
    const payload: any = serverResp?.body ?? serverResp;
    return payload as ChartDateRange;
  }

  /**
   * Fetch tasks grouped by status, priority, phase, or labels for multiple projects (aggregated)
   */
  async getTaskGroupsForProjects(params: { projectIds: string[]; timeZone: string; group?: 'status' | 'priority' | 'phase' | 'labels'; archived?: boolean; search?: string; }): Promise<any[]> {
    const { projectIds, timeZone, group = 'status', archived = false, search } = params;

    const response = await this.client.get(`${API_BASE_URL}/task-groups`, {
      params: {
        projectIds: projectIds.join(','),
        group,
        archived: archived ? 'true' : 'false',
        search,
        timezone: timeZone
      }
    });
    const serverResp: any = (response as any)?.body ?? (response as any)?.data ?? response;
    const payload: any = serverResp?.body ?? serverResp;
    return payload as any[];
  }

  /**
   * Fetch tasks grouped by status, priority, phase, or labels
   */
  async getTaskGroups(params: RoadmapApiParams): Promise<TaskGroup[]> {
    const { projectId, timeZone, group = 'status', archived = false, search } = params;

    const response = await this.client.get(`${API_BASE_URL}/task-groups/${projectId}`, {
      params: {
        group,
        archived: archived ? 'true' : 'false',
        search,
        timezone: timeZone
      }
    });
    const serverResp: any = (response as any)?.body ?? (response as any)?.data ?? response;
    const payload: any = serverResp?.body ?? serverResp;
    return payload as TaskGroup[];
  }

  /**
   * Fetch subtasks for a specific parent task
   */
  async getSubtasks(params: {
    projectId: string;
    parentTaskId: string;
    timeZone: string;
  }): Promise<BackendTask[]> {
    const response = await this.client.get(`${API_BASE_URL}/task-groups/${params.projectId}`, {
      params: {
        parent_task: params.parentTaskId,
        timezone: params.timeZone
      }
    });
    const serverResp: any = (response as any)?.body ?? (response as any)?.data ?? response;
    const payload: any = serverResp?.body ?? serverResp;
    return payload as BackendTask[];
  }
}

export const roadmapApiService = new RoadmapApiService();