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
import { ChannelControl, DrawingCategory } from "../../core-backend";
import { LineSegment3d, Point2d, Point3d, XYProps } from "@itwin/core-geometry";
import { UpdateRebaseConflict } from "../../InteractiveRebase";

chai.use(chaiAsPromised);

describe("InteractiveRebase", () => {
  before(async () => {
    HubMock.startup("InteractiveRebase", KnownTestLocations.outputDir);
  });

  after(async () => {
    HubMock.shutdown();
  });

  it("can resolve simple conflict", async () => {
    const accessToken1 = "user1";
    const accessToken2 = "user2";
    const iModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject", noLocks: true });
    const briefcase1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId: HubMock.iTwinId, iModelId: iModelId });

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

    interface SomeGraphicalElementProps extends GeometricElement2dProps {
      foo: string;
      somePoint: XYProps;
    }

    const id = await withEditTxn(briefcase1, async (txn) => {
      await txn.iModel.importSchemaStrings([schema]);

      const codeProps = Code.createEmpty();
      codeProps.value = "DrawingModel";
      const drawingModelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true)[1];
      let drawingCategoryId = DrawingCategory.queryCategoryIdByName(briefcase1, IModel.dictionaryId, "MyDrawingCategory");
      if (undefined === drawingCategoryId)
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

    const briefcase2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId: HubMock.iTwinId, iModelId: iModelId });
    briefcase2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

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
    const interactive = await briefcase2.pullChangesInteractive();
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
});