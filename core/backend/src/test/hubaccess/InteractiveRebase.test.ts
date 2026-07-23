/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { TestUtils } from "../TestUtils";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubMock } from "../../internal/HubMock";
import { KnownTestLocations } from "../KnownTestLocations";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { withEditTxn } from "../TestEditTxn";
import { Code, GeometricElement2dProps, GeometryStreamBuilder, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { BriefcaseDb, ChannelControl, DrawingCategory } from "../../core-backend";
import { LineSegment3d, Point2d, Point3d, XYProps } from "@itwin/core-geometry";
import { TheirDeleteOurUpdateRebaseConflict, TheirUpdateOurDeleteRebaseConflict, UniqueConstraintRebaseConflict, UpdateRebaseConflict } from "../../InteractiveRebase";
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

  it("can present an UPDATE conflict", async () => {
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
    const updateConflict = interactive.conflicts[0] as UpdateRebaseConflict;
    chai.expect(updateConflict.id).to.equal(id);
    chai.expect(updateConflict.kind).to.equal("Update");

    chai.expect(updateConflict.original["SomePoint"]).to.deep.equal({ X: 1.23, Y: 4.56 });
    chai.expect(updateConflict.ours["SomePoint"]).to.deep.equal({ X: 3.0, Y: 4.0 });
    chai.expect(updateConflict.theirs["SomePoint"]).to.deep.equal({ X: 1.0, Y: 2.0 });

    chai.expect(updateConflict.original["Foo"]).to.equal("Original");
    chai.expect(updateConflict.ours["Foo"]).to.equal("User2");
    chai.expect(updateConflict.theirs["Foo"]).to.equal("User1");

    // Initially, "our" values are selected.
    const valuesInitial = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesInitial.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesInitial.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;
    chai.expect(valuesInitial.userLabel).to.equal("Wat");

    // We can explicitly accept "theirs" instead.
    updateConflict.acceptTheirs(interactive);
    const valuesTheirs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirs.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirs.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    // UserLabel does not conflict, so our value is maintained.
    chai.expect(valuesTheirs.userLabel).to.equal("Wat");

    // And then switch back to "ours" again.
    updateConflict.acceptOurs(interactive);
    const valuesOurs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOurs.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOurs.somePoint).isExactEqual(new Point2d(3.0, 4.0))).to.be.true;
    chai.expect(valuesOurs.userLabel).to.equal("Wat");

    // We can accept a subset of properties
    updateConflict.acceptTheirs(interactive, ["SomePoint"]);
    const valuesTheirsSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    updateConflict.acceptTheirs(interactive, ["Foo"]);
    const valuesTheirsSubset2 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirsSubset2.foo).to.equal("User1");
    chai.expect(Point2d.fromJSON(valuesTheirsSubset2.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;

    updateConflict.acceptOurs(interactive, ["Foo"]);
    const valuesOursSubset1 = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOursSubset1.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOursSubset1.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
  });

  it("does not consider both deleting to be a conflict", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(id);
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
    chai.expect(interactive.conflicts.length).to.equal(0);
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

    const deleteConflict = interactive.conflicts[0] as TheirUpdateOurDeleteRebaseConflict;
    chai.expect(deleteConflict.kind).to.equal("TheirUpdateOurDelete");
    chai.expect(deleteConflict.original["Foo"]).to.equal("Original");
    chai.expect(deleteConflict.original["SomePoint"]).to.deep.equal({ X: 1.23, Y: 4.56 });
    chai.expect(deleteConflict.theirs["Foo"]).to.equal("User1");
    chai.expect(deleteConflict.theirs["SomePoint"]).to.deep.equal({ X: 1.0, Y: 2.0 });
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

    const conflict = interactive.conflicts[0] as TheirDeleteOurUpdateRebaseConflict;
    chai.expect(conflict.kind).to.equal("TheirDeleteOurUpdate");
    chai.expect(conflict.original["Foo"]).to.equal("Original");
    chai.expect(conflict.original["SomePoint"]).to.deep.equal({ X: 1.23, Y: 4.56 });
    chai.expect(conflict.ours["Foo"]).to.equal("User2");
    chai.expect(conflict.ours["SomePoint"]).to.deep.equal({ X: 3.0, Y: 4.0 });
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

    await withEditTxn(briefcase2, async (txn) => {
      txn.insertElement({
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

    const conflict = interactive.conflicts[0] as UniqueConstraintRebaseConflict;
    chai.expect(conflict.kind).to.equal("UniqueConstraint");
    chai.expect(conflict.original).to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.ours.FederationGuid).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("FederationGuid");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(1);
    chai.expect(conflict.ours.FederationGuid).to.equal(conflict.uniqueConstraintViolations[0].conflictingRow.FederationGuid);
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

    const conflict = interactive.conflicts[0] as UniqueConstraintRebaseConflict;
    chai.expect(conflict.kind).to.equal("UniqueConstraint");
    chai.expect(conflict.original).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.original?.CodeScope).not.to.be.undefined;
    chai.expect(conflict.original?.CodeSpec).not.to.be.undefined;
    chai.expect(conflict.ours.CodeScope).not.to.be.undefined;
    chai.expect(conflict.ours.CodeSpec).not.to.be.undefined;
    chai.expect(conflict.ours.CodeValue).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("CodeScope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("CodeSpec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("CodeValue");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);
    chai.expect(conflict.original?.CodeScope).not.to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingRow.CodeScope);
    chai.expect(conflict.original?.CodeSpec).not.to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingRow.CodeSpec);
    chai.expect(conflict.original?.CodeValue).not.to.equal(conflict.uniqueConstraintViolations[0].conflictingRow.CodeValue);
    chai.expect(conflict.ours.CodeScope).to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingRow.CodeScope);
    chai.expect(conflict.ours.CodeSpec).to.deep.equal(conflict.uniqueConstraintViolations[0].conflictingRow.CodeSpec);
    chai.expect(conflict.ours.CodeValue).to.equal(conflict.uniqueConstraintViolations[0].conflictingRow.CodeValue);
  });

  it("can present a conflict where local and upstream both inserted a row with the same primary key", async () => {
    const guid = Guid.createValue();
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertElement({
        id: "0x1234",
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

    await withEditTxn(briefcase2, async (txn) => {
      txn.insertElement({
        id: "0x1234",
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "User2",
        somePoint: new Point2d(3.0, 4.0),
        federationGuid: guid,
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
    chai.expect(conflict.kind).to.equal("Insert");
    chai.expect(conflict.id).to.equal("0x1234");
  });
});
