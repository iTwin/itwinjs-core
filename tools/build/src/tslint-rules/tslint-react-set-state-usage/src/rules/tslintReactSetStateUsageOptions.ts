/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export const OPTION_UPDATER_ONLY = "updater-only";
export const OPTION_ALLOW_OBJECT = "allow-object";

export interface IOptions {
  readonly updaterOnly: boolean;
  readonly allowObject: boolean;
}

export function parseOptions(ruleArguments: any[]): IOptions {
  const updaterOnly = ruleArguments.some((arg: any) => arg === OPTION_UPDATER_ONLY);
  const allowObject = ruleArguments.some((arg: any) => arg === OPTION_ALLOW_OBJECT);

  return {
    updaterOnly,
    allowObject,
  };
}
