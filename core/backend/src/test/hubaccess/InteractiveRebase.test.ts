/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubMock } from "../../internal/HubMock";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { withEditTxn } from "../TestEditTxn";
import { Code, ElementAspectProps, GeometricElement2dProps, IModel, SubCategoryAppearance, TypeDefinitionElementProps } from "@itwin/core-common";
import { BriefcaseDb, ChannelControl, DrawingCategory, ElementOwnsChildElements, GenericGraphicalType2d } from "../../core-backend";
import type { RebaseConflict } from "../../InteractiveRebase";
import { Point2d, XYProps } from "@itwin/core-geometry";
import { Guid, GuidString, Id64String } from "@itwin/core-bentley";

chai.use(chaiAsPromised);

describe("InteractiveRebase", () => {
  let iModelId: GuidString;
  let briefcase1: BriefcaseDb;
  let briefcase2: BriefcaseDb;
  let id: Id64String;
  let initialChangesetIndex: number;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;

  interface SomeGraphicalElementProps extends GeometricElement2dProps {
    foo: string;
    somePoint: XYProps;
  }

  interface SomeUniqueAspectProps extends ElementAspectProps {
    aspectValue: string;
    aspectNumber: number;
  }

  const uniqueAspectClassFullName = "irt:SomeUniqueAspect";

  const getUniqueAspect = (iModel: BriefcaseDb, elementId: Id64String) => {
    const aspects = iModel.elements.getAspects(elementId, uniqueAspectClassFullName);
    chai.expect(aspects.length).to.equal(1);
    return aspects[0].toJSON() as SomeUniqueAspectProps;
  };

  before(async () => {
    HubMock.startup("InteractiveRebase", KnownTestLocations.outputDir);

    const accessToken1 = "user1";
    const accessToken2 = "user2";
    iModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject", noLocks: true });
    briefcase1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId: HubMock.iTwinId, iModelId: iModelId });

    briefcase1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    const schema = `
      <?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="InteractiveRebaseTest" alias="irt" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECEntityClass typeName="SomeGraphicalElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="Foo" typeName="string" />
              <ECProperty propertyName="SomePoint" typeName="point2d" />
          </ECEntityClass>
          <ECEntityClass typeName="SomeUniqueAspect">
            <BaseClass>bis:ElementUniqueAspect</BaseClass>
            <ECProperty propertyName="AspectValue" typeName="string" />
            <ECProperty propertyName="AspectNumber" typeName="int" />
          </ECEntityClass>
      </ECSchema>`;

    id = await withEditTxn(briefcase1, async (txn) => {
      await txn.iModel.importSchemaStrings([schema]);

      const codeProps = Code.createEmpty();
      codeProps.value = "DrawingModel";
      drawingModelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true)[1];
      const maybeDrawingCategoryId = DrawingCategory.queryCategoryIdByName(briefcase1, IModel.dictionaryId, "MyDrawingCategory");
      if (undefined !== maybeDrawingCategoryId)
        drawingCategoryId = maybeDrawingCategoryId;
      else
        drawingCategoryId = DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance());

      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Original",
        somePoint: new Point2d(1.23, 4.56),
      } as SomeGraphicalElementProps);
    });

    await briefcase1.pushChanges({ description: "Initial" });

    briefcase2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId: HubMock.iTwinId, iModelId: iModelId });
    briefcase2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    initialChangesetIndex = briefcase1.changeset.index!;
  });

  beforeEach(async () => {
    if (briefcase1.txns.rebaser.isRebasing)
      await briefcase1.txns.rebaser.abort();
    await briefcase1.discardChanges();
    if (briefcase2.txns.rebaser.isRebasing)
      await briefcase2.txns.rebaser.abort();
    await briefcase2.discardChanges();

    await briefcase1.pullChanges({ toIndex: initialChangesetIndex });
    await briefcase2.pullChanges({ toIndex: initialChangesetIndex });

    const hub = HubMock.findLocalHub(iModelId);
    hub.truncateToChangeset(initialChangesetIndex);
  });

  after(async () => {
    HubMock.shutdown();
  });

  it("does not consider both deleting to be a conflict", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(id);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(0);
  });

  it("can present a conflict where both users update the same element", async () => {
    // Create a conflict on foo and somePoint between the two briefcases.
    // Also add a non-conflicting userLabel.
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
      });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        foo: "User2",
        userLabel: "Wat",
        somePoint: new Point2d(3.0, 4.0),
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(id);
    chai.expect(conflict.ours).to.not.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;
    chai.expect(conflict.original).to.not.be.undefined;

    // Only the properties with actual conflicts should be found in conflictingProperties.
    chai.expect(conflict.conflictingProperties.length).to.equal(3);
    chai.expect(conflict.conflictingProperties).to.include("somePoint");
    chai.expect(conflict.conflictingProperties).to.include("foo");
    chai.expect(conflict.conflictingProperties).to.include("lastMod");

    // The reported values should be correct.
    chai.expect(conflict.original?.somePoint).to.deep.equal({ x: 1.23, y: 4.56 });
    chai.expect(conflict.ours?.somePoint).to.deep.equal({ x: 3.0, y: 4.0 });
    chai.expect(conflict.theirs?.somePoint).to.deep.equal({ x: 1.0, y: 2.0 });

    chai.expect(conflict.original?.foo).to.equal("Original");
    chai.expect(conflict.ours?.foo).to.equal("User2");
    chai.expect(conflict.theirs?.foo).to.equal("User1");

    chai.expect(conflict.original?.userLabel).to.be.undefined;
    chai.expect(conflict.ours?.userLabel).to.equal("Wat");
    chai.expect(conflict.theirs?.userLabel).to.be.undefined;

    // Initially, "our" values are selected.
    const valuesInitial = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesInitial.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesInitial.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;
    chai.expect(valuesInitial.userLabel).to.equal("Wat");

    // We can explicitly accept "theirs" instead.
    conflict.acceptTheirs();
    const valuesTheirs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirs.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirs.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    // The userLabel had no value in "theirs", so make sure it is now null.
    chai.expect(valuesTheirs.userLabel).to.be.undefined;

    // And then switch back to "ours" again.
    conflict.acceptOurs();
    const valuesOurs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOurs.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOurs.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;
    chai.expect(valuesOurs.userLabel).to.equal("Wat");

    // We can accept a subset of properties
    conflict.acceptTheirs(["somePoint"]);
    const valuesTheirsSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    conflict.acceptTheirs(["foo"]);
    const valuesTheirsSubset2 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset2.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset2.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    conflict.acceptOurs(["foo"]);
    const valuesOursSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOursSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOursSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
  });

  it("identifies conflicting properties by their name in the element props", async () => {
    const code = (value: string) => new Code({ spec: IModel.dictionaryId, scope: IModel.dictionaryId, value });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id, code: code("Initial") });
    });
    await briefcase1.pushChanges({ description: "Set initial code" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id, code: code("User1Code") });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement({ id, code: code("User2Code") });
    });

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.conflictingProperties).to.include("code.value");
    chai.expect(conflict.original!.code.value).to.equal("Initial");
    chai.expect(conflict.ours!.code.value).to.equal("User2Code");
    chai.expect(conflict.theirs!.code.value).to.equal("User1Code");

    conflict.acceptTheirs(["code.value"]);
    chai.expect(briefcase2.elements.getElementProps(id).code.value).to.equal("User1Code");

    conflict.acceptOurs(["code.value"]);
    chai.expect(briefcase2.elements.getElementProps(id).code.value).to.equal("User2Code");
  });

  it("can present a conflict where we delete something the upstream modified", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
      });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;

    // The properties that were updated in their changes should be called out.
    chai.expect(conflict.theirModifiedProperties.length).to.equal(3);
    chai.expect(conflict.theirModifiedProperties).to.include("somePoint");
    chai.expect(conflict.theirModifiedProperties).to.include("foo");
    chai.expect(conflict.theirModifiedProperties).to.include("lastMod");

    // The original and their values should both be correctly captured.
    chai.expect(conflict.original!.foo).to.equal("Original");
    chai.expect(conflict.original!.somePoint).to.deep.equal({ x: 1.23, y: 4.56 });
    chai.expect(conflict.theirs!.foo).to.equal("User1");
    chai.expect(conflict.theirs!.somePoint).to.deep.equal({ x: 1.0, y: 2.0 });

    // The instance should not exist in the iModel, since we deleted it.
    const values = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(values).to.be.undefined;

    // Accepting "theirs" should restore the element to the state it was in after their changes.
    conflict.acceptTheirs();
    const theirsValues = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(theirsValues).to.not.be.undefined;
    chai.expect(theirsValues!.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(theirsValues!.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    // Accepting "ours" again should delete it.
    conflict.acceptOurs();
    const oursValues = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(oursValues).to.be.undefined;
  });

  it("can present a conflict where we modify something the upstream deleted", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(id);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        foo: "User2",
        somePoint: new Point2d(3.0, 4.0),
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.theirs).to.be.undefined;

    chai.expect(conflict.ourModifiedProperties.length).to.equal(3);
    chai.expect(conflict.ourModifiedProperties).to.include("somePoint");
    chai.expect(conflict.ourModifiedProperties).to.include("foo");
    chai.expect(conflict.ourModifiedProperties).to.include("lastMod");

    // The original and their values should both be correctly captured.
    chai.expect(conflict.original!.foo).to.equal("Original");
    chai.expect(conflict.original!.somePoint).to.deep.equal({ x: 1.23, y: 4.56 });
    chai.expect(conflict.ours!.foo).to.equal("User2");
    chai.expect(conflict.ours!["somePoint"]).to.deep.equal({ x: 3.0, y: 4.0 });

    // In most cases we try to let "our" changes stand. But not here.
    // If "they" deleted the element, we let the delete stand by default. Deleting the
    // element could lead to foreign key constraint problems. However, we need to deal
    // with that possibility whether we modified the referenced instance or not.
    const values = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(values).to.be.undefined;

    // We can resurrect it by accepting "ours".
    conflict.acceptOurs();
    const oursValues = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(oursValues).to.not.be.undefined;
    chai.expect(oursValues!.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(oursValues!.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;

    // Accepting theirs deletes it again
    conflict.acceptTheirs();
    const theirsValues = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(theirsValues).to.be.undefined;
  });

  it("can present a conflict where local and upstream both insert a row with the same primary key", async () => {
    const guid = Guid.createValue();
    const id = "0x1234";
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertElement({
        id: id,
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
        federationGuid: guid,
      } as SomeGraphicalElementProps, {
        forceUseId: true,
      });
    });

    const localId = await withEditTxn(briefcase2, async (txn) => {
      return txn.insertElement({
        id: id,
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "User2",
        somePoint: new Point2d(3.0, 4.0),
        federationGuid: guid,
        userLabel: "Wat",
      } as SomeGraphicalElementProps, {
        forceUseId: true,
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(id);

    chai.expect(conflict.differentProperties.length).to.equal(4);
    chai.expect(conflict.differentProperties).to.include("somePoint");
    chai.expect(conflict.differentProperties).to.include("foo");
    chai.expect(conflict.differentProperties).to.include("lastMod");
    chai.expect(conflict.differentProperties).to.include("userLabel");

    // Initially, "our" values are selected.
    const valuesInitial = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesInitial.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesInitial.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;
    chai.expect(valuesInitial.userLabel).to.equal("Wat");

    // We can explicitly accept "theirs" instead.
    conflict.acceptTheirs();
    const valuesTheirs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirs.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirs.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    chai.expect(valuesTheirs.userLabel).to.be.undefined;

    // And then switch back to "ours" again.
    conflict.acceptOurs();
    const valuesOurs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOurs.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOurs.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;
    chai.expect(valuesOurs.userLabel).to.equal("Wat");

    // We can accept a subset of properties
    conflict.acceptTheirs(["somePoint"]);
    const valuesTheirsSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    conflict.acceptTheirs(["foo"]);
    const valuesTheirsSubset2 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset2.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset2.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    conflict.acceptOurs(["foo"]);
    const valuesOursSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOursSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOursSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
  });

  it("can present a conflict where a locally-inserted row triggers a unique constraint violation", async () => {
    const guid = Guid.createValue();
    const newId = await withEditTxn(briefcase1, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
        federationGuid: guid,
      } as SomeGraphicalElementProps);
    });

    const test = briefcase1.elements.getElementProps<SomeGraphicalElementProps>(newId);
    chai.expect(test.federationGuid).to.equal(guid);

    const localId = await withEditTxn(briefcase2, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "User2",
        somePoint: new Point2d(3.0, 4.0),
        // Same federationGuid as the element inserted in briefcase1, which will trigger a unique constraint violation.
        federationGuid: guid,
      } as SomeGraphicalElementProps);
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];

    chai.expect(conflict.original).to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.ours!.federationGuid).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("federationGuid");
    chai.expect(conflict.ours!.federationGuid).to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.federationGuid);

    // By default, the conflicting element is assigned a new federationGuid to resolve the conflict.
    const localElement = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(localId);
    chai.expect(localElement.federationGuid).not.to.equal(guid);
    chai.expect(localElement.federationGuid).not.to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.federationGuid);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.property).to.equal("federationGuid");
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.value).to.equal(localElement.federationGuid);

    // Accepting "ours" will cause the conflict resolution to re-run, resulting in another new GUID.
    conflict.acceptOurs();
    const localElement2 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(localId);
    chai.expect(localElement2.federationGuid).not.to.equal(guid);
    chai.expect(localElement2.federationGuid).not.to.equal(localElement.federationGuid);

    // The same constraint was violated again, so the existing record is refreshed rather than duplicated.
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("federationGuid");
    chai.expect(conflict.uniqueConstraintViolations[0].conflictingInstance.federationGuid).to.equal(conflict.ours!.federationGuid);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.value).to.equal(localElement2.federationGuid);

    // Accepting "theirs" will delete our new element
    conflict.acceptTheirs();
    const localElement3 = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(localId);
    chai.expect(localElement3).to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(0);
  });

  it("can present a conflict where a locally-updated row triggers a unique constraint violation", async () => {
    const code = new Code({
      spec: IModel.dictionaryId,
      scope: IModel.dictionaryId,
      value: "SomeValue"
    });
    const newId = await withEditTxn(briefcase1, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: code,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
      } as SomeGraphicalElementProps);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement({
        id: id,
        userLabel: "Wat",
        // Same code as the element inserted in briefcase1, which will trigger a unique constraint violation.
        code: code,
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.original).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.original?.code.scope).not.to.be.undefined;
    chai.expect(conflict.original?.code.spec).not.to.be.undefined;
    chai.expect(conflict.ours!.code.scope).not.to.be.undefined;
    chai.expect(conflict.ours!.code.spec).not.to.be.undefined;
    chai.expect(conflict.ours!.code.value).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);
    chai.expect(conflict.original?.code.scope).not.to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.scope);
    chai.expect(conflict.original?.code.spec).not.to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.spec);
    chai.expect(conflict.original?.code.value).not.to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.value);
    chai.expect(conflict.ours!.code.scope).to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.scope);
    chai.expect(conflict.ours!.code.spec).to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.spec);
    chai.expect(conflict.ours!.code.value).to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.value);

    const localElement = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(localElement.code.value).to.equal("SomeValue (Conflict)");
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.property).to.equal("code.value");
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.value).to.equal("SomeValue (Conflict)");

    // Accepting a property that the automatic fix did not touch leaves the fix - and its record - in place.
    conflict.acceptOurs(["userLabel"]);
    chai.expect(briefcase2.elements.getElementProps(id).code.value).to.equal("SomeValue (Conflict)");
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.value).to.equal("SomeValue (Conflict)");

    // Accepting the fixed-up property itself supersedes the record, which the re-triggered violation replaces.
    conflict.acceptOurs(["code.value"]);
    chai.expect(briefcase2.elements.getElementProps(id).code.value).to.equal("SomeValue (Conflict)");
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedFix?.property).to.equal("code.value");

    // "They" never touched this element, so accepting theirs reverts our change rather than deleting it.
    conflict.acceptTheirs();
    const theirsElement = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(theirsElement.code.value).to.equal(conflict.original!.code.value);
    chai.expect(theirsElement.userLabel).to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(0);
  });

  it("can present a conflict where a partial update of a code triggers a unique constraint violation", async () => {
    const code1 = new Code({
      spec: IModel.dictionaryId,
      scope: IModel.dictionaryId,
      value: "SomeValue"
    });
    const code2 = new Code({
      spec: IModel.dictionaryId,
      scope: IModel.dictionaryId,
      value: "AnotherValue"
    });

    // Add two elements with two different codes.
    const ids = await withEditTxn(briefcase1, async (txn) => {
      return [
        txn.insertElement({
          classFullName: "irt:SomeGraphicalElement",
          model: drawingModelId,
          category: drawingCategoryId,
          code: code1,
          foo: "User1",
          somePoint: new Point2d(1.0, 2.0),
        } as SomeGraphicalElementProps),
        txn.insertElement({
          classFullName: "irt:SomeGraphicalElement",
          model: drawingModelId,
          category: drawingCategoryId,
          code: code2,
          foo: "User1",
          somePoint: new Point2d(3.0, 4.0),
        } as SomeGraphicalElementProps)
      ];
    });

    await briefcase1.pushChanges({ description: "Set initial code" });
    await briefcase2.pullChanges();

    // Update both codes in two different briefcases so that they now conflict
    const conflictingCode = new Code({
      spec: IModel.dictionaryId,
      scope: IModel.dictionaryId,
      value: "ConflictingValue"
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({
        id: ids[0],
        code: conflictingCode,
      });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement({
        id: ids[1],
        code: conflictingCode,
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];

    // The codeValue should be included, because it was changed.
    chai.expect(conflict.original?.code.value).not.to.be.undefined;
    chai.expect(conflict.ours!.code.value).not.to.be.undefined;

    // codeSpec and codeScope should also be included even though they were not changed.
    chai.expect(conflict.original?.code.spec).not.to.be.undefined;
    chai.expect(conflict.original?.code.scope).not.to.be.undefined;
    chai.expect(conflict.ours!.code.spec).not.to.be.undefined;
    chai.expect(conflict.ours!.code.scope).not.to.be.undefined;

    // The conflict should correctly identify which unique constraint was violated.
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);

    // The conflicting row should include the changed codeValue property
    chai.expect(conflict.original?.code.value).not.to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.value);
    chai.expect(conflict.ours!.code.value).to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.value);

    // And it should also contain the unchanged codeSpec and codeScope properties, which are part of the unique constraint.
    chai.expect(conflict.uniqueConstraintViolations[0].conflictingInstance.code.spec).to.equal(IModel.dictionaryId);
    chai.expect(conflict.uniqueConstraintViolations[0].conflictingInstance.code.scope).to.equal(IModel.dictionaryId);
  });

  it("reports a UNIQUE constraint conflict triggered by applying a conflicting data change", async () => {
    const code = new Code({
      spec: IModel.dictionaryId,
      scope: IModel.dictionaryId,
      value: "SomeValue"
    });

    // Create a conflict on foo and somePoint between the two briefcases.
    // Also add a non-conflicting userLabel.
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: code,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
      } as SomeGraphicalElementProps);
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
        userLabel: "Wat" // non-conflicting property
      });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        code: code, // conflicts with the newly-inserted element in briefcase1
        foo: "User2" // data conflict with the update in briefcase1
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;

    // Both the data conflict (on "foo") and the UNIQUE constraint violation (on "code") are reported
    // against the same instance, so they're merged into a single RebaseConflict2 entry.
    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(id);

    chai.expect(conflict.differentProperties.length).to.equal(7);
    chai.expect(conflict.differentProperties).to.include("code.scope");
    chai.expect(conflict.differentProperties).to.include("code.spec");
    chai.expect(conflict.differentProperties).to.include("code.value");
    chai.expect(conflict.differentProperties).to.include("lastMod");
    chai.expect(conflict.differentProperties).to.include("foo");
    chai.expect(conflict.differentProperties).to.include("somePoint");
    chai.expect(conflict.differentProperties).to.include("userLabel");

    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");

    // Only the properties with actual conflicts should be found in conflictingProperties.
    chai.expect(conflict.conflictingProperties.length).to.equal(2);
    chai.expect(conflict.conflictingProperties).to.include("foo");
    chai.expect(conflict.conflictingProperties).to.include("lastMod");

    // Initially, "our" values are selected.
    // - For the data conflicts, "our" value has been applied.
    // - For the unique constraint conflict, a new value has been selected automatically to avoid the conflict.
    const valuesInitial = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesInitial.foo).to.equal("User2");
    chai.expect(valuesInitial.code.spec).to.equal(code.spec);
    chai.expect(valuesInitial.code.scope).to.equal(code.scope);
    chai.expect(valuesInitial.code.value).to.equal("SomeValue (Conflict)");

    // We can explicitly accept "theirs" instead. At which point there is no UNIQUE constraint violation anymore.
    conflict.acceptTheirs();
    const valuesTheirs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirs.foo).to.equal("User1");
    chai.expect(valuesTheirs.code.value).to.equal("");
    chai.expect(Point2d.fromJSON(valuesTheirs.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    chai.expect(valuesTheirs.userLabel).to.equal("Wat");
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(0);

    // And then switch back to "ours" again. The violation should be back.
    conflict.acceptOurs();
    const valuesOurs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOurs.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOurs.somePoint).isExactEqual(new Point2d(1.23, 4.56))).to.be.true;
    chai.expect(valuesOurs.userLabel).to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");

    // We can accept a subset of properties
    conflict.acceptTheirs(["somePoint"]);
    const valuesTheirsSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    conflict.acceptTheirs(["foo"]);
    const valuesTheirsSubset2 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset2.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset2.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    conflict.acceptOurs(["foo"]);
    const valuesOursSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOursSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOursSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    // Accepting their code.value will clear the UNIQUE constraint violation.
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    conflict.acceptTheirs(["code.value"]);
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(0);
  });

  it("reports a foreign key constraint violation when we add an element to a parent they deleted", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(id);
    });

    const childId = await withEditTxn(briefcase2, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Child",
        somePoint: new Point2d(5.0, 6.0),
        parent: new ElementOwnsChildElements(id)
      } as SomeGraphicalElementProps);
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    const moreGroups = interactive.nextGroup();
    chai.expect(moreGroups).to.be.false;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(childId);

    chai.expect(conflict.brokenRelationships.length).to.equal(1);
    chai.expect(conflict.brokenRelationships[0].navigationProperty).to.equal("parent");
    chai.expect(conflict.brokenRelationships[0].relationshipClass.fullName).to.equal("BisCore:ElementOwnsChildElements");
  });

  it("should report an aspect conflict when both users update the same aspect property", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
    });

    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User2";
      txn.updateAspect(aspect);
    });

    await briefcase1.pushChanges({ description: "User1 updates aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.conflictingProperties).to.include("aspectValue");
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.ours).to.not.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;

    chai.expect(conflict.original!.aspectValue).to.equal("Initial");
    chai.expect(conflict.ours!.aspectValue).to.equal("User2");
    chai.expect(conflict.theirs!.aspectValue).to.equal("User1");

    let aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User2");

    conflict.acceptTheirs(["aspectValue"]);
    aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User1");

    conflict.acceptOurs(["aspectValue"]);
    aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User2");
  });

  it("should not report an aspect conflict when users update different aspect properties", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
    });

    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectNumber = 2;
      txn.updateAspect(aspect);
    });

    await briefcase1.pushChanges({ description: "User1 updates aspect value" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(0);

    const aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User1");
    chai.expect(aspect.aspectNumber).to.equal(2);
  });

  it("should report an aspect conflict when we update an aspect they deleted", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      txn.deleteAspect(aspect.id!);
    });

    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User2";
      txn.updateAspect(aspect);
    });

    await briefcase1.pushChanges({ description: "User1 deletes aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.be.undefined;
    chai.expect(conflict.ours).to.not.be.undefined;
    chai.expect(conflict.conflictingProperties).to.have.length(0);
    chai.expect(conflict.ourModifiedProperties).to.include("aspectValue");

    chai.expect(briefcase2.elements.getAspects(id, uniqueAspectClassFullName)).to.have.length(0);
    conflict.acceptOurs();
    const aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User2");
  });

  it("should report an aspect conflict when they update an aspect we deleted", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
    });

    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      txn.deleteAspect(aspect.id!);
    });

    await briefcase1.pushChanges({ description: "User1 updates aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;
    chai.expect(conflict.conflictingProperties).to.have.length(0);
    chai.expect(conflict.theirModifiedProperties).to.include("aspectValue");

    chai.expect(briefcase2.elements.getAspects(id, uniqueAspectClassFullName)).to.have.length(0);
    conflict.acceptTheirs();
    const aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User1");
  });

  it("should report an aspect update when our element deletion cascades to the aspect", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1 updates aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    const conflict = interactive.conflicts.find((entry) => entry.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;
    chai.expect(conflict.theirModifiedProperties).to.include("aspectValue");

    conflict.acceptTheirs();
    const element = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(element).to.not.be.undefined;
    chai.expect(getUniqueAspect(briefcase2, id).aspectValue).to.equal("User1");
  });

  it("should restore an element and its aspect when accepting our aspect update after they deleted the element", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(id);
    });

    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User2";
      txn.updateAspect(aspect);
    });

    await briefcase1.pushChanges({ description: "User1 deletes element" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    const conflict = interactive.conflicts.find((entry) => entry.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.be.undefined;
    chai.expect(conflict.ours).to.not.be.undefined;
    chai.expect(conflict.ourModifiedProperties).to.include("aspectValue");

    conflict.acceptOurs();
    const element = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(element).to.not.be.undefined;
    chai.expect(getUniqueAspect(briefcase2, id).aspectValue).to.equal("User2");
  });

  it("should restore an edited aspect when accepting theirs after our element deletion", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
      // Use a property with an already-set baseline value ("Original", from the outer `before()`
      // setup) rather than an unset one: an unset-to-set transition on a delete-vs-update conflict
      // is not detected by native's `expectedOldValues` comparison - a separate, pre-existing gap
      // unrelated to this cascade/closure design.
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1 updates element and aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    const conflict = interactive.conflicts.find((entry) => entry.classFullName === "InteractiveRebaseTest:SomeGraphicalElement");
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    conflict.acceptTheirs();
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("User1");
    chai.expect(getUniqueAspect(briefcase2, id).aspectValue).to.equal("User1");
  });

  it("merges an ON DELETE SET NULL side effect without reporting a broken relationship", async () => {
    const typeCode = Code.createEmpty();
    typeCode.value = "SomeGraphicalType";

    const [typeId, otherId] = await withEditTxn(briefcase1, async (txn) => {
      const newTypeId = txn.insertElement({
        classFullName: GenericGraphicalType2d.classFullName,
        model: IModel.dictionaryId,
        code: typeCode,
      } as TypeDefinitionElementProps);
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        typeDefinition: { id: newTypeId, relClassName: "BisCore:GraphicalElement2dIsOfType" },
      });
      // Second element exists only to force a genuine conflict, so that a real rebase runs
      // instead of the incoming changeset fast-forwarding.
      const newOtherId = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Original",
        somePoint: new Point2d(9.0, 9.0),
      } as SomeGraphicalElementProps);
      return [newTypeId, newOtherId];
    });

    await briefcase1.pushChanges({ description: "Add type definition" });
    await briefcase2.pullChanges();

    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).typeDefinition?.id).to.equal(typeId);

    // They set a property on the referencing element that we never touch.
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, userLabel: "TheirLabel" });
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User1" });
    });

    // We delete the type definition, which SET NULLs TypeDefinitionId on the referencing element.
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(typeId);
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User2" });
    });

    briefcase2.clearCaches();
    chai.expect(briefcase2.elements.tryGetElementProps(typeId)).to.be.undefined;
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).typeDefinition).to.be.undefined;

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    // The SET NULL is applied to the referencing element as an ordinary property update, so it
    // merges property-wise and is never surfaced as a conflict or a broken relationship.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(otherId);
    chai.expect(interactive.conflicts[0].brokenRelationships.length).to.equal(0);
    chai.expect(interactive.conflicts.some((c) => c.id === id)).to.be.false;

    const final = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(final.typeDefinition).to.be.undefined;
    chai.expect(final.userLabel).to.equal("TheirLabel");
    chai.expect(briefcase2.elements.tryGetElementProps(typeId)).to.be.undefined;
  });

  it("should restore an edited aspect when accepting ours after they deleted the element", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(id);
    });

    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User2";
      txn.updateAspect(aspect);
      txn.updateElement({ id, userLabel: "User2" });
    });

    await briefcase1.pushChanges({ description: "User1 deletes element" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    const conflict = interactive.conflicts.find((entry) => entry.classFullName === "InteractiveRebaseTest:SomeGraphicalElement");
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    conflict.acceptOurs();
    chai.expect(briefcase2.elements.getElementProps(id).userLabel).to.equal("User2");
    chai.expect(getUniqueAspect(briefcase2, id).aspectValue).to.equal("User2");
  });

  it("detects a conflict on an aspect two levels below a deleted grandparent", async () => {
    const grandparent = id;
    const [parent, otherId] = await withEditTxn(briefcase1, async (txn) => {
      const p = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Parent",
        somePoint: new Point2d(1.0, 1.0),
        parent: new ElementOwnsChildElements(grandparent),
      } as SomeGraphicalElementProps);
      const other = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Original",
        somePoint: new Point2d(9.0, 9.0),
      } as SomeGraphicalElementProps);
      return [p, other];
    });
    await briefcase1.pushChanges({ description: "setup parent+other" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id: parent, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "insert aspect on parent" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, parent);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      // Deleting the grandparent cascades through `parent` (a child element) down to the aspect on it.
      txn.deleteElement(grandparent);
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User2" });
    });

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    const aspectConflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
    chai.expect(aspectConflict).to.not.be.undefined;
    chai.expect(aspectConflict?.theirs?.aspectValue).to.equal("User1");
    chai.expect(aspectConflict?.ours).to.be.undefined;

    // `parent` and `grandparent` were never touched by upstream (only cascaded away by our own
    // delete), so neither gets a conflict of its own - only the aspect (their update vs our
    // cascade-delete) and the forced conflict on `otherId`.
    chai.expect(interactive.conflicts.length).to.equal(2);
    chai.expect(interactive.conflicts.some((c) => c.id === grandparent)).to.be.false;
    chai.expect(interactive.conflicts.some((c) => c.id === otherId)).to.be.true;
  });

  it("reparenting a child away from a locally-deleted parent produces no spurious conflict", async () => {
    const parentA = id;
    const [childC, parentB, otherId] = await withEditTxn(briefcase1, async (txn) => {
      const c = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Child",
        somePoint: new Point2d(1.0, 1.0),
        parent: new ElementOwnsChildElements(parentA),
      } as SomeGraphicalElementProps);
      const b = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "ParentB",
        somePoint: new Point2d(2.0, 2.0),
      } as SomeGraphicalElementProps);
      const other = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Original",
        somePoint: new Point2d(9.0, 9.0),
      } as SomeGraphicalElementProps);
      return [c, b, other];
    });
    await briefcase1.pushChanges({ description: "setup child+parentB+other" });
    await briefcase2.pullChanges();

    // Upstream touches only the unrelated `otherId`, to force a genuine rebase rather than a
    // fast-forward, without touching anything related to the reparent/delete below.
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      // Reparent the child away from A *before* deleting A, so A is childless by the time it's deleted.
      txn.updateElement({ id: childC, parent: new ElementOwnsChildElements(parentB) });
      txn.deleteElement(parentA);
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User2" });
    });

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    // Only the forced conflict on `otherId` should be reported - the reparent+delete of A must not
    // produce any conflict, since `childC` was correctly linked to its *new* owner (B), not A.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(otherId);

    const child = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(childC);
    chai.expect(child.parent?.id).to.equal(parentB);
    chai.expect(briefcase2.elements.tryGetElementProps(parentA)).to.be.undefined;
  });

  it("reparenting into an element upstream deleted reports a broken relationship, not an owner conflict", async () => {
    const [childC, parentB] = await withEditTxn(briefcase1, async (txn) => {
      const c = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Child",
        somePoint: new Point2d(1.0, 1.0),
        parent: new ElementOwnsChildElements(id),
      } as SomeGraphicalElementProps);
      const b = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "ParentB",
        somePoint: new Point2d(2.0, 2.0),
      } as SomeGraphicalElementProps);
      return [c, b];
    });
    await briefcase1.pushChanges({ description: "setup child+parentB" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(parentB);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement({ id: childC, parent: new ElementOwnsChildElements(parentB) });
    });

    await briefcase1.pushChanges({ description: "User1 deletes parentB" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    const conflict = interactive.conflicts.find((c) => c.id === childC);
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    chai.expect(conflict.brokenRelationships.length).to.equal(1);
    chai.expect(conflict.brokenRelationships[0].navigationProperty).to.equal("parent");
    // Must not also be (mis)reported as a dependent conflict of some owner.
    chai.expect(conflict.ownerConflict).to.be.undefined;
  });

  it("inserting an element and an aspect on it together replays without a spurious constraint violation", async () => {
    let elementId: Id64String;
    let aspectId: Id64String;
    await withEditTxn(briefcase1, async (txn) => {
      elementId = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "New",
        somePoint: new Point2d(1.0, 1.0),
      } as SomeGraphicalElementProps);
      // Aspects and elements draw ECInstanceIds from independent sequences (see the design doc), so
      // this aspect's id naturally tends to sort *before* the element's - exercising replay ordering
      // without needing a forced id.
      aspectId = txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id: elementId, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "New",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
      // Force a genuine conflict so the rebase actually runs instead of fast-forwarding.
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
    });

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    // The forced conflict on `id` is expected; the new element+aspect insert must replay cleanly.
    chai.expect(interactive.conflicts.some((c) => c.id === elementId)).to.be.false;
    chai.expect(interactive.conflicts.some((c) => c.id === aspectId)).to.be.false;

    const newAspects = briefcase2.elements.getAspects(elementId!, uniqueAspectClassFullName);
    chai.expect(newAspects.length).to.equal(1);
    chai.expect((newAspects[0].toJSON() as SomeUniqueAspectProps).aspectValue).to.equal("New");
  });

  it("attributes a cascaded aspect delete to the txn that deleted its owner, across separate ungrouped txns", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "Insert aspect" });
    await briefcase2.pullChanges();

    // Two separate local txns on briefcase2, left ungrouped (each its own TxnRebaseGroup by default).
    await withEditTxn(briefcase2, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "LocalEdit";
      txn.updateAspect(aspect);
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
    });
    await briefcase1.pushChanges({ description: "User1 updates aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    // Two separate local groups are reinstated in sequence; exactly which group the conflict surfaces
    // in depends on exactly when the incoming changeset gets merged relative to each group's replay
    // (multi-group sequencing is a known, separately-tracked limitation - see the design doc section
    // 11). What must hold regardless: the cascade-delete's Txn correctly attributes the aspect's
    // cascade-away to *its own* captured change, so the conflict against upstream's edit is not lost
    // across the Txn boundary - it must appear in some group, not none.
    let found: RebaseConflict | undefined;
    for (; ;) {
      const more = interactive.nextGroup();
      found ??= interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
      if (!more)
        break;
    }

    chai.expect(found).to.not.be.undefined;
    chai.expect(found?.theirs?.aspectValue).to.equal("User1");
  });

  it("restores an unconflicted dependent when its owner conflict is restored", async () => {
    // Element A (=id) owns aspect X and child element Y. Upstream touches A and X but never Y.
    // Restoring A must also restore Y, even though Y has no conflict of its own.
    const [aspectXId, childYId] = await withEditTxn(briefcase1, async (txn) => {
      const x = txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "InitialX",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
      const y = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Y",
        somePoint: new Point2d(5.0, 5.0),
        parent: new ElementOwnsChildElements(id),
      } as SomeGraphicalElementProps);
      return [x, y];
    });
    await briefcase1.pushChanges({ description: "Insert aspect X and child Y" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
      aspect.aspectValue = "User1X";
      txn.updateAspect(aspect);
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      // Cascades away both aspect X and child Y.
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1 updates element and aspect X" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;
    const elementConflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeGraphicalElement" && c.id === id);
    const aspectConflict = interactive.conflicts.find((c) => c.id === aspectXId);
    chai.expect(elementConflict).to.not.be.undefined;
    chai.expect(aspectConflict).to.not.be.undefined;
    // Y never conflicted - nobody but the cascade touched it.
    chai.expect(interactive.conflicts.some((c) => c.id === childYId)).to.be.false;
    if (!elementConflict) return;

    elementConflict.acceptTheirs();

    // The element and aspect X (which had their own conflicts) are restored to "theirs" ...
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("User1");
    chai.expect(getUniqueAspect(briefcase2, id).aspectValue).to.equal("User1X");
    // ... and so is Y, even though it never had a conflict of its own - the regression this guards.
    const childY = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(childYId);
    chai.expect(childY).to.not.be.undefined;
    chai.expect(childY?.foo).to.equal("Y");
  });

  it("reports an upstream-inserted aspect instead of silently cascading it away", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "FromUpstream",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1 inserts aspect" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    const aspectConflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
    chai.expect(aspectConflict).to.not.be.undefined;
    chai.expect(aspectConflict?.original).to.be.undefined;
    chai.expect(aspectConflict?.ours).to.be.undefined;
    chai.expect(aspectConflict?.theirs?.aspectValue).to.equal("FromUpstream");
  });

  it("can rebase a txn that deletes an element and then reuses its federationGuid for a new element", async () => {
    // This test is only trying to test a one-briefcase delete+reinsert. But in order to trigger the
    // interactive rebase path (instead of fast-forward), we need to create a conflict by updating
    // the deleted element in another briefcase.
    const federationGuid = briefcase1.elements.getElementProps<SomeGraphicalElementProps>(id).federationGuid;
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id, foo: "User1" } as SomeGraphicalElementProps);
    });

    const newId = await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        federationGuid: federationGuid,
        code: Code.createEmpty(),
        foo: "Original",
        somePoint: new Point2d(1.23, 4.56),
      } as SomeGraphicalElementProps);
    });

    await briefcase1.pushChanges({ description: "User1 edits the userLabel" });
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    // There should only be the one UPDATE-DELETE conflict.
    // The new element reuses the deleted element's federationGuid, but that is not a conflict.
    // It might be incorrectly identified as one, though, if the insertion happens before the
    // deletion. That is what this test is checking.
    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    const newElementProps = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(newId);
    chai.expect(newElementProps.federationGuid).to.equal(federationGuid);
    chai.expect(briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id)).to.be.undefined;
  });

  it("can rebase a txn that deletes an element and reuses its federationGuid via an update to another element", async () => {
    const federationGuid = briefcase1.elements.getElementProps<SomeGraphicalElementProps>(id).federationGuid;

    const otherId = await withEditTxn(briefcase1, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Other",
        somePoint: new Point2d(9.0, 9.0),
      } as SomeGraphicalElementProps);
    });
    await briefcase1.pushChanges({ description: "setup other" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id, foo: "User1" } as SomeGraphicalElementProps);
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, federationGuid });
    });

    await briefcase1.pushChanges({ description: "User1 edits foo" });
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.false;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    const otherElementProps = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(otherId);
    chai.expect(otherElementProps.federationGuid).to.equal(federationGuid);
    chai.expect(briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id)).to.be.undefined;
  });
});
