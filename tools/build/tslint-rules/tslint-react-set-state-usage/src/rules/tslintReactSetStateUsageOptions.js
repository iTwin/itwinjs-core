/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";
/*---------------------------------------------------------------------------------------------
* This code has been adapted from
* [tslint-react-set-state-usage](https://github.com/sutrkiller/tslint-react-set-state-usage).
*--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOptions = exports.OPTION_ALLOW_OBJECT = exports.OPTION_UPDATER_ONLY = void 0;
exports.OPTION_UPDATER_ONLY = "updater-only";
exports.OPTION_ALLOW_OBJECT = "allow-object";
function parseOptions(ruleArguments) {
    const updaterOnly = ruleArguments.some((arg) => arg === exports.OPTION_UPDATER_ONLY);
    const allowObject = ruleArguments.some((arg) => arg === exports.OPTION_ALLOW_OBJECT);
    return {
        updaterOnly,
        allowObject,
    };
}
exports.parseOptions = parseOptions;
