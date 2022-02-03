/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import type { Id64String, OrderedId64Iterable} from "@itwin/core-bentley";
import { CompressedId64Set, DbOpcode, Guid, TransientIdSequence } from "@itwin/core-bentley";
import type { Range3dProps } from "@itwin/core-geometry";
import { Range3d } from "@itwin/core-geometry";
import type { ModelGeometryChangesProps } from "../ModelGeometryChanges";
import { ElementGeometryChange, ModelGeometryChanges } from "../ModelGeometryChanges";

// Each test is list of inserted, updated, and/or deleted element Ids; along with modelId.
// We choose an arbitrary range for each insert or update.
// We produce a SortedArray<ElementGeometryChange> from input
// We make another SortedArray<ElementGeometryChange> except this one allows duplicates
// We make a ModelGeometryChangesProps
// We make an iterator and populate our second sorted array
// We verify the contents of the arrays match

const ids = new TransientIdSequence();

const range = Range3d.createXYZXYZ(1, 2, 3, -3, -2, -1);
function nextRange(): Range3d {
  range.low.x -= 1;
  range.high.y += 1;
  return range.clone();
}

class ElementChangeSets {
  public inserts = new Set<ElementGeometryChange>();
  public updates = new Set<ElementGeometryChange>();
  public deletes = new Set<ElementGeometryChange>();
}

function generateElementChanges(numInserts: number, numUpdates: number, numDeletes: number): ElementChangeSets {
  const changes = new ElementChangeSets();
  for (let i = 0; i < numInserts; i++)
    changes.inserts.add({ id: ids.next, type: DbOpcode.Insert, range: nextRange() });

  for (let i = 0; i < numUpdates; i++)
    changes.updates.add({ id: ids.next, type: DbOpcode.Update, range: nextRange() });

  for (let i = 0; i < numDeletes; i++)
    changes.deletes.add({ id: ids.next, type: DbOpcode.Delete });

  return changes;
}

function* elementIdIterator(changes: Set<ElementGeometryChange>): Iterator<Id64String> {
  for (const change of changes)
    yield change.id;
}

function elementIdIterable(changes: Set<ElementGeometryChange>): OrderedId64Iterable {
  return { [Symbol.iterator]: () => elementIdIterator(changes) };
}

function elementRangesToJSON(changes: Set<ElementGeometryChange>): Range3dProps[] {
  const ranges: Range3dProps[] = [];
  for (const change of changes) {
    expect(change.type).not.to.equal(DbOpcode.Delete);
    if (DbOpcode.Delete !== change.type)
      ranges.push(change.range.toJSON());
  }

  return ranges;
}

function elementChangesToJSON(changes: ElementChangeSets): ModelGeometryChangesProps {
  let insertedIds, updatedIds, deleted;
  let insertedRanges, updatedRanges;
  if (0 < changes.inserts.size) {
    insertedIds = CompressedId64Set.compressIds(elementIdIterable(changes.inserts));
    insertedRanges = elementRangesToJSON(changes.inserts);
    expect(insertedIds.length).least(2);
    expect(insertedRanges.length).least(1);
  }

  if (0 < changes.updates.size) {
    updatedIds = CompressedId64Set.compressIds(elementIdIterable(changes.updates));
    updatedRanges = elementRangesToJSON(changes.updates);
    expect(updatedIds.length).least(2);
    expect(updatedRanges.length).least(1);
  }

  if (0 < changes.deletes.size) {
    deleted = CompressedId64Set.compressIds(elementIdIterable(changes.deletes));
    expect(deleted.length).least(2);
  }

  const inserted = insertedIds && insertedRanges ? { ids: insertedIds, ranges: insertedRanges } : undefined;
  const updated = updatedIds && updatedRanges ? { ids: updatedIds, ranges: updatedRanges } : undefined;
  return {
    inserted, updated, deleted,
    id: ids.next,
    guid: Guid.createValue(),
    range: nextRange().toJSON(),
  };
}

function extractElementChanges(changes: Iterable<ElementGeometryChange>): ElementChangeSets {
  const sets = new ElementChangeSets();
  const allIds = new Set<string>();
  for (const change of changes) {
    expect(allIds.has(change.id)).to.be.false;
    allIds.add(change.id);

    const set = DbOpcode.Insert === change.type ? sets.inserts : (DbOpcode.Update === change.type ? sets.updates : sets.deletes);
    set.add(change);
  }

  return sets;
}

describe("ModelGeometryChanges", () => {
  it("should iterate ElementGeometryChanges", () => {
    const test = (numInserts: number, numUpdates: number, numDeletes: number) => {
      const expected = generateElementChanges(numInserts, numUpdates, numDeletes);
      const actual = extractElementChanges(ElementGeometryChange.iterable(elementChangesToJSON(expected)));
      expect(expected).to.deep.equal(actual);
      expect(actual.inserts.size + actual.updates.size + actual.deletes.size).to.equal(numInserts + numUpdates + numDeletes);
    };

    test(0, 0, 0);
    test(2, 0, 0);
    test(0, 1, 0);
    test(0, 0, 5);
    test(2, 3, 1);
    test(3, 4, 2);
  });

  it("should iterate ModelGeometryChanges", () => {
    const test = (expected: ElementChangeSets[]) => {
      const props = expected.map((x) => elementChangesToJSON(x));
      let index = 0;
      for (const modelChanges of ModelGeometryChanges.iterable(props)) {
        expect(modelChanges.id).to.equal(props[index].id);
        expect(modelChanges.range).to.deep.equal(Range3d.fromJSON(props[index].range));
        expect(modelChanges.geometryGuid).to.equal(props[index].guid);
        const actualElems = extractElementChanges(modelChanges.elements);
        expect(actualElems).to.deep.equal(expected[index]);
        index++;
      }

      expect(index).to.equal(expected.length);
    };

    test([]);
    test([generateElementChanges(0, 0, 0)]);
    test([generateElementChanges(2, 0, 4)]);
    test([generateElementChanges(0, 4, 3), generateElementChanges(1, 0, 0), generateElementChanges(0, 0, 0), generateElementChanges(3, 1, 2)]);
  });
});
