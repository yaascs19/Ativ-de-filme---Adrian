import type { ApiRequest, ApiResponse } from './_lib/handlers';
import { handleHealthRequest } from './_lib/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleHealthRequest(req, res);
}
