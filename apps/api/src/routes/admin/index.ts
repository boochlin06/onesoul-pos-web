import { createRouter } from '../common';
import { allocationRouter } from './allocation.routes';
import { inventoryRouter } from './inventory.routes';
import { transfersRouter } from './transfers.routes';
import { preordersRouter } from './preorders.routes';
import { auditRouter } from './audit.routes';
import { settingsRouter } from './settings.routes';
import { adminMembersRouter } from './members.routes';
import { adminSessionsRouter } from './sessions.routes';

export const adminRoutes = createRouter()
  .route('/allocation', allocationRouter)
  .route('/inventory', inventoryRouter)
  .route('/transfers', transfersRouter)
  .route('/preorders', preordersRouter)
  .route('/audit', auditRouter)
  .route('/settings', settingsRouter)
  .route('/members', adminMembersRouter)
  .route('/sessions', adminSessionsRouter);
