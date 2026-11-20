import type { ApiRequest, ApiResponse } from './_lib/handlers.ts';
import { handleChatRequest } from './_lib/handlers.ts';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleChatRequest(req, res);
}
