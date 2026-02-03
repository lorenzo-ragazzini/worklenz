import React, { useEffect, useRef } from 'react';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import { evt_project_roadmap_visit } from '../../../../shared/worklenz-analytics-events';
import './project-view-roadmap.css';
import { Flex } from '@/shared/antd-imports';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { updateTaskDate, updateTaskProgress } from '../../../../features/roadmap/roadmap-slice';
import apiClient from '@api/api-client';
import { API_BASE_URL } from '@/shared/constants';
import { selectRoadmap, selectCurrentProject } from '@/app/selectors';

// This view embeds the external SVAR React app via iframe and accepts postMessage events to update roadmap state.
const ProjectViewRoadmap: React.FC = () => {
  const { trackMixpanelEvent } = useMixpanelTracking();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const roadmap = useAppSelector(selectRoadmap);
  const currentProject = useAppSelector(selectCurrentProject);
  const dispatch = useAppDispatch();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    trackMixpanelEvent(evt_project_roadmap_visit);
  }, [trackMixpanelEvent]);

  // Listen for messages from the SVAR iframe and dispatch roadmap updates
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Basic origin check: if VITE_SVAR_URL is absolute, restrict to that origin.
      const svarUrl = import.meta.env.VITE_SVAR_URL || '/svar';
      let allowedOrigin: string | null = null;
      try {
        allowedOrigin = svarUrl.startsWith('http') ? new URL(svarUrl).origin : null;
        if (allowedOrigin && e.origin !== allowedOrigin) return;
      } catch (err) {
        // ignore URL parsing errors and allow messages (local dev / relative paths)
      }

      let data: any = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (err) {
          return;
        }
      }

      if (!data || !data.type) return;

      switch (data.type) {
        case 'updateTaskDate': {
          const { taskId, start, end } = data.payload || {};
          if (taskId && start && end) {
            // Update redux state
            dispatch(updateTaskDate({ taskId, start: new Date(start), end: new Date(end) }));

            // Persist change to backend (use duration endpoint)
            (async () => {
              try {
                await apiClient.put(`${API_BASE_URL}/tasks/duration/${taskId}`, {
                  start: new Date(start).toISOString(),
                  end: new Date(end).toISOString(),
                });
              } catch (err) {
                // ignore - action already applied locally; backend failure will be surfaced by apiClient
                // Optionally, could revert state here if desired
              }
            })();
          }
          break;
        }
        case 'updateTaskProgress': {
          const { taskId, progress, totalTasksCount, completedCount } = data.payload || {};
          if (taskId != null && progress != null) {
            dispatch(updateTaskProgress({ taskId, progress, totalTasksCount, completedCount }));
            // Let backend recalculate progress via refresh endpoint for the project if available
            if (currentProject?.id) {
              (async () => {
                try {
                  await apiClient.post(`${API_BASE_URL}/tasks/refresh-progress/${currentProject.id}`);
                } catch (err) {
                  // ignore
                }
              })();
            }
          }
          break;
        }
        case 'requestInitialData': {
          // iframe asked for initial data; send roadmap + project id
          const targetOrigin = (() => {
            try {
              const svar = import.meta.env.VITE_SVAR_URL || '/svar';
              return svar.startsWith('http') ? new URL(svar).origin : '*';
            } catch (err) {
              return '*';
            }
          })();

          iframeRef.current?.contentWindow?.postMessage(
            {
              type: 'initialData',
              payload: { roadmap: roadmap.tasksList || [], projectId: currentProject?.id || null },
            },
            targetOrigin
          );
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [dispatch, roadmap.tasksList, currentProject]);

  const svarUrl = import.meta.env.VITE_SVAR_URL || '/svar';

  const onIframeLoad = () => {
    // send initial data on load
    const targetOrigin = (() => {
      try {
        const svar = import.meta.env.VITE_SVAR_URL || '/svar';
        return svar.startsWith('http') ? new URL(svar).origin : '*';
      } catch (err) {
        return '*';
      }
    })();

    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'initialData',
        payload: { roadmap: roadmap.tasksList || [], projectId: currentProject?.id || null },
      },
      targetOrigin
    );
  };

  return (
    <Flex vertical className={`${themeMode === 'dark' ? 'dark-theme' : ''}`} style={{ height: '100%' }}>
      <iframe
        ref={iframeRef}
        title="SVAR React"
        src={svarUrl}
        onLoad={onIframeLoad}
        style={{ border: 0, width: '100%', height: '100%', minHeight: 600 }}
      />
    </Flex>
  );
};

export default ProjectViewRoadmap;
