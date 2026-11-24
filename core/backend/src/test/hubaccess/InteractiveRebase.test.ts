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
import { Code, CodeScopeSpec, ElementAspectProps, ElementProps, GeometricElement2dProps, IModel, QueryBinder, RelatedElementProps, SubCategoryAppearance, TypeDefinitionElementProps } from "@itwin/core-common";
import { BriefcaseDb, ChannelControl, DocumentListModel, Drawing, DrawingCategory, DrawingModel, EditTxn, ElementOwnsChildElements, GenericGraphicalType2d } from "../../core-backend";
import type { RebaseConflict } from "../../InteractiveRebase";
import { InteractiveRebaseError } from "../../InteractiveRebase";
import { _nativeDb } from "../../internal/Symbols";
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
    peer?: RelatedElementProps;
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
          <ECRelationshipClass typeName="SomeGraphicalElementRefersToPeer" strength="referencing" modifier="None">
              <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true">
                  <Class class="SomeGraphicalElement"/>
              </Source>
              <Target multiplicity="(0..1)" roleLabel="is referred to by" polymorphic="true">
                  <Class class="SomeGraphicalElement"/>
              </Target>
          </ECRelationshipClass>
          <ECEntityClass typeName="SomeGraphicalElement">
              <BaseClass>bis:GraphicalElement2d</BaseClass>
              <ECProperty propertyName="Foo" typeName="string" />
              <ECProperty propertyName="SomePoint" typeName="point2d" />
              <ECNavigationProperty propertyName="Peer" relationshipName="SomeGraphicalElementRefersToPeer" direction="forward" />
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

  it("Delete-Delete", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.original).not.to.be.undefined;
    chai.expect(conflict.theirs).to.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;
  });

  it("Update-Update", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

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
    // The userLabel did not conflict, so it is not changed.
    chai.expect(valuesTheirs.userLabel).to.equal("Wat");

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

    chai.expect(() => conflict.acceptOurs(["userLabel"])).to.throw("None of the specified properties");
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

    chai.expect(interactive.nextGroup()).to.be.true;
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

  it("Our Delete-Their Update", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;

    // The properties that were updated in their changes should be called out.
    chai.expect(conflict.conflictingProperties.length).to.equal(0);
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

    // It is not valid to call acceptOurs or acceptTheirs on this conflict, since one side does not exist.
    chai.expect(() => conflict.acceptOurs()).to.throw("Cannot use acceptOurs or acceptTheirs on a conflict where one side does not exist");
    chai.expect(() => conflict.acceptTheirs()).to.throw("Cannot use acceptOurs or acceptTheirs on a conflict where one side does not exist");
  });

  it("Our Delete-Their Update where updated property was originally null", async () => {
    chai.expect(briefcase1.elements.getElementProps(id).userLabel).to.be.undefined;
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, userLabel: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    await briefcase1.pushChanges({ description: "User1 sets userLabel" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(id);
    chai.expect(conflict.ours).to.be.undefined;
    chai.expect(conflict.theirModifiedProperties).to.include("userLabel");
    chai.expect(conflict.original!.userLabel).to.be.undefined;
    chai.expect(conflict.theirs!.userLabel).to.equal("User1");
    chai.expect(() => conflict.acceptOurs()).to.throw("Cannot use acceptOurs or acceptTheirs on a conflict where one side does not exist");
  });

  it("Our Update-Their Delete", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
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
    // We let the delete stand.
    const values = briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id);
    chai.expect(values).to.be.undefined;

    // Neither acceptOurs nor acceptTheirs are allowed.
    chai.expect(() => conflict.acceptOurs()).to.throw("Cannot use acceptOurs or acceptTheirs on a conflict where one side does not exist");
    chai.expect(() => conflict.acceptTheirs()).to.throw("Cannot use acceptOurs or acceptTheirs on a conflict where one side does not exist");
  });

  it("Insert-Insert", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
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

  it("Insert triggers UNIQUE constraint violation", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];

    chai.expect(conflict.original).to.be.undefined;
    chai.expect(conflict.theirs).to.be.undefined;
    chai.expect(conflict.ours).not.to.be.undefined;
    chai.expect(conflict.conflictingProperties.length).to.equal(0);

    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.ours!.federationGuid).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("federationGuid");
    chai.expect(conflict.ours!.federationGuid).to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.federationGuid);

    // The conflicting element is assigned a new federationGuid to resolve the conflict.
    const localElement = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(localId);
    chai.expect(localElement.federationGuid).not.to.equal(guid);
    chai.expect(localElement.federationGuid).not.to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.federationGuid);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.deep.equal(["federationGuid"]);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedValue).to.deep.equal([localElement.federationGuid]);

    // The violation can be resolved by supplying a new value.
    const newGuid = Guid.createValue();
    conflict.resolveUniqueConstraintViolation(conflict.uniqueConstraintViolations[0], [newGuid]);

    // This will update the iModel, but not update the original `ours`.
    const localElementUpdated = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(localId);
    chai.expect(localElementUpdated.federationGuid).to.equal(newGuid);
    chai.expect(conflict.ours!.federationGuid).not.to.equal(newGuid);
  });

  it("Update triggers UNIQUE constraint violation with their inserted element", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
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
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.deep.equal(["code.spec", "code.scope", "code.value"]);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedValue).to.deep.equal([IModel.dictionaryId, IModel.dictionaryId, "SomeValue (Conflict)"]);

    // The violation can be resolved by supplying a new value.
    const newCodeValue = "Newness";
    conflict.resolveUniqueConstraintViolation(conflict.uniqueConstraintViolations[0], [IModel.dictionaryId, IModel.dictionaryId, newCodeValue]);

    // This will update the iModel, but not update the original `ours`.
    const localElementUpdated = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(localElementUpdated.code.value).to.equal(newCodeValue);
    chai.expect(conflict.ours!.code.value).not.to.equal(newCodeValue);
  });

  it("Update triggers UNIQUE constraint violation with their updated element", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);

    const conflict = interactive.conflicts[0];

    // The code.value should be included, because it was changed.
    chai.expect(conflict.original?.code.value).not.to.be.undefined;
    chai.expect(conflict.ours!.code.value).not.to.be.undefined;
    chai.expect(conflict.theirs!.code.value).not.to.be.undefined;

    // code.spec and code.scope should also be included even though they were not changed.
    chai.expect(conflict.original?.code.spec).not.to.be.undefined;
    chai.expect(conflict.original?.code.scope).not.to.be.undefined;
    chai.expect(conflict.theirs!.code.spec).not.to.be.undefined;
    chai.expect(conflict.ours!.code.spec).not.to.be.undefined;
    chai.expect(conflict.ours!.code.scope).not.to.be.undefined;
    chai.expect(conflict.theirs!.code.scope).not.to.be.undefined;

    // The conflict should correctly identify which unique constraint was violated.
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);

    // The conflicting row should include the changed code.value property
    chai.expect(conflict.original?.code.value).not.to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.value);
    chai.expect(conflict.ours!.code.value).to.equal(conflict.uniqueConstraintViolations[0].conflictingInstance.code.value);

    // And it should also contain the unchanged code.spec and code.scope properties, which are part of the unique constraint.
    chai.expect(conflict.uniqueConstraintViolations[0].conflictingInstance.code.spec).to.equal(IModel.dictionaryId);
    chai.expect(conflict.uniqueConstraintViolations[0].conflictingInstance.code.scope).to.equal(IModel.dictionaryId);
  });

  it("Conflicting Update triggers UNIQUE constraint violation when applied", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // Both the data conflict (on "foo") and the UNIQUE constraint violation (on "code") are reported
    // against the same instance, so they're merged into a single RebaseConflict entry.
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
    chai.expect(Point2d.fromJSON(valuesInitial.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    chai.expect(valuesInitial.userLabel).to.equal("Wat");

    // When we explicitly accept "theirs" instead, only data-conflicting properties are updated,
    // so the unique constraint violation is unaffected because it is not a data conflict.
    conflict.acceptTheirs();
    const valuesTheirs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirs.foo).to.equal("User1");
    chai.expect(valuesTheirs.code.value).to.equal("SomeValue (Conflict)");
    chai.expect(Point2d.fromJSON(valuesTheirs.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    chai.expect(valuesTheirs.userLabel).to.equal("Wat");
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");

    // Switching back to "ours" leaves upstream-only changes and the constraint fix intact.
    conflict.acceptOurs();
    const valuesOurs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOurs.foo).to.equal("User2");
    chai.expect(Point2d.fromJSON(valuesOurs.somePoint).isExactEqual(new Point2d(1.0, 2.0))).to.be.true;
    chai.expect(valuesOurs.userLabel).to.equal("Wat");
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(3);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.scope");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.spec");
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("code.value");

    // Upstream-only properties are not eligible for conflict resolution.
    chai.expect(() => conflict.acceptTheirs(["somePoint"])).to.throw("None of the specified properties");
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

    // The non-data-conflicting code must be resolved through the constraint API.
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(() => conflict.acceptTheirs(["code.value"])).to.throw("None of the specified properties");
    conflict.resolveUniqueConstraintViolation(conflict.uniqueConstraintViolations[0], [
      conflict.theirs!.code.spec, conflict.theirs!.code.scope, conflict.theirs!.code.value,
    ]);
    chai.expect(briefcase2.elements.getElementProps(id).code).to.deep.equal(conflict.theirs!.code);
    chai.expect(conflict.uniqueConstraintViolations[0].appliedValue).to.deep.equal([
      conflict.theirs!.code.spec, conflict.theirs!.code.scope, conflict.theirs!.code.value,
    ]);
    chai.expect(conflict.uniqueConstraintViolations[0].stagedValue).to.be.undefined;
  });

  it("UNIQUE constraint violation on data-conflicting property can be cleared by acceptTheirs", async () => {
    const conflictingGuid = Guid.createValue();
    const otherGuid = Guid.createValue();
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
        federationGuid: conflictingGuid,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
      } as SomeGraphicalElementProps);
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        foo: "User1",
        somePoint: new Point2d(1.0, 2.0),
        federationGuid: otherGuid,
        userLabel: "Wat" // non-conflicting property
      });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        // data conflict _and_ unique constraint conflict
        federationGuid: conflictingGuid,
      });
    });

    await briefcase1.pushChanges({ description: "User1" });

    // Pull changes into briefcase2, which will create a conflict on the element.
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    // Both the data conflict (on "federationGuid") and the UNIQUE constraint violation (also on "federationGuid") are reported
    // against the same instance, so they're merged into a single RebaseConflict entry.
    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(id);

    chai.expect(conflict.differentProperties.length).to.equal(5);
    chai.expect(conflict.differentProperties).to.include("federationGuid");
    chai.expect(conflict.differentProperties).to.include("lastMod");
    chai.expect(conflict.differentProperties).to.include("foo");
    chai.expect(conflict.differentProperties).to.include("somePoint");
    chai.expect(conflict.differentProperties).to.include("userLabel");

    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties.length).to.equal(1);
    chai.expect(conflict.uniqueConstraintViolations[0].uniqueConstraintProperties).to.include("federationGuid");
    chai.expect(conflict.uniqueConstraintViolations[0].appliedValue).not.to.be.undefined;
    chai.expect(conflict.uniqueConstraintViolations[0].appliedValue!.length).to.equal(1);

    // Only the properties with actual conflicts should be found in conflictingProperties.
    chai.expect(conflict.conflictingProperties.length).to.equal(2);
    chai.expect(conflict.conflictingProperties).to.include("federationGuid");
    chai.expect(conflict.conflictingProperties).to.include("lastMod");

    // Initially, "our" values are selected.
    // For the unique constraint conflict, a new value has been selected automatically to avoid the conflict.
    const valuesInitial = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesInitial.federationGuid).not.to.equal(conflictingGuid);
    chai.expect(valuesInitial.federationGuid).not.to.equal(otherGuid);
    chai.expect(valuesInitial.federationGuid).to.equal(conflict.uniqueConstraintViolations[0].appliedValue![0]);

    // We can explicitly accept "theirs" instead. At which point there is no UNIQUE constraint violation anymore.
    conflict.acceptTheirs();
    const valuesTheirs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesTheirs.federationGuid).to.equal(otherGuid);
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(0);

    // And then switch back to "ours" again. The violation should be back with another new guid
    conflict.acceptOurs();
    const valuesOurs = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(valuesOurs.federationGuid).not.to.equal(conflictingGuid);
    chai.expect(valuesOurs.federationGuid).not.to.equal(otherGuid);
    chai.expect(valuesOurs.federationGuid).to.equal(conflict.uniqueConstraintViolations[0].appliedValue![0]);

    // Accepting their federationGuid will clear the UNIQUE constraint violation.
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(1);
    conflict.acceptTheirs(["federationGuid"]);
    chai.expect(conflict.uniqueConstraintViolations.length).to.equal(0);
  });

  it("Swaps two federationGuids with zero reported conflicts", async () => {
    const guidA = Guid.createValue();
    const guidB = Guid.createValue();

    const [elA, elB] = await withEditTxn(briefcase1, async (txn) => {
      const a = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "SwapA",
        somePoint: new Point2d(10.0, 10.0),
        federationGuid: guidA,
      } as SomeGraphicalElementProps);
      const b = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "SwapB",
        somePoint: new Point2d(11.0, 11.0),
        federationGuid: guidB,
      } as SomeGraphicalElementProps);
      return [a, b];
    });
    await briefcase1.pushChanges({ description: "Insert swap elements" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase2, async (txn) => {
      // A true swap - each root claims the value the other one is simultaneously freeing. Constructed via
      // a temporary third value: SQLite enforces the UNIQUE constraint immediately per statement, so
      // writing elA straight to guidB here (while elB still holds it live) would fail on the spot, well
      // before any of this reaches InteractiveRebase. The capture only records each element's *net*
      // old/new for the whole Txn, so this intermediate step is invisible to replay - elA nets out to
      // old=guidA/new=guidB and elB to old=guidB/new=guidA, exactly the swap this test means to exercise.
      txn.updateElement<SomeGraphicalElementProps>({ id: elA, federationGuid: Guid.createValue() });
      txn.updateElement<SomeGraphicalElementProps>({ id: elB, federationGuid: guidA });
      txn.updateElement<SomeGraphicalElementProps>({ id: elA, federationGuid: guidB });
      // Unrelated - just forces a genuine rebase instead of a fast-forward merge.
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });
    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    // Only the forced conflict on `id` should surface - the swap is a self-contained ordering cycle,
    // not a real external collision, so it must apply cleanly with no UniqueConstraintViolation.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(id);

    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(elA).federationGuid).to.equal(guidB);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(elB).federationGuid).to.equal(guidA);
  });

  it("Applies a large federationGuid cycle with zero reported conflicts", async () => {
    const numberOfElements = 100;
    const guids = Array.from({ length: numberOfElements }, () => Guid.createValue());
    const elementIds: Id64String[] = [];

    const id = await withEditTxn(briefcase1, async (txn) => {
      guids.forEach(guid => {
        elementIds.push(txn.insertElement({
          classFullName: "irt:SomeGraphicalElement",
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          foo: "SwapA",
          somePoint: new Point2d(10.0, 10.0),
          federationGuid: guid,
        } as SomeGraphicalElementProps));
      });

      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "SwapA",
        somePoint: new Point2d(10.0, 10.0),
      } as SomeGraphicalElementProps);
    });
    await briefcase1.pushChanges({ description: "Insert elements" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase2, async (txn) => {
      // Cycle each federationGuid to the next element.
      for (let i = 0; i < numberOfElements; ++i) {
        txn.updateElement<SomeGraphicalElementProps>({ id: elementIds[i], federationGuid: Guid.createValue() });
      }
      for (let i = 0; i < numberOfElements; ++i) {
        const elementId = elementIds[i];
        const guid = guids[(i + 1) % numberOfElements];
        txn.updateElement<SomeGraphicalElementProps>({ id: elementId, federationGuid: guid });
      }

      // Unrelated - just forces a rebase instead of a fast-forward merge.
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });
    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    // Only the forced conflict on `id` should surface - the swap is a self-contained ordering cycle,
    // not a real external collision, so it must apply cleanly with no UniqueConstraintViolation.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(id);
  });

  it("Assigns a type definition onto a newly-inserted type in the same Txn", async () => {
    const childId = await withEditTxn(briefcase1, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Untyped",
        somePoint: new Point2d(12.0, 12.0),
      } as SomeGraphicalElementProps);
    });
    await briefcase1.pushChanges({ description: "Insert untyped element" });
    await briefcase2.pullChanges();

    const typeCode = Code.createEmpty();
    typeCode.value = "NewBatchType";
    const newTypeId = await withEditTxn(briefcase2, async (txn) => {
      const insertedTypeId = txn.insertElement({
        classFullName: GenericGraphicalType2d.classFullName,
        model: IModel.dictionaryId,
        code: typeCode,
      } as TypeDefinitionElementProps);
      // Referencing a same-batch Insert. Verifying the dependency (insertedTypeId) is
      // inserted before the dependent (childId) is updated.
      txn.updateElement<SomeGraphicalElementProps>({
        id: childId,
        typeDefinition: { id: insertedTypeId, relClassName: "BisCore:GraphicalElement2dIsOfType" },
      });
      // Unrelated, just forces a rebase instead of a fast-forward merge.
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
      return insertedTypeId;
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });
    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(id);

    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(childId).typeDefinition?.id).to.equal(newTypeId);
  });

  it("Inserts elements with circular references without reporting a conflict", async () => {
    const aId = "0xabc00a";
    const bId = "0xabc00b";

    await withEditTxn(briefcase2, async (txn) => {
      txn.insertElement({
        id: aId,
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "CycleA",
        somePoint: new Point2d(13.0, 13.0),
        peer: { id: bId, relClassName: "irt:SomeGraphicalElementRefersToPeer" },
      } as SomeGraphicalElementProps, { forceUseId: true });
      txn.insertElement({
        id: bId,
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "CycleB",
        somePoint: new Point2d(14.0, 14.0),
        peer: { id: aId, relClassName: "irt:SomeGraphicalElementRefersToPeer" },
      } as SomeGraphicalElementProps, { forceUseId: true });
      // Unrelated - just forces a rebase instead of a fast-forward merge.
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });
    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    // Neither of the two mutually-referencing new inserts should be reported as a conflict - only the
    // forced conflict on `id`.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(id);

    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(aId).peer?.id).to.equal(bId);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(bId).peer?.id).to.equal(aId);
  });

  it("BrokenRelationship - we add an element to a parent element they deleted", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(childId);

    chai.expect(conflict.brokenRelationships.length).to.equal(1);
    chai.expect(conflict.brokenRelationships[0].navigationProperty).to.equal("parent");
    chai.expect(conflict.brokenRelationships[0].relationshipClass.fullName).to.equal("BisCore:ElementOwnsChildElements");
    chai.expect(conflict.brokenRelationships[0].appliedValue).to.be.null;

    // The new element should still exist, but it should have no parent.
    const child = briefcase2.elements.tryGetElementProps(childId);
    chai.expect(child).to.not.be.undefined;
    chai.expect((child as any).parent).to.be.undefined;

    // The broken relationship can be resolved
    const newId = interactive.editTxn.insertElement({
      classFullName: "irt:SomeGraphicalElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      foo: "New Parent!",
      somePoint: new Point2d(1.23, 4.56),
    } as SomeGraphicalElementProps);

    conflict.resolveBrokenRelationship(conflict.brokenRelationships[0], newId);

    chai.expect(briefcase2.elements.tryGetElementProps(childId)?.parent?.id).to.equal(newId);
  });

  it("BrokenRelationship - we add an element to a model they deleted (non-nullable navigation property)", async () => {
    const deletedModelId = await withEditTxn(briefcase1, async (txn) => {
      const code = Code.createEmpty();
      code.value = "DeletedModel";
      return IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, code, true)[1];
    });
    await briefcase1.pushChanges({ description: "Create model" });
    await briefcase2.pullChanges();

    const childId = await withEditTxn(briefcase2, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: deletedModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Child",
        somePoint: new Point2d(5.0, 6.0),
      } as SomeGraphicalElementProps);
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteModel(deletedModelId);
    });
    await briefcase1.pushChanges({ description: "Delete model" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(childId);

    // Because the model was deleted and the model property is not nullable, this change is not applied at all.
    chai.expect(conflict.brokenRelationships.length).to.equal(1);
    chai.expect(conflict.brokenRelationships[0].navigationProperty).to.equal("model");
    chai.expect(conflict.brokenRelationships[0].appliedValue).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;

    // We can resolve the broken relationship by supplying a model, at which point the child element will be inserted.
    const code = Code.createEmpty();
    code.value = "NewModel";
    const newModelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(interactive.editTxn, code, true)[1];
    conflict.resolveBrokenRelationship(conflict.brokenRelationships[0], newModelId);

    chai.expect(conflict.brokenRelationships[0].appliedValue).to.equal(newModelId);
    chai.expect(conflict.brokenRelationships[0].stagedValue).to.be.undefined;

    const childProps = briefcase2.elements.tryGetElementProps(childId);
    chai.expect(childProps).not.to.be.undefined;
    chai.expect(childProps!.model).to.equal(newModelId);
  });

  it("DeletionEffect - cascade to their inserted child", async () => {
    const childId = await withEditTxn(briefcase1, async (txn) => {
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
    await briefcase1.pushChanges({ description: "Insert child" });

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(id);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];

    // Our delete should stand, and it should be cascaded to the new child element as well.
    chai.expect(conflict.id).to.equal(id);
    chai.expect(conflict.deletionEffects).to.have.length(1);
    chai.expect(conflict.deletionEffects[0].affectedId).to.equal(childId);
    chai.expect(conflict.deletionEffects[0].action).to.equal("cascade");
    chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;

    // acceptOurs and acceptTheirs are disallowed.
    chai.expect(() => conflict.acceptOurs()).to.throw();
    chai.expect(() => conflict.acceptTheirs()).to.throw();
  });

  it("DeletionEffect - cascade to an element that was reparented to a deleted element", async () => {
    const childId = await withEditTxn(briefcase1, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Child",
        somePoint: new Point2d(5.0, 6.0),
      } as SomeGraphicalElementProps);
    });
    await briefcase1.pushChanges({ description: "Insert child" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id: childId, parent: new ElementOwnsChildElements(id) });
    });
    await briefcase1.pushChanges({ description: "Reparent child under id" });

    // The child is not under `id` yet when we delete it, so our delete doesn't cascade to it locally.
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id: childId, foo: "Local" });
      txn.deleteElement(id);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    // Make sure our deletion went through and the element is gone.
    chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;

    // The deletion should cascade to the child, and this should be reported.
    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;
    const reported = interactive.conflicts.some((conflict) => conflict.id === childId || conflict.deletionEffects.some((effect) => effect.affectedId === childId));
    chai.expect(reported, "the cascaded delete of the child is not reported").to.be.true;
  });

  it("DeletionEffect - code scope deletion blocked by a required NoAction reference", async () => {
    const [codeSpecId, codeScopeId] = await withEditTxn(briefcase1, async (txn) => {
      const spec = briefcase1.codeSpecs.insert(txn, "BlockedCodeScopeDelete", CodeScopeSpec.Type.RelatedElement);
      const scope = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Scope",
        somePoint: new Point2d(5.0, 6.0),
      } as SomeGraphicalElementProps);
      return [spec, scope];
    });
    await briefcase1.pushChanges({ description: "Create code scope for blocked deletion" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(codeScopeId);
    });
    chai.expect(briefcase2.elements.tryGetElementProps(codeScopeId)).to.be.undefined;

    let referencingElementId!: Id64String;
    await withEditTxn(briefcase1, async (txn) => {
      referencingElementId = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: new Code({ spec: codeSpecId, scope: codeScopeId, value: "BlockedCodeScopeReference" }),
        foo: "Reference",
        somePoint: new Point2d(8.0, 9.0),
      } as SomeGraphicalElementProps);
    });
    await briefcase1.pushChanges({ description: "Add required code scope reference" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];

    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;

    // There should be a deletion effect reporting that the CodeScope element's deletion was blocked.
    chai.expect(conflict.deletionEffects.length).to.equal(1);
    const deletionEffect = conflict.deletionEffects[0];
    chai.expect(deletionEffect.action).to.equal("blocks-deletion");
    chai.expect(deletionEffect.affectedId).to.equal(referencingElementId);
    chai.expect(deletionEffect.references.length).to.equal(1);
    const reference = deletionEffect.references[0];
    chai.expect(reference.targetId).to.equal(codeScopeId);

    // The element should still exist, and still be referenced.
    chai.expect(briefcase2.elements.tryGetElementProps(codeScopeId)).to.not.be.undefined;
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(referencingElementId).code.scope).to.equal(codeScopeId);
  });

  it("BrokenRelationship - preserves the previous value when an update to a non-nullable navigation property is invalid", async () => {
    const [codeSpecId, originalScopeId, deletedScopeId] = await withEditTxn(briefcase1, async (txn) => {
      const insertScope = (foo: string) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo,
        somePoint: new Point2d(5.0, 6.0),
      } as SomeGraphicalElementProps);
      const spec = briefcase1.codeSpecs.insert(txn, "UpdateCodeScopeSpec", CodeScopeSpec.Type.RelatedElement);
      const originalScope = insertScope("OriginalScope");
      const deletedScope = insertScope("DeletedScope");
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        code: new Code({ spec, scope: originalScope, value: "ScopedCode" }),
      });
      return [spec, originalScope, deletedScope];
    });
    await briefcase1.pushChanges({ description: "Create scopes for invalid update" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(deletedScopeId);
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        code: new Code({ spec: codeSpecId, scope: deletedScopeId, value: "ScopedCode" }),
      });
    });
    await briefcase1.pushChanges({ description: "Delete scope for invalid update" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;
    const conflict = interactive.conflicts.find((candidate) => candidate.id === id);
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    chai.expect(conflict.brokenRelationships).to.have.length(1);
    const brokenRelationship = conflict.brokenRelationships[0];
    chai.expect(brokenRelationship.navigationProperty).to.equal("code.scope");
    chai.expect(brokenRelationship.appliedValue).to.equal(originalScopeId);
    chai.expect(briefcase2.elements.getElementProps(id).code.scope).to.equal(originalScopeId);

    const newScopeId = interactive.editTxn.insertElement({
      classFullName: "irt:SomeGraphicalElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      foo: "New Scope",
      somePoint: new Point2d(5.0, 6.0),
    } as SomeGraphicalElementProps);

    conflict.resolveBrokenRelationship(brokenRelationship, newScopeId);

    chai.expect(conflict.brokenRelationships.length).to.equal(1);
    chai.expect(conflict.brokenRelationships[0]).to.equal(brokenRelationship);
    chai.expect(brokenRelationship.appliedValue).to.equal(newScopeId);
    chai.expect(interactive.iModel.elements.getElementProps(id).code.scope).to.equal(newScopeId);
  });

  it("BrokenRelationship - preserves their non-nullable navigation value when each side deletes the other's target", async () => {
    const [codeSpecId, ourScopeId, theirScopeId] = await withEditTxn(briefcase1, async (txn) => {
      const insertScope = (foo: string) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo,
        somePoint: new Point2d(5.0, 6.0),
      } as SomeGraphicalElementProps);
      const spec = briefcase1.codeSpecs.insert(txn, "CrossedUpdateCodeScopeSpec", CodeScopeSpec.Type.RelatedElement);
      const originalScope = insertScope("OriginalScope");
      const ourScope = insertScope("OurScope");
      const theirScope = insertScope("TheirScope");
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        code: new Code({ spec, scope: originalScope, value: "CrossedScopedCode" }),
      });
      return [spec, ourScope, theirScope];
    });
    await briefcase1.pushChanges({ description: "Create scopes for crossed invalid updates" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        code: new Code({ spec: codeSpecId, scope: theirScopeId, value: "CrossedScopedCode" }),
      });
      txn.deleteElement(ourScopeId);
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        code: new Code({ spec: codeSpecId, scope: ourScopeId, value: "CrossedScopedCode" }),
      });
      txn.deleteElement(theirScopeId);
    });
    await briefcase1.pushChanges({ description: "Update scope and delete their target" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(2);
    const updateConflict = interactive.conflicts.find((candidate) => candidate.id === id);
    const deleteConflict = interactive.conflicts.find((candidate) => candidate.id === theirScopeId);
    chai.expect(updateConflict).to.not.be.undefined;
    chai.expect(deleteConflict).to.not.be.undefined;
    if (!updateConflict || !deleteConflict) return;

    // The updateConflict should have a broken relationship due to the deletion of theirScopeId,
    // and continue using the previous scope.
    chai.expect(updateConflict.conflictingProperties.length).to.equal(2);
    chai.expect(updateConflict.conflictingProperties).to.include("code.scope");
    chai.expect(updateConflict.conflictingProperties).to.include("lastMod");

    chai.expect(updateConflict.brokenRelationships.length).to.equal(1);
    const brokenRelationship = updateConflict.brokenRelationships[0];
    chai.expect(brokenRelationship.navigationProperty).to.equal("code.scope");
    chai.expect(brokenRelationship.appliedValue).to.equal(theirScopeId);

    chai.expect(briefcase2.elements.getElementProps(id).code.scope).to.equal(theirScopeId);

    // The deletionConflict should report it was blocked because the previous scope is still in use.
    chai.expect(deleteConflict.deletionEffects.length).to.equal(1);
    const deletionEffect = deleteConflict.deletionEffects[0];
    chai.expect(deletionEffect.action).to.equal("blocks-deletion");
    chai.expect(deletionEffect.affectedId).to.equal(id);
    chai.expect(deletionEffect.references.length).to.equal(1);
    chai.expect(deletionEffect.references[0].targetId).to.equal(theirScopeId);

    // Resolving the broken relationship allows the scope deletion to proceed,
    // but it is not automatic.
    const newScopeId = interactive.editTxn.insertElement({
      classFullName: "irt:SomeGraphicalElement",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      foo: "New Scope",
      somePoint: new Point2d(5.0, 6.0),
    } as SomeGraphicalElementProps);
    updateConflict.resolveBrokenRelationship(brokenRelationship, newScopeId);

    // The scope still exists.
    chai.expect(briefcase2.elements.tryGetElementProps(theirScopeId)).not.to.be.undefined;

    // But we can delete it now.
    interactive.editTxn.deleteElement(theirScopeId);
    chai.expect(briefcase2.elements.tryGetElementProps(theirScopeId)).to.be.undefined;
  });

  it("BrokenRelationship - can resolve broken model relationships for a new element hierarchy in any order", async () => {
    const deletedModelId = await withEditTxn(briefcase1, async (txn) => {
      const code = Code.createEmpty();
      code.value = "DeletedHierarchyModel";
      return IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, code, true)[1];
    });
    await briefcase1.pushChanges({ description: "Create hierarchy model" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteModel(deletedModelId);
    });

    const [parentId, childId, grandchildId] = await withEditTxn(briefcase2, async (txn) => {
      const insert = (foo: string, parentId?: Id64String) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: deletedModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo,
        somePoint: new Point2d(5.0, 6.0),
        parent: parentId === undefined ? undefined : new ElementOwnsChildElements(parentId),
      } as SomeGraphicalElementProps);

      const parent = insert("Parent");
      const child = insert("Child", parent);
      const grandchild = insert("Grandchild", child);
      return [parent, child, grandchild];
    });

    await briefcase1.pushChanges({ description: "Delete hierarchy model" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts).to.have.length(3);

    const conflicts = [parentId, childId, grandchildId].map((elementId) => {
      const conflict = interactive.conflicts.find((candidate) => candidate.id === elementId);
      chai.expect(conflict).to.not.be.undefined;
      chai.expect(conflict?.brokenRelationships.some((relationship) => relationship.navigationProperty === "model")).to.be.true;
      chai.expect(briefcase2.elements.tryGetElementProps(elementId)).to.be.undefined;
      return conflict!;
    });

    // Resolve in reverse hierarchy order to verify that resolution does not require owners first.
    for (const conflict of conflicts.toReversed()) {
      conflict.resolveBrokenRelationship("model", drawingModelId);
    }

    for (const elementId of [parentId, childId, grandchildId])
      chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(elementId).model).to.equal(drawingModelId);
  });

  it("BrokenRelationship - inserts dependent element once broken model and code.spec relationships are resolved", async () => {
    const [deletedModelId, deletedCodeSpecId] = await withEditTxn(briefcase1, async (txn) => {
      const code = Code.createEmpty();
      code.value = "DeletedModel";
      const modelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, code, true)[1];
      const codeSpecId = briefcase1.codeSpecs.insert(txn, "DeletedCodeSpec", CodeScopeSpec.Type.Repository);
      return [modelId, codeSpecId];
    });
    await briefcase1.pushChanges({ description: "Create model and code spec" });
    await briefcase2.pullChanges();

    const childId = await withEditTxn(briefcase2, async (txn) => {
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: deletedModelId,
        category: drawingCategoryId,
        code: new Code({ spec: deletedCodeSpecId, scope: IModel.rootSubjectId, value: "Child" }),
        foo: "Child",
        somePoint: new Point2d(5.0, 6.0),
      } as SomeGraphicalElementProps);
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteModel(deletedModelId);
      txn.iModel.withSqliteStatement("DELETE FROM bis_CodeSpec WHERE Id=?", (statement) => {
        statement.bindId(1, deletedCodeSpecId);
        statement.step();
      });
    });
    await briefcase1.pushChanges({ description: "Delete model and code spec" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];

    // Child element has two broken relationships.
    // These prevent the element from being inserted at all.
    chai.expect(conflict.id).to.equal(childId);

    const modelRelationship = conflict.brokenRelationships.find((relationship) => relationship.navigationProperty === "model");
    const codeSpecRelationship = conflict.brokenRelationships.find((relationship) => relationship.navigationProperty === "code.spec");
    chai.expect(modelRelationship).to.not.be.undefined;
    chai.expect(codeSpecRelationship).to.not.be.undefined;
    if (!modelRelationship || !codeSpecRelationship) return;

    chai.expect(modelRelationship.appliedValue).to.be.undefined;
    chai.expect(codeSpecRelationship.appliedValue).to.be.undefined;

    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;

    // Resolving the first broken relationship stages a value but can't insert the element yet.
    const modelCode = Code.createEmpty();
    modelCode.value = "ReplacementModel";
    const replacementModelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(interactive.editTxn, modelCode, true)[1];
    conflict.resolveBrokenRelationship(modelRelationship, replacementModelId);

    chai.expect(modelRelationship.appliedValue).to.be.undefined;
    chai.expect(modelRelationship.stagedValue).to.equal(replacementModelId);
    chai.expect(codeSpecRelationship.appliedValue).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;

    // Resolving the second broken relationship allows the element to be inserted.
    const replacementCodeSpecId = briefcase2.codeSpecs.insert(interactive.editTxn, "ReplacementCodeSpec", CodeScopeSpec.Type.Repository);
    conflict.resolveBrokenRelationship(codeSpecRelationship, replacementCodeSpecId);

    chai.expect(modelRelationship.appliedValue).to.equal(replacementModelId);
    chai.expect(modelRelationship.stagedValue).to.be.undefined;
    chai.expect(codeSpecRelationship.appliedValue).to.equal(replacementCodeSpecId);
    chai.expect(codeSpecRelationship.stagedValue).to.be.undefined;
    const childProps = briefcase2.elements.tryGetElementProps(childId);
    chai.expect(childProps).to.not.be.undefined;
    chai.expect(childProps!.model).to.equal(replacementModelId);
    chai.expect(childProps!.code.spec).to.equal(replacementCodeSpecId);
  });

  it("BrokenRelationship - restores nullable parent relationships after resolving parent's insertion blocker", async () => {
    const [scopeId, codeSpecId] = await withEditTxn(briefcase1, async (txn) => {
      const scope = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Scope",
        somePoint: new Point2d(1.0, 1.0),
      } as SomeGraphicalElementProps);
      const spec = briefcase1.codeSpecs.insert(txn, "RelatedElementCodeSpec", CodeScopeSpec.Type.RelatedElement);
      return [scope, spec];
    });
    await briefcase1.pushChanges({ description: "Create code scope" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(scopeId);
    });

    const [parentId, childId] = await withEditTxn(briefcase2, async (txn) => {
      const parent = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: new Code({ spec: codeSpecId, scope: scopeId, value: "Parent" }),
        foo: "Parent",
        somePoint: new Point2d(2.0, 2.0),
      } as SomeGraphicalElementProps);
      const child = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Child",
        somePoint: new Point2d(3.0, 3.0),
        parent: new ElementOwnsChildElements(parent),
      } as SomeGraphicalElementProps);
      return [parent, child];
    });

    await briefcase1.pushChanges({ description: "Delete code scope" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    const parentConflict = interactive.conflicts.find((conflict) => conflict.id === parentId);
    chai.expect(parentConflict).to.not.be.undefined;
    if (!parentConflict) return;

    // Broken relationship is reported and blocks insertion of the parent element.
    const codeScopeRelationship = parentConflict.brokenRelationships.find((relationship) => relationship.navigationProperty === "code.scope");
    chai.expect(codeScopeRelationship).to.not.be.undefined;
    if (!codeScopeRelationship) return;
    chai.expect(codeScopeRelationship.stagedValue).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(parentId)).to.be.undefined;

    // Because the parent is not inserted, the child's parent relationship is set to null.
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(childId).parent).to.be.undefined;

    // When we resolve the parent's broken relationship, the parent element is inserted.
    parentConflict.resolveBrokenRelationship(codeScopeRelationship, IModel.rootSubjectId);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(parentId).code.scope).to.equal(IModel.rootSubjectId);

    // And now the child's parent relationship is restored.
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(childId).parent?.id).to.equal(parentId);
  });

  it("BrokenRelationship - recursively inserts elements linked through non-nullable navigation properties", async () => {
    const [deletedScopeId, codeSpecId] = await withEditTxn(briefcase1, async (txn) => {
      const scope = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "DeletedScope",
        somePoint: new Point2d(1.0, 1.0),
      } as SomeGraphicalElementProps);
      const spec = briefcase1.codeSpecs.insert(txn, "RelatedElementCodeSpec", CodeScopeSpec.Type.RelatedElement);
      return [scope, spec];
    });
    await briefcase1.pushChanges({ description: "Create code scope" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.deleteElement(deletedScopeId);
    });

    const [firstId, secondId] = await withEditTxn(briefcase2, async (txn) => {
      const first = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: new Code({ spec: codeSpecId, scope: deletedScopeId, value: "First" }),
        foo: "First",
        somePoint: new Point2d(2.0, 2.0),
      } as SomeGraphicalElementProps);
      const second = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: new Code({ spec: codeSpecId, scope: first, value: "Second" }),
        foo: "Second",
        somePoint: new Point2d(3.0, 3.0),
      } as SomeGraphicalElementProps);
      return [first, second];
    });

    await briefcase1.pushChanges({ description: "Delete code scope" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    const firstConflict = interactive.conflicts.find((conflict) => conflict.id === firstId);
    chai.expect(firstConflict).to.not.be.undefined;
    if (!firstConflict) return;

    const firstCodeScope = firstConflict.brokenRelationships.find((relationship) => relationship.navigationProperty === "code.scope");
    chai.expect(firstCodeScope).to.not.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(firstId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(secondId)).to.be.undefined;
    if (!firstCodeScope) return;

    // After resolving the broken relationship, both first and second are inserted.
    firstConflict.resolveBrokenRelationship(firstCodeScope, IModel.rootSubjectId);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(firstId).code.scope).to.equal(IModel.rootSubjectId);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(secondId).code.scope).to.equal(firstId);
  });

  it("Update-Update conflict reported for aspects", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // Updating an aspect's property also updates the lastMod of its owning element.
    // So we will see a conflict on both the element and the aspect.
    chai.expect(interactive.conflicts.length).to.equal(2);

    const aspectConflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
    chai.expect(aspectConflict).to.not.be.undefined;
    const elementConflict = interactive.conflicts.find(c => c !== aspectConflict);
    chai.expect(elementConflict).to.not.be.undefined;

    if (!aspectConflict || !elementConflict) return;

    chai.expect(aspectConflict.conflictingProperties).to.include("aspectValue");
    chai.expect(aspectConflict.original).to.not.be.undefined;
    chai.expect(aspectConflict.ours).to.not.be.undefined;
    chai.expect(aspectConflict.theirs).to.not.be.undefined;

    chai.expect(aspectConflict.original!.aspectValue).to.equal("Initial");
    chai.expect(aspectConflict.ours!.aspectValue).to.equal("User2");
    chai.expect(aspectConflict.theirs!.aspectValue).to.equal("User1");

    chai.expect(elementConflict.id).to.equal(id);
    chai.expect(elementConflict.brokenRelationships.length).to.equal(0);
    chai.expect(elementConflict.conflictingProperties.length).to.equal(1);
    chai.expect(elementConflict.conflictingProperties).to.include("lastMod");
    chai.expect(elementConflict.differentProperties.length).to.equal(1);
    chai.expect(elementConflict.differentProperties).to.include("lastMod");
    chai.expect(elementConflict.ourModifiedProperties.length).to.equal(1);
    chai.expect(elementConflict.ourModifiedProperties).to.include("lastMod");
    chai.expect(elementConflict.theirModifiedProperties.length).to.equal(1);
    chai.expect(elementConflict.theirModifiedProperties).to.include("lastMod");

    let aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User2");

    aspectConflict.acceptTheirs(["aspectValue"]);
    aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User1");

    aspectConflict.acceptOurs(["aspectValue"]);
    aspect = getUniqueAspect(briefcase2, id);
    chai.expect(aspect.aspectValue).to.equal("User2");
  });

  it("Our Update-Their Delete aspect conflict", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // Updating or deleting an aspect also updates lastMod on the owning element.
    chai.expect(interactive.conflicts.length).to.equal(2);

    const conflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect")!;
    chai.expect(conflict).to.not.be.undefined;
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.be.undefined;
    chai.expect(conflict.ours).to.not.be.undefined;
    chai.expect(conflict.conflictingProperties).to.have.length(0);
    chai.expect(conflict.ourModifiedProperties).to.include("aspectValue");

    chai.expect(briefcase2.elements.getAspects(id, uniqueAspectClassFullName)).to.have.length(0);

    chai.expect(() => conflict.acceptOurs()).to.throw();
    chai.expect(() => conflict.acceptTheirs()).to.throw();
  });

  it("Our Delete-Their Update aspect conflict", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // Updating or deleting an aspect also updates lastMod on the owning element.
    chai.expect(interactive.conflicts.length).to.equal(2);

    const conflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect")!;
    chai.expect(conflict).to.not.be.undefined;
    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.theirs).to.not.be.undefined;
    chai.expect(conflict.ours).to.be.undefined;
    chai.expect(conflict.conflictingProperties).to.have.length(0);
    chai.expect(conflict.theirModifiedProperties).to.include("aspectValue");

    chai.expect(briefcase2.elements.getAspects(id, uniqueAspectClassFullName)).to.have.length(0);

    chai.expect(() => conflict.acceptOurs()).to.throw();
    chai.expect(() => conflict.acceptTheirs()).to.throw();
  });

  it("DeletionEffect - not created for existing, indirect-deleted aspect", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // When an element is deleted, its aspects are deleted via an _indirect_ change,
    // which means we don't replay it. So when the element is deleted during rebase,
    // the aspect would be noted as a DeletionEffect. Not ideal because the cascade
    // happened exactly the same way when we originally deleted the element.
    //
    // InteractiveRebase avoids this by looking for indirect changes that cover the
    // deletion effect. When it finds one, it replays that indirect change - even
    // though it's indirect. Replaying an indirect change containing a cascaded
    // deletion or SET NULL eliminates the reference and therefore eliminates the
    // DeletionEffect.
    chai.expect(interactive.conflicts.length).to.equal(2);

    const elementConflict = interactive.conflicts.find(c => c.classFullName === "InteractiveRebaseTest:SomeGraphicalElement");
    const aspectConflict = interactive.conflicts.find(c => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
    chai.expect(elementConflict).to.not.be.undefined;
    chai.expect(aspectConflict).to.not.be.undefined;
    if (!elementConflict || !aspectConflict) return;

    chai.expect(elementConflict.original).to.not.be.undefined;
    chai.expect(elementConflict.theirs).to.not.be.undefined;
    chai.expect(elementConflict.ours).to.be.undefined;
    chai.expect(aspectConflict.original).to.not.be.undefined;
    chai.expect(aspectConflict.theirs).to.not.be.undefined;
    chai.expect(aspectConflict.ours).to.be.undefined;

    chai.expect(elementConflict.conflictingProperties.length).to.equal(0);
    chai.expect(elementConflict.differentProperties.length).to.equal(0);
    chai.expect(elementConflict.theirModifiedProperties.length).to.equal(1);
    chai.expect(elementConflict.theirModifiedProperties).to.include("lastMod");
    chai.expect(elementConflict.ourModifiedProperties.length).to.equal(0);

    chai.expect(aspectConflict.conflictingProperties.length).to.equal(0);
    chai.expect(aspectConflict.differentProperties.length).to.equal(0);
    chai.expect(aspectConflict.theirModifiedProperties.length).to.equal(1);
    chai.expect(aspectConflict.theirModifiedProperties).to.include("aspectValue");
    chai.expect(aspectConflict.ourModifiedProperties.length).to.equal(0);

    chai.expect(elementConflict.deletionEffects.length).to.equal(0);
    chai.expect(aspectConflict.deletionEffects.length).to.equal(0);

    chai.expect(() => elementConflict.acceptTheirs()).to.throw();
    chai.expect(() => elementConflict.acceptOurs()).to.throw();
    chai.expect(() => aspectConflict.acceptTheirs()).to.throw();
    chai.expect(() => aspectConflict.acceptOurs()).to.throw();
  });

  it("DeletionEffect - ON DELETE SET NULL", async () => {
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
    const upstreamReferenceId = await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, userLabel: "TheirLabel" });
      txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User1" });
      return txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "UpstreamReference",
        somePoint: new Point2d(7.0, 8.0),
        typeDefinition: { id: typeId, relClassName: "BisCore:GraphicalElement2dIsOfType" },
      } as SomeGraphicalElementProps);
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // When `typeId` is deleted, both `id` and `upstreamReferenceId` have their `typeDefinition` set to null.
    // In the case of `id`, this happened when the deletion was originally done, too. It happens in an indirect
    // change, but InteractiveRebase lifts it to a direct change in order to avoid a spurious DeletionEffect.
    // So only `upstreamReferenceId` should appear in the deletion effects.

    chai.expect(interactive.conflicts.length).to.equal(2);
    const typeConflict = interactive.conflicts.find((conflict) => conflict.id === typeId)!;
    chai.expect(typeConflict).to.not.be.undefined;
    const otherConflict = interactive.conflicts.find((conflict) => conflict.id === otherId)!;
    chai.expect(otherConflict).to.not.be.undefined;

    chai.expect(typeConflict.original).to.not.be.undefined;
    chai.expect(typeConflict.theirs).to.not.be.undefined;
    chai.expect(typeConflict.ours).to.be.undefined;

    chai.expect(typeConflict.deletionEffects).to.have.length(1);
    const effect = typeConflict.deletionEffects[0];
    chai.expect(effect.affectedId).to.equal(upstreamReferenceId);
    chai.expect(effect.action).to.equal("set-null");
    chai.expect(effect).not.to.have.property("deletedInstance");
    chai.expect(effect.references.length).to.equal(1);
    const affectedReference = effect.references[0];
    chai.expect(affectedReference.navigationProperty).to.equal("typeDefinition");
    chai.expect(affectedReference.relationshipClass.fullName).to.equal("BisCore:GeometricElement2dHasTypeDefinition");
    chai.expect(affectedReference.targetId).to.equal(typeId);

    const final = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(final.typeDefinition).to.be.undefined;
    chai.expect(final.userLabel).to.equal("TheirLabel");
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(upstreamReferenceId).typeDefinition).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(typeId)).to.be.undefined;

    chai.expect(() => typeConflict.acceptTheirs()).to.throw();
    chai.expect(() => typeConflict.acceptOurs()).to.throw();
  });

  it("Our Update-Their Delete ON DELETE SET NULL does not cause conflict", async () => {
    const [typeId, untouchedId] = await withEditTxn(briefcase1, async (txn) => {
      const type = txn.insertElement({
        classFullName: GenericGraphicalType2d.classFullName,
        model: IModel.dictionaryId,
        code: Code.createEmpty(),
        userLabel: "OriginalType",
      });
      txn.updateElement<SomeGraphicalElementProps>({
        id,
        typeDefinition: { id: type }
      });
      const untouched = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Untouched",
        somePoint: new Point2d(5, 6),
        typeDefinition: { id: type },
      } as SomeGraphicalElementProps);
      return [type, untouched];
    });
    await briefcase1.pushChanges({ description: "Create typed elements" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => txn.deleteElement(typeId));
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement({ id: typeId, userLabel: "LocalType" });
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "LocalElement" });
    });
    await briefcase1.pushChanges({ description: "Delete type upstream" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    // We update typeId, they delete it.
    // We update foo and lastMod on id, they update typeDefinition via ON DELETE SET NULL (but this does _not_ update lastMod!)
    // So typeId has a Delete-Update conflict, id has no conflict at all.
    chai.expect(interactive.conflicts).to.have.length(1);
    const conflict = interactive.conflicts[0];

    chai.expect(conflict.original).to.not.be.undefined;
    chai.expect(conflict.ours).to.not.be.undefined;
    chai.expect(conflict.theirs).to.be.undefined;

    chai.expect(conflict.ourModifiedProperties).to.include("userLabel");
    chai.expect(conflict.ourModifiedProperties).to.include("lastMod");
    chai.expect(conflict.ourModifiedProperties.length).to.equal(2);

    chai.expect(conflict.deletionEffects).to.have.length(0);

    const idAfterMerge = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(idAfterMerge.typeDefinition).to.be.undefined;
    chai.expect(idAfterMerge.foo).to.equal("LocalElement");

    chai.expect(briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(typeId)).to.be.undefined;
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(untouchedId).typeDefinition).to.be.undefined;

    chai.expect(() => conflict.acceptTheirs()).to.throw();
    chai.expect(() => conflict.acceptOurs()).to.throw();
  });

  it("Our Update-Their Delete reports child conflict when their delete is a modified parent deletion cascade", async () => {
    const [childId, untouchedId] = await withEditTxn(briefcase1, async (txn) => {
      const insertChild = (foo: string) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo,
        somePoint: new Point2d(5, 6),
        parent: new ElementOwnsChildElements(id),
      } as SomeGraphicalElementProps);
      return [insertChild("EditedChild"), insertChild("UntouchedChild")];
    });
    await briefcase1.pushChanges({ description: "Create children" });
    await briefcase2.pullChanges();
    await withEditTxn(briefcase1, async (txn) => txn.deleteElement(id));
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "LocalParent" });
      txn.updateElement<SomeGraphicalElementProps>({ id: childId, foo: "LocalChild" });
    });
    await briefcase1.pushChanges({ description: "Delete parent upstream" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts).to.have.length(2);
    const parentConflict = interactive.conflicts.find(c => c.id === id)!;
    const childConflict = interactive.conflicts.find(c => c.id === childId)!;
    chai.expect(parentConflict).not.to.be.undefined;
    chai.expect(childConflict).not.to.be.undefined;

    chai.expect(parentConflict.id).to.equal(id);
    chai.expect(parentConflict.original).to.not.be.undefined;
    chai.expect(parentConflict.ours).to.not.be.undefined;
    chai.expect(parentConflict.theirs).to.be.undefined;
    chai.expect(parentConflict.ourModifiedProperties).to.include("lastMod");
    chai.expect(parentConflict.ourModifiedProperties).to.include("foo");
    chai.expect(parentConflict.deletionEffects).to.have.length(0);

    chai.expect(childConflict.id).to.equal(childId);
    chai.expect(childConflict.original).to.not.be.undefined;
    chai.expect(childConflict.ours).to.not.be.undefined;
    chai.expect(childConflict.theirs).to.be.undefined;
    chai.expect(childConflict.ourModifiedProperties).to.include("lastMod");
    chai.expect(childConflict.ourModifiedProperties).to.include("foo");
    chai.expect(childConflict.deletionEffects).to.have.length(0);

    chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(untouchedId)).to.be.undefined;

    chai.expect(() => parentConflict.acceptTheirs()).to.throw();
    chai.expect(() => parentConflict.acceptOurs()).to.throw();
    chai.expect(() => childConflict.acceptTheirs()).to.throw();
    chai.expect(() => childConflict.acceptOurs()).to.throw();
  });

  it("Our Update-Their Delete reports child conflict when their delete is an unchanged parent deletion cascade", async () => {
    const [childId, untouchedId] = await withEditTxn(briefcase1, async (txn) => {
      const insertChild = (foo: string) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo,
        somePoint: new Point2d(5, 6),
        parent: new ElementOwnsChildElements(id),
      } as SomeGraphicalElementProps);
      return [insertChild("EditedChild"), insertChild("UntouchedChild")];
    });
    await briefcase1.pushChanges({ description: "Create children" });
    await briefcase2.pullChanges();
    await withEditTxn(briefcase1, async (txn) => txn.deleteElement(id));
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id: childId, foo: "LocalChild" });
    });
    await briefcase1.pushChanges({ description: "Delete parent upstream" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts).to.have.length(1);
    const childConflict = interactive.conflicts[0];

    chai.expect(childConflict.id).to.equal(childId);
    chai.expect(childConflict.original).to.not.be.undefined;
    chai.expect(childConflict.ours).to.not.be.undefined;
    chai.expect(childConflict.theirs).to.be.undefined;
    chai.expect(childConflict.ourModifiedProperties).to.include("lastMod");
    chai.expect(childConflict.ourModifiedProperties).to.include("foo");
    chai.expect(childConflict.deletionEffects).to.have.length(0);

    chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(untouchedId)).to.be.undefined;

    chai.expect(() => childConflict.acceptTheirs()).to.throw();
    chai.expect(() => childConflict.acceptOurs()).to.throw();
  });

  it("Our Delete-Their Update detects a conflict on an aspect two levels below a deleted grandparent", async () => {
    const grandparent = id;
    const parentId = await withEditTxn(briefcase1, async (txn) => {
      const p = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Parent",
        somePoint: new Point2d(1.0, 1.0),
        parent: new ElementOwnsChildElements(grandparent),
      } as SomeGraphicalElementProps);
      return p;
    });
    await briefcase1.pushChanges({ description: "setup parent+other" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      txn.insertAspect({
        classFullName: uniqueAspectClassFullName,
        element: { id: parentId, relClassName: "BisCore.ElementOwnsUniqueAspect" },
        aspectValue: "Initial",
        aspectNumber: 1,
      } as SomeUniqueAspectProps);
    });
    await briefcase1.pushChanges({ description: "insert aspect on parent" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => {
      const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, parentId);
      aspect.aspectValue = "User1";
      txn.updateAspect(aspect);
    });

    await withEditTxn(briefcase2, async (txn) => {
      // Deleting the grandparent cascades through `parent` (a child element) down to the aspect on it.
      txn.deleteElement(grandparent);
    });

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    // Updating an aspect also updates the element's lastMod, so we should have two conflicts.
    chai.expect(interactive.conflicts.length).to.equal(2);

    const aspectConflict = interactive.conflicts.find((c) => c.classFullName === "InteractiveRebaseTest:SomeUniqueAspect")!;
    const parentConflict = interactive.conflicts.find(c => c.id === parentId)!;
    chai.expect(aspectConflict).to.not.be.undefined;
    chai.expect(parentConflict).to.not.be.undefined;

    chai.expect(aspectConflict?.theirs?.aspectValue).to.equal("User1");
    chai.expect(aspectConflict?.ours).to.be.undefined;
    chai.expect(aspectConflict.theirModifiedProperties).to.include("aspectValue");

    chai.expect(parentConflict?.ours).to.be.undefined;
    chai.expect(parentConflict.theirModifiedProperties).to.include("lastMod");
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // Only the forced conflict on `otherId` should be reported - the reparent+delete of A must not
    // produce any conflict, since `childC` was correctly linked to its *new* owner (B), not A.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(otherId);

    const child = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(childC);
    chai.expect(child.parent?.id).to.equal(parentB);
    chai.expect(briefcase2.elements.tryGetElementProps(parentA)).to.be.undefined;
  });

  it("reparenting into an element upstream deleted reports a broken relationship", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(childC);

    chai.expect(conflict.brokenRelationships.length).to.equal(1);
    chai.expect(conflict.brokenRelationships[0].navigationProperty).to.equal("parent");
    chai.expect(conflict.brokenRelationships[0].appliedValue).to.equal(id);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(childC).parent?.id).to.equal(id);
  });

  it("inserting an element and its aspect together replays without a spurious broken relationship", async () => {
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
      // Aspects and elements draw ECInstanceIds from independent sequences, so
      // this aspect's id naturally tends to sort *before* the element's. If that were
      // the end of the story, there would be a BrokenRelationship reported when we tried
      // to insert the aspect before its element had been inserted. This test asserts
      // that the replay mechanism correctly handles ordering based on the dependency and
      // does not report a BrokenRelationship.
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

    chai.expect(interactive.nextGroup()).to.be.true;

    // The forced conflict on `id` is expected; the new element+aspect insert must replay cleanly.
    chai.expect(interactive.conflicts.some((c) => c.id === elementId)).to.be.false;
    chai.expect(interactive.conflicts.some((c) => c.id === aspectId)).to.be.false;

    const newAspects = briefcase2.elements.getAspects(elementId!, uniqueAspectClassFullName);
    chai.expect(newAspects.length).to.equal(1);
    chai.expect((newAspects[0].toJSON() as SomeUniqueAspectProps).aspectValue).to.equal("New");
  });

  it("accepting our edit in the first group means our delete in the second group applies without conflict", async () => {
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

    // In the first group, there should be an Update-Update conflict on the aspect.
    // There's also an Update-Update conflict on the element's lastMod because updating
    // an aspect also updates lastMod.
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(2);
    const elementConflict = interactive.conflicts.find(c => c.id === id)!;
    const aspectConflict = interactive.conflicts.find(c => c !== elementConflict)!;
    chai.expect(elementConflict).to.not.be.undefined;
    chai.expect(aspectConflict).to.not.be.undefined;

    chai.expect(elementConflict.conflictingProperties).to.include("lastMod");
    chai.expect(elementConflict.conflictingProperties.length).to.equal(1);
    chai.expect(aspectConflict.conflictingProperties).to.include("aspectValue");
    chai.expect(aspectConflict.conflictingProperties.length).to.equal(1);

    // In the second group, there should be a Delete-Update conflict on the element.
    // The aspect delete applies cleanly.
    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(1);
    const deleteConflict = interactive.conflicts[0];
    chai.expect(deleteConflict.theirModifiedProperties).to.include("lastMod");
    chai.expect(deleteConflict.theirModifiedProperties.length).to.equal(1);
  });

  it("rejecting our edit in the first group means our delete in the second group has a data conflict", async () => {
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

    // In the first group, there should be an Update-Update conflict on the aspect.
    // There's also an Update-Update conflict on the element's lastMod because updating
    // an aspect also updates lastMod.
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(2);
    const elementConflict = interactive.conflicts.find(c => c.id === id)!;
    const aspectConflict = interactive.conflicts.find(c => c !== elementConflict)!;
    chai.expect(elementConflict).to.not.be.undefined;
    chai.expect(aspectConflict).to.not.be.undefined;

    chai.expect(elementConflict.conflictingProperties).to.include("lastMod");
    chai.expect(elementConflict.conflictingProperties.length).to.equal(1);
    chai.expect(aspectConflict.conflictingProperties).to.include("aspectValue");
    chai.expect(aspectConflict.conflictingProperties.length).to.equal(1);

    // Use their value for aspectValue.
    aspectConflict.acceptTheirs();
    const theirAspect = getUniqueAspect(briefcase2, id);
    chai.expect(theirAspect.aspectValue).to.equal("User1");

    // In the second group, there should be a Delete-Update conflict on the element.
    // There is also an Update-Delete conflict on the aspect's aspectValue because
    // we did an acceptTheirs above. It means the aspect does not have the same values
    // it had when we originally deleted it.
    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.conflicts.length).to.equal(2);
    const elementDeleteConflict = interactive.conflicts.find(c => c.id === id)!;
    const aspectDeleteConflict = interactive.conflicts.find(c => c !== elementDeleteConflict)!;
    chai.expect(elementDeleteConflict).to.not.be.undefined;
    chai.expect(aspectDeleteConflict).to.not.be.undefined;
    chai.expect(elementDeleteConflict.theirModifiedProperties).to.include("lastMod");
    chai.expect(elementDeleteConflict.theirModifiedProperties.length).to.equal(1);
    chai.expect(aspectDeleteConflict.theirModifiedProperties).to.include("aspectValue");
    chai.expect(aspectDeleteConflict.theirModifiedProperties.length).to.equal(1);
    chai.expect(aspectDeleteConflict.theirs?.aspectValue).to.equal("User1");
  });

  it("DeletionEffect - reports an upstream-inserted aspect instead of silently cascading it away", async () => {
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

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts).to.have.length(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(id);
    chai.expect(conflict.deletionEffects).to.have.length(1);
    const effect = conflict.deletionEffects[0];
    chai.expect(effect.action).to.equal("cascade");
    chai.expect(effect.references.length).to.equal(1);
    chai.expect(effect.references[0].navigationProperty).to.equal("element");
    if (effect.action !== "cascade") throw new Error("Expected CASCADE effect");
    chai.expect(effect.deletedInstance.aspectValue).to.equal("FromUpstream");
  });

  it("DeletionEffect - cascades our model deletion to an element hierarchy upstream inserted into it", async () => {
    const [drawingId, modelId, existingId] = await withEditTxn(briefcase1, async (txn) => {
      const documentList = DocumentListModel.insert(txn, IModel.rootSubjectId, "CascadeDocuments");
      const drawing = Drawing.insert(txn, documentList, "CascadeDrawing");
      const existing = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawing,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "Existing",
        somePoint: new Point2d(1, 1),
      } as SomeGraphicalElementProps);
      return [drawing, drawing, existing];
    });
    await briefcase1.pushChanges({ description: "Create drawing" });
    await briefcase2.pullChanges();

    const [upstreamParentId, upstreamChildId] = await withEditTxn(briefcase1, async (txn) => {
      const upstreamParent = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: modelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "UpstreamParent",
        somePoint: new Point2d(2, 2),
      } as SomeGraphicalElementProps);
      const upstreamChild = txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: modelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "UpstreamChild",
        somePoint: new Point2d(3, 3),
        parent: new ElementOwnsChildElements(upstreamParent),
      } as SomeGraphicalElementProps);
      return [upstreamParent, upstreamChild];
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(existingId);
      txn.deleteModel(modelId);
      txn.deleteElement(drawingId);
    });
    await briefcase1.pushChanges({ description: "Insert elements into drawing" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(briefcase2.models.tryGetModelProps(modelId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(upstreamParentId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(upstreamChildId)).to.be.undefined;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(modelId);
    chai.expect(conflict.classFullName).to.equal("BisCore:DrawingModel");

    chai.expect(conflict.deletionEffects.length).to.equal(2);
    const upstreamParentEffect = conflict.deletionEffects.find((effect) => effect.affectedId === upstreamParentId)!;
    const upstreamChildEffect = conflict.deletionEffects.find((effect) => effect.affectedId === upstreamChildId)!;
    chai.expect(upstreamParentEffect).to.not.be.undefined;
    chai.expect(upstreamChildEffect).to.not.be.undefined;

    const parentModelReference = upstreamParentEffect.references.find(r => r.navigationProperty === "model")!;
    const childModelReference = upstreamChildEffect.references.find(r => r.navigationProperty === "model")!;
    chai.expect(parentModelReference).to.not.be.undefined;
    chai.expect(childModelReference).to.not.be.undefined;
    chai.expect(parentModelReference.targetId).to.equal(modelId);
    chai.expect(childModelReference.targetId).to.equal(modelId);

    // The child should have an affected reference to the parent.
    const childParentReference = upstreamChildEffect.references.find(r => r.navigationProperty === "parent")!;
    chai.expect(childParentReference).to.not.be.undefined;
    chai.expect(childParentReference.targetId).to.equal(upstreamParentId);

    chai.expect(() => conflict.acceptTheirs()).to.throw();
    chai.expect(() => conflict.acceptOurs()).to.throw();
  });

  it("DeletionEffect - cascade reported only on deletion of the first owner", async () => {
    const [listId, drawingId] = await withEditTxn(briefcase1, async (txn) => {
      const list = DocumentListModel.insert(txn, IModel.rootSubjectId, "LimitationDocuments");
      const drawing = txn.insertElement({
        classFullName: Drawing.classFullName,
        model: list,
        code: Drawing.createCode(txn.iModel, list, "LimitationDrawing"),
        userLabel: "Original",
      });
      return [list, drawing];
    });
    await briefcase1.pushChanges({ description: "Create unmodeled drawing" });
    await briefcase2.pullChanges();

    // Upstream sub-models the drawing. That sub-model is owned by both the document list model (ParentModel)
    // and the drawing (ModeledElement), both of which we delete. Upstream also edits the drawing so that it
    // gets a conflict of its own, independent of the document list model's.
    const drawingModelId = await withEditTxn(briefcase1, async (txn) => {
      const drawingModelId = txn.insertModel(txn.iModel.models.createModel({ classFullName: DrawingModel.classFullName, modeledElement: { id: drawingId } }).toJSON());
      txn.updateElement({ id: drawingId, userLabel: "Upstream" } as ElementProps);
      return drawingModelId;
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(drawingId);
      txn.deleteModel(listId);
      txn.deleteElement(listId);
    });
    await briefcase1.pushChanges({ description: "Sub-model the drawing" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    // Make sure the deletions actually happened.
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(listId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(listId)).to.be.undefined;

    // There should be a DeletionEffect on the drawing element
    const drawingElementConflict = interactive.conflicts.find((conflict) => conflict.id === drawingId && conflict.classFullName === Drawing.classFullName)!;
    chai.expect(drawingElementConflict).to.not.be.undefined;
    chai.expect(drawingElementConflict.deletionEffects.length).to.equal(1);
    const drawingElementDeletionEffect = drawingElementConflict.deletionEffects[0];
    chai.expect(drawingElementDeletionEffect.affectedId).to.equal(drawingModelId);
    chai.expect(drawingElementDeletionEffect.affectedClassFullName).to.equal(DrawingModel.classFullName);
    chai.expect(drawingElementDeletionEffect.action).to.equal("cascade");
    chai.expect(drawingElementDeletionEffect.references.length).to.equal(1);
    chai.expect(drawingElementDeletionEffect.references[0].navigationProperty).to.equal("modeledElement");

    // The document list model conflict should not have a deletion effect for the drawing model because it was already
    // cascade deleted along with the drawing element.
    // There should also be a DeletionEffect on the document list model, referring to the same affected DrawingModel.
    const documentListModelConflict = interactive.conflicts.find((conflict) => conflict.id === listId && conflict.classFullName === DocumentListModel.classFullName);
    chai.expect(documentListModelConflict).to.not.be.undefined;
    if (!documentListModelConflict) return;
    chai.expect(documentListModelConflict.deletionEffects.length).to.equal(0);
  });

  it("restores a multi-owner dependent after re-deleting its owners starting with the parent model", async () => {
    const [listId, drawingId] = await withEditTxn(briefcase1, async (txn) => {
      const list = DocumentListModel.insert(txn, IModel.rootSubjectId, "ReDeleteDocuments");
      const drawing = txn.insertElement({
        classFullName: Drawing.classFullName,
        model: list,
        code: Drawing.createCode(txn.iModel, list, "ReDeleteDrawing"),
        userLabel: "Original",
      });
      return [list, drawing];
    });
    await briefcase1.pushChanges({ description: "Create unmodeled drawing" });
    await briefcase2.pullChanges();

    // Same setup as above: an upstream sub-model owned by both the list model (ParentModel) and the drawing (ModeledElement).
    await withEditTxn(briefcase1, async (txn) => {
      txn.insertModel(txn.iModel.models.createModel({ classFullName: DrawingModel.classFullName, modeledElement: { id: drawingId } }).toJSON());
      txn.updateElement({ id: drawingId, userLabel: "Upstream" } as ElementProps);
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(drawingId);
      txn.deleteModel(listId);
      txn.deleteElement(listId);
    });
    await briefcase1.pushChanges({ description: "Sub-model the drawing" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    const listModelConflict = interactive.conflicts.find((conflict) => conflict.id === listId && conflict.classFullName === "BisCore:DocumentListModel");
    const listElementConflict = interactive.conflicts.find((conflict) => conflict.id === listId && conflict.classFullName !== "BisCore:DocumentListModel");
    const drawingConflict = interactive.conflicts.find((conflict) => conflict.id === drawingId && conflict.classFullName === Drawing.classFullName);
    chai.expect(listModelConflict).to.not.be.undefined;
    chai.expect(listElementConflict).to.not.be.undefined;
    chai.expect(drawingConflict).to.not.be.undefined;
    if (!listModelConflict || !listElementConflict || !drawingConflict) return;

    // Restore everything, so the sub-model exists again.
    listElementConflict.acceptTheirs();
    listModelConflict.acceptTheirs();
    drawingConflict.acceptTheirs();
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.not.be.undefined;

    // Re-delete starting with the parent model, which takes the drawing and the sub-model with it.
    listModelConflict.acceptOurs();
    drawingConflict.acceptOurs();
    chai.expect(briefcase2.models.tryGetModelProps(listId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;

    // Restore the list model alone: the drawing stays deleted, so the sub-model must too.
    listModelConflict.acceptTheirs();
    chai.expect(briefcase2.models.tryGetModelProps(listId)).to.not.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;

    // Restoring the drawing means both of the sub-model's owners exist again, so it comes back.
    drawingConflict.acceptTheirs();
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.not.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.not.be.undefined;
  });

  it("restores an upstream-inserted sub-modeled drawing after re-deleting its parent model", async () => {
    const listId = await withEditTxn(briefcase1, async (txn) => DocumentListModel.insert(txn, IModel.rootSubjectId, "DiscoveredDocuments"));
    await briefcase1.pushChanges({ description: "Create document list" });
    await briefcase2.pullChanges();

    // Upstream inserts both the drawing and its sub-model, so neither is captured locally - both are discovered.
    const drawingId = await withEditTxn(briefcase1, async (txn) => Drawing.insert(txn, listId, "DiscoveredDrawing"));
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteModel(listId);
      txn.deleteElement(listId);
    });
    await briefcase1.pushChanges({ description: "Insert sub-modeled drawing" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;
    const listModelConflict = interactive.conflicts.find((conflict) => conflict.id === listId && conflict.classFullName === "BisCore:DocumentListModel");
    const listElementConflict = interactive.conflicts.find((conflict) => conflict.id === listId && conflict.classFullName !== "BisCore:DocumentListModel");
    const drawingConflict = interactive.conflicts.find((conflict) => conflict.id === drawingId && conflict.classFullName === Drawing.classFullName);
    chai.expect(listModelConflict).to.not.be.undefined;
    chai.expect(listElementConflict).to.not.be.undefined;
    chai.expect(drawingConflict).to.not.be.undefined;
    if (!listModelConflict || !listElementConflict || !drawingConflict) return;

    listElementConflict.acceptTheirs();
    listModelConflict.acceptTheirs();
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.not.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.not.be.undefined;

    // Re-delete via the parent model, then keep the drawing deleted while restoring the parent model alone.
    listModelConflict.acceptOurs();
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;
    drawingConflict.acceptOurs();
    listModelConflict.acceptTheirs();
    chai.expect(briefcase2.models.tryGetModelProps(listId)).to.not.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;

    // The drawing recorded the sub-model when the cascade reached it, so restoring the drawing brings it back.
    drawingConflict.acceptTheirs();
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.not.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.not.be.undefined;
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

    chai.expect(interactive.nextGroup()).to.be.true;

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

    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(interactive.conflicts.length).to.equal(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict).to.not.be.undefined;
    if (!conflict) return;

    const otherElementProps = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(otherId);
    chai.expect(otherElementProps.federationGuid).to.equal(federationGuid);
    chai.expect(briefcase2.elements.tryGetElementProps<SomeGraphicalElementProps>(id)).to.be.undefined;
  });

  it("rebases a large changeset (stress) without regressing correctness at scale", async () => {
    const count = 200;
    const ids = await withEditTxn(briefcase1, async (txn) => {
      const inserted: Id64String[] = [];
      for (let i = 0; i < count; i++) {
        inserted.push(txn.insertElement({
          classFullName: "irt:SomeGraphicalElement",
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          foo: `Stress${i}`,
          somePoint: new Point2d(i, i),
        } as SomeGraphicalElementProps));
      }
      return inserted;
    });
    await briefcase1.pushChanges({ description: "Insert many elements" });
    await briefcase2.pullChanges();

    // Local edits touching every one of the `count` elements, plus a forced conflict on `id`, all in
    // a single Txn - exercising forest-building/root-ordering/replay over many nodes at once.
    await withEditTxn(briefcase2, async (txn) => {
      for (const elId of ids)
        txn.updateElement<SomeGraphicalElementProps>({ id: elId, foo: `Local${elId}` });
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
    });

    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });
    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    chai.expect(interactive.nextGroup()).to.be.true;

    // Only the forced conflict should surface - all `count` unrelated local edits must replay cleanly.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(interactive.conflicts[0].id).to.equal(id);

    for (const elId of [ids[0], ids[Math.floor(count / 2)], ids[count - 1]]) {
      const props = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(elId);
      chai.expect(props.foo).to.equal(`Local${elId}`);
    }
  });

  // Two separate ungrouped local Txns (each defaults to its own TxnRebaseGroup) touching different
  // properties of `id`, with a non-conflicting upstream change, used by the group-navigation tests below.
  const setUpTwoGroups = async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, userLabel: "UpstreamLabel" });
    });
    await briefcase1.pushChanges({ description: "Upstream label" });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "Local1" });
    });
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, somePoint: new Point2d(9, 9) });
    });

    const interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    return interactive!;
  };

  it("moves forward through ungrouped groups one Txn at a time via nextGroup", async () => {
    using interactive = await setUpTwoGroups();

    chai.expect(interactive.groups.length).to.equal(2);
    chai.expect(interactive.currentGroup).to.be.undefined;
    chai.expect(interactive.isComplete).to.be.false;

    const first = interactive.nextGroup();
    chai.expect(first).to.be.true;
    chai.expect(interactive.currentGroup).to.equal(interactive.groups[0]);
    chai.expect(interactive.isComplete).to.be.false;
    chai.expect(interactive.conflicts.length).to.equal(0);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("Local1");

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.currentGroup).to.equal(interactive.groups[1]);
    chai.expect(interactive.isComplete).to.be.false;

    const finalProps = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(finalProps.foo).to.equal("Local1");
    chai.expect(Point2d.fromJSON(finalProps.somePoint).isExactEqual(new Point2d(9, 9))).to.be.true;
    chai.expect(finalProps.userLabel).to.equal("UpstreamLabel");

    // No groups remain - this call signals completion rather than moving anywhere.
    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.isComplete).to.be.true;
  });

  it("throws when calling nextGroup past the last group", async () => {
    using interactive = await setUpTwoGroups();

    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(interactive.nextGroup()).to.be.false;
    chai.expect(interactive.isComplete).to.be.true;

    chai.expect(() => interactive.nextGroup()).to.throw();
    chai.expect(InteractiveRebaseError.isError(
      (() => { try { interactive.nextGroup(); } catch (err) { return err; } return undefined; })(),
      "already-past-last-group",
    )).to.be.true;
  });

  it("throws when calling previousGroup before the first group", async () => {
    using interactive = await setUpTwoGroups();

    chai.expect(() => interactive.previousGroup()).to.throw();
    chai.expect(InteractiveRebaseError.isError(
      (() => { try { interactive.previousGroup(); } catch (err) { return err; } return undefined; })(),
      "already-past-first-group",
    )).to.be.true;
  });

  it("previousGroup reverts the current group's replay and moves back to the previous group", async () => {
    using interactive = await setUpTwoGroups();

    interactive.nextGroup(); // group 0: foo -> "Local1"
    interactive.nextGroup(); // group 1: somePoint -> (9, 9)

    interactive.previousGroup();
    chai.expect(interactive.currentGroup).to.equal(interactive.groups[0]);
    chai.expect(interactive.isComplete).to.be.false;

    // Group 1's replay should have been undone, leaving only group 0's committed change in place.
    const propsAfterBackingUp = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(propsAfterBackingUp.foo).to.equal("Local1");
    chai.expect(Point2d.fromJSON(propsAfterBackingUp.somePoint).isExactEqual(new Point2d(1.23, 4.56))).to.be.true;
  });

  it("restartGroup discards conflict resolutions and redoes the current group's replay", async () => {
    await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User1" });
    });

    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement<SomeGraphicalElementProps>({ id, foo: "User2" });
    });

    await briefcase1.pushChanges({ description: "User1" });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;

    interactive.nextGroup();
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("User2");

    interactive.conflicts[0].acceptTheirs();
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("User1");

    interactive.restartGroup();

    // Restarting the group should redo its replay from scratch, so the conflict should be freshly
    // reported and "ours" should be selected again, as if acceptTheirs() had never been called.
    chai.expect(interactive.conflicts.length).to.equal(1);
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("User2");
  });

  it("restartAll returns to the beginning and reverts every committed group", async () => {
    using interactive = await setUpTwoGroups();

    interactive.nextGroup(); // group 0: foo -> "Local1"
    interactive.nextGroup(); // group 1: somePoint -> (9, 9)

    interactive.restartAll();
    chai.expect(interactive.currentGroup).to.be.undefined;
    chai.expect(interactive.isComplete).to.be.false;

    // Both groups' replays should have been undone, leaving only the upstream (already-merged) change.
    const propsAfterRestart = briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id);
    chai.expect(propsAfterRestart.foo).to.equal("Original");
    chai.expect(Point2d.fromJSON(propsAfterRestart.somePoint).isExactEqual(new Point2d(1.23, 4.56))).to.be.true;
    chai.expect(propsAfterRestart.userLabel).to.equal("UpstreamLabel");

    // Advancing again from the beginning should replay group 0 the same way it did the first time.
    chai.expect(interactive.nextGroup()).to.be.true;
    chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).foo).to.equal("Local1");
  });

  describe("indirect changes caused by our deletion", () => {
    const insertInitialAspect = async (elementId: Id64String) => {
      await withEditTxn(briefcase1, async (txn) => {
        txn.insertAspect({
          classFullName: uniqueAspectClassFullName,
          element: { id: elementId, relClassName: "BisCore.ElementOwnsUniqueAspect" },
          aspectValue: "Initial",
          aspectNumber: 1,
        } as SomeUniqueAspectProps);
      });
      await briefcase1.pushChanges({ description: "Insert aspect" });
      await briefcase2.pullChanges();
    };

    it("replays our cascaded aspect delete instead of reporting a deletion effect", async () => {
      await insertInitialAspect(id);
      await withEditTxn(briefcase1, async (txn) => txn.updateElement({ id, userLabel: "TheirLabel" }));
      await withEditTxn(briefcase2, async (txn) => txn.deleteElement(id));
      await briefcase1.pushChanges({ description: "User1 updates element" });

      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(interactive.nextGroup()).to.be.true;

      chai.expect(interactive.conflicts).to.have.length(1);
      const conflict = interactive.conflicts[0];
      chai.expect(conflict.id).to.equal(id);
      chai.expect(conflict.theirModifiedProperties).to.include("userLabel");
      chai.expect(conflict.deletionEffects).to.be.empty;
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
      chai.expect(briefcase2.elements.getAspects(id, uniqueAspectClassFullName)).to.be.empty;
    });

    it("reports a data conflict on our cascaded aspect when they updated it", async () => {
      await insertInitialAspect(id);
      await withEditTxn(briefcase1, async (txn) => {
        const aspect = getUniqueAspect(txn.iModel as BriefcaseDb, id);
        aspect.aspectValue = "User1";
        txn.updateAspect(aspect);
      });
      await withEditTxn(briefcase2, async (txn) => txn.deleteElement(id));
      await briefcase1.pushChanges({ description: "User1 updates aspect" });

      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(interactive.nextGroup()).to.be.true;

      const elementConflict = interactive.conflicts.find((conflict) => conflict.id === id);
      chai.expect(elementConflict).to.not.be.undefined;
      chai.expect(elementConflict!.deletionEffects).to.be.empty;

      const aspectConflict = interactive.conflicts.find((conflict) => conflict.classFullName === "InteractiveRebaseTest:SomeUniqueAspect");
      chai.expect(aspectConflict).to.not.be.undefined;
      chai.expect(aspectConflict!.original?.aspectValue).to.equal("Initial");
      chai.expect(aspectConflict!.theirs?.aspectValue).to.equal("User1");
      chai.expect(aspectConflict!.ours).to.be.undefined;
      chai.expect(aspectConflict!.theirModifiedProperties).to.include("aspectValue");

      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    });

    it("reports only the upstream-inserted child when our deletion also cascaded an existing aspect", async () => {
      await insertInitialAspect(id);
      const childId = await withEditTxn(briefcase1, async (txn) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        foo: "UpstreamChild",
        somePoint: new Point2d(5, 6),
        parent: new ElementOwnsChildElements(id),
      } as SomeGraphicalElementProps));
      await withEditTxn(briefcase2, async (txn) => txn.deleteElement(id));
      await briefcase1.pushChanges({ description: "User1 inserts child" });

      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(interactive.nextGroup()).to.be.true;

      const conflict = interactive.conflicts.find((candidate) => candidate.id === id);
      chai.expect(conflict).to.not.be.undefined;
      chai.expect(conflict!.deletionEffects).to.have.length(1);
      chai.expect(conflict!.deletionEffects[0].action).to.equal("cascade");
      chai.expect(conflict!.deletionEffects[0].affectedId).to.equal(childId);
      chai.expect(briefcase2.elements.tryGetElementProps(childId)).to.be.undefined;
      chai.expect(briefcase2.elements.getAspects(id, uniqueAspectClassFullName)).to.be.empty;
    });

    it("replays our SET NULL and reports only the upstream-added reference", async () => {
      const [typeId, otherId] = await withEditTxn(briefcase1, async (txn) => {
        const newTypeId = txn.insertElement({
          classFullName: GenericGraphicalType2d.classFullName,
          model: IModel.dictionaryId,
          code: Code.createEmpty(),
        } as TypeDefinitionElementProps);
        txn.updateElement<SomeGraphicalElementProps>({ id, typeDefinition: { id: newTypeId, relClassName: "BisCore:GraphicalElement2dIsOfType" } });
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

      const upstreamReferenceId = await withEditTxn(briefcase1, async (txn) => {
        txn.updateElement<SomeGraphicalElementProps>({ id: otherId, foo: "User1" });
        return txn.insertElement({
          classFullName: "irt:SomeGraphicalElement",
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          foo: "UpstreamReference",
          somePoint: new Point2d(7.0, 8.0),
          typeDefinition: { id: typeId, relClassName: "BisCore:GraphicalElement2dIsOfType" },
        } as SomeGraphicalElementProps);
      });
      await withEditTxn(briefcase2, async (txn) => txn.deleteElement(typeId));
      await briefcase1.pushChanges({ description: "User1 adds a reference" });

      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(interactive.nextGroup()).to.be.true;

      const typeConflict = interactive.conflicts.find((conflict) => conflict.id === typeId);
      chai.expect(typeConflict).to.not.be.undefined;
      chai.expect(typeConflict!.deletionEffects).to.have.length(1);
      chai.expect(typeConflict!.deletionEffects[0].action).to.equal("set-null");
      chai.expect(typeConflict!.deletionEffects[0].affectedId).to.equal(upstreamReferenceId);
      chai.expect(interactive.conflicts.find((conflict) => conflict.id === id)).to.be.undefined;

      chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(id).typeDefinition).to.be.undefined;
      chai.expect(briefcase2.elements.getElementProps<SomeGraphicalElementProps>(upstreamReferenceId).typeDefinition).to.be.undefined;
      chai.expect(briefcase2.elements.tryGetElementProps(typeId)).to.be.undefined;
    });

    it("reports a blocked deletion", async () => {
      const [codeSpecId, codeScopeId] = await withEditTxn(briefcase1, async (txn) => {
        const spec = briefcase1.codeSpecs.insert(txn, "LiftedBlockedCodeScopeDelete", CodeScopeSpec.Type.RelatedElement);
        const scope = txn.insertElement({
          classFullName: "irt:SomeGraphicalElement",
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          foo: "Scope",
          somePoint: new Point2d(5.0, 6.0),
        } as SomeGraphicalElementProps);
        return [spec, scope];
      });
      await briefcase1.pushChanges({ description: "Create code scope" });
      await briefcase2.pullChanges();
      await insertInitialAspect(codeScopeId);

      await withEditTxn(briefcase2, async (txn) => txn.deleteElement(codeScopeId));
      const referencingElementId = await withEditTxn(briefcase1, async (txn) => txn.insertElement({
        classFullName: "irt:SomeGraphicalElement",
        model: drawingModelId,
        category: drawingCategoryId,
        code: new Code({ spec: codeSpecId, scope: codeScopeId, value: "LiftedBlockedReference" }),
        foo: "Reference",
        somePoint: new Point2d(8.0, 9.0),
      } as SomeGraphicalElementProps));
      await briefcase1.pushChanges({ description: "Add required code scope reference" });

      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(interactive.nextGroup()).to.be.true;

      chai.expect(interactive.conflicts).to.have.length(1);
      const conflict = interactive.conflicts[0];
      chai.expect(conflict.deletionEffects).to.have.length(1);
      chai.expect(conflict.deletionEffects[0].action).to.equal("blocks-deletion");
      chai.expect(conflict.deletionEffects[0].affectedId).to.equal(referencingElementId);
      chai.expect(briefcase2.elements.tryGetElementProps(codeScopeId)).to.not.be.undefined;
      chai.expect(getUniqueAspect(briefcase2, codeScopeId).aspectValue).to.equal("Initial");
    });
  });
});

describe("InteractiveRebase deletion replay", () => {
  let iModelId: GuidString;
  let briefcase1: BriefcaseDb;
  let briefcase2: BriefcaseDb;
  let initialChangesetIndex: number;
  let drawingModelId: Id64String;
  let drawingCategoryId: Id64String;

  const insertGraphic = (txn: EditTxn, userLabel: string, parentId?: Id64String) => txn.insertElement({
    classFullName: "BisCore:DrawingGraphic",
    model: drawingModelId,
    category: drawingCategoryId,
    code: Code.createEmpty(),
    userLabel,
    parent: parentId === undefined ? undefined : new ElementOwnsChildElements(parentId),
  } as GeometricElement2dProps);

  before(async () => {
    HubMock.startup("InteractiveRebaseDeletionReplay", KnownTestLocations.outputDir);
    iModelId = await HubMock.createNewIModel({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelName: "Test", description: "TestSubject", noLocks: true });
    briefcase1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user1", iTwinId: HubMock.iTwinId, iModelId });
    briefcase1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    await withEditTxn(briefcase1, async (txn) => {
      drawingModelId = IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, Code.createEmpty(), true)[1];
      drawingCategoryId = DrawingCategory.insert(txn, IModel.dictionaryId, "DeletionReplayCategory", new SubCategoryAppearance());
    });
    await briefcase1.pushChanges({ description: "Initial" });
    briefcase2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: "user2", iTwinId: HubMock.iTwinId, iModelId });
    briefcase2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    initialChangesetIndex = briefcase1.changeset.index!;
  });

  beforeEach(async () => {
    for (const briefcase of [briefcase1, briefcase2]) {
      if (briefcase.txns.rebaser.isRebasing)
        await briefcase.txns.rebaser.abort();
      await briefcase.discardChanges();
      await briefcase.pullChanges({ toIndex: initialChangesetIndex });
    }
    HubMock.findLocalHub(iModelId).truncateToChangeset(initialChangesetIndex);
  });

  after(async () => {
    HubMock.shutdown();
  });

  it("reports an effect reachable from two of our deletions exactly once, on the deletion that applied it", async () => {
    const [listId, drawingId] = await withEditTxn(briefcase1, async (txn) => {
      const list = DocumentListModel.insert(txn, IModel.rootSubjectId, "DeletionReplayDocuments");
      const drawing = txn.insertElement({
        classFullName: Drawing.classFullName,
        model: list,
        code: Drawing.createCode(txn.iModel, list, "DeletionReplayDrawing"),
      });
      return [list, drawing];
    });
    await briefcase1.pushChanges({ description: "Create unmodeled drawing" });
    await briefcase2.pullChanges();

    // The sub-model is owned by both the drawing (ModeledElement) and the list model (ParentModel).
    const subModelId = await withEditTxn(briefcase1, async (txn) =>
      txn.insertModel(txn.iModel.models.createModel({ classFullName: DrawingModel.classFullName, modeledElement: { id: drawingId } }).toJSON()));
    await briefcase1.pushChanges({ description: "Sub-model the drawing" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(drawingId);
      txn.deleteModel(listId);
      txn.deleteElement(listId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(briefcase2.models.tryGetModelProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(drawingId)).to.be.undefined;
    chai.expect(briefcase2.models.tryGetModelProps(listId)).to.be.undefined;

    const reports = interactive.conflicts.flatMap((candidate) => candidate.deletionEffects
      .filter((candidateEffect) => candidateEffect.affectedId === subModelId && candidateEffect.affectedClassFullName === DrawingModel.classFullName)
      .map((candidateEffect) => ({ conflict: candidate, effect: candidateEffect })));
    chai.expect(reports).to.have.length(1);
    const [{ conflict, effect }] = reports;
    chai.expect(effect.action).to.equal("cascade");
    chai.expect(effect.references.some((reference) => reference.targetInstanceKey === conflict.instanceKey)).to.be.true;
  });

  it("records no conflict for our deletion whose target our own earlier deletion cascaded", async () => {
    const [firstId, secondId] = await withEditTxn(briefcase1, async (txn) => [insertGraphic(txn, "First"), insertGraphic(txn, "Second")]);
    await briefcase1.pushChanges({ description: "Insert elements" });
    await briefcase2.pullChanges();

    // Upstream makes the second element a child of the first, so deleting the first cascades to it.
    await withEditTxn(briefcase1, async (txn) => txn.updateElement({ id: secondId, parent: { id: firstId, relClassName: ElementOwnsChildElements.classFullName } }));
    await briefcase1.pushChanges({ description: "Reparent second" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(firstId);
      txn.deleteElement(secondId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(briefcase2.elements.tryGetElementProps(firstId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(secondId)).to.be.undefined;
    chai.expect(interactive.conflicts).to.have.length(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(firstId);
    chai.expect(conflict.deletionEffects).to.have.length(1);
    chai.expect(conflict.deletionEffects[0].action).to.equal("cascade");
    chai.expect(conflict.deletionEffects[0].affectedId).to.equal(secondId);
  });

  // A graphic whose code is scoped by `scopeId`; its required CodeScope reference blocks the scope's deletion.
  const insertScopedGraphic = (txn: EditTxn, codeSpecId: Id64String, scopeId: Id64String, value: string, parentId?: Id64String) => txn.insertElement({
    classFullName: "BisCore:DrawingGraphic",
    model: drawingModelId,
    category: drawingCategoryId,
    code: new Code({ spec: codeSpecId, scope: scopeId, value }),
    userLabel: value,
    parent: parentId === undefined ? undefined : new ElementOwnsChildElements(parentId),
  } as GeometricElement2dProps);

  const insertCodeSpec = (txn: EditTxn, name: string) => briefcase1.codeSpecs.insert(txn, name, CodeScopeSpec.Type.RelatedElement);

  const allDeletionEffects = (interactive: { conflicts: ReadonlyArray<RebaseConflict> }) => interactive.conflicts.flatMap((conflict) => conflict.deletionEffects);

  it("applies our deletion whose blocker our unrelated deletion's cascade removes", async () => {
    // A is inserted first so that, unplanned, its deletion would replay before P's.
    const [codeSpecId, aId, pId] = await withEditTxn(briefcase1, async (txn) =>
      [insertCodeSpec(txn, "PlannedUnrelatedBlocker"), insertGraphic(txn, "A"), insertGraphic(txn, "P")]);
    await briefcase1.pushChanges({ description: "Insert A and P" });
    await briefcase2.pullChanges();

    const xId = await withEditTxn(briefcase1, async (txn) => insertScopedGraphic(txn, codeSpecId, aId, "X", pId));
    await briefcase1.pushChanges({ description: "Insert X under P, scoped by A" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(aId);
      txn.deleteElement(pId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [aId, pId, xId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    const effects = allDeletionEffects(interactive);
    chai.expect(effects.filter((effect) => effect.action === "blocks-deletion")).to.be.empty;
    chai.expect(effects).to.have.length(1);
    chai.expect(effects[0].action).to.equal("cascade");
    chai.expect(effects[0].affectedId).to.equal(xId);
  });

  it("applies a chain of our deletions that each remove the next one's blocker", async () => {
    const [codeSpecId, aId, pId, qId] = await withEditTxn(briefcase1, async (txn) =>
      [insertCodeSpec(txn, "PlannedChainBlocker"), insertGraphic(txn, "A"), insertGraphic(txn, "P"), insertGraphic(txn, "Q")]);
    await briefcase1.pushChanges({ description: "Insert A, P, and Q" });
    await briefcase2.pullChanges();

    const [xId, yId] = await withEditTxn(briefcase1, async (txn) =>
      [insertScopedGraphic(txn, codeSpecId, aId, "X", pId), insertScopedGraphic(txn, codeSpecId, pId, "Y", qId)]);
    await briefcase1.pushChanges({ description: "Insert X under P scoped by A, and Y under Q scoped by P" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(aId);
      txn.deleteElement(pId);
      txn.deleteElement(qId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [aId, pId, qId, xId, yId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    const effects = allDeletionEffects(interactive);
    chai.expect(effects.filter((effect) => effect.action === "blocks-deletion")).to.be.empty;
    chai.expect(effects.map((effect) => effect.affectedId)).to.have.members([xId, yId]);
  });

  it("applies two of our deletions that each remove the other's blocker together", async () => {
    const [codeSpecId, aId, pId] = await withEditTxn(briefcase1, async (txn) =>
      [insertCodeSpec(txn, "PlannedCycleBlocker"), insertGraphic(txn, "A"), insertGraphic(txn, "P")]);
    await briefcase1.pushChanges({ description: "Insert A and P" });
    await briefcase2.pullChanges();

    const [xId, yId] = await withEditTxn(briefcase1, async (txn) =>
      [insertScopedGraphic(txn, codeSpecId, aId, "X", pId), insertScopedGraphic(txn, codeSpecId, pId, "Y", aId)]);
    await briefcase1.pushChanges({ description: "Insert X under P scoped by A, and Y under A scoped by P" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(aId);
      txn.deleteElement(pId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [aId, pId, xId, yId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    const effects = allDeletionEffects(interactive);
    chai.expect(effects.filter((effect) => effect.action === "blocks-deletion")).to.be.empty;
    chai.expect(effects.map((effect) => effect.affectedId)).to.have.members([xId, yId]);
    for (const conflict of interactive.conflicts) {
      for (const effect of conflict.deletionEffects)
        chai.expect(effect.references.some((reference) => reference.targetId === conflict.id)).to.be.true;
    }
  });

  it("applies our deletions of an element and its parent when an upstream child of the parent references the element", async () => {
    const [codeSpecId, pId] = await withEditTxn(briefcase1, async (txn) => [insertCodeSpec(txn, "PlannedOverlapBlocker"), insertGraphic(txn, "P")]);
    const aId = await withEditTxn(briefcase1, async (txn) => insertGraphic(txn, "A", pId));
    await briefcase1.pushChanges({ description: "Insert P and its child A" });
    await briefcase2.pullChanges();

    const xId = await withEditTxn(briefcase1, async (txn) => insertScopedGraphic(txn, codeSpecId, aId, "X", pId));
    await briefcase1.pushChanges({ description: "Insert X under P, scoped by A" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(aId);
      txn.deleteElement(pId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [aId, pId, xId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    const effects = allDeletionEffects(interactive);
    chai.expect(effects.filter((effect) => effect.action === "blocks-deletion")).to.be.empty;
    chai.expect(effects).to.have.length(1);
    chai.expect(effects[0].action).to.equal("cascade");
    chai.expect(effects[0].affectedId).to.equal(xId);
  });

  it("blocks our deletions that no local deletion can unblock, and still applies an independent one", async () => {
    const [codeSpecId, bId, cId, eId] = await withEditTxn(briefcase1, async (txn) =>
      [insertCodeSpec(txn, "PlannedInfeasibleBlocker"), insertGraphic(txn, "B"), insertGraphic(txn, "C"), insertGraphic(txn, "E")]);
    await briefcase1.pushChanges({ description: "Insert B, C, and E" });
    await briefcase2.pullChanges();

    // Z blocks B from outside every deletion set; W blocks C, and only B's deletion would remove W.
    const [zId, wId] = await withEditTxn(briefcase1, async (txn) =>
      [insertScopedGraphic(txn, codeSpecId, bId, "Z"), insertScopedGraphic(txn, codeSpecId, cId, "W", bId)]);
    await briefcase1.pushChanges({ description: "Insert blockers" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(bId);
      txn.deleteElement(cId);
      txn.deleteElement(eId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [bId, cId, zId, wId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.not.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(eId)).to.be.undefined;

    const blockersOf = (id: Id64String) => interactive.conflicts.find((conflict) => conflict.id === id)?.deletionEffects
      .filter((effect) => effect.action === "blocks-deletion").map((effect) => effect.affectedId);
    chai.expect(blockersOf(bId)).to.deep.equal([zId]);
    chai.expect(blockersOf(cId)).to.deep.equal([wId]);
    chai.expect(interactive.conflicts.find((conflict) => conflict.id === eId)).to.be.undefined;
  });

  it("does not count a reference our Update moves away as blocking our deletion", async () => {
    // P is inserted first so that, unplanned, its deletion would replay before A's.
    const [codeSpecId, pId, aId, sId] = await withEditTxn(briefcase1, async (txn) =>
      [insertCodeSpec(txn, "PlannedMovedReference"), insertGraphic(txn, "P"), insertGraphic(txn, "A"), insertGraphic(txn, "S")]);
    const yId = await withEditTxn(briefcase1, async (txn) => insertScopedGraphic(txn, codeSpecId, aId, "Y"));
    await briefcase1.pushChanges({ description: "Insert P, A, S, and Y scoped by A" });
    await briefcase2.pullChanges();

    const xId = await withEditTxn(briefcase1, async (txn) => insertScopedGraphic(txn, codeSpecId, pId, "X", aId));
    await briefcase1.pushChanges({ description: "Insert X under A, scoped by P" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.updateElement({ id: yId, code: new Code({ spec: codeSpecId, scope: sId, value: "Y" }) });
      txn.deleteElement(pId);
      txn.deleteElement(aId);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [pId, aId, xId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(briefcase2.elements.getElementProps(yId).code.scope).to.equal(sId);
    chai.expect(allDeletionEffects(interactive).filter((effect) => effect.action === "blocks-deletion")).to.be.empty;
  });

  // Upstream inserts X and Y under P, each scoping the other's code (CodeScope has an SQL foreign key), while we delete P.
  const deleteParentOfForeignKeyCycle = async (name: string) => {
    const [codeSpecId, pId] = await withEditTxn(briefcase1, async (txn) => [insertCodeSpec(txn, name), insertGraphic(txn, "P")]);
    await briefcase1.pushChanges({ description: "Insert P" });
    await briefcase2.pullChanges();

    const [xId, yId] = await withEditTxn(briefcase1, async (txn) => {
      const x = insertScopedGraphic(txn, codeSpecId, pId, "X", pId);
      const y = insertScopedGraphic(txn, codeSpecId, x, "Y", pId);
      txn.updateElement({ id: x, code: new Code({ spec: codeSpecId, scope: y, value: "X" }) });
      return [x, y];
    });
    await briefcase1.pushChanges({ description: "Insert X and Y under P, scoping each other's code" });
    await withEditTxn(briefcase2, async (txn) => txn.deleteElement(pId));
    return { pId, xId, yId };
  };

  interface DeferringNativeDb { deleteInstancesDeferringForeignKeys?: unknown }
  const withDeferringOverride = async <T>(override: unknown, operation: () => Promise<T>): Promise<T> => {
    const nativeDb = briefcase2[_nativeDb] as unknown as DeferringNativeDb;
    // The prototype's method is read-only, so shadow it with an own property.
    Object.defineProperty(nativeDb, "deleteInstancesDeferringForeignKeys", { value: override, configurable: true });
    try {
      return await operation();
    } finally {
      delete nativeDb.deleteInstancesDeferringForeignKeys;
    }
  };

  it("deletes a cycle of foreign key references among the members of our deletion set together", async () => {
    const { pId, xId, yId } = await deleteParentOfForeignKeyCycle("ForeignKeyCycleApplied");
    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [pId, xId, yId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(interactive.conflicts).to.have.length(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(pId);
    chai.expect(conflict.deletionEffects.map((effect) => effect.action)).to.deep.equal(["cascade", "cascade"]);
    chai.expect(conflict.deletionEffects.map((effect) => effect.affectedId)).to.have.members([xId, yId]);
  });

  it("throws when a cycle of foreign key references fails its deferred foreign key check", async () => {
    await deleteParentOfForeignKeyCycle("ForeignKeyCycleViolation");
    await withDeferringOverride(() => ({ status: "violation" }), async () => {
      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(() => interactive.nextGroup()).to.throw(/cycle of foreign key references.*violation/);
    });
  });

  it("deletes members that reference each other without a cycle referencers first", async () => {
    const [codeSpecId, pId] = await withEditTxn(briefcase1, async (txn) => [insertCodeSpec(txn, "ForeignKeyChain"), insertGraphic(txn, "P")]);
    await briefcase1.pushChanges({ description: "Insert P" });
    await briefcase2.pullChanges();

    // X is inserted before the Y that references it, so deleting them in insertion order would violate CodeScope's foreign key.
    const [xId, yId] = await withEditTxn(briefcase1, async (txn) => {
      const x = insertScopedGraphic(txn, codeSpecId, pId, "X", pId);
      return [x, insertScopedGraphic(txn, codeSpecId, x, "Y", pId)];
    });
    await briefcase1.pushChanges({ description: "Insert X under P and Y under P scoped by X" });
    await withEditTxn(briefcase2, async (txn) => txn.deleteElement(pId));

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    for (const id of [pId, xId, yId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(interactive.conflicts).to.have.length(1);
    chai.expect(interactive.conflicts[0].deletionEffects.map((effect) => effect.affectedId)).to.have.members([xId, yId]);
  });

  // We delete D and then its parent A, whose deletion cascades (indirectly) to its other child C, and then insert B
  // reusing one of C's identity values. D's deletion must precede A's, so A's deletion is ordered after B's insert
  // unless B's insert is ordered after the deletion that frees C's identity value.
  const replayInsertReusingCascadedChildIdentity = async (insertReuser: (txn: EditTxn, cProps: ElementProps) => Id64String) => {
    const [codeSpecId, aId] = await withEditTxn(briefcase1, async (txn) => [insertCodeSpec(txn, "LiftedIdentity"), insertGraphic(txn, "A")]);
    const [cId, dId] = await withEditTxn(briefcase1, async (txn) =>
      [insertScopedGraphic(txn, codeSpecId, IModel.rootSubjectId, "Reused", aId), insertGraphic(txn, "D", aId)]);
    await briefcase1.pushChanges({ description: "Insert A and its children C and D" });
    await briefcase2.pullChanges();

    await withEditTxn(briefcase1, async (txn) => insertGraphic(txn, "Unrelated"));
    await briefcase1.pushChanges({ description: "Insert unrelated element" });
    const cProps = briefcase2.elements.getElementProps(cId);
    const bId = await withEditTxn(briefcase2, async (txn) => {
      txn.deleteElement(dId);
      txn.deleteElement(aId);
      return insertReuser(txn, cProps);
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return undefined;
    chai.expect(interactive.nextGroup()).to.be.true;
    for (const id of [aId, cId, dId])
      chai.expect(briefcase2.elements.tryGetElementProps(id)).to.be.undefined;
    chai.expect(interactive.conflicts.filter((conflict) => conflict.id === bId)).to.be.empty;
    return { cProps, bProps: briefcase2.elements.getElementProps(bId) };
  };

  it("replays our insert that reuses the code of a child our deletion cascaded after that deletion", async () => {
    const result = await replayInsertReusingCascadedChildIdentity((txn, cProps) => insertScopedGraphic(txn, cProps.code.spec, cProps.code.scope, cProps.code.value!));
    chai.expect(result?.bProps.code).to.deep.equal(result?.cProps.code);
  });

  it("replays our insert that reuses the federationGuid of a child our deletion cascaded after that deletion", async () => {
    const result = await replayInsertReusingCascadedChildIdentity((txn, cProps) => txn.insertElement({
      classFullName: "BisCore:DrawingGraphic",
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      federationGuid: cProps.federationGuid,
    } as GeometricElement2dProps));
    chai.expect(result?.cProps.federationGuid).to.not.be.undefined;
    chai.expect(result?.bProps.federationGuid).to.equal(result?.cProps.federationGuid);
  });

  const groupsMembersClassFullName = "BisCore:ElementGroupsMembers";
  const insertGroupsMembers = (txn: EditTxn, sourceId: Id64String, targetId: Id64String) =>
    txn.insertRelationship({ classFullName: groupsMembersClassFullName, sourceId, targetId });
  const linkTableRelationshipExists = (id: Id64String) => briefcase2.withQueryReader(
    "SELECT 1 FROM BisCore.ElementRefersToElements WHERE ECInstanceId = ?", (reader) => reader.step(), new QueryBinder().bindId(1, id));

  // Upstream relates A to X through a link-table relationship; we delete A, as the relationship's source or target.
  const replayDeletionOfLinkTableEndpoint = async (aIsSource: boolean) => {
    const [aId, xId] = await withEditTxn(briefcase1, async (txn) => [insertGraphic(txn, "A"), insertGraphic(txn, "X")]);
    await briefcase1.pushChanges({ description: "Insert A and X" });
    await briefcase2.pullChanges();

    // Upstream also updates A: inserting a link-table row raises no foreign key conflict, so this forces a rebase.
    const relId = await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id: aId, userLabel: "A updated" });
      return aIsSource ? insertGroupsMembers(txn, aId, xId) : insertGroupsMembers(txn, xId, aId);
    });
    await briefcase1.pushChanges({ description: "Relate A and X" });
    await withEditTxn(briefcase2, async (txn) => txn.deleteElement(aId));

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(briefcase2.elements.tryGetElementProps(aId)).to.be.undefined;
    chai.expect(briefcase2.elements.tryGetElementProps(xId)).to.not.be.undefined;
    chai.expect(linkTableRelationshipExists(relId)).to.be.false;
    chai.expect(interactive.conflicts).to.have.length(1);
    const conflict = interactive.conflicts[0];
    chai.expect(conflict.id).to.equal(aId);
    chai.expect(conflict.deletionEffects).to.have.length(1);
    const effect = conflict.deletionEffects[0];
    chai.expect(effect.action).to.equal("cascade");
    chai.expect(effect.affectedId).to.equal(relId);
    chai.expect(effect.affectedClassFullName).to.equal(groupsMembersClassFullName);
    chai.expect(effect.references.map((reference) => reference.targetInstanceKey)).to.deep.equal([conflict.instanceKey]);
    if (effect.action !== "cascade")
      return;
    chai.expect(effect.affectedInstanceKey).to.not.equal(conflict.instanceKey);
    chai.expect(effect.deletedInstance).to.include({ id: relId, classFullName: groupsMembersClassFullName, sourceId: aIsSource ? aId : xId, targetId: aIsSource ? xId : aId });
  };

  it("cascades our deletion to an upstream link-table relationship whose source is the deleted element", async () => {
    await replayDeletionOfLinkTableEndpoint(true);
  });

  it("cascades our deletion to an upstream link-table relationship whose target is the deleted element", async () => {
    await replayDeletionOfLinkTableEndpoint(false);
  });

  // Deleting an element removes its ElementRefersToElements rows as direct changes, not indirect ones, so our
  // deletion of the existing relationship replays as its own Delete, which must precede our deletion of A.
  it("reports only the upstream link-table relationship when our deletion also removed an existing one", async () => {
    const [aId, xId, yId] = await withEditTxn(briefcase1, async (txn) => [insertGraphic(txn, "A"), insertGraphic(txn, "X"), insertGraphic(txn, "Y")]);
    const existingRelId = await withEditTxn(briefcase1, async (txn) => insertGroupsMembers(txn, aId, yId));
    await briefcase1.pushChanges({ description: "Insert A, X, and Y, and relate A to Y" });
    await briefcase2.pullChanges();

    const upstreamRelId = await withEditTxn(briefcase1, async (txn) => {
      txn.updateElement({ id: aId, userLabel: "A updated" });
      return insertGroupsMembers(txn, xId, aId);
    });
    await briefcase1.pushChanges({ description: "Relate X to A" });
    await withEditTxn(briefcase2, async (txn) => txn.deleteElement(aId));

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(briefcase2.elements.tryGetElementProps(aId)).to.be.undefined;
    chai.expect(linkTableRelationshipExists(existingRelId)).to.be.false;
    chai.expect(linkTableRelationshipExists(upstreamRelId)).to.be.false;
    const effects = allDeletionEffects(interactive);
    chai.expect(effects).to.have.length(1);
    chai.expect(effects[0].action).to.equal("cascade");
    chai.expect(effects[0].affectedId).to.equal(upstreamRelId);
  });

  const danglingLinkTableRelationships = () => briefcase2.withQueryReader(
    `SELECT ECInstanceId FROM BisCore.ElementRefersToElements
     WHERE SourceECInstanceId NOT IN (SELECT ECInstanceId FROM BisCore.Element) OR TargetECInstanceId NOT IN (SELECT ECInstanceId FROM BisCore.Element)`,
    (reader) => {
      const ids: Id64String[] = [];
      for (const row of reader)
        ids.push(row[0] as Id64String);
      return ids;
    });

  // Gap: an upstream link-table insert raises no conflict, so the pull fast-forwards past InteractiveRebase and nothing removes the row.
  it("known gap: leaves no link-table relationship referencing our deleted element after a fast-forward pull", async () => {
    const [aId, xId] = await withEditTxn(briefcase1, async (txn) => [insertGraphic(txn, "A"), insertGraphic(txn, "X")]);
    await briefcase1.pushChanges({ description: "Insert A and X" });
    await briefcase2.pullChanges();

    const relId = await withEditTxn(briefcase1, async (txn) => insertGroupsMembers(txn, xId, aId));
    await briefcase1.pushChanges({ description: "Relate X to A" });
    await withEditTxn(briefcase2, async (txn) => txn.deleteElement(aId));

    using interactive = await briefcase2.pullChangesInteractive();
    while (interactive !== undefined && !interactive.isComplete)
      interactive.nextGroup();

    chai.expect(briefcase2.elements.tryGetElementProps(aId)).to.be.undefined;
    chai.expect(danglingLinkTableRelationships()).to.not.include(relId);
  });

  // Gap: the captured original of our relationship Delete lacks sourceClassName/targetClassName, which the current read includes, so it always looks changed.
  it("known gap: records no conflict for our deletion of an existing link-table relationship upstream left unchanged", async () => {
    const [aId, yId, bId] = await withEditTxn(briefcase1, async (txn) => [insertGraphic(txn, "A"), insertGraphic(txn, "Y"), insertGraphic(txn, "B")]);
    const relId = await withEditTxn(briefcase1, async (txn) => insertGroupsMembers(txn, aId, yId));
    await briefcase1.pushChanges({ description: "Insert A, Y, and B, and relate A to Y" });
    await briefcase2.pullChanges();

    // Both sides update B, which forces a rebase without touching the relationship.
    await withEditTxn(briefcase1, async (txn) => txn.updateElement({ id: bId, userLabel: "B theirs" }));
    await briefcase1.pushChanges({ description: "Update B" });
    await withEditTxn(briefcase2, async (txn) => {
      txn.deleteRelationship(briefcase2.relationships.getInstanceProps(groupsMembersClassFullName, relId));
      txn.updateElement({ id: bId, userLabel: "B ours" });
    });

    using interactive = await briefcase2.pullChangesInteractive();
    chai.expect(interactive).to.not.be.undefined;
    if (!interactive) return;
    chai.expect(interactive.nextGroup()).to.be.true;

    chai.expect(linkTableRelationshipExists(relId)).to.be.false;
    chai.expect(interactive.conflicts.filter((conflict) => conflict.id === relId)).to.be.empty;
  });

  const insertScopedType = (txn: EditTxn, codeSpecId: Id64String, scopeId: Id64String, value: string, parentId?: Id64String) => txn.insertElement({
    classFullName: GenericGraphicalType2d.classFullName,
    model: IModel.dictionaryId,
    code: new Code({ spec: codeSpecId, scope: scopeId, value }),
    parent: parentId === undefined ? undefined : new ElementOwnsChildElements(parentId),
  });

  // Gap: JavaScript has no savepoint, so a failed deferred foreign key check cannot undo the set-null and member deletions applied before it.
  it("known gap: leaves the iModel unchanged when a cycle of foreign key references fails its deferred foreign key check", async () => {
    const [codeSpecId, pId] = await withEditTxn(briefcase1, async (txn) => {
      const spec = insertCodeSpec(txn, "ForeignKeyCyclePartialWrites");
      return [spec, insertScopedType(txn, spec, IModel.dictionaryId, "P")];
    });
    await briefcase1.pushChanges({ description: "Insert type P" });
    await briefcase2.pullChanges();

    // X and Y scope each other's code; Z, scoped by X, is deleted before them; W's type definition is set null.
    const [xId, yId, zId, wId] = await withEditTxn(briefcase1, async (txn) => {
      const x = insertScopedType(txn, codeSpecId, pId, "X", pId);
      const y = insertScopedType(txn, codeSpecId, x, "Y", pId);
      txn.updateElement({ id: x, code: new Code({ spec: codeSpecId, scope: y, value: "X" }) });
      const z = insertScopedType(txn, codeSpecId, x, "Z", pId);
      const w = txn.insertElement({
        classFullName: "BisCore:DrawingGraphic",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        typeDefinition: { id: z, relClassName: "BisCore:GraphicalElement2dIsOfType" },
      } as GeometricElement2dProps);
      return [x, y, z, w];
    });
    await briefcase1.pushChanges({ description: "Insert X, Y, and Z under P, and W of type Z" });
    await withEditTxn(briefcase2, async (txn) => txn.deleteElement(pId));

    await withDeferringOverride(() => ({ status: "violation" }), async () => {
      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      try {
        interactive.nextGroup();
      } catch {
        // Whether or not the deletion throws, it must not have applied any of its writes.
      }

      briefcase2.clearCaches();
      const state = {
        deletedMembers: [pId, xId, yId, zId].filter((id) => briefcase2.elements.tryGetElementProps(id) === undefined),
        wTypeDefinition: briefcase2.elements.getElementProps<GeometricElement2dProps>(wId).typeDefinition?.id,
      };
      chai.expect(state).to.deep.equal({ deletedMembers: [], wTypeDefinition: zId });
    });
  });

  describe("with an aspect class that has a unique property", () => {
    const keyAspectClassFullName = "LiftedIdentityTest:KeyAspect";
    const insertKeyAspect = (txn: EditTxn, elementId: Id64String, key: string) => txn.insertAspect({
      classFullName: keyAspectClassFullName,
      element: { id: elementId, relClassName: "BisCore.ElementOwnsMultiAspects" },
      key,
    } as ElementAspectProps);
    const getKeys = (elementId: Id64String) =>
      briefcase2.elements.getAspects(elementId, keyAspectClassFullName).map((aspect) => (aspect.toJSON() as ElementAspectProps & { key: string }).key);

    before(async () => {
      for (const briefcase of [briefcase1, briefcase2]) {
        if (briefcase.txns.rebaser.isRebasing)
          await briefcase.txns.rebaser.abort();
        await briefcase.discardChanges();
        await briefcase.pullChanges({ toIndex: initialChangesetIndex });
      }
      HubMock.findLocalHub(iModelId).truncateToChangeset(initialChangesetIndex);

      await withEditTxn(briefcase1, async (txn) => txn.iModel.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="LiftedIdentityTest" alias="lit" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECSchemaReference name="ECDbMap" version="02.00.00" alias="ecdbmap"/>
          <ECEntityClass typeName="KeyAspect">
            <BaseClass>bis:ElementMultiAspect</BaseClass>
            <ECCustomAttributes>
              <DbIndexList xmlns="ECDbMap.02.00.00">
                <Indexes>
                  <DbIndex>
                    <Name>uix_lit_KeyAspect_Key</Name>
                    <IsUnique>True</IsUnique>
                    <Properties><string>Key</string></Properties>
                  </DbIndex>
                </Indexes>
              </DbIndexList>
            </ECCustomAttributes>
            <ECProperty propertyName="Key" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`]));
      await briefcase1.pushChanges({ description: "Import LiftedIdentityTest schema" });
      await briefcase2.pullChanges();
      initialChangesetIndex = briefcase1.changeset.index!;
    });

    it("replays our insert that reuses the unique value of an aspect our deletion cascaded after that deletion", async () => {
      // As above, D's deletion must precede A's, so without an edge the aspect insert replays before A's deletion.
      const [aId, eId] = await withEditTxn(briefcase1, async (txn) => [insertGraphic(txn, "A"), insertGraphic(txn, "E")]);
      const dId = await withEditTxn(briefcase1, async (txn) => {
        insertKeyAspect(txn, aId, "Reused");
        return insertGraphic(txn, "D", aId);
      });
      await briefcase1.pushChanges({ description: "Insert A with an aspect and a child D, and E" });
      await briefcase2.pullChanges();

      await withEditTxn(briefcase1, async (txn) => insertGraphic(txn, "Unrelated"));
      await briefcase1.pushChanges({ description: "Insert unrelated element" });
      await withEditTxn(briefcase2, async (txn) => {
        txn.deleteElement(dId);
        txn.deleteElement(aId);
        insertKeyAspect(txn, eId, "Reused");
      });

      using interactive = await briefcase2.pullChangesInteractive();
      chai.expect(interactive).to.not.be.undefined;
      if (!interactive) return;
      chai.expect(interactive.nextGroup()).to.be.true;

      chai.expect(briefcase2.elements.tryGetElementProps(aId)).to.be.undefined;
      chai.expect(getKeys(eId)).to.deep.equal(["Reused"]);
      chai.expect(interactive.conflicts).to.be.empty;
    });
  });
});
