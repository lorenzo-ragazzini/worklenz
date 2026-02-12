# Plan: Fix "% completed" slider (Roadmap/Gantt)

Goal
- Stop excessive backend requests when dragging the "% completed" slider by implementing a 500ms debounce + AbortController cancellation, keep optimistic UI, and send a single backend update when user stops dragging.

Scope
- Frontend only (worklenz-frontend). Backend API assumed available at task progress endpoint; if missing, create a single PATCH/PUT endpoint to persist progress.

Files to change
- `worklenz-frontend/src/components/roadmap/SvarGanttChart.tsx`
  - central SVAR Gantt event handlers (handleTaskUpdate, handleRequestData)
- `worklenz-frontend/src/components/advanced-gantt/DraggableTaskBar.tsx`
  - if slider originates here, add same debounce/cancel logic
- `worklenz-frontend/src/api/*` (prefer `tasks.api.service.ts` or existing roadmap api service)
  - ensure a single endpoint method exists: updateTaskProgress(taskId, progress)

Implementation steps
1. Add utilities
   - Implement/use a debounced callback helper (500ms). Prefer a small custom hook useDebouncedCallback or lodash.debounce.
   - Create an AbortController map ref: Map<taskId, AbortController> to cancel in-flight progress requests for the same task.

2. Update Gantt progress handler
   - Replace immediate network calls in SVAR handler with:
     - Immediately update local UI state / redux slice for optimistic feedback (dispatch local progress update).
     - Call debouncedSendProgress(taskId, progress).

3. Debounced sender
   - debouncedSendProgress should:
     - Abort any existing controller for taskId (controllerMap.get(taskId)?.abort()).
     - Create new AbortController, store in map.
     - Call API client with the controller.signal to send a single request when debounce fires.
     - On success: clear controller and confirm state.
     - On failure (non-abort): rollback optimistic update (restore previous progress) and show toast error.

4. API client
   - Add/update a method in `worklenz-frontend/src/api/tasks/tasks.api.service.ts` (or `roadmap.api.service.ts`) called `updateTaskProgress(taskId, progress, options)` that accepts a signal for AbortController and performs one PATCH/PUT to `/api/v1/tasks/progress/${taskId}` or the existing endpoint.

5. Edge cases
   - If user does minor drags producing same integer progress repeatedly, dedupe by checking last-sent progress per task in controllerMap or a small cache.
   - Ensure progress values normalized to integer 0-100 before sending.

6. UX
   - Keep optimistic UI change when dragging (so progress bar follows the slider).
   - Show subtle spinner or per-task saving state while the debounced request is pending.
   - On failure, show toast with message: "Could not save progress — changes reverted" and restore previous progress.

7. Tests & QA (you will run)
   - Manual reproduction steps:
     1. Open project roadmap Gantt page for a project with multiple tasks.
     2. Open DevTools Network tab.
     3. Drag the "% completed" slider continuously; assert only one request is sent after you stop dragging (within ~500ms).
     4. Verify optimistic UI updates immediately while dragging and persists after request finishes.
     5. Simulate a failing response and verify rollback + toast shown.
   - Provide a simple e2e checklist (will be delivered with PR) for you to run.

Deliverables
- Patch candidate modifying the files above with debounce + AbortController logic, optimistic update, and API method.
- Short testing checklist (manual steps) for you to run in local environment.
- PR description and QA checklist.

Notes
- After you approve, I will switch to code mode and implement the changes in a focused PR for the slider fix only.
- I will avoid changing link/precedence features in this PR; those will follow once slider fix is merged.
