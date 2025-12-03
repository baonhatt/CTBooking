import { createServer } from "../server";

const app = createServer();

export default (req: any, res: any) => app(req, res);
