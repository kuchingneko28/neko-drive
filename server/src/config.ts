export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "1073741824", 10);
export const PORT = parseInt(process.env.PORT || "3000", 10);
export const IDLE_TIMEOUT = parseInt(process.env.IDLE_TIMEOUT || "255", 10);
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 100;