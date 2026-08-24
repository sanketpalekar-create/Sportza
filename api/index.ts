/**
 * Vercel serverless entry — Express app (no listen / Socket.io / BullMQ workers).
 * All `/api/*` traffic is rewritten here via root vercel.json.
 */
import { createApp } from "../apps/api/src/app";

const app = createApp();

export default app;
