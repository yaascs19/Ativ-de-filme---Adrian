import type { ApiRequest, ApiResponse } from './_lib/handlers.js';
import { handleHealthRequest } from './_lib/handlers.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleHealthRequest(req, res);
}
