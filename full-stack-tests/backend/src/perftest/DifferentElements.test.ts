/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
import { assert } from "chai";
import * as path from "path";
import { DbResult, Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Arc3d, Matrix3d, Point3d, Range3d, Sphere, StandardViewIndex, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  BriefcaseIdValue, Camera, Code, ColorDef, DefinitionElementProps, ElementProps, GeometryStreamBuilder, IModel, PhysicalElementProps, SpatialViewDefinitionProps, SubCategoryAppearance,
} from "@itwin/core-common";
import { CategorySelector, DefinitionModel, DisplayStyle3d, ECSqlStatement, GenericPhysicalMaterial, GeometryPart, IModelDb, IModelHost, IModelJsFs, ModelSelector, PhysicalObject, PhysicalTypeIsOfPhysicalMaterial, RepositoryLink, SnapshotDb, SpatialCategory, SpatialViewDefinition } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { PerfTestUtility } from "./PerfTestUtils";
import { GeometryPartProps, RepositoryLinkProps } from "@itwin/core-common/src/ElementProps";

interface TestElementProps extends ElementProps { [key: string]: any }

describe("PerformanceDifferentElementsTests", () => {
  const classNames: string[] = [];
  const elemPropsDictionary: { [className: string]: TestElementProps } = {};

  function getElemProps(className: string, iModelDb: IModelDb, model: Id64String, spatialCategoryId: Id64String, displayStyleId: Id64String, modelSelectorId: Id64String, categorySelectorId: Id64String, physicalMaterialId: Id64String): TestElementProps {
    let elementProps = elemPropsDictionary[className];
    if(elementProps !== undefined)
      return elementProps;

    elementProps = createElemProps(className, iModelDb, model, spatialCategoryId, displayStyleId, modelSelectorId, categorySelectorId, physicalMaterialId);
    elemPropsDictionary[className] = elementProps;
    return elementProps;
  }

  function createElemProps(className: string, iModelDb: IModelDb, model: Id64String, spatialCategoryId: Id64String, displayStyleId: Id64String, modelSelectorId: Id64String, categorySelectorId: Id64String, physicalMaterialId: Id64String): TestElementProps {
    const rotation = Matrix3d.createStandardWorldToView(StandardViewIndex.Iso);
    const angles = YawPitchRollAngles.createFromMatrix3d(rotation);
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
    const range = new Range3d(1, 1, 1, 8, 8, 8);
    const rotatedRange = rotationTransform.multiplyRange(range);
    const extents = rotatedRange.diagonal();
    const origin = rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z).cloneAsPoint3d();
    const builder = new GeometryStreamBuilder();
    builder.setLocalToWorld3d(origin, angles);
    builder.appendGeometry(Sphere.createCenterRadius(Point3d.createZero(), 6));
    for (const geom of [
      Arc3d.createXY(Point3d.create(0, 0), 5),
      Arc3d.createXY(Point3d.create(5, 5), 2),
      Arc3d.createXY(Point3d.create(-5, -5), 20),
    ]) {
      builder.appendGeometry(geom);
    }

    switch (className) {
      case GeometryPart.classFullName: {
        return {
          classFullName: className,
          model: IModel.dictionaryId,
          code: Code.createEmpty(),
          geom: builder.geometryStream,
          bbox: { low: [1, 2, 3], high: [4, 5, 6] },
        } as GeometryPartProps;
      }
      case RepositoryLink.classFullName: {
        return {
          description: "This is a test repository link",
          url: "http://itwinjs.org",
          repositoryGuid: Guid.createValue(),
          classFullName: className,
          code: RepositoryLink.createCode(iModelDb, IModel.repositoryModelId, Guid.createValue()),
          model: IModel.repositoryModelId,
          federationGuid: Guid.createValue(),
          userLabel: `UserLabel-${className}`,
        } as RepositoryLinkProps;
      }
      case PhysicalObject.classFullName: {
        return {
          classFullName: className,
          model,
          category: spatialCategoryId,
          code: Code.createEmpty(),
          geom: builder.geometryStream,
          placement: { origin, angles, bbox: { low: [1, 2, 3], high: [4, 5, 6] } },
          physicalMaterial: new PhysicalTypeIsOfPhysicalMaterial(physicalMaterialId),
        } as PhysicalElementProps;
      }
      case SpatialViewDefinition.classFullName: {
        return {
          classFullName: className,
          model: IModel.dictionaryId,
          code: Code.createEmpty(),
          cameraOn: false,
          origin,
          extents,
          angles,
          camera: new Camera(),
          modelSelectorId,
          categorySelectorId,
          displayStyleId,
          jsonProperties: { viewDetails: { aspectSkew: 1, disable3dManipulations: false, gridPerRef: 15 } },
        } as SpatialViewDefinitionProps;
      }
      default: {
        throw new Error(`Unsupported class name: ${className}`);
      }
    }
  }

  before(async () => {
    const fileName = `Performance_different_classes_seed.bim`;
    const pathname = path.join(KnownTestLocations.outputDir, "ElementDifferentPerformance", fileName);

    if (IModelJsFs.existsSync(pathname))
      IModelJsFs.removeSync(pathname);

    await IModelHost.startup();

    classNames.push(...[
      GeometryPart.classFullName,
      RepositoryLink.classFullName,
      PhysicalObject.classFullName,
      SpatialViewDefinition.classFullName,
    ]);

    const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ElementDifferentPerformance", fileName), { rootSubject: { name: "PerfTest" } });
    seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);

    const spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
    const displayStyleId = DisplayStyle3d.insert(seedIModel, IModel.dictionaryId, "default", { backgroundColor: ColorDef.fromString("rgb(255,0,0)") });
    const modelSelectorId = ModelSelector.insert(seedIModel, IModel.dictionaryId, "default", [newModelId]);
    const categorySelectorId = CategorySelector.insert(seedIModel, IModel.dictionaryId, "default", [spatialCategoryId]);
    const definitionModelId: Id64String = DefinitionModel.insert(seedIModel, IModel.rootSubjectId, "Test DefinitionModel");

    const physicalMaterialProps: DefinitionElementProps = {
      classFullName: GenericPhysicalMaterial.classFullName,
      model: definitionModelId,
      code: Code.createEmpty(),
      userLabel: GenericPhysicalMaterial.className,
    };
    const physicalElement = seedIModel.elements.createElement(physicalMaterialProps);
    const physicalMaterialId = seedIModel.elements.insertElement(physicalElement.toJSON());
    assert.isTrue(Id64.isValidId64(physicalMaterialId), "insert worked");

    seedIModel.saveChanges("Basic setup");

    // Create all of the seed elements for an iModel
    for (const name of classNames) {
      const elementProps = getElemProps(name, seedIModel, newModelId, spatialCategoryId, displayStyleId, modelSelectorId, categorySelectorId, physicalMaterialId);
      const element = seedIModel.elements.createElement(elementProps);
      const id = seedIModel.elements.insertElement(element.toJSON());
      assert.isTrue(Id64.isValidId64(id), "insert worked");
    }

    classNames.push(GenericPhysicalMaterial.classFullName);

    seedIModel.saveChanges();
    seedIModel.close();
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  it("Different Classes Read", async () => {
    let totalTimeOld = 0;
    let totalTimeNew = 0;
    let totalTimeStatement = 0;
    let totalTimeParsing = 0;

    const seedFileName = path.join(KnownTestLocations.outputDir, "ElementDifferentPerformance", `Performance_different_classes_seed.bim`);
    const testFileName = IModelTestUtils.prepareOutputFile("ElementDifferentPerformance", `Specific_Performance_different_classes_seed.bim`);
    const perfIModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

    for (const name of classNames) {
      const minId: number = PerfTestUtility.getMinId(perfIModel, name);
      const elId = minId;

      const startTime = new Date().getTime();
      perfIModel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0), undefined, true);
      totalTimeOld += new Date().getTime() - startTime;

      const startTime1 = new Date().getTime();
      perfIModel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
      totalTimeNew += new Date().getTime() - startTime1;

      const startTime11 = new Date().getTime();
      perfIModel.withPreparedStatement("SELECT $ FROM Bis.Element WHERE ECInstanceId=? OPTIONS USE_JS_PROP_NAMES DO_NOT_TRUNCATE_BLOB", (statement: ECSqlStatement) => {
        statement.bindId(1, Id64.fromLocalAndBriefcaseIds(elId, 0));

        if (statement.step() !== DbResult.BE_SQLITE_ROW)
          return undefined;

        return statement.getValue(0).getString();
      });
      totalTimeStatement += new Date().getTime() - startTime11;

      const startTime12 = new Date().getTime();
      perfIModel.withPreparedStatement("SELECT $ FROM Bis.Element WHERE ECInstanceId=? OPTIONS USE_JS_PROP_NAMES DO_NOT_TRUNCATE_BLOB", (statement: ECSqlStatement) => {
        statement.bindId(1, Id64.fromLocalAndBriefcaseIds(elId, 0));

        if (statement.step() !== DbResult.BE_SQLITE_ROW)
          return undefined;

        return JSON.parse(statement.getValue(0).getString());
      });
      totalTimeParsing += new Date().getTime() - startTime12;
    }

    perfIModel.close();
    console.log("Old, New, Statement, Parsing (ms)");
    console.log(totalTimeOld / classNames.length, totalTimeNew / classNames.length, totalTimeStatement / classNames.length, totalTimeParsing / classNames.length);
  });
});
