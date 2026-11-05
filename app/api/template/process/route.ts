import { edgeProxy } from '@/lib/edge-proxy';
export const POST = (req: Request) => edgeProxy(req, 'template');
