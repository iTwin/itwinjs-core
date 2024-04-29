/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EntityClassesMetadata, EntityClassMetadata } from "../EntityClassMetadata";

describe.only("EntityClassMetadata", () => {
  class Classes extends EntityClassesMetadata {
    public constructor() {
      super(() => Promise.resolve([]));
    }
  }

  describe("is", () => {
    it("returns false for unknown base class", () => {
      const classes = new Classes();
      const a = classes.add({ name: "a", id: "0xa" });
      expect(a.is("b")).to.be.false;
      expect(a.is("0xb")).to.be.false;
    });

    it("returns true for exact match", () => {
      const classes = new Classes();
      const a = classes.add({ name: "a", id: "0xa" });
      expect(a.is(a)).to.be.true;
      expect(a.is("a")).to.be.true;
      expect(a.is("0xa")).to.be.true;
    });

    it("returns true for direct base class", () => {
      const classes = new Classes();
      const a = classes.add({ id: "0xa", name: "a" });
      const b = classes.add({ id: "0xb", name: "b" });
      b.addBaseClass(a);
      
      expect(b.is(a)).to.be.true;
      expect(b.is("a")).to.be.true;
      expect(b.is("0xa")).to.be.true;

      expect(a.is(b)).to.be.false;
      expect(a.is("b")).to.be.false;
      expect(a.is("0xb")).to.be.false;
    });

    it("returns true for indirect base class", () => {
      const classes = new Classes();
      const a = classes.add({ name: "a", id: "0xa" });
      const b = classes.add({ name: "b", id: "0xb" });
      const c = classes.add({ name: "c", id: "0xc" });

      c.addBaseClass(b);
      b.addBaseClass(a);

      expect(c.is(a)).to.be.true;
      expect(c.is("a")).to.be.true;
      expect(c.is("0xa")).to.be.true;

      expect(a.is(c)).to.be.false;
      expect(a.is("c")).to.be.false;
      expect(a.is("0xc")).to.be.false;
    });

    it("treats class names case-insensitively", () => {
      const classes = new Classes();
      const baad = classes.add({ name: "baad", id: "0xbaad" });
      const feed = classes.add({ name: "feed", id: "0xfeed" });

      feed.addBaseClass(baad);

      expect(feed.is("baad")).to.be.true;
      expect(feed.is("BAAD")).to.be.true;
      expect(feed.is("BaaD")).to.be.true;
      expect(feed.is("bAaD")).to.be.true;

      expect(feed.is("0xbaad")).to.be.true;
      expect(feed.is("0xBAAD")).to.be.false;
    });
  });
});

describe.only("EntityClassesMetadata", () => {
  
});
