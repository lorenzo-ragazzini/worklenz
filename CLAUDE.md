# Worklenz Codebase Knowledge

## Project Overview

Worklenz is a project management application with:
- **Frontend**: React + TypeScript + Vite + Ant Design
- **Backend**: Node.js + Express + PostgreSQL
- **State Management**: Redux Toolkit

## Directory Structure

```
worklenz/
├── worklenz-frontend/          # React frontend application
│   ├── src/
│   │   ├── app/routes/         # Route definitions
│   │   ├── components/         # Reusable components
│   │   ├── features/           # Redux slices and feature logic
│   │   ├── pages/              # Page components
│   │   ├── lib/                # Configuration and constants
│   │   └── shared/             # Shared utilities and imports
│   └── public/locales/         # i18n translations (en, de, es, pt, zh, ko, alb)
├── worklenz-backend/           # Express backend
└── docker-compose.yaml         # Docker configuration
```

## Key Configuration Files

| Purpose | File |
|---------|------|
| Navigation routes | `worklenz-frontend/src/features/navbar/navRoutes.ts` |
| Main app routes | `worklenz-frontend/src/app/routes/main-routes.tsx` |
| Project view tabs | `worklenz-frontend/src/lib/project/project-view-constants.ts` |
| Settings tabs | `worklenz-frontend/src/lib/settings/settings-constants.ts` |

## Feature Flags (Environment Variables)

### Frontend (.env)
| Flag | Default | Description |
|------|---------|-------------|
| `VITE_ENABLE_RECAPTCHA` | false | Enable reCAPTCHA on auth pages |
| `VITE_ENABLE_GOOGLE_LOGIN` | false | Enable Google OAuth login |
| `VITE_ENABLE_SURVEY_MODAL` | false | Enable survey modal prompts |

### Backend (.env)
| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_EMAIL_CRONJOBS` | true | Enable email notification cron jobs |
| `ENABLE_RECURRING_JOBS` | true | Enable recurring task jobs |

## Hidden/Disabled Features

### Fully Implemented but Hidden

1. **Roadmap/Gantt Tab** (ENABLED)
   - Location: `src/pages/projects/project-view-1/roadmap/`
   - Added to project view tabs in `project-view-constants.ts`
   - Uses `gantt-task-react` library
   - Redux slice: `src/features/roadmap/roadmap-slice.ts`

2. **Schedule Navigation** (ENABLED)
   - Location: `src/pages/schedule/schedule.tsx`
   - Route: `/worklenz/schedule`
   - Admin-only access

3. **Gantt Demo Page**
   - Route: `/worklenz/gantt-demo`
   - Location: `src/pages/GanttDemoPage.tsx`
   - Experimental/demo page

### Stub/Incomplete Features

1. **Workload View**
   - Location: `src/pages/projects/project-view-1/workload/`
   - Returns only `<div>ProjectViewWorkload</div>`
   - Backend APIs exist at `/api/workload/*`

2. **Bulk Actions** (in `src/components/task-list-v2/hooks/useBulkActions.ts`)
   - Bulk Duplicate (stub - line 298)
   - Bulk Export (stub - line 315)
   - Bulk Set Due Date (stub - line 329)

### Legacy/Alternative Implementations

| Current | Legacy/Alternative |
|---------|-------------------|
| `src/pages/schedule/` | `src/pages/schedule-old/` |
| `src/pages/projects/projectView/` | `src/pages/projects/project-view-1/` |
| `src/components/task-list/` | `src/components/task-list-v2/` |
| `src/components/kanban-board-management/` | `src/components/kanban-board-management-v2/` |

## Adding New Project View Tabs

To add a new tab to project views, edit `src/lib/project/project-view-constants.ts`:

1. Add lazy import:
```typescript
const MyNewTab = React.lazy(() => import('@/pages/projects/project-view-1/my-new-tab'));
```

2. Add to fallback labels (both objects):
```typescript
myNewTab: 'My New Tab',
```

3. Add tab item:
```typescript
{
  index: 7,
  key: 'myNewTab',
  label: getTabLabel('myNewTab'),
  element: React.createElement(
    Suspense,
    { fallback: React.createElement(InlineSuspenseFallback) },
    React.createElement(MyNewTab)
  ),
},
```

4. Add case in `updateTabLabels`:
```typescript
case 'myNewTab':
  item.label = getTabLabel('myNewTab');
  break;
```

5. Add translations to all `public/locales/*/project-view.json` files.

## Adding Navigation Links

Edit `src/features/navbar/navRoutes.ts`:

```typescript
{
  name: 'myRoute',      // Translation key in navbar.json
  path: '/worklenz/my-route',
  adminOnly: false,     // Set true for admin-only
  freePlanFeature: true // Set false to hide from free plan
},
```

## Common Import Patterns

```typescript
// Ant Design components (use shared imports)
import { Button, Flex, Typography } from '@/shared/antd-imports';

// Redux hooks
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';

// Task drawer
import { setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
```

## Important Slice Files

| Feature | Slice Location |
|---------|---------------|
| Roadmap | `src/features/roadmap/roadmap-slice.ts` |
| Task Drawer | `src/features/task-drawer/task-drawer.slice.ts` |
| Tasks | `src/features/tasks/tasks.slice.ts` |
| Theme | `src/features/theme/` (themeReducer) |
| Projects | `src/features/projects/` |

## Admin-Only Features

These features require admin/owner role:
- Schedule page
- Settings: Clients, Job Titles, Labels, Categories, Templates, Team Members, Teams
- Admin Center (all routes)

## Translations

7 locales supported: `en`, `de`, `es`, `pt`, `zh`, `ko`, `alb`

Translation files location: `public/locales/{locale}/*.json`

Key translation files:
- `navbar.json` - Navigation labels
- `project-view.json` - Project view tab labels
- `settings.json` - Settings page labels

## Roadmap API Integration

The Roadmap feature is connected to real project data via the backend API.

### API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /roadmap-gannt/chart-dates/:projectId` | Returns timeline date range and calendar data |
| `GET /roadmap-gannt/task-groups/:projectId` | Returns tasks grouped by status/priority/phase |

### Frontend Files
| File | Purpose |
|------|---------|
| `src/api/roadmap/roadmap.api.service.ts` | API service for roadmap endpoints |
| `src/features/roadmap/roadmap-slice.ts` | Redux slice with async thunks |
| `src/pages/projects/project-view-1/roadmap/project-view-roadmap.tsx` | Main component |
| `src/pages/projects/project-view-1/roadmap/roadmap-grant-chart.tsx` | Gantt chart component |
| `src/pages/projects/project-view-1/roadmap/roadmap-table/roadmap-table.tsx` | Task table component |

### Key Functions
```typescript
// Fetch roadmap data
dispatch(fetchChartDates({ projectId, timeZone }));
dispatch(fetchRoadmapTasks({ projectId, group: 'status', timeZone }));

// Transform backend tasks to Gantt format
import { transformToGanttTasks } from '@/features/roadmap/roadmap-slice';
const ganttTasks = transformToGanttTasks(taskGroups);
```

### Backend Controller
- Location: `worklenz-backend/src/controllers/project-roadmap/roadmap-tasks-controller-v2.ts`
- Groups tasks by status, priority, or phase
- Returns tasks with `start_date`, `end_date`, `status_category`

## Known Issues Fixed

1. **Roadmap import errors**: The roadmap components had incorrect imports referencing `toggleTaskDrawer` from wrong slice. Fixed by using `setShowTaskDrawer` from `task-drawer.slice.ts`.

2. **Roadmap dates**: Originally used hardcoded demo data. Now connected to real project data via API.

3. **Roadmap API integration**: Frontend was not calling backend endpoints. Added `roadmap.api.service.ts` and async thunks in Redux slice.