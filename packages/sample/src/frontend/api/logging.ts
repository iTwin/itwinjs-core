import { GetMetaDataFunction } from "@bentley/imodeljs-common";
import { LogFunction, Logger } from "@bentley/bentleyjs-core";

// tslint:disable:no-console
export default function init() {
  // Map between iModelJs LogFunction signature and console logger
  const errorLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Error: " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : ""));
  const warningLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Warning: " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : ""));
  const infoLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Info: " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : ""));
  Logger.initialize(errorLogger, warningLogger, infoLogger); // configure logging for imodeljs-core
}
