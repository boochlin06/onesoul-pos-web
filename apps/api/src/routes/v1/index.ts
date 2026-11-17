import { createRouter } from '../common';
import { ordersRouter } from './orders.routes';
import { luckybagsRouter } from './luckybags.routes';
import { productsRouter } from './products.routes';
import { membersRouter } from './members.routes';
import { sessionsRouter } from './sessions.routes';
import { stocktakesRouter } from './stocktakes.routes';
import { brandRouter } from './brand.routes';
import { notificationsRouter } from './notifications.routes';

export const v1Routes = createRouter()
  .route('/orders', ordersRouter)
  .route('/luckybags', luckybagsRouter)
  .route('/products', productsRouter)
  .route('/members', membersRouter)
  .route('/sessions', sessionsRouter)
  .route('/stocktakes', stocktakesRouter)
  .route('/brand', brandRouter)
  .route('/notifications', notificationsRouter);
