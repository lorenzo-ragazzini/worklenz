import { API_BASE_URL } from '@/shared/constants';
import apiClient from '../api-client';
import { IServerResponse } from '@/types/common.types';
import { toQueryString } from '@/utils/toQueryString';

const rootUrl = `${API_BASE_URL}/roadmap-gannt`;

// Chart date range response
export interface IRoadmapDateRange {
  date_data: Array<{
    month: string;
    weeks: number[];
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

// Task from backend
export interface IRoadmapTask {
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
  priority: string | null;
  priority_value: number | null;
  start_date: string | null;
  end_date: string | null;
  offset_from?: number;
  width?: number;
  index?: number;
}

// Group of tasks
export interface IRoadmapGroup {
  id: string;
  name: string;
  color_code: string;
  category_id: string | null;
  tasks: IRoadmapTask[];
  is_expanded: boolean;
}

// Configuration for fetching tasks
export interface IRoadmapConfig {
  projectId: string;
  group?: 'status' | 'priority' | 'phase';
  archived?: boolean;
  expandedGroups?: string;
  timeZone?: string;
  isSubtasksInclude?: boolean;
}

export const roadmapApiService = {
  // Get chart date range for timeline
  getChartDates: async (
    projectId: string,
    timeZone: string
  ): Promise<IServerResponse<IRoadmapDateRange>> => {
    const q = toQueryString({ timeZone });
    const response = await apiClient.get<IServerResponse<IRoadmapDateRange>>(
      `${rootUrl}/chart-dates/${projectId}${q}`
    );
    return response.data;
  },

  // Get tasks grouped by status/priority/phase
  getTaskGroups: async (config: IRoadmapConfig): Promise<IServerResponse<IRoadmapGroup[]>> => {
    const params: Record<string, any> = {
      group: config.group || 'status',
      archived: config.archived || false,
      isSubtasksInclude: config.isSubtasksInclude ?? true,
    };
    // Only add optional params if they have values
    if (config.expandedGroups) params.expandedGroups = config.expandedGroups;
    if (config.timeZone) params.timeZone = config.timeZone;

    const q = toQueryString(params);
    const response = await apiClient.get<IServerResponse<IRoadmapGroup[]>>(
      `${rootUrl}/task-groups/${config.projectId}${q}`
    );
    return response.data;
  },
};
