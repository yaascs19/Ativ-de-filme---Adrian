import type { ApiRequest, ApiResponse } from '../_lib/handlers.js';
import { handleAuthRequest } from '../_lib/handlers.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleAuthRequest(req, res);
}
