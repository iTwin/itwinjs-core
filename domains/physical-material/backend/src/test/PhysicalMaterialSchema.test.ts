/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "node:path";
import { DbResult, LogLevel, Logger } from "@itwin/core-bentley";
import { Category, ECSqlStatement, ElementMultiAspect, IModelDb, IModelHost, IModelJsFs, KnownLocations, PhysicalElement, PhysicalMaterial, PhysicalModel, PhysicalPartition, PhysicalType, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { Code, ElementAspectProps, ElementProps, GeometricElement3dProps, IModel, PhysicalElementProps, PhysicalTypeProps, SubCategoryAppearance } from "@itwin/core-common";
import { Aggregate, Aluminum, Asphalt, Concrete, PhysicalMaterialSchema, Steel } from "../physical-material-backend.js";

interface PipingPortTypeProps extends ElementProps {
  innerDiameter: number,
  outerDiameter: number
}

interface VolumeAspectProps extends ElementAspectProps {
  netVolume: number,
  grossVolume: number
}

interface CircularAspectProps extends ElementAspectProps {
  structureDiameter: number
}

interface BoxAspectProps extends ElementAspectProps {
  structureLength: number,
  structureWidth: number
}

describe("PhysicalMaterialSchema", () => {
  const outputDir = path.join(import.meta.dirname, "output");

  before(async () => {
    await IModelHost.startup({ cacheDir: path.join(import.meta.dirname, ".cache") });
    PhysicalMaterialSchema.registerSchema();
    if (!IModelJsFs.existsSync(outputDir)) {
      IModelJsFs.mkdirSync(outputDir);
    }
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  function schemaViewFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `BisCoreViews.ecschema.xml`);
  }

  function archPhysSchemaFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `ArchitecturalPhysical.ecschema.xml`);
  }

  function qtoSchemaFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `QuantityTakeoffsAspects.ecschema.xml`);
  }

  it.only("should import", async () => {
    const iModelFileName: string = path.join(outputDir, "PhysicalMaterialSchema.bim");
    if (IModelJsFs.existsSync(iModelFileName)) {
      IModelJsFs.removeSync(iModelFileName);
    }
    // Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Trace)

    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "PhysicalMaterialSchema" }, createClassViews: true });
    await iModelDb.importSchemas([
      PhysicalMaterialSchema.schemaFilePath,
      schemaViewFilePath(),
      archPhysSchemaFilePath(),
      qtoSchemaFilePath()
    ]);

    const modelId = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, 'TestPhysicalModel', false);
    const catId = SpatialCategory.insert(iModelDb, IModel.dictionaryId, 'TestCategory', SubCategoryAppearance.defaults);

    for (let i = 1; i <= 3; i++) {
      const matId1 = Aggregate.create(iModelDb, IModel.dictionaryId, `${Aggregate.className}${i}`).insert();
      assert.isTrue(matId1 !== undefined);

      const physElmId1 = iModelDb.elements.insertElement({
        classFullName: 'generic:PhysicalObject',
        code: Code.createEmpty(),
        model: modelId,
        category: catId,
        physicalMaterial: { id: matId1, relClassName: 'bis:PhysicalElementIsOfPhysicalMaterial' }
      } as PhysicalElementProps);

      const aspectId = iModelDb.elements.insertAspect({
        classFullName: 'qto:VolumeAspect',
        element: { id: physElmId1 },
        grossVolume: 10,
        netVolume: 20
      } as VolumeAspectProps);

      const physElm = iModelDb.elements.getElement<PhysicalElement>(physElmId1);
      assert.equal(matId1, physElm.physicalMaterial!.id);

      const aspect = iModelDb.elements.getAspect(aspectId);
      assert.equal(10, aspect.asAny.grossVolume);
      assert.equal(20, aspect.asAny.netVolume);

      const matId2 = Aluminum.create(iModelDb, IModel.dictionaryId, `${Aluminum.className}${i}`).insert();
      const typeId1 = iModelDb.elements.insertElement({
        classFullName: 'generic:PhysicalType',
        code: Code.createEmpty(),
        model: IModel.dictionaryId,
        physicalMaterial: { id: matId2, relClassName: 'bis:PhysicalTypeIsOfPhysicalMaterial' }
      } as PhysicalTypeProps);

      iModelDb.elements.insertElement({
        classFullName: 'generic:PhysicalObject',
        code: Code.createEmpty(),
        model: modelId,
        category: catId,
        typeDefinition: { id: typeId1, relClassName: 'bis:PhysicalElementIsOfType' }
      } as PhysicalElementProps);


      iModelDb.elements.insertElement({
        classFullName: 'archphys:Wall',
        code: Code.createEmpty(),
        model: modelId,
        category: catId,
        grossVolume: 50
      } as PhysicalElementProps);

      Asphalt.create(iModelDb, IModel.dictionaryId, `${Asphalt.className}${i}`).insert();
      Concrete.create(iModelDb, IModel.dictionaryId, `${Concrete.className}${i}`).insert();
      Steel.create(iModelDb, IModel.dictionaryId, `${Steel.className}${i}`).insert();
    }
    assert.equal(3, count(iModelDb, Aggregate.classFullName));
    assert.equal(3, count(iModelDb, Aluminum.classFullName));
    assert.equal(3, count(iModelDb, Asphalt.classFullName));
    assert.equal(3, count(iModelDb, Concrete.classFullName));
    assert.equal(3, count(iModelDb, Steel.classFullName));
    assert.equal(15, count(iModelDb, PhysicalMaterial.classFullName));

    iModelDb.saveChanges();

    assert.equal(9, count(iModelDb, 'bisViews.PhysicalElementMaterialView'));
    iModelDb.withStatement('SELECT COUNT(*) FROM bisViews.PhysicalElementMaterialView WHERE PhysicalMaterial.Id IS NOT NULL',
      (stmt: ECSqlStatement) => {
        stmt.step();
        assert.equal(6, stmt.getValue(0).getInteger());
      });

    iModelDb.withStatement('SELECT ECInstanceId, ec_classname(ECClassId), PropertyName, LevelOfDetail, [Value] FROM bisViews.PhysicalElementVolumeQuantitiesView',
      (stmt: ECSqlStatement) => {
        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
          console.log('id %s - class name %s - prop name %s - detail %s - value %d',
            stmt.getValue(0).getString(),
            stmt.getValue(1).getString(),
            stmt.getValue(2).getString(),
            stmt.getValue(3).getString(),
            stmt.getValue(4).getDouble())
        }
      });

    iModelDb.close();
  });

  function stormSewerSchemaFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `StormSewerPhysical.ecschema.xml`);
  }

  function stormSewerViewsSchemaFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `StormSewerPhysicalViews.ecschema.xml`);
  }

  it("should import StormSewer", async () => {
    const iModelFileName: string = path.join(outputDir, "StormSewerSchema.bim");
    if (IModelJsFs.existsSync(iModelFileName)) {
      IModelJsFs.removeSync(iModelFileName);
    }
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Trace)

    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "StormSewerSchema" }, createClassViews: true });
    await iModelDb.importSchemas([stormSewerSchemaFilePath(), stormSewerViewsSchemaFilePath()]);

    const modelId = PhysicalModel.insert(iModelDb, IModel.rootSubjectId, 'TestPhysicalModel', false);
    const catId = SpatialCategory.insert(iModelDb, IModel.dictionaryId, 'TestCategory', SubCategoryAppearance.defaults);

    const distStrucElmId1 = iModelDb.elements.insertElement({
      classFullName: 'stmswrphys:DistributionStructure',
      code: Code.createEmpty(),
      model: modelId,
      category: catId
    } as PhysicalElementProps);

    const pipeTypeId = iModelDb.elements.insertElement({
      classFullName: 'pipphys:PipeType',
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
    });

    const pipeId = iModelDb.elements.insertElement({
      classFullName: 'pipphys:Pipe',
      code: Code.createEmpty(),
      model: modelId,
      category: catId,
      typeDefinition: { id: pipeTypeId, relClassName: 'pipphys:PipeIsOfType' }
    } as PhysicalElementProps);

    const pipePortTypeId = iModelDb.elements.insertElement({
      classFullName: 'pipphys:CompressionPortType',
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      innerDiameter: 0.2,
      outerDiameter: 0.21
    } as PipingPortTypeProps);

    const pipePortTypeProps = iModelDb.elements.getElementProps<PipingPortTypeProps>(pipePortTypeId);
    assert.equal(0.2, pipePortTypeProps.innerDiameter);
    assert.equal(0.21, pipePortTypeProps.outerDiameter);

    const portId1 = iModelDb.elements.insertElement({
      classFullName: 'pipphys:PipingPort',
      code: Code.createEmpty(),
      model: modelId,
      category: catId,
      parent: { id: pipeId, relClassName: 'dsys:DistributionElementOwnsDistributionPorts' },
      placement: { origin: { x: 0, y: 0, z: 1 }, angles: { yaw: 0, pitch: 0, roll: 0 } },
      typeDefinition: { id: pipePortTypeId, relClassName: 'pipphys:PipingPortIsOfType' }
    } as GeometricElement3dProps);

    const portId2 = iModelDb.elements.insertElement({
      classFullName: 'pipphys:PipingPort',
      code: Code.createEmpty(),
      model: modelId,
      category: catId,
      parent: { id: pipeId, relClassName: 'dsys:DistributionElementOwnsDistributionPorts' },
      placement: { origin: { x: 1, y: 0, z: 1 }, angles: { yaw: 0, pitch: 0, roll: 0 } },
      typeDefinition: { id: pipePortTypeId, relClassName: 'pipphys:PipingPortIsOfType' }
    } as GeometricElement3dProps);

    const distStrucElmId2 = iModelDb.elements.insertElement({
      classFullName: 'stmswrphys:DistributionStructure',
      code: Code.createEmpty(),
      model: modelId,
      category: catId
    } as PhysicalElementProps);

    iModelDb.saveChanges();

    assert.equal(1, count(iModelDb, 'pipphys.Pipe'));
    assert.equal(2, count(iModelDb, 'stmswrphys.DistributionStructure'));

    iModelDb.withStatement('SELECT CrownElevation, InvertElevation FROM stmswrphysViews.PipingPortView WHERE Parent.Id = ?',
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, pipeId);

        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        assert.equal(1.1, stmt.getValue(0).getDouble());
        assert.equal(0.9, stmt.getValue(1).getDouble());

        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        assert.equal(1.1, stmt.getValue(0).getDouble());
        assert.equal(0.9, stmt.getValue(1).getDouble());

        assert.equal(DbResult.BE_SQLITE_DONE, stmt.step());
      });

    iModelDb.withStatement('SELECT Length FROM stmswrphysViews.PipeView pv WHERE pv.ECInstanceId = ?',
      (stmt: ECSqlStatement) => {
        stmt.bindId(1, pipeId);

        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        assert.equal(1.0, stmt.getValue(0).getDouble());

        assert.equal(DbResult.BE_SQLITE_DONE, stmt.step());
      });

    iModelDb.close();
  });

  function sewerHydraulicSchemaFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `SewerHydraulicAnalysis.ecschema.xml`);
  }

  function sewerHydraulicViewsSchemaFilePath(): string {
    return path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain", `SewerHydraulicAnalysisViews.ecschema.xml`);
  }

  it.only("should import SewerHydraulicAnalysis", async () => {
    const iModelFileName: string = path.join(outputDir, "SewerHydraulicSchema.bim");
    if (IModelJsFs.existsSync(iModelFileName)) {
      IModelJsFs.removeSync(iModelFileName);
    }
    // Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Trace)

    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "SewerHydraulicSchema" }, createClassViews: true });
    const schemaPath = sewerHydraulicSchemaFilePath();
    await iModelDb.importSchemas([schemaPath, sewerHydraulicViewsSchemaFilePath()]);

    const hydAnalysisPartitionId = iModelDb.elements.insertElement({
      classFullName: 'swrhyd:SewerHydraulicAnalysisPartition',
      code: Code.createEmpty(),
      model: IModel.repositoryModelId,
      parent: { id: IModel.rootSubjectId, relClassName: 'bis:SubjectOwnsPartitionElements' }
    });

    const modelId = iModelDb.models.insertModel({
      modeledElement: { id: hydAnalysisPartitionId },
      classFullName: 'swrhyd:SewerHydraulicAnalysisModel'
    });

    const catId = SpatialCategory.insert(iModelDb, IModel.dictionaryId, 'TestCategory', SubCategoryAppearance.defaults);

    const manholeId1 = iModelDb.elements.insertElement({
      classFullName: 'swrhyd:Manhole',
      code: Code.createEmpty(),
      model: modelId,
      category: catId,
      structureShape: 0
    } as GeometricElement3dProps);

    iModelDb.elements.insertAspect({
      element: { id: manholeId1, relClassName: 'swrhyd:GravityStructureOwnsCircularShapeAspect' },
      classFullName: 'swrhyd:CircularGravityStructureShapeAspect',
      structureDiameter: (60 * 0.0254)
    } as CircularAspectProps);

    const catchbasinId1 = iModelDb.elements.insertElement({
      classFullName: 'swrhyd:Catchbasin',
      code: Code.createEmpty(),
      model: modelId,
      category: catId,
      structureShape: 1
    } as GeometricElement3dProps);

    iModelDb.elements.insertAspect({
      element: { id: catchbasinId1, relClassName: 'swrhyd:GravityStructureOwnsBoxShapeAspect' },
      classFullName: 'swrhyd:BoxGravityStructureShapeAspect',
      structureLength: (40 * 0.0254),
      structureWidth: (50 * 0.0254)
    } as BoxAspectProps);

    iModelDb.saveChanges();

    assert.equal(1, count(iModelDb, 'swrhyd.Manhole'));
    assert.equal(2, count(iModelDb, 'swrhyd.GravityStructure'));

    iModelDb.withStatement('SELECT ShapeDisplayLabel FROM swrhydViews.GravityStructureView ORDER BY ECInstanceId',
      (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        assert.equal("Circular Structure", stmt.getValue(0).getString());

        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        assert.equal("Box Structure", stmt.getValue(0).getString());

        assert.equal(DbResult.BE_SQLITE_DONE, stmt.step());
      });

    iModelDb.close();
  });
});
