import type { ApiRequest, ApiResponse } from './_lib/handlers.ts';
import { handleHealthRequest } from './_lib/handlers.ts';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleHealthRequest(req, res);
}
