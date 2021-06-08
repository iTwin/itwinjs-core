/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ChangedEntities, ChangedEntitiesIterable, EntityIdAndClassId } from "../ChangedEntities";

describe("ChangedEntitiesIterable", () => {
  function entity(id: string, classId: string): EntityIdAndClassId {
    return { id, classId };
  }

  function expectEntities(entities: Iterable<Readonly<EntityIdAndClassId>>, expected: EntityIdAndClassId[]) {
    const actual = [];
    for (const e of entities)
      actual.push({ ...e });

    expect(actual).to.deep.equal(expected);
  }

  function expectChangedEntities(props: ChangedEntities, expected: { inserted?: EntityIdAndClassId[], updated?: EntityIdAndClassId[], deleted?: EntityIdAndClassId[] }) {
    const iterable = ChangedEntitiesIterable.create(props);
    expectEntities(iterable.inserted, expected.inserted ?? []);
    expectEntities(iterable.deleted, expected.deleted ?? []);
    expectEntities(iterable.updated, expected.updated ?? []);
  }

  it("iterates", () => {
    expectChangedEntities({}, {});

    expectChangedEntities({
      inserted: "+1",
      insertedClassIndices: [0],
      classIds: ["0xa"],
    }, {
      inserted: [entity("0x1", "0xa")],
    });

    expectChangedEntities({
      classIds: ["0xa", "0xb", "0xc", "0xd"],
      inserted: "+1+2",
      insertedClassIndices: [1, 0],
      deleted:"+2+3+4",
      deletedClassIndices: [3, 1, 2],
      updated: "+4+1+2",
      updatedClassIndices: [2, 2, 2],
    }, {
      inserted: [entity("0x1", "0xb"), entity("0x3", "0xa")],
      deleted: [entity("0x2", "0xd"), entity("0x5", "0xb"), entity("0x9", "0xc")],
      updated: [entity("0x4", "0xc"), entity("0x5", "0xc"), entity("0x7", "0xc")],
    });
  });

  it("ignores undefined data", () => {
    expectChangedEntities({ deleted: "+1+2", deletedClassIndices: [0, 1] }, {});
    expectChangedEntities({ insertedClassIndices: [0, 1], classIds: ["0xa", "0xb"] }, {});
    expectChangedEntities({ updated: "+1+2", classIds: ["0xa", "0xb"] }, {});
  });

  it("ignores missing data", () => {
    expectChangedEntities({
      inserted: "+1+2+3+4",
      insertedClassIndices: [0, 2, 1],
      classIds: ["0xa", "0xb"],
    }, {
      inserted: [entity("0x1", "0xa"), entity("0x6", "0xb")],
    });
  });
});
