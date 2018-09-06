/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PresentationError, PresentationStatus } from "../lib/Error";

describe("PresentationError", () => {

  describe("[get] name", () => {

    it("returns name of PresentationStatus when exists", () => {
      const error = new PresentationError(PresentationStatus.UseAfterDisposal);
      expect(error.name).to.eq("UseAfterDisposal");
    });

    it("returns error number when it's not in PresentationStatus enum", () => {
      const error = new PresentationError(1);
      expect(error.name).to.eq("Unknown Error (1)");
    });

  });

});
