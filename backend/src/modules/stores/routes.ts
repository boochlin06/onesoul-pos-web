import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { authenticate } from '../../plugins/auth';

export async function storeRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate] }, async () => {
    const stores = await prisma.store.findMany({
      orderBy: { id: 'asc' },
    });
    return { success: true, data: stores };
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      return reply.status(404).send({ success: false, message: '找不到此門市' });
    }
    return { success: true, data: store };
  });
}
