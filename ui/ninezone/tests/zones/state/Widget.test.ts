/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import TestProps from "./TestProps";
import NineZone from "@src/zones/state/NineZone";

describe("Widget", () => {
  describe("equals", () => {
    it("should return true for same widgets", () => {
      const nineZone = new NineZone(TestProps.defaultProps);
      nineZone.getWidget(1).equals(nineZone.getWidget(1)).should.true;
    });

    it("should return false for different widgets", () => {
      const nineZone = new NineZone(TestProps.defaultProps);
      nineZone.getWidget(1).equals(nineZone.getWidget(2)).should.false;
    });
  });
});
