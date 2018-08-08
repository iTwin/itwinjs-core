import * as Bunyan from "bunyan";
import { GetMetaDataFunction } from "@bentley/imodeljs-common/lib/IModelError";
import { LogFunction, Logger } from "@bentley/bentleyjs-core/lib/Logger";

export default function init() {
  // configure a standard bunyan logger
  const bunyanLogger = Bunyan.createLogger({
    name: "MyApp",
    streams: [{ stream: process.stdout, level: "info" }],
  });
  // Map between iModelJs LogFunction signature and bunyan logger
  const errorLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => bunyanLogger.error(getMetaData ? getMetaData() : {}, message);
  const warningLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => bunyanLogger.warn(getMetaData ? getMetaData() : {}, message);
  const infoLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => bunyanLogger.info(getMetaData ? getMetaData() : {}, message);
  Logger.initialize(errorLogger, warningLogger, infoLogger); // configure logging for imodeljs-core
}
