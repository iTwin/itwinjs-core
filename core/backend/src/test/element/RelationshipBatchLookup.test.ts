/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Code, IModel, RelationshipProps, RepositoryLinkProps, SourceAndTarget } from "@itwin/core-common";
import { withEditTxn } from "../../EditTxn";
import { RepositoryLink } from "../../Element";
import { SnapshotDb } from "../../IModelDb";
import { ElementDrivesElement, ElementGroupsMembers, ElementRefersToElements } from "../../Relationship";
import { IModelTestUtils } from "../IModelTestUtils";

describe("Relationships batched lookup", () => {
  const testSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="BatchLookupTest" alias="blt" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECStructClass typeName="TestStruct">
        <ECProperty propertyName="label" typeName="string"/>
        <ECProperty propertyName="origin" typeName="point2d"/>
      </ECStructClass>
      <ECRelationshipClass typeName="TestRefersToElements" strength="referencing" modifier="Sealed">
        <BaseClass>bis:ElementRefersToElements</BaseClass>
        <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true">
          <Class class="bis:Element"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is referenced by" polymorphic="true">
          <Class class="bis:Element"/>
        </Target>
        <ECProperty propertyName="Location" typeName="point3d"/>
        <ECStructProperty propertyName="Info" typeName="TestStruct"/>
        <ECArrayProperty propertyName="Points" typeName="point3d" minOccurs="0" maxOccurs="unbounded"/>
      </ECRelationshipClass>
    </ECSchema>`;
  const testRelClass = "BatchLookupTest:TestRefersToElements";

  let imodel: SnapshotDb;
  let elementIds: Id64String[];
  let relIds: Id64String[];

  before(async () => {
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("Relationship", "BatchLookup.bim"), { rootSubject: { name: "BatchLookup" } });
    await imodel.importSchemaStrings([testSchema]);
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

  it("matches tryGetInstanceProps for ids and source/target pairs, preserving order", async () => {
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

    const batch = await imodel.relationships.queryInstancesProps(ElementGroupsMembers.classFullName, criteria);
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

    // The concurrent query connection sees the same saved data.
    expect(await imodel.relationships.queryInstancesProps(ElementGroupsMembers.classFullName, criteria, { usePrimaryConn: false })).to.deep.equal(batch);
  });

  it("returns an empty array for empty criteria", async () => {
    expect(await imodel.relationships.queryInstancesProps(ElementGroupsMembers.classFullName, [])).to.deep.equal([]);
    expect(await imodel.relationships.queryInstances(ElementGroupsMembers.classFullName, [])).to.deep.equal([]);
  });

  it("queries polymorphically and respects the relationship class", async () => {
    const criteria = [relIds[0], { sourceId: elementIds[1], targetId: elementIds[2] }];

    const viaBase = await imodel.relationships.queryInstancesProps(ElementRefersToElements.classFullName, criteria);
    expect(viaBase.map((p) => p?.classFullName)).to.deep.equal([ElementGroupsMembers.classFullName, ElementGroupsMembers.classFullName]);
    criteria.forEach((criterion, i) => expect(viaBase[i]).to.deep.equal(imodel.relationships.tryGetInstanceProps(ElementRefersToElements.classFullName, criterion), `criterion ${i}`));

    const viaOther = await imodel.relationships.queryInstancesProps(ElementDrivesElement.classFullName, criteria);
    expect(viaOther).to.deep.equal([undefined, undefined]);
  });

  it("queryInstances constructs Relationship entities", async () => {
    const criteria = [relIds[1], { sourceId: elementIds[3], targetId: elementIds[4] }, Id64.invalid];
    const rels = await imodel.relationships.queryInstances<ElementGroupsMembers>(ElementGroupsMembers.classFullName, criteria);
    expect(rels.length).to.equal(3);
    expect(rels[0]).to.be.instanceOf(ElementGroupsMembers);
    expect(rels[0]?.id).to.equal(relIds[1]);
    expect(rels[0]?.memberPriority).to.equal(1);
    expect(rels[1]).to.be.instanceOf(ElementGroupsMembers);
    expect(rels[1]?.sourceId).to.equal(elementIds[3]);
    expect(rels[1]?.targetId).to.equal(elementIds[4]);
    expect(rels[2]).to.be.undefined;
    criteria.forEach((criterion, i) => expect(rels[i]?.toJSON()).to.deep.equal(imodel.relationships.tryGetInstance(ElementGroupsMembers.classFullName, criterion)?.toJSON(), `criterion ${i}`));
  });

  it("sees unsaved changes by default", async () => {
    const cls = ElementGroupsMembers.classFullName;
    const pair = { sourceId: elementIds[4], targetId: elementIds[5] };
    await withEditTxn(imodel, async (txn) => {
      const id = txn.insertRelationship(ElementGroupsMembers.create(imodel, pair.sourceId, pair.targetId, 4).toJSON());
      const found = await imodel.relationships.queryInstances(cls, [id, pair]);
      expect(found.map((r) => r?.id)).to.deep.equal([id, id]);
      txn.deleteRelationship(imodel.relationships.getInstanceProps(cls, id));
    });
  });

  it("converts point, struct and array properties like tryGetInstanceProps", async () => {
    const pair = { sourceId: elementIds[0], targetId: elementIds[5] };
    await withEditTxn(imodel, async (txn) => {
      const id = txn.insertRelationship({
        classFullName: testRelClass,
        ...pair,
        location: { x: 1, y: 2, z: 3 },
        info: { label: "a", origin: { x: 4, y: 5 } },
        points: [{ x: 6, y: 7, z: 8 }, { x: 9, y: 10, z: 11 }],
      } as RelationshipProps);

      const criteria = [id, pair];
      const batch = await imodel.relationships.queryInstancesProps(testRelClass, criteria);
      criteria.forEach((criterion, i) => expect(batch[i]).to.deep.equal(imodel.relationships.tryGetInstanceProps(testRelClass, criterion), `criterion ${i}`));
      expect(batch[0]).to.include({ id, classFullName: testRelClass });
      expect(batch[0]).to.deep.include({
        location: { x: 1, y: 2, z: 3 },
        info: { label: "a", origin: { x: 4, y: 5 } },
        points: [{ x: 6, y: 7, z: 8 }, { x: 9, y: 10, z: 11 }],
      });
      txn.deleteRelationship(batch[0]!);
    });
  });

  it("reads only the requested pairs in a dense many-to-many graph", async () => {
    const cls = ElementGroupsMembers.classFullName;
    const n = 5;
    await withEditTxn(imodel, async (txn) => {
      const sources: Id64String[] = [];
      const targets: Id64String[] = [];
      for (let i = 0; i < 2 * n; ++i) {
        const id = txn.insertElement({ classFullName: RepositoryLink.classFullName, model: IModel.repositoryModelId, code: Code.createEmpty(), repositoryGuid: Guid.createValue() } as RepositoryLinkProps);
        (i < n ? sources : targets).push(id);
      }

      // Connect every source to every target, then request only the "diagonal" pairs.
      for (const sourceId of sources)
        for (const targetId of targets)
          txn.insertRelationship(ElementGroupsMembers.create(imodel, sourceId, targetId, 0).toJSON());

      const pairs = sources.map((sourceId, i) => ({ sourceId, targetId: targets[i] }));
      let rowsRead = 0;
      const createQueryReader = imodel.createQueryReader.bind(imodel);
      const stub = sinon.stub(imodel, "createQueryReader").callsFake((ecsql, params, config) => {
        const reader = createQueryReader(ecsql, params, config);
        const step = reader.step.bind(reader);
        reader.step = async () => {
          const hasRow = await step();
          if (hasRow)
            ++rowsRead;
          return hasRow;
        };
        return reader;
      });
      try {
        const found = await imodel.relationships.queryInstancesProps(cls, pairs);
        expect(found.map((p) => p && { sourceId: p.sourceId, targetId: p.targetId })).to.deep.equal(pairs);
      } finally {
        stub.restore();
      }
      expect(rowsRead).to.equal(n);
    });
  });

  it("supports relationships stored as navigation properties and ids from any briefcase", async () => {
    const cls = "BisCore:ModelContainsElements";
    const highBriefcaseId = Id64.fromLocalAndBriefcaseIds(1, 0xfffffd);
    const criteria: Array<Id64String | SourceAndTarget> = [
      elementIds[0],
      { sourceId: IModel.repositoryModelId, targetId: elementIds[1] },
      highBriefcaseId,
      { sourceId: highBriefcaseId, targetId: elementIds[1] },
    ];
    const batch = await imodel.relationships.queryInstancesProps(cls, criteria);
    criteria.forEach((criterion, i) => expect(batch[i]).to.deep.equal(imodel.relationships.tryGetInstanceProps(cls, criterion), `criterion ${i}`));
    expect(batch.map((p) => p?.targetId)).to.deep.equal([elementIds[0], elementIds[1], undefined, undefined]);
  });
});
