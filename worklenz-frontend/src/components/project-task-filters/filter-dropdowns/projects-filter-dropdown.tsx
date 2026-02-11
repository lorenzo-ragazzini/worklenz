import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDownFilled } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  List,
  Typography,
  InputRef
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';

import { colors } from '@/styles/colors';
import { setSelectedProjects, toggleProjectSelection } from '@/features/project/project.slice';
import { fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { fetchBoardTaskGroups } from '@/features/board/board-slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';

interface ProjectItem extends IProjectViewModel {
  selected: boolean;
}

const ProjectsFilterDropdown = () => {
  const projectsInputRef = useRef<InputRef>(null);
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [searchQuery, setSearchQuery] = useState('');
  const [allProjects, setAllProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation('task-list-filters');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { selectedProjects, projectId: currentProjectId } = useAppSelector(state => state.projectReducer);

  // Fetch all projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const response = await projectsApiService.getProjects(
          0,      // index
          100,    // size
          null,   // field
          null,   // order
          null,   // search
          null,   // filter
          null,   // statuses
          null    // categories
        );
        const projects = (response.body?.data || []).map(project => ({
          ...project,
          selected: selectedProjects.includes(project.id || '')
        }));
        setAllProjects(projects);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [selectedProjects]);

  // Update selection state when selectedProjects changes
  useEffect(() => {
    setAllProjects(prev =>
      prev.map(project => ({
        ...project,
        selected: selectedProjects.includes(project.id || '')
      }))
    );
  }, [selectedProjects]);

  const selectedCount = useMemo(() => {
    return selectedProjects.length;
  }, [selectedProjects]);

  const filteredProjectsData = useMemo(() => {
    return allProjects.filter(project => 
      project.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allProjects, searchQuery]);

  const handleProjectSelection = useCallback(
    async (projectId: string | undefined, checked: boolean) => {
      if (!projectId || !currentProjectId) return;

      dispatch(toggleProjectSelection(projectId));

      // Refresh task data after changing selection
      if (projectView === 'list') {
        dispatch(fetchTaskGroups(currentProjectId));
      } else {
        dispatch(fetchBoardTaskGroups(currentProjectId));
      }
    },
    [currentProjectId, projectView, dispatch]
  );

  const handleClearAll = useCallback(() => {
    dispatch(setSelectedProjects([]));
    if (currentProjectId) {
      if (projectView === 'list') {
        dispatch(fetchTaskGroups(currentProjectId));
      } else {
        dispatch(fetchBoardTaskGroups(currentProjectId));
      }
    }
  }, [currentProjectId, projectView, dispatch]);

  const renderProjectItem = (project: ProjectItem) => (
    <List.Item
      className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
      key={project.id}
      style={{ display: 'flex', gap: 8, padding: '4px 8px', border: 'none' }}
    >
      <Checkbox
        id={project.id}
        checked={project.selected}
        onChange={e => handleProjectSelection(project.id, e.target.checked)}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: project.color_code || colors.lightGray,
              flexShrink: 0
            }}
          />
          <Flex vertical>
            <Typography.Text>{project.name}</Typography.Text>
            {project.category_name && (
              <Typography.Text style={{ fontSize: 12, color: colors.lightGray }}>
                {project.category_name}
              </Typography.Text>
            )}
          </Flex>
        </div>
      </Checkbox>
    </List.Item>
  );

  const projectsDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={projectsInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchInputPlaceholder')}
        />
        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }} loading={loading}>
          {filteredProjectsData.length ? (
            filteredProjectsData.map((project) => renderProjectItem(project))
          ) : (
            <Empty />
          )}
        </List>
        {selectedCount > 0 && (
          <Button size="small" onClick={handleClearAll} block>
            {t('clearAllText', { defaultValue: 'Clear All' })}
          </Button>
        )}
      </Flex>
    </Card>
  );

  const handleProjectsDropdownOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setTimeout(() => projectsInputRef.current?.focus(), 0);
      }
    },
    []
  );

  return (
    <Dropdown
      trigger={['click']}
      dropdownRender={() => projectsDropdownContent}
      onOpenChange={handleProjectsDropdownOpen}
    >
      <Badge count={selectedCount} size="small" offset={[-4, 4]}>
        <Button
          type="text"
          icon={<CaretDownFilled />}
          iconPosition="end"
          style={{ color: selectedCount > 0 ? colors.primary : undefined }}
        >
          {t('projectsFilterText', { defaultValue: 'Projects' })}
        </Button>
      </Badge>
    </Dropdown>
  );
};

export default ProjectsFilterDropdown;
