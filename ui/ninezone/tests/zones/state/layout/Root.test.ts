/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import Root from "../../../../src/zones/state/layout/Root";

describe("Root", () => {
  it("should construct an instance", () => {
    new Root({ height: 0, width: 0 }, false);
  });
});
