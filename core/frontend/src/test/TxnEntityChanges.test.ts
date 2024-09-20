/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { EntityChanges, Metadata, TxnEntityChangeIterable, TxnEntityChangeType } from "../TxnEntityChanges";
import { NotifyEntitiesChangedArgs, NotifyEntitiesChangedMetadata } from "@itwin/core-common";

describe("TxnEntityMetadata", () => {
  describe("is", () => {
    it("returns false for unknown base class", () => {
      const a = new Metadata("a");
      expect(a.is("b")).toBe(false);
    });

    it("returns true for exact match", () => {
      const a = new Metadata("a");
      expect(a.is("a")).toBe(true);
    });

    it("returns true for direct base class", () => {
      const a = new Metadata("a");
      const b = new Metadata("b");
      b.baseClasses.push(a);

      expect(b.is("a")).toBe(true);
    });

    it("returns true for indirect base class", () => {
      const a = new Metadata("a");
      const b = new Metadata("b");
      const c = new Metadata("c");
      c.baseClasses.push(b);
      b.baseClasses.push(a);

      expect(c.is("a")).toBe(true);
    });
  });
});

describe("TxnEntityChanges", () => {
  it("populates metadata from args", () => {
    function populate(met: NotifyEntitiesChangedMetadata[]): Metadata[] {
      const args: NotifyEntitiesChangedArgs = {
        insertedMeta: [], updatedMeta: [], deletedMeta: [],
        meta: met,
      };

      const changes = new EntityChanges(args);
      return changes.metadata;
    }

    expect(populate([])).toEqual([]);

    expect(populate([{ name: "a", bases: [] }])).toEqual([new Metadata("a")]);

    let meta = populate([
      { name: "a", bases: [] },
      { name: "b", bases: [0] },
    ]);

    expect(meta.length).toEqual(2);
    expect(meta[0].classFullName).toEqual("a");
    expect(meta[1].classFullName).toEqual("b");
    expect(meta[1].is("a")).toBe(true);
    expect(meta[0].is("b")).toBe(false);

    meta = populate([
      { name: "b", bases: [1] },
      { name: "a", bases: [] },
    ]);

    expect(meta.length).toEqual(2);
    expect(meta[1].classFullName).toEqual("a");
    expect(meta[0].classFullName).toEqual("b");
    expect(meta[0].is("a")).toBe(true);
    expect(meta[1].is("b")).toBe(false);

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
      { name: "iguana", bases: [0, 8] },
    ]);

    expect(meta.length).toEqual(11);

    function expectMeta(index: number, name: string, bases?: string[]): void {
      const entry = meta[index];
      expect(entry.classFullName).toEqual(name);

      bases = bases ?? [];

      expect(entry.baseClasses.length).toBeLessThanOrEqual(bases.length);
      expect(entry.baseClasses.every((x) => bases!.includes(x.classFullName))).toBe(true);

      bases.push(name); // this.is(this) is always true.

      for (const test of meta) {
        expect(entry.is(test.classFullName)).toEqual(bases.includes(test.classFullName));
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

  function expectEntities(iter: TxnEntityChangeIterable, expected: Array<[id: number, ecclass: string, type: TxnEntityChangeType]>): void {
    const actual = Array.from(iter).map((x) => [x.id, x.metadata.classFullName, x.type]);
    expect(actual).toEqual(expected.map((x) => [`0x${x[0]}`, x[1], x[2]]));
  }

  it("iterates", () => {
    let changes = new EntityChanges({
      insertedMeta: [], updatedMeta: [], deletedMeta: [], meta: [],
    });

    expectEntities(changes, []);

    changes = new EntityChanges({
      inserted: "+1",
      deleted: "+2",
      updated: "+3",
      insertedMeta: [0],
      deletedMeta: [1],
      updatedMeta: [0],
      meta: [
        { name: "a", bases: [] },
        { name: "b", bases: [0] },
      ],
    });

    expectEntities(changes, [
      [1, "a", "inserted"],
      [2, "b", "deleted"],
      [3, "a", "updated"],
    ]);

    changes = new EntityChanges({
      inserted: "+1+5",
      updated: "+3+2+3",
      insertedMeta: [0, 1],
      deletedMeta: [],
      updatedMeta: [1, 1, 0],
      meta: [
        { name: "a", bases: [] },
        { name: "b", bases: [0] },
      ],
    });

    expectEntities(changes, [
      [1, "a", "inserted"],
      [6, "b", "inserted"],
      [3, "b", "updated"],
      [5, "b", "updated"],
      [8, "a", "updated"],
    ]);
  });

  it("provides filtered iteration", () => {
    const changes = new EntityChanges({
      inserted: "+1+1+1+1",
      insertedMeta: [0, 1, 2, 3],
      deleted: "+5+1",
      deletedMeta: [3, 2],
      updated: "+7+1+1",
      updatedMeta: [1, 2, 1],
      meta: [
        { name: "a", bases: [] },
        { name: "b", bases: [0] },
        { name: "c", bases: [1] },
        { name: "d", bases: [] },
      ],
    });

    expectEntities(changes.filter({ }), [
      [1, "a", "inserted"],
      [2, "b", "inserted"],
      [3, "c", "inserted"],
      [4, "d", "inserted"],
      [5, "d", "deleted"],
      [6, "c", "deleted"],
      [7, "b", "updated"],
      [8, "c", "updated"],
      [9, "b", "updated"],
    ]);

    expectEntities(changes.filter({ includeTypes: [] }), []);

    expectEntities(changes.filter({ includeTypes: ["deleted"] }), [
      [5, "d", "deleted"],
      [6, "c", "deleted"],
    ]);

    expectEntities(changes.filter({ includeTypes: ["inserted", "updated"] }), [
      [1, "a", "inserted"],
      [2, "b", "inserted"],
      [3, "c", "inserted"],
      [4, "d", "inserted"],
      [7, "b", "updated"],
      [8, "c", "updated"],
      [9, "b", "updated"],
    ]);

    expectEntities(changes.filter({ includeMetadata: (meta) => meta.classFullName === "b" }), [
      [2, "b", "inserted"],
      [7, "b", "updated"],
      [9, "b", "updated"],
    ]);

    expectEntities(changes.filter({ includeMetadata: (meta) => meta.is("b") }), [
      [2, "b", "inserted"],
      [3, "c", "inserted"],
      [6, "c", "deleted"],
      [7, "b", "updated"],
      [8, "c", "updated"],
      [9, "b", "updated"],
    ]);

    expectEntities(changes.filter({ includeMetadata: (meta) => meta.is("a"), includeTypes: ["inserted", "deleted" ]}), [
      [1, "a", "inserted"],
      [2, "b", "inserted"],
      [3, "c", "inserted"],
      [6, "c", "deleted"],
    ]);
  });
});
