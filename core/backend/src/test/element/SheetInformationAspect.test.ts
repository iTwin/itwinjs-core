/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

describe.only("SheetInformationAspect", () => {
  describe("with BisCore < 00.01.25", () => {

    describe("getSheetInformation", () => {
      it("returns undefined", () => {

      });
    });

    describe("setSheetInformation", () => {
      it("throws", () => {

      });
    });
  });

  describe("with BisCore >= 00.01.25", () => {
    describe("getSheetInformation", () => {
      it("returns undefined if no aspect exists", () => {

      });

      it("returns undefined if element is not a valid Sheet", () => {

      });

      it("returns information if aspect exists", () => {

      });
    });

    describe("setSheetInformation", () => {
      it("inserts aspect if it doesn't already exist", () => {

      });

      it("updates existing aspect", () => {

      });

      it("deletes existing aspect if information is undefined", () => {

      });

      it("is a no-op if information is undefined and no aspect exists", () => {

      });

      it("throws if element is not a valid Sheet", () => {

      });

      it("creates SheetOwnsSheetInformationAspect relationships", () => {

      });
    })
  });
});
