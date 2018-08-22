/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { NineZone, getDefaultProps } from "../../../../src/zones/state/NineZone";
import Root from "../../../../src/zones/state/layout/Root";

describe("Root", () => {
  it("should construct an instance", () => {
    new Root(new NineZone(getDefaultProps()));
  });
});
