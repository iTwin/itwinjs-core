/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECPresentationError, ECPresentationStatus } from "@src/Error";

describe("ECPresentationError", () => {

  describe("[get] name", () => {

    it("returns name of ECPresentationStatus when exists", () => {
      const error = new ECPresentationError(ECPresentationStatus.UseAfterDisposal);
      expect(error.name).to.eq("UseAfterDisposal");
    });

    it("returns error number when it's not in ECPresentationStatus enum", () => {
      const error = new ECPresentationError(1);
      expect(error.name).to.eq("Unknown Error (1)");
    });

  });

});
