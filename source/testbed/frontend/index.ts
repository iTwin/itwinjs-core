/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";

(() => {
  // tslint:disable:no-var-requires
  const remote = require("electron").remote;
  remote.getCurrentWindow().setTitle("imodeljs-core testbed");
  remote.require("../../../lib/backend/index");
  // tslint:enable:no-var-requires
})();

describe("Hello World", () => it("should be true", () => {
  // tslint:disable-next-line:no-debugger
  debugger;
  assert(true);
}));
