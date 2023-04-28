/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { PresentationError, PresentationStatus } from "../presentation-common";

describe("PresentationError", () => {
  describe("[get] name", () => {
    it("returns name of PresentationStatus when exists", () => {
      const error = new PresentationError(PresentationStatus.InvalidArgument);
      expect(error.name).to.eq("InvalidArgument");
    });

    it("returns error number when it's not in PresentationStatus enum", () => {
      const error = new PresentationError(999 as PresentationStatus);
      expect(error.name).to.eq("Unknown Error (999)");
    });
  });
});
