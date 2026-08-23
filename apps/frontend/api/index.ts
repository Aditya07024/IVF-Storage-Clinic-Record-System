import app from '../../backend/src/main.js';

export default function handler(req: any, res: any) {
  return app(req, res);
}
