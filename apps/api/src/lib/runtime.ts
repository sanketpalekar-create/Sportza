/** True when running inside a Vercel serverless / edge-adjacent Node function. */
export const isVercel = Boolean(process.env.VERCEL);

/** Opt-in flag for local testing of serverless behaviour. */
export const isServerless =
  isVercel || process.env.SPORTZA_SERVERLESS === "1";

/** Long-lived process: Socket.io + BullMQ workers are safe to start. */
export const canRunPersistentWorkers = !isServerless;
