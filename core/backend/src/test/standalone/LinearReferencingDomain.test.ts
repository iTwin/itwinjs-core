/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Guid, Id64String, Id64 } from "@bentley/bentleyjs-core";
import {
  CategoryProps, Code, IModel, ILinearElementProps, InformationPartitionElementProps, GeometricElement3dProps,
  LinearlyLocatedAttributionProps, LinearlyReferencedFromToLocationProps,
} from "@bentley/imodeljs-common";
import {
  BackendRequestContext, BriefcaseManager, LinearReferencingSchema,
  PhysicalModel, IModelDb, SpatialCategory, PhysicalPartition, SubjectOwnsPartitionElements,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { LinearElement, LinearlyLocated } from "../../domains/LinearReferencingElements";

describe("LinearReferencing Domain", () => {
  const requestContext = new BackendRequestContext();

  it("should create elements exercising the LinearReferencing domain", async () => {
    const iModelDb: IModelDb = IModelDb.createSnapshot(IModelTestUtils.prepareOutputFile("LinearReferencingDomain", "LinearReferencingTest.bim"), {
      rootSubject: { name: "LinearReferencingTest", description: "Test of the LinearReferencing domain schema." },
      client: "LinearReferencing",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

    // Import the LinearReferencing schema
    await LinearReferencingSchema.importSchema(requestContext, iModelDb);
    LinearReferencingSchema.registerSchema();

    BriefcaseManager.createStandaloneChangeSet(iModelDb.briefcase); // importSchema below will fail if this is not called to flush local changes

    await iModelDb.importSchema(requestContext, path.join(__dirname, "../assets/TestLinearReferencing.ecschema.xml"));
    iModelDb.saveChanges("Import TestLinearReferencing schema");

    // Insert a SpatialCategory
    const spatialCategoryProps: CategoryProps = {
      classFullName: SpatialCategory.classFullName,
      model: IModel.dictionaryId,
      code: SpatialCategory.createCode(iModelDb, IModel.dictionaryId, "Test Spatial Category"),
      isPrivate: false,
    };
    const spatialCategoryId: Id64String = iModelDb.elements.insertElement(spatialCategoryProps);
    assert.isTrue(Id64.isValidId64(spatialCategoryId));

    // Create and populate a bis:PhysicalModel
    const physicalPartitionProps: InformationPartitionElementProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      code: PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, "Test Physical Model"),
    };
    const physicalPartitionId: Id64String = iModelDb.elements.insertElement(physicalPartitionProps);
    assert.isTrue(Id64.isValidId64(physicalPartitionId));
    const physicalModel: PhysicalModel = iModelDb.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: physicalPartitionId },
    }) as PhysicalModel;
    const physicalModelId: Id64String = iModelDb.models.insertModel(physicalModel);
    assert.isTrue(Id64.isValidId64(physicalModelId));

    // Create a Test Feature element
    const testLinearFeatureProps: GeometricElement3dProps = {
      classFullName: "TestLinearReferencing:TestLinearFeature",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };
    const linearFeatureElementId: Id64String = iModelDb.elements.insertElement(testLinearFeatureProps);
    assert.isTrue(Id64.isValidId64(linearFeatureElementId));

    // Create a Test LinearElement instance
    const linearElementProps: ILinearElementProps = {
      classFullName: "TestLinearReferencing:TestLinearElement",
      model: physicalModelId,
      source: { id: linearFeatureElementId },
      startValue: 0.0,
      lengthValue: 100.0,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };
    const linearElementId: Id64String = iModelDb.elements.insertElement(linearElementProps);
    assert.isTrue(Id64.isValidId64(linearElementId));

    // Create a Test LinearlyLocatedAttribution element
    const testLinearlyLocatedAttributionProps: LinearlyLocatedAttributionProps = {
      classFullName: "TestLinearReferencing:TestLinearlyLocatedAttribution",
      model: physicalModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      attributedElement: { id: linearFeatureElementId },
    };

    const linearFromToPosition: LinearlyReferencedFromToLocationProps = {
      fromPosition: { distanceAlongFromStart: 10.0 },
      toPosition: { distanceAlongFromStart: 70.0 },
    };

    const linearlyLocatedAttributionId: Id64String =
      LinearlyLocated.insertFromTo(iModelDb, testLinearlyLocatedAttributionProps, linearElementId, linearFromToPosition);
    assert.isTrue(Id64.isValidId64(linearlyLocatedAttributionId));

    const linearLocationAspects = LinearlyLocated.getFromToLocations(iModelDb, linearlyLocatedAttributionId);
    assert.equal(linearLocationAspects.length, 1);

    const linearLocationAspect = LinearlyLocated.getFromToLocation(iModelDb, linearlyLocatedAttributionId);
    assert.isFalse(linearLocationAspect === undefined);
    assert.equal(linearLocationAspect!.fromPosition.distanceAlongFromStart, 10.0);
    assert.equal(linearLocationAspect!.toPosition.distanceAlongFromStart, 70.0);

    // Query for linearly located elements via the queryLinearLocations API
    let linearLocationRefs = LinearElement.queryLinearLocations(iModelDb, linearElementId,
      { fromDistanceAlong: 10.0, toDistanceAlong: 70.0 });
    assert.equal(linearLocationRefs.length, 1);
    assert.equal(linearLocationRefs[0].linearlyLocatedId, linearlyLocatedAttributionId);
    assert.equal(linearLocationRefs[0].linearlyLocatedClassFullName, "TestLinearReferencing:TestLinearlyLocatedAttribution");
    assert.equal(linearLocationRefs[0].startDistanceAlong, 10.0);
    assert.equal(linearLocationRefs[0].stopDistanceAlong, 70.0);

    linearLocationRefs = LinearElement.queryLinearLocations(iModelDb, linearElementId,
      { linearlyLocatedClassFullNames: ["TestLinearReferencing:TestLinearlyLocatedAttribution"] });
    assert.equal(linearLocationRefs.length, 1);
    assert.equal(linearLocationRefs[0].linearlyLocatedId, linearlyLocatedAttributionId);

    iModelDb.saveChanges("Insert Test LinearReferencing elements");

    iModelDb.closeSnapshot();
  });
});
