"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Logging.serviceLoggingExample
const bentleyjs_core_1 = require("@bentley/bentleyjs-core");
const BunyanLoggerConfig_1 = require("@bentley/bentleyjs-core/lib/BunyanLoggerConfig");
const SeqLoggerConfig_1 = require("@bentley/bentleyjs-core/lib/SeqLoggerConfig");
function initializeLogging() {
    // Read the configuration parameters for my service. Some config
    // params might be specified as envvars.
    const config = require("./MyService.config.json");
    const defaultConfigValues = {
        "MY-SERVICE-DEFAULT-LOG-LEVEL": "Error",
        "MY-SERVICE-SEQ-URL": "http://localhost",
        "MY-SERVICE-SEQ-PORT": "5341",
    };
    bentleyjs_core_1.EnvMacroSubst.replaceInProperties(config, true, defaultConfigValues);
    if (bentleyjs_core_1.EnvMacroSubst.anyPropertyContainsEnvvars(config.seq, true)) {
        throw new bentleyjs_core_1.BentleyError(65574 /* NotFound */, "Unmatched environment variables in configuration.");
    }
    // Set up to log to the seq service
    if ("seq" in config) {
        if (SeqLoggerConfig_1.SeqLoggerConfig.validateProps(config.seq))
            BunyanLoggerConfig_1.BunyanLoggerConfig.logToBunyan(SeqLoggerConfig_1.SeqLoggerConfig.createBunyanSeqLogger(config.seq, "MyService"));
    }
    // Configure log levels by category
    if ("loggerConfig" in config) {
        if (bentleyjs_core_1.Logger.validateProps(config.loggerConfig))
            bentleyjs_core_1.Logger.configureLevels(config.loggerConfig);
    }
}
exports.initializeLogging = initializeLogging;
// __PUBLISH_EXTRACT_END__
//# sourceMappingURL=Logging.js.map