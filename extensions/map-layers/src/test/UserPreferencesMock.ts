/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { MapLayersUI } from "../mapLayers";
import type { ITwinIdArg, PreferenceArg, PreferenceKeyArg, TokenArg } from "@itwin/core-frontend";

let iModelPrefs: Map<string, any> | undefined;
let iTwinPrefs: Map<string, any> | undefined;
export function setup() {
  if (undefined === iModelPrefs || undefined === iTwinPrefs) {
    iModelPrefs = new Map<string, any>();
    iTwinPrefs = new Map<string, any>();
  }

  const getStub = async (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => {
    if (undefined === iModelPrefs || undefined === iTwinPrefs)
      throw new Error("The user preferences mock is not properly setup - please run the `setup` method.");

    // If the arg.key isn't set, expect the return of all values since the only namespace used is the MapLayer's one.
    // A real implementation would need to actual find all values in the namespace or loop over the list of values and return the ones
    // that start with the namespace.

    let returnVal;
    if (arg.iModelId) {
      if (!arg.key)
        return Array.from(iModelPrefs.values());
      returnVal = iModelPrefs.get(arg.key);
    }

    if (undefined !== returnVal)
      return returnVal;

    if (arg.iTwinId) {
      if (!arg.key)
        return Array.from(iTwinPrefs.values());
      returnVal = iTwinPrefs.get(arg.key);
    }

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

  sinon.stub(MapLayersUI, "iTwinConfig").get(() => ({
    get: getStub,
    save: saveStub,
    delete: deleteStub,
  }));
}

export function restore() {
  iModelPrefs = undefined;
  iTwinPrefs = undefined;
}
