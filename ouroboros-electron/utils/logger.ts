import { createLogger, format, transports } from "winston";
import { app } from "electron";
import { join } from "path";
import { is } from "./constants";

const logger = createLogger({});

if (is.dev) {
  logger.add(
    new transports.Console({
      level: "debug",
      format: format.combine(
        format.timestamp(),
        format.splat(),
        format.colorize({}),
        format.printf(
          (info) => `[${info.timestamp}][${info.level}]: ${info.message}`
        )
      ),
    })
  );
} else {
  logger.add(
    new transports.File({
      format: format.combine(format.timestamp(), format.json()),
      level: "warn",
      filename: join(app.getPath("userData"), "app.log"),
      maxsize: 1024 * 1024 * 2,
      maxFiles: 2,
    })
  );
}

export default logger;
