import type { ApiRequest, ApiResponse } from '../../_lib/handlers';
import { handleEvaluateMovieRequest } from '../../_lib/handlers';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  await handleEvaluateMovieRequest(req, res);
}
