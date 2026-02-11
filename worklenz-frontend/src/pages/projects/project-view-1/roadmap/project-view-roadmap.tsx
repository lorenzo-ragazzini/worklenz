import React, { useEffect, useState } from 'react';
import { Spin, Alert, Space, Select, Input, Checkbox } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchRoadmapData,
  fetchRoadmapsForProjects,
  setSelectedProjectIds,
  setViewMode,
  setGroupBy,
  setShowArchived,
  setSearchTerm,
  clearError
} from '@/features/roadmap/roadmap-slice';
import { setProjectId, getProject } from '@/features/project/project.slice';
import { SvarGanttChart } from '@/components/roadmap/SvarGanttChart';
import { TimeFilter } from './time-filter';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import './project-view-roadmap.css';

const ProjectViewRoadmap: React.FC = () => {
  const dispatch = useAppDispatch();
  const [availableProjects, setAvailableProjects] = useState<IProjectViewModel[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Redux state
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const currentProject = useAppSelector(state => state.projectReducer.project);
  const timeZone = useAppSelector(state => state.userReducer.timezone || 'UTC');
  const loading = useAppSelector(state => state.roadmapReducer.loading);
  const error = useAppSelector(state => state.roadmapReducer.error);
  const viewMode = useAppSelector(state => state.roadmapReducer.viewMode);
  const groupBy = useAppSelector(state => state.roadmapReducer.groupBy);
  const showArchived = useAppSelector(state => state.roadmapReducer.showArchived);
  const searchTerm = useAppSelector(state => state.roadmapReducer.searchTerm);
  const selectedProjectIds = useAppSelector(state => state.roadmapReducer.selectedProjectIds || []);

  /**
   * Fetch available projects for the selector
   */
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setProjectsLoading(true);
        const response = await projectsApiService.getProjects(1, 100, 'name', 'asc', '', null, '', '');
        if (response.body?.data) {
          setAvailableProjects(response.body.data);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  /**
   * Fetch roadmap data on mount and when filters change
   */
  useEffect(() => {
    if (selectedProjectIds && selectedProjectIds.length > 1) {
      const projectsToFetch = availableProjects
        .filter(p => selectedProjectIds.includes(p.id))
        .map(p => ({ id: p.id, name: p.name }));
      dispatch(fetchRoadmapsForProjects({
        projects: projectsToFetch,
        timeZone,
        groupBy,
        archived: showArchived,
        search: searchTerm
      }));
    } else if (projectId) {
      dispatch(fetchRoadmapData({
        projectId,
        timeZone,
        groupBy,
        archived: showArchived,
        search: searchTerm
      }));
    }
  }, [dispatch, projectId, selectedProjectIds, timeZone, groupBy, showArchived, searchTerm]);

  /**
   * Handle view mode change
   */
  const handleViewModeChange = (mode: 'day' | 'week' | 'month') => {
    dispatch(setViewMode(mode));
  };

  /**
   * Handle group by change
   */
  const handleGroupByChange = (value: 'status' | 'priority' | 'phase' | 'labels') => {
    dispatch(setGroupBy(value));
  };

  /**
   * Handle search input
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchTerm(e.target.value));
  };

  /**
   * Handle archived toggle
   */
  const handleArchivedToggle = (checked: boolean) => {
    dispatch(setShowArchived(checked));
  };

  /**
   * Handle project selection change
   */
  const handleProjectChange = (selected: string | string[]) => {
    if (Array.isArray(selected)) {
      if (selected.length === 1) {
        const singleId = selected[0];
        dispatch(setSelectedProjectIds([]));
        dispatch(setProjectId(singleId));
        dispatch(getProject(singleId));
      } else if (selected.length > 1) {
        dispatch(setSelectedProjectIds(selected));
        const projectsToFetch = availableProjects
          .filter(p => selected.includes(p.id))
          .map(p => ({ id: p.id, name: p.name }));
        dispatch(fetchRoadmapsForProjects({
          projects: projectsToFetch,
          timeZone,
          groupBy,
          archived: showArchived,
          search: searchTerm
        }));
      } else {
        dispatch(setSelectedProjectIds([]));
      }
    } else {
      // single string value
      dispatch(setSelectedProjectIds([]));
      dispatch(setProjectId(selected));
      dispatch(getProject(selected));
    }
  };

  if (!projectId && (!selectedProjectIds || selectedProjectIds.length === 0)) {
    return (
      <div className="roadmap-container">
        <Alert
          message="No project selected"
          description="Please select a project to view the roadmap."
          type="info"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="roadmap-container">
      {/* Toolbar */}
      <div className="roadmap-toolbar">
        <Space>
          {/* Project selector */}
          <Select
            mode="multiple"
            value={selectedProjectIds && selectedProjectIds.length > 0 ? selectedProjectIds : (projectId ? [projectId] : [])}
            onChange={handleProjectChange}
            loading={projectsLoading}
            placeholder="Select project(s)"
            style={{ width: 300 }}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
          >
            {availableProjects.map((project) => (
              <Select.Option key={project.id} value={project.id}>
                {project.name}
              </Select.Option>
            ))}
          </Select>

          {/* View mode selector */}
          <TimeFilter
            view={viewMode}
            onViewChange={handleViewModeChange}
          />

          {/* Group by selector */}
          <Select
            value={groupBy}
            onChange={handleGroupByChange}
            style={{ width: 150 }}
          >
            <Select.Option value="status">By Status</Select.Option>
            <Select.Option value="priority">By Priority</Select.Option>
            <Select.Option value="phase">By Phase</Select.Option>
            <Select.Option value="labels">By Labels</Select.Option>
          </Select>

          {/* Search input */}
          <Input.Search
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{ width: 250 }}
            allowClear
          />

          {/* Show archived checkbox */}
          <Checkbox
            checked={showArchived}
            onChange={(e) => handleArchivedToggle(e.target.checked)}
          >
            Show Archived
          </Checkbox>
        </Space>
      </div>

      {/* Error display */}
      {error && (
        <Alert
          message="Error loading roadmap"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => dispatch(clearError())}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Gantt chart */}
      <div className="roadmap-gantt-container">
        {loading ? (
          <div className="roadmap-loading">
            <Spin size="large" tip="Loading roadmap..." />
          </div>
        ) : (
          <SvarGanttChart projectId={projectId} />
        )}
      </div>
    </div>
  );
};

export default ProjectViewRoadmap;
