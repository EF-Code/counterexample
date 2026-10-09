import pino from "pino";

export const logger = pino({
  level: process.env["NODE_ENV"] === "test" ? "silent" : "info",
  ...(process.env["NODE_ENV"] === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});
