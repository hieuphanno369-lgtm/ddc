import type { Instrumentation } from 'next';
import { errorFields, logger } from './src/lib/logger';

/**
 * P5-B Task 2 - kiem bien moi truong bat buoc luc khoi dong (production dung app neu thieu/sai) va
 * ghi log JSON cho loi request chua bat (khong lam vo trang, chi de lai dau vet trong log server).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { enforceServerEnv } = await import('./src/lib/env-check');
  enforceServerEnv();
}

export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  logger.error('request.unhandled', {
    method: request.method,
    path: request.path.split(/[?#]/)[0],
    routePath: context.routePath,
    routeType: context.routeType,
    ...errorFields(err),
  });
};
