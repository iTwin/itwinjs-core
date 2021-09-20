/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { IModelApp } from "../../IModelApp";
import { ITwinIdArg, PreferenceArg, PreferenceKeyArg, TokenArg } from "../../UserPreferences";

let iModelPrefs: Map<string, any> | undefined = undefined;
let iTwinPrefs: Map<string, any> | undefined = undefined;
export function setup() {
  if (undefined === iModelPrefs || undefined === iTwinPrefs) {
    iModelPrefs = new Map<string, any>();
    iTwinPrefs = new Map<string, any>();
  }

  const getStub = async (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => {
    if (undefined === iModelPrefs || undefined === iTwinPrefs)
      throw new Error("The user preferences mock is not properly setup - please run the `setup` method.");

    let returnVal = undefined;
    if (arg.iModelId)
      returnVal = iModelPrefs.get(arg.key);

    if (undefined !== returnVal)
      return returnVal;

    if (arg.iTwinId)
      returnVal = iModelPrefs.get(arg.key);

    return returnVal;
  };

  const deleteStub = async (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => {
    if (undefined === iModelPrefs || undefined === iTwinPrefs)
      throw new Error("The user preferences mock is not properly setup - please run the `setup` method.");

    if (arg.iModelId)
      iModelPrefs.delete(arg.key);
    if (arg.iTwinId)
      iTwinPrefs.delete(arg.key);
  };

  const saveStub = async (arg: PreferenceArg & ITwinIdArg & TokenArg) => {
    if (undefined === iModelPrefs || undefined === iTwinPrefs)
      throw new Error("The user preferences mock is not properly setup - please run the `setup` method.");

    if (arg.iModelId)
      iModelPrefs.set(arg.key, arg.content);
    if (arg.iTwinId)
      iTwinPrefs.set(arg.key, arg.content);
  };

  sinon.replaceGetter(IModelApp, "userPreferences", () => {
    return {
      get: getStub,
      save: saveStub,
      delete: deleteStub,
    };
  });
}

export function restore() {
  iModelPrefs = undefined;
  iTwinPrefs = undefined;
}
