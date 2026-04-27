/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "node:path";
import {
  ClassRegistry, EditTxn, IModelDb, IModelHost, IModelJsFs, PhysicalModel, PhysicalPartition, Schema, Schemas, SnapshotDb, SpatialCategory,
  SubjectOwnsPartitionElements, withEditTxn,
} from "@itwin/core-backend";
import { Guid, Id64, Id64String } from "@itwin/core-bentley";
import { CategoryProps, Code, GeometricElement3dProps, IModel, InformationPartitionElementProps, PhysicalElementProps } from "@itwin/core-common";
import { ILinearElementProps, LinearlyLocatedAttributionProps, LinearlyReferencedFromToLocationProps } from "@itwin/linear-referencing-common";
import {
  LinearElement, LinearlyLocated, LinearlyLocatedAttribution, LinearlyLocatedSingleFromTo, LinearlyReferencedFromToLocation, LinearReferencingSchema,
} from "../linear-referencing-backend";

class TestLinearReferencingSchema extends Schema {
  public static override get schemaName(): string { return "TestLinearReferencing"; }
  public static get schemaFilePath(): string { return path.join(__dirname, "assets", "TestLinearReferencing.ecschema.xml"); }
  public static registerSchema() {
    if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
      Schemas.unregisterSchema(this.schemaName);
      Schemas.registerSchema(this);

      ClassRegistry.register(TestLinearlyLocatedAttribution, this);
    }
  }
}

class TestLinearlyLocatedAttribution extends LinearlyLocatedAttribution implements LinearlyLocatedSingleFromTo {
  public static override get className(): string { return "TestLinearlyLocatedAttribution"; }

  public constructor(props: LinearlyLocatedAttributionProps, iModel: IModelDb) {
    super(props, iModel);
  }

  private static toProps(modelId: Id64String, categoryId: Id64String, attributedElementId: Id64String): LinearlyLocatedAttributionProps {
    const props: LinearlyLocatedAttributionProps = {
      classFullName: TestLinearlyLocatedAttribution.classFullName,
      category: categoryId,
      model: modelId,
      code: Code.createEmpty(),
      attributedElement: { id: attributedElementId },
    };

    return props;
  }

  public getFromToLocation(): LinearlyReferencedFromToLocation | undefined {
    return LinearlyLocated.getFromToLocation(this.iModel, this.id);
  }

  /** @deprecated Use updateFromToLocation(txn, ...) instead. */
  public updateFromToLocation(linearLocation: LinearlyReferencedFromToLocationProps, aspectId?: Id64String): void;

  public updateFromToLocation(txn: EditTxn, linearLocation: LinearlyReferencedFromToLocationProps, aspectId?: Id64String): void;
  public updateFromToLocation(txnOrLinearLocation: EditTxn | LinearlyReferencedFromToLocationProps, linearLocationOrAspectId?: LinearlyReferencedFromToLocationProps | Id64String, aspectId?: Id64String): void {
    if (txnOrLinearLocation instanceof EditTxn) {
      LinearlyLocated.updateFromToLocation(txnOrLinearLocation, this.id, linearLocationOrAspectId as LinearlyReferencedFromToLocationProps, aspectId);
      return;
    }
    withEditTxn(this.iModel, (txn) =>
      LinearlyLocated.updateFromToLocation(txn, this.id, txnOrLinearLocation, linearLocationOrAspectId as Id64String | undefined),
    );
  }

  public static insertFromTo(txn: EditTxn, modelId: Id64String, categoryId: Id64String, linearElementId: Id64String,
    fromToPosition: LinearlyReferencedFromToLocationProps, attributedElementId: Id64String): Id64String {
    return LinearlyLocated.insertFromTo(txn, this.toProps(modelId, categoryId, attributedElementId), linearElementId, fromToPosition);
  }
}

describe("LinearReferencing Domain", () => {
  const outputDir = path.join(__dirname, "output");

  before(async () => {
    await IModelHost.startup({ cacheDir: path.join(__dirname, ".cache") });
    LinearReferencingSchema.registerSchema();
    TestLinearReferencingSchema.registerSchema();
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
  });

  it("should create elements exercising the LinearReferencing domain", async () => {
    const iModelFileName: string = path.join(outputDir, "LinearReferencingTest.bim");
    if (IModelJsFs.existsSync(iModelFileName)) {
      IModelJsFs.removeSync(iModelFileName);
    }
    const iModelDb = SnapshotDb.createEmpty(iModelFileName, {
      rootSubject: { name: "LinearReferencingTest", description: "Test of the LinearReferencing domain schema." },
      client: "LinearReferencing",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
      createClassViews: true,
    });

    // Import the LinearReferencing schema
    await iModelDb.importSchemas([LinearReferencingSchema.schemaFilePath, TestLinearReferencingSchema.schemaFilePath]);

    const { spatialCategoryId, physicalModelId, linearFeatureElementId, linearElementId } = withEditTxn(iModelDb, "linear referencing test setup", (txn) => {
      const spatialCategoryProps: CategoryProps = {
        classFullName: SpatialCategory.classFullName,
        model: IModel.dictionaryId,
        code: SpatialCategory.createCode(iModelDb, IModel.dictionaryId, "Test Spatial Category"),
        isPrivate: false,
      };
      const createdSpatialCategoryId: Id64String = txn.insertElement(spatialCategoryProps);

      const physicalPartitionProps: InformationPartitionElementProps = {
        classFullName: PhysicalPartition.classFullName,
        model: IModel.repositoryModelId,
        parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
        code: PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, "Test Physical Model"),
      };
      const physicalPartitionId: Id64String = txn.insertElement(physicalPartitionProps);
      const physicalModel = iModelDb.models.createModel<PhysicalModel>({
        classFullName: PhysicalModel.classFullName,
        modeledElement: { id: physicalPartitionId },
      });
      const createdPhysicalModelId: Id64String = txn.insertModel(physicalModel.toJSON());

      const testLinearFeatureProps: GeometricElement3dProps = {
        classFullName: "TestLinearReferencing:TestLinearFeature",
        model: createdPhysicalModelId,
        category: createdSpatialCategoryId,
        code: Code.createEmpty(),
      };
      const createdLinearFeatureElementId: Id64String = txn.insertElement(testLinearFeatureProps);

      const linearElementProps: ILinearElementProps = {
        classFullName: "TestLinearReferencing:TestLinearElement",
        model: createdPhysicalModelId,
        source: { id: createdLinearFeatureElementId },
        startValue: 0.0,
        lengthValue: 100.0,
        category: createdSpatialCategoryId,
        code: Code.createEmpty(),
      };
      const createdLinearElementId: Id64String = txn.insertElement(linearElementProps);

      return {
        spatialCategoryId: createdSpatialCategoryId,
        physicalModelId: createdPhysicalModelId,
        linearFeatureElementId: createdLinearFeatureElementId,
        linearElementId: createdLinearElementId,
      };
    });
    assert.isTrue(Id64.isValidId64(spatialCategoryId));
    assert.isTrue(Id64.isValidId64(linearFeatureElementId));
    assert.isTrue(Id64.isValidId64(linearElementId));

    // Create a Test LinearlyLocatedAttribution element
    let linearFromToPosition: LinearlyReferencedFromToLocationProps = {
      fromPosition: { distanceAlongFromStart: 0.0 },
      toPosition: { distanceAlongFromStart: 70.0 },
    };

    const linearlyLocatedAttributionId = withEditTxn(iModelDb, (txn) => TestLinearlyLocatedAttribution.insertFromTo(
      txn, physicalModelId, spatialCategoryId, linearElementId, linearFromToPosition, linearFeatureElementId));
    assert.isTrue(Id64.isValidId64(linearlyLocatedAttributionId));
    assert.equal(linearElementId, LinearlyLocated.getLinearElementId(iModelDb, linearlyLocatedAttributionId));

    const linearLocationAspects = LinearlyLocated.getFromToLocations(iModelDb, linearlyLocatedAttributionId);
    assert.equal(linearLocationAspects.length, 1);

    let linearLocationAspect = LinearlyLocated.getFromToLocation(iModelDb, linearlyLocatedAttributionId);
    assert.isFalse(linearLocationAspect === undefined);
    assert.equal(linearLocationAspect!.fromPosition.distanceAlongFromStart, 0.0);
    assert.equal(linearLocationAspect!.toPosition.distanceAlongFromStart, 70.0);

    const linearlyLocatedAttribution = iModelDb.elements.getElement<TestLinearlyLocatedAttribution>(linearlyLocatedAttributionId);
    linearLocationAspect = linearlyLocatedAttribution.getFromToLocation();
    assert.equal(linearLocationAspect!.fromPosition.distanceAlongFromStart, 0.0);
    assert.equal(linearLocationAspect!.toPosition.distanceAlongFromStart, 70.0);
    assert.equal(linearlyLocatedAttribution.getLinearElementId(), linearElementId);

    linearFromToPosition.fromPosition.distanceAlongFromStart = 10.0;
    linearFromToPosition.fromPosition.lateralOffsetFromILinearElement = 5.0;
    linearFromToPosition.fromPosition.verticalOffsetFromILinearElement = 15.0;
    withEditTxn(iModelDb, (txn) => linearlyLocatedAttribution.updateFromToLocation(txn, linearFromToPosition, linearLocationAspect!.id));

    linearLocationAspect = linearlyLocatedAttribution.getFromToLocation();
    assert.equal(linearLocationAspect!.fromPosition.distanceAlongFromStart, 10.0);
    assert.equal(linearLocationAspect!.fromPosition.lateralOffsetFromILinearElement, 5.0);
    assert.equal(linearLocationAspect!.fromPosition.verticalOffsetFromILinearElement, 15.0);
    assert.equal(linearLocationAspect!.toPosition.distanceAlongFromStart, 70.0);

    // Create a Test PhysicalLinear element
    const testPhysicalLinearProps: PhysicalElementProps = {
      classFullName: "TestLinearReferencing:TestLinearPhysicalElement",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    linearFromToPosition = {
      fromPosition: { distanceAlongFromStart: 30.0 },
      toPosition: { distanceAlongFromStart: 60.0 },
    };

    const linearPhysicalElementId: Id64String = withEditTxn(iModelDb, (txn) =>
      LinearlyLocated.insertFromTo(txn, testPhysicalLinearProps, linearElementId, linearFromToPosition));
    assert.isTrue(Id64.isValidId64(linearPhysicalElementId));
    assert.equal(linearElementId, LinearlyLocated.getLinearElementId(iModelDb, linearPhysicalElementId));

    // Query for linearly located elements via the queryLinearLocations API
    let linearLocationRefs = LinearElement.queryLinearLocations(iModelDb, linearElementId,
      { fromDistanceAlong: 10.0, toDistanceAlong: 70.0 });
    assert.equal(linearLocationRefs.length, 2);
    assert.equal(linearLocationRefs[0].linearlyLocatedId, linearlyLocatedAttributionId);
    assert.equal(linearLocationRefs[0].linearlyLocatedClassFullName, "TestLinearReferencing:TestLinearlyLocatedAttribution");
    assert.equal(linearLocationRefs[0].startDistanceAlong, 10.0);
    assert.equal(linearLocationRefs[0].stopDistanceAlong, 70.0);

    assert.equal(linearLocationRefs[1].linearlyLocatedId, linearPhysicalElementId);
    assert.equal(linearLocationRefs[1].linearlyLocatedClassFullName, "TestLinearReferencing:TestLinearPhysicalElement");
    assert.equal(linearLocationRefs[1].startDistanceAlong, 30.0);
    assert.equal(linearLocationRefs[1].stopDistanceAlong, 60.0);

    linearLocationRefs = LinearElement.queryLinearLocations(iModelDb, linearElementId,
      { linearlyLocatedClassFullNames: ["TestLinearReferencing:TestLinearlyLocatedAttribution"] });
    assert.equal(linearLocationRefs.length, 1);
    assert.equal(linearLocationRefs[0].linearlyLocatedId, linearlyLocatedAttributionId);

    linearLocationRefs = LinearElement.queryLinearLocations(iModelDb, linearElementId,
      {
        linearlyLocatedClassFullNames: ["TestLinearReferencing:TestLinearlyLocatedAttribution",
          "TestLinearReferencing:TestLinearPhysicalElement"],
      });
    assert.equal(linearLocationRefs.length, 2);
    assert.equal(linearLocationRefs[0].linearlyLocatedId, linearlyLocatedAttributionId);
    assert.equal(linearLocationRefs[1].linearlyLocatedId, linearPhysicalElementId);

    iModelDb.close();
  });
});
