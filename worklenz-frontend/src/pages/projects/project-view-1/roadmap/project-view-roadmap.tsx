import { useState, useEffect } from 'react';
import { useMixpanelTracking } from '../../../../hooks/useMixpanelTracking';
import { evt_project_roadmap_visit } from '../../../../shared/worklenz-analytics-events';
import { ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import './project-view-roadmap.css';
import { Flex, Skeleton, Empty } from '@/shared/antd-imports';
import { useAppSelector } from '../../../../hooks/useAppSelector';
import { useAppDispatch } from '../../../../hooks/useAppDispatch';
import { TimeFilter } from './time-filter';
import RoadmapTable from './roadmap-table/roadmap-table';
import RoadmapGrantChart from './roadmap-grant-chart';
import {
  fetchChartDates,
  fetchRoadmapTasks,
  clearRoadmapData,
} from '../../../../features/roadmap/roadmap-slice';

const ProjectViewRoadmap = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.Day);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const dispatch = useAppDispatch();

  // Get theme details
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // Get project ID from Redux
  const projectId = useAppSelector(state => state.projectReducer.projectId);

  // Get roadmap state
  const { taskGroups, loading, error } = useAppSelector(state => state.roadmapReducer);

  // Debug: log state
  console.log('[Roadmap] loading:', loading, 'error:', error, 'taskGroups:', taskGroups.length);

  useEffect(() => {
    trackMixpanelEvent(evt_project_roadmap_visit);
  }, [trackMixpanelEvent]);

  // Fetch roadmap data when projectId changes
  useEffect(() => {
    if (projectId) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      dispatch(fetchChartDates({ projectId, timeZone }));
      dispatch(
        fetchRoadmapTasks({
          projectId,
          group: 'status',
          timeZone,
          isSubtasksInclude: true,
        })
      );
    }

    // Cleanup on unmount
    return () => {
      dispatch(clearRoadmapData());
    };
  }, [dispatch, projectId]);

  if (loading) {
    return (
      <Flex vertical gap={16} style={{ padding: 16 }}>
        <Skeleton active />
        <Skeleton active />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex vertical align="center" justify="center" style={{ padding: 32 }}>
        <Empty description={`Error loading roadmap: ${error}`} />
      </Flex>
    );
  }

  if (!taskGroups.length) {
    return (
      <Flex vertical align="center" justify="center" style={{ padding: 32 }}>
        <Empty description="No tasks found in this project." />
      </Flex>
    );
  }

  return (
    <Flex vertical className={`${themeMode === 'dark' ? 'dark-theme' : ''}`}>
      {/* time filter */}
      <TimeFilter onViewModeChange={viewMode => setView(viewMode)} />

      <Flex>
        {/* table */}
        <div className="after:content relative h-fit w-full max-w-[500px] after:absolute after:-right-3 after:top-0 after:z-10 after:min-h-full after:w-3 after:bg-linear-to-r after:from-[rgba(0,0,0,0.12)] after:to-transparent">
          <RoadmapTable />
        </div>

        {/* gantt Chart */}
        <RoadmapGrantChart view={view} />
      </Flex>
    </Flex>
  );
};

export default ProjectViewRoadmap;
