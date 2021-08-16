/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/naming-convention */

// __PUBLISH_EXTRACT_START__ Logging-configureLoggingAndStreams.example-code
import { BentleyError, EnvMacroSubst, IModelStatus, Logger, LoggerLevelsConfig } from "@bentley/bentleyjs-core";

export function initializeLogging(): void {
  // Read the configuration parameters for my service. Some config
  // params might be specified as envvars.
  const config = require("./MyService.config.json");

  const defaultConfigValues: any = {
    "ROBOT-WORLD-DEFAULT-LOG-LEVEL": "Error",
    "ROBOT-WORLD-SEQ-URL": "http://localhost",
    "ROBOT-WORLD-SEQ-PORT": "5341",
  };

  EnvMacroSubst.replaceInProperties(config, true, defaultConfigValues);
  if (EnvMacroSubst.anyPropertyContainsEnvvars(config.seq, true)) {
    throw new BentleyError(IModelStatus.NotFound, "Unmatched environment variables in configuration.");
  }

  Logger.initializeToConsole();

  // Configure log levels by category
  if ("loggerConfig" in config) {
    Logger.validateProps(config.loggerConfig);
    Logger.configureLevels(config.loggerConfig as LoggerLevelsConfig);
  }
}
// __PUBLISH_EXTRACT_END__
