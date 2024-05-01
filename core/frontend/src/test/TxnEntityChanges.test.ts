/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { EntityChanges, Metadata } from "../TxnEntityChanges";
import { NotifyEntitiesChangedArgs, NotifyEntitiesChangedMetadata } from "@itwin/core-common";

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
  it("populates metadata from args", () => {
    function populate(meta: NotifyEntitiesChangedMetadata[]): Metadata[] {
      const args: NotifyEntitiesChangedArgs = {
        insertedMeta: [], updatedMeta: [], deletedMeta: [],
        meta,
      };

      const changes = new EntityChanges(args);
      return changes.metadata;
    }

    expect(populate([])).to.deep.equal([]);

    expect(populate([{ name: "a", bases: [] }])).to.deep.equal([new Metadata("a")]);

    let meta = populate([
      { name: "a", bases: [] },
      { name: "b", bases: [0] },
    ]);

    expect(meta.length).to.equal(2);
    expect(meta[0].classFullName).to.equal("a");
    expect(meta[1].classFullName).to.equal("b");
    expect(meta[1].is("a")).to.be.true;
    expect(meta[0].is("b")).to.be.false;

    meta = populate([
      { name: "b", bases: [1] },
      { name: "a", bases: [] },
    ]);

    expect(meta.length).to.equal(2);
    expect(meta[1].classFullName).to.equal("a");
    expect(meta[0].classFullName).to.equal("b");
    expect(meta[0].is("a")).to.be.true;
    expect(meta[1].is("b")).to.be.false;

    meta = populate([
      { name: "reptile", bases: [1] },
      { name: "animal", bases: [] },
      { name: "croton", bases: [7] },
      { name: "cat", bases: [5] },
      { name: "dog", bases: [5] },
      { name: "mammal", bases: [1] },
      { name: "amoeba", bases: [] },
      { name: "plant", bases: [] },
      { name: "green", bases: [] },
      { name: "ivy", bases: [8, 7] },
      { name: "iguana", bases: [0, 8] }
    ]);

    expect(meta.length).to.equal(11);

    function expectMeta(index: number, name: string, bases?: string[]): void {
      const entry = meta[index];
      expect(entry.classFullName).to.equal(name);

      bases = bases ?? [];
      expect(entry.baseClasses.length).most(bases.length);
      expect(entry.baseClasses.every((x) => bases!.includes(x.classFullName))).to.be.true;

      bases.push(name); // this.is(this) is always true.

      for (const test of meta) {
        expect(entry.is(test.classFullName)).to.equal(bases.includes(test.classFullName));
      }
    }

    expectMeta(0, "reptile", ["animal"]);
    expectMeta(1, "animal");
    expectMeta(2, "croton", ["plant"]);
    expectMeta(3, "cat", ["mammal", "animal"]);
    expectMeta(4, "dog", ["mammal", "animal"]);
    expectMeta(5, "mammal", ["animal"]);
    expectMeta(6, "amoeba");
    expectMeta(7, "plant");
    expectMeta(8, "green");
    expectMeta(9, "ivy", ["green", "plant"]);
    expectMeta(10, "iguana", ["reptile", "green", "animal"]);
  });

  it("iterates", () => {
    
  });

  it("provides filtered iteration", () => {
    
  });
});
