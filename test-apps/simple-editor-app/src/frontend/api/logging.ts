/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console
import { LogFunction, Logger } from "@bentley/bentleyjs-core";
import { GetMetaDataFunction } from "@bentley/imodeljs-common";

export default function init() {
  // map between iModelJs LogFunction signature and console logger
  const errorLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Error: " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : ""));
  const warningLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Warning: " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : ""));
  const infoLogger: LogFunction = (_category: string, message: string, getMetaData?: GetMetaDataFunction): void => console.log("Info: " + message + (getMetaData ? " " + JSON.stringify(getMetaData()) : ""));
  Logger.initialize(errorLogger, warningLogger, infoLogger);
}
