import React, { useCallback, useEffect, useRef } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import logger from '@/utils/errorLogger';
import apiClient from '@/api/api-client';
import { message } from '@/shared/antd-imports';

interface TaskContextMenuProps {
  task: any; // SVAR task format
  projectId: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  projectId,
  position,
  onClose,
}) => {
  const currentSession = useAppSelector(state => state.userReducer);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleCopyLink = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const taskLink = `${window.location.origin}/worklenz/projects/${projectId}?tab=tasks-list&pinned_tab=tasks-list&task=${task.id}`;
      await navigator.clipboard.writeText(taskLink);
      message.success('Link copied to clipboard');
    } catch (error) {
      logger.error('Error copying link:', error);
      message.error('Failed to copy link');
    } finally {
      onClose();
    }
  }, [projectId, task.id, onClose]);

  const handleAssignToMe = useCallback(async () => {
    if (!projectId || !task.id || !currentSession?.team_member_id) return;

    try {
      // Simple API call to assign task to current user
      await apiClient.post(`/tasks/assign/${task.id}`, {
        assignee_id: currentSession.team_member_id,
        project_id: projectId,
      });

      message.success('Task assigned to you');
    } catch (error) {
      logger.error('Error assigning to me:', error);
      message.error('Failed to assign task');
    } finally {
      onClose();
    }
  }, [projectId, task.id, currentSession, onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-48 z-50"
      style={{
        top: position.y,
        left: position.x,
        zIndex: 9999,
      }}
    >
      <ul className="list-none p-0 m-0">
        <li>
          <button
            onClick={handleAssignToMe}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <span>👤 Assign to me</span>
          </button>
        </li>
        <li>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <span>🔗 Copy link</span>
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              // Placeholder for opening task drawer
              message.info(`Opening task: ${task.text || task.name || 'Unknown'}`);
              onClose();
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
          >
            <span>📝 Edit task</span>
          </button>
        </li>
      </ul>
    </div>
  );
};
