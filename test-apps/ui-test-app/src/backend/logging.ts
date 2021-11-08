/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, LogLevel } from "@itwin/core-bentley";
import { BackendLoggerCategory, NativeLoggerCategory } from "@itwin/core-backend";
import { PresentationBackendNativeLoggerCategory } from "@itwin/presentation-backend";
import { ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";

/** Initializes logging based on the configuration json file */
export function initializeLogging() {

  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Error);

  Logger.setLevel(BackendLoggerCategory.IModelDb, LogLevel.Trace);
  Logger.setLevel(BackendLoggerCategory.IModelHost, LogLevel.Trace);
  Logger.setLevel(IModelHubClientLoggerCategory.FileHandlers, LogLevel.Trace);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation, LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation_Connections, LogLevel.Info);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation_RulesEngine_Threads, LogLevel.Info);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation_RulesEngine_Content, LogLevel.Info);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation_RulesEngine_Navigation, LogLevel.Info);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation_RulesEngine_Navigation_Cache, LogLevel.Warning);
  Logger.setLevel(NativeLoggerCategory.ECObjectsNative, LogLevel.Warning);
  Logger.setLevel(NativeLoggerCategory.UnitsNative, LogLevel.Warning);
  Logger.setLevel(NativeLoggerCategory.BeSQLite, LogLevel.Warning);
  Logger.setLevel(NativeLoggerCategory.DgnCore, LogLevel.Warning);
  Logger.setLevel(ITwinClientLoggerCategory.Clients, LogLevel.Trace);
  Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, LogLevel.Trace);
}
