/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as Bunyan from "bunyan";
import { GetMetaDataFunction } from "@bentley/imodeljs-backend/lib/common/IModelError";
import { LogFunction, Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { IModelDb } from "@bentley/imodeljs-backend/lib/backend/IModelDb";
import ECPresentationManager from "@bentley/ecpresentation-backend/lib/backend/ECPresentationManager";
import { NodeAddonLoader } from "@bentley/imodeljs-nodeaddon/NodeAddonLoader";
import { NodeAddonRegistry } from "@bentley/imodeljs-backend/lib/backend/NodeAddonRegistry";

// Ensure that the imodeljs-core backend is included.
IModelDb;
ECPresentationManager;

// Initialize the Node addon
NodeAddonRegistry.registerAddon(NodeAddonLoader.loadAddon());

// Configure a standard bunyan logger
const bunyanLogger = Bunyan.createLogger({
  name: "MyApp",
  streams: [{ stream: process.stdout, level: "info" }],
});

// Map between iModelJs LogFunction signature and bunyan logger
const errorLogger: LogFunction = (message: string, getMetaData?: GetMetaDataFunction): void => bunyanLogger.error(getMetaData ? getMetaData() : {}, message);
const warningLogger: LogFunction = (message: string, getMetaData?: GetMetaDataFunction): void => bunyanLogger.warn(getMetaData ? getMetaData() : {}, message);
const infoLogger: LogFunction = (message: string, getMetaData?: GetMetaDataFunction): void => bunyanLogger.info(getMetaData ? getMetaData() : {}, message);
Logger.initialize(errorLogger, warningLogger, infoLogger); // configure logging for imodeljs-core
