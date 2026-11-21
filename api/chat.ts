import type { ApiRequest, ApiResponse } from './_lib/handlers.js';
import { handleChatRequest } from './_lib/handlers.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleChatRequest(req, res);
}
