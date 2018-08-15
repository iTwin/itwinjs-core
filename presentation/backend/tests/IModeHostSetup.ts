/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHost } from "@bentley/imodeljs-backend";

beforeEach(() => {
  IModelHost.shutdown();
  try {
    IModelHost.startup();
  } catch (_e) { }
});
