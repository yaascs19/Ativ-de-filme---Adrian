import type { ApiRequest, ApiResponse } from './_lib/handlers';
import { handleChatRequest } from './_lib/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleChatRequest(req, res);
}
