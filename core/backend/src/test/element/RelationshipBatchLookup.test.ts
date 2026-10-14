/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Code, IModel, RepositoryLinkProps, SourceAndTarget } from "@itwin/core-common";
import { withEditTxn } from "../../EditTxn";
import { RepositoryLink } from "../../Element";
import { SnapshotDb } from "../../IModelDb";
import { ElementDrivesElement, ElementGroupsMembers, ElementRefersToElements } from "../../Relationship";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Relationships batched lookup", () => {
  let imodel: SnapshotDb;
  let elementIds: Id64String[];
  let relIds: Id64String[];

  before(() => {
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("Relationship", "BatchLookup.bim"), { rootSubject: { name: "BatchLookup" } });
    withEditTxn(imodel, (txn) => {
      elementIds = [];
      for (let i = 0; i < 6; ++i) {
        const props: RepositoryLinkProps = {
          classFullName: RepositoryLink.classFullName,
          model: IModel.repositoryModelId,
          code: Code.createEmpty(),
          repositoryGuid: Guid.createValue(),
        };
        elementIds.push(txn.insertElement(props));
      }

      // Chain e0->e1->e2->e3->e4 with memberPriority equal to the source index.
      relIds = [];
      for (let i = 0; i < 4; ++i)
        relIds.push(txn.insertRelationship(ElementGroupsMembers.create(imodel, elementIds[i], elementIds[i + 1], i).toJSON()));
    });
  });

  after(() => imodel.close());

  it("matches tryGetInstanceProps for ids and source/target pairs, preserving order", () => {
    const [e0, e1, e2, e3, e4, e5] = elementIds;
    const criteria: Array<Id64String | SourceAndTarget> = [
      relIds[2],
      { sourceId: e0, targetId: e1 },
      Id64.fromLocalAndBriefcaseIds(0x7fff, 0), // non-existent id
      { sourceId: e3, targetId: e4 },
      { sourceId: e0, targetId: e2 }, // both ends requested elsewhere, but not related as a pair
      { sourceId: e4, targetId: e5 }, // unrelated
      Id64.invalid,
      relIds[2], // duplicate
      { sourceId: e1, targetId: e2 },
      relIds[0],
    ];

    const batch = imodel.relationships.tryGetInstancesProps(ElementGroupsMembers.classFullName, criteria);
    expect(batch.length).to.equal(criteria.length);
    criteria.forEach((criterion, i) => {
      expect(batch[i]).to.deep.equal(imodel.relationships.tryGetInstanceProps(ElementGroupsMembers.classFullName, criterion), `criterion ${i}`);
    });

    expect(batch[0]?.id).to.equal(relIds[2]);
    expect(batch[0]?.classFullName).to.equal(ElementGroupsMembers.classFullName);
    expect((batch[1] as any).memberPriority).to.equal(0);
    expect(batch[1]?.id).to.equal(relIds[0]);
    expect(batch[2]).to.be.undefined;
    expect(batch[3]?.id).to.equal(relIds[3]);
    expect(batch[4]).to.be.undefined;
    expect(batch[5]).to.be.undefined;
    expect(batch[6]).to.be.undefined;
    expect(batch[7]?.id).to.equal(relIds[2]);
    expect(batch[8]?.id).to.equal(relIds[1]);
  });

  it("returns an empty array for empty criteria", () => {
    expect(imodel.relationships.tryGetInstancesProps(ElementGroupsMembers.classFullName, [])).to.deep.equal([]);
    expect(imodel.relationships.tryGetInstances(ElementGroupsMembers.classFullName, [])).to.deep.equal([]);
  });

  it("queries polymorphically and respects the relationship class", () => {
    const criteria = [relIds[0], { sourceId: elementIds[1], targetId: elementIds[2] }];

    const viaBase = imodel.relationships.tryGetInstancesProps(ElementRefersToElements.classFullName, criteria);
    expect(viaBase.map((p) => p?.classFullName)).to.deep.equal([ElementGroupsMembers.classFullName, ElementGroupsMembers.classFullName]);

    const viaOther = imodel.relationships.tryGetInstancesProps(ElementDrivesElement.classFullName, criteria);
    expect(viaOther).to.deep.equal([undefined, undefined]);
  });

  it("tryGetInstances constructs Relationship entities", () => {
    const rels = imodel.relationships.tryGetInstances<ElementGroupsMembers>(ElementGroupsMembers.classFullName, [relIds[1], { sourceId: elementIds[3], targetId: elementIds[4] }, Id64.invalid]);
    expect(rels.length).to.equal(3);
    expect(rels[0]).to.be.instanceOf(ElementGroupsMembers);
    expect(rels[0]?.id).to.equal(relIds[1]);
    expect(rels[0]?.memberPriority).to.equal(1);
    expect(rels[1]).to.be.instanceOf(ElementGroupsMembers);
    expect(rels[1]?.sourceId).to.equal(elementIds[3]);
    expect(rels[1]?.targetId).to.equal(elementIds[4]);
    expect(rels[2]).to.be.undefined;

    const single = imodel.relationships.tryGetInstance<ElementGroupsMembers>(ElementGroupsMembers.classFullName, relIds[1]);
    expect(rels[0]?.toJSON()).to.deep.equal(single?.toJSON());
  });
});
