import type { ApiRequest, ApiResponse } from '../_lib/handlers.js';
import { handleMovieByIdRequest } from '../_lib/handlers.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleMovieByIdRequest(req, res);
}
