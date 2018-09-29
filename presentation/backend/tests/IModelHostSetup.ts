/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHost } from "@bentley/imodeljs-backend";

beforeEach(() => {
  IModelHost.shutdown();
  try {
    IModelHost.startup();
  } catch (_e) { }
});
