/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EntityChanges, Metadata } from "../TxnEntityChanges";

describe.only("TxnEntityMetadata", () => {
  describe("is", () => {
    it("returns false for unknown base class", () => {
      const a = new Metadata("a");
      expect(a.is("b")).to.be.false;
    });

    it("returns true for exact match", () => {
      const a = new Metadata("a");
      expect(a.is("a")).to.be.true;
    });

    it("returns true for direct base class", () => {
      const a = new Metadata("a");
      const b = new Metadata("b");
      b.baseClasses.push(a);

      expect(b.is("a")).to.be.true;
    });

    it("returns true for indirect base class", () => {
      const a = new Metadata("a");
      const b = new Metadata("b");
      const c = new Metadata("c");
      c.baseClasses.push(b);
      b.baseClasses.push(a);

      expect(c.is("a")).to.be.true;
    });
  });
});

describe.only("TxnEntityChanges", () => {
  it("is populated from args", () => {
    
  });

  it("iterates", () => {
    
  });

  it("provides filtered iteration", () => {
    
  });
});
