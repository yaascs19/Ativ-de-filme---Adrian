import type { ApiRequest, ApiResponse } from '../_lib/handlers.js';
import { handleUserActivityRequest } from '../_lib/handlers.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleUserActivityRequest(req, res);
}
