import apiClient from '@/api/api-client';

export const tasksApiService = {
  async updateTaskProgress(taskId: string, progress: number, options: { signal?: AbortSignal } = {}) {
    const p = Math.max(0, Math.min(100, Math.round(Number(progress) || 0)));
    return apiClient.put(`/api/v1/tasks/progress/${taskId}`, { progress: p }, { signal: options.signal });
  }
};
