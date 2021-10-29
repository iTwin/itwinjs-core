/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { Arc3d, Box, Cone, LineString3d, Point2d, Point3d, PointString3d, Vector3d } from "@bentley/geometry-core";
import {
  DefinitionContainer, DefinitionGroup,ElementOwnsChildElements,IModelDb, PhysicalElementFulfillsFunction, SnapshotDb,
} from "../imodeljs-backend";
import { Code, GeometricElement3dProps, GeometryStreamBuilder, GeometryStreamProps, IModel, PhysicalElementProps } from "@bentley/imodeljs-common";
import { ElectricalEquipmentDefinition, ElectricalFunctionalEquipment, ElectricalPhysicalEquipment, ElectricalPhysicalRecipe, ElectricalPhysicalType, FunctionalContainer, PhysicalContainer } from "./Element";
import {
  SpatialCategoryName, StandardDefinitionManager, SubstationClassNames, SubstationFullClassNames,
} from "./StandardDefinitionManager";
import { DefinitionContainerName, TestDefinitionDataCodes } from "./TestDataConstants";

interface SampleEquipmentDefinitionProps {
  iModelDb: IModelDb;
  definitionContainerId: string;
  physicalContainerId: string;
  functionalContainerId: string;
  definitionGroupId: string;
  equipmentDefinitionName: string;
  genericEquipmentCategoryId: string;
  standardDefinitionManager: StandardDefinitionManager;
}

/**
 * Follows the Catalog Database format/schema and generates 'test component library'.
 * The only use case for this is for internal tests (automated/manual), as in some cases
 * we don't have the *real* definitions yet and need to create 'stub' ones. */
export class CatalogDbGeneratorEngine {
  private _definitionManager: StandardDefinitionManager;

  public constructor(definitionManager: StandardDefinitionManager) {
    this._definitionManager = definitionManager;
  }

  /**
   * Creates a SnapshotDb of the catalog with `generate views` option.
   * Uses a naming convention `{originalFile}.views.db`
   */
  public createSnapshotDbWithViews(): void {
    const snapName = this._definitionManager.iModelDb.pathName.replace(".bim", ".views.bim");
    SnapshotDb.createFrom(this._definitionManager.iModelDb, snapName, { createClassViews: true });
  }

  /** Create sample EquipmentDefinitions */
  public insertSampleComponentDefinitions(): void {
    const manager = this._definitionManager;
    const iModelDb = manager.iModelDb;

    const catalogName = DefinitionContainerName.SampleEquipmentCatalog;

    /** Get container code from definition container name.*/
    const { definitionContainerId, physicalContainerId, functionalContainerId } = this.initializeCatalog(catalogName, iModelDb);

    // Create Catalog folder structure
    // - Circuit Breakers
    //     - ACME Circuit Breaker [with 2 connection points input & output]
    // - Transformers
    //     - ACME Transformer
    const circuitBreakerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Circuit Breakers");
    const transformerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Transformers");
    const genericEquipmentCategoryId = manager.tryGetSpatialCategoryId(SpatialCategoryName.Equipment, definitionContainerId)!;

    const props = {
      iModelDb,
      definitionContainerId,
      physicalContainerId,
      functionalContainerId,
      standardDefinitionManager: manager,
      genericEquipmentCategoryId,
    };

    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.ACMETransformer });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.ACMEBreaker });
  }

  public insertSampleComponentDefinitionFor2D(): void {
    const manager = this._definitionManager;
    const iModelDb = manager.iModelDb;

    const catalogName = DefinitionContainerName.Substation2DCatalog;

    /** Get container code from definition container name.*/
    const { definitionContainerId, physicalContainerId, functionalContainerId } = this.initializeCatalog(catalogName, iModelDb);

    const genericEquipmentCategoryId = manager.tryGetSpatialCategoryId(SpatialCategoryName.Equipment, definitionContainerId)!;
    const circuitBreakerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Circuit Breakers");
    const transformerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Transformers");
    const surgeArrestorDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Surge Arrestors");

    const props = {
      iModelDb,
      definitionContainerId,
      physicalContainerId,
      functionalContainerId,
      standardDefinitionManager: manager,
      genericEquipmentCategoryId,
    };

    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_2D_1 });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_2D_2 });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_2D_3 });

    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_2D_1 });
    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_2D_2 });
    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_2D_3 });

    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_2D_1 });
    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_2D_2 });
    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_2D_3 });
  }

  public insertSampleComponentDefinitionFor3D(): void {
    const manager = this._definitionManager;
    const iModelDb = manager.iModelDb;

    const catalogName = DefinitionContainerName.Substation3DCatalog;

    /** Get container code from definition container name.*/
    const { definitionContainerId, physicalContainerId, functionalContainerId } = this.initializeCatalog(catalogName, iModelDb);

    const genericEquipmentCategoryId = manager.tryGetSpatialCategoryId(SpatialCategoryName.Equipment, definitionContainerId)!;
    const circuitBreakerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Circuit Breakers");
    const transformerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Transformers");
    const surgeArrestorDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Surge Arrestors");

    const props = {
      iModelDb,
      definitionContainerId,
      physicalContainerId,
      functionalContainerId,
      standardDefinitionManager: manager,
      genericEquipmentCategoryId,
    };

    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_3D_1 });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_3D_2 });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_3D_3 });

    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_3D_1 });
    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_3D_2 });
    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_3D_3 });

    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_3D_1 });
    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_3D_2 });
    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_3D_3 });
  }

  public insertSampleComponentDefinitionForACME(): void {
    const manager = this._definitionManager;
    const iModelDb = manager.iModelDb;

    const catalogName = DefinitionContainerName.SubstationACMECatalog;

    /** Get container code from definition container name.*/
    const { definitionContainerId, physicalContainerId, functionalContainerId } = this.initializeCatalog(catalogName, iModelDb);

    const genericEquipmentCategoryId = manager.tryGetSpatialCategoryId(SpatialCategoryName.Equipment, definitionContainerId)!;
    const circuitBreakerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Circuit Breakers");
    const transformerDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Transformers");
    const surgeArrestorDefGroupId = this.insertSampleDefinitionGroup(iModelDb, definitionContainerId, "Surge Arrestors");

    const props = {
      iModelDb,
      definitionContainerId,
      physicalContainerId,
      functionalContainerId,
      standardDefinitionManager: manager,
      genericEquipmentCategoryId,
    };

    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_ACME_1 });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_ACME_2 });
    this.insertSampleCircuitBreaker({ ...props, definitionGroupId: circuitBreakerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.CircuitBreaker_ACME_3 });

    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_ACME_1 });
    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_ACME_2 });
    this.insertSampleTransformer({ ...props, definitionGroupId: transformerDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.Transformer_ACME_3 });

    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_ACME_1 });
    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_ACME_2 });
    this.insertSampleSurgeArrestor({ ...props, definitionGroupId: surgeArrestorDefGroupId, equipmentDefinitionName: TestDefinitionDataCodes.SurgeArrestor_ACME_3 });
  }

  private initializeCatalog(catalogName: DefinitionContainerName, iModelDb: IModelDb) {
    const containerCode = this._definitionManager.createDefinitionContainerCode(catalogName);
    const definitionContainerId = DefinitionContainer.insert(iModelDb, IModel.dictionaryId, containerCode);
    const physicalContainerId = PhysicalContainer.insert(iModelDb, definitionContainerId, catalogName);
    const functionalContainerId = FunctionalContainer.insert(iModelDb, definitionContainerId, catalogName);

    this._definitionManager.ensureStandardDefinitions(definitionContainerId);

    return { definitionContainerId, physicalContainerId, functionalContainerId };
  }

  /** Creates a GeometryStream containing a single cylinder entry. */
  private createCylinderGeom(radius: number, height?: number): GeometryStreamProps {
    if (!height)
      height = 2 * radius;
    const pointA = Point3d.create(0, 0, 0);
    const pointB = Point3d.create(0, 0, height);
    const cylinder = Cone.createBaseAndTarget(pointA, pointB, Vector3d.unitX(), Vector3d.unitY(), radius, radius, true);
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(cylinder);
    return builder.geometryStream;
  }

  /** Creates a GeometryStream containing a single box entry. */
  private createBoxGeom(size: Point3d): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Box.createDgnBox(
      Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
      size.x, size.y, size.x, size.y, true,
    )!);
    return builder.geometryStream;
  }

  /** Creates a GeometryStream containing a single point entry. */
  private createPointGeom(): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(PointString3d.create(Point3d.createZero()));
    return builder.geometryStream;
  }

  /** Creates a GeometryStream containing a single circle entry. */
  private createCircleGeom(radius: number): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(Arc3d.createXY(Point3d.createZero(), radius)); // NOTE: will be valid for a GeometricElement2d GeometryStream
    return builder.geometryStream;
  }

  /** Creates a GeometryStream containing a single rectangle entry. */
  private createRectangleGeom(size: Point2d): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(LineString3d.createPoints([
      new Point3d(0, 0),
      new Point3d(size.x, 0),
      new Point3d(size.x, size.y),
      new Point3d(0, size.y),
      new Point3d(0, 0),
    ]));
    return builder.geometryStream;
  }

  private insertSampleDefinitionGroup(iModelDb: IModelDb, containerId: Id64String, groupName: string): string {
    const defGroupCode = this._definitionManager.createDefinitionGroupCode(containerId, groupName);
    const defGroup = DefinitionGroup.create(iModelDb, containerId, defGroupCode);
    const defGroupId = iModelDb.elements.insertElement(defGroup);
    return defGroupId;
  }

  private insertSampleTransformer(props: SampleEquipmentDefinitionProps) {
    const transformerPhysicalTemplateId = ElectricalPhysicalRecipe.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName);
    const transformerCategoryId = props.standardDefinitionManager.tryGetSpatialCategoryId(SubstationClassNames.DistributionTransformer, props.definitionContainerId)!;
    const transformerPhysicalProps: PhysicalElementProps = {
      classFullName: SubstationFullClassNames.ElectricalGeometry3d,
      model: transformerPhysicalTemplateId,
      category: props.genericEquipmentCategoryId,
      code: Code.createEmpty(), // empty in the template, should be set when an instance is placed
      userLabel: props.equipmentDefinitionName,
      placement: { origin: Point3d.createZero(), angles: { yaw: 0, pitch: 0, roll: 0 } },
      geom: this.createCylinderGeom(1),
    };

    props.iModelDb.elements.insertElement(transformerPhysicalProps);

    const transformerElectricalPhysicalTypeId = ElectricalPhysicalType.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName, transformerPhysicalTemplateId, SubstationClassNames.DistributionTransformerPhysicalType, SubstationClassNames.DistributionTransformer);
    const transformerPhysicalId = ElectricalPhysicalEquipment.insert(props.iModelDb, props.physicalContainerId, props.equipmentDefinitionName, transformerCategoryId, transformerElectricalPhysicalTypeId, SubstationClassNames.DistributionTransformer, `${props.equipmentDefinitionName}Physical`);
    const transformerElectricalFunctionalId = ElectricalFunctionalEquipment.insert(props.iModelDb, props.functionalContainerId, props.equipmentDefinitionName, SubstationClassNames.DistributionTransformerFunctional);

    const physicalToFunctionalRelationship = props.iModelDb.relationships.createInstance({
      classFullName: PhysicalElementFulfillsFunction.classFullName,
      sourceId: transformerPhysicalId,
      targetId: transformerElectricalFunctionalId,
    });
    props.iModelDb.relationships.insertInstance(physicalToFunctionalRelationship);

    const transformerDefinitionId = ElectricalEquipmentDefinition.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName, transformerElectricalPhysicalTypeId, props.equipmentDefinitionName);
    this.insertDefGrpDefElementRelationship(props.iModelDb, props.definitionGroupId, transformerDefinitionId);
  }

  private insertSampleCircuitBreaker(props: SampleEquipmentDefinitionProps) {
    const circuitBreakerPhysicalTemplateId = ElectricalPhysicalRecipe.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName);
    const circuitBreakerCategoryId = props.standardDefinitionManager.tryGetSpatialCategoryId(SubstationClassNames.DisconnectingCircuitBreaker, props.definitionContainerId)!;
    const breakerPhysicalProps: PhysicalElementProps = {
      classFullName: SubstationFullClassNames.ElectricalGeometry3d,
      model: circuitBreakerPhysicalTemplateId,
      category: props.genericEquipmentCategoryId,
      code: Code.createEmpty(), // empty in the template, should be set when an instance is placed
      userLabel: props.equipmentDefinitionName,
      placement: { origin: Point3d.createZero(), angles: { yaw: 0, pitch: 0, roll: 0 } },
      geom: this.createBoxGeom(Point3d.create(1, 1, 1)),
    };

    const circuitBreakerId = props.iModelDb.elements.insertElement(breakerPhysicalProps);

    const childElementProps: GeometricElement3dProps = {
      classFullName: SubstationFullClassNames.ElectricalAnchorPoint3d,
      model: circuitBreakerPhysicalTemplateId,
      category: props.genericEquipmentCategoryId,
      parent: new ElementOwnsChildElements(circuitBreakerId),
      code: Code.createEmpty(),
      userLabel: "Input",
      placement: { origin: Point3d.create(0.25, 0.5, 1), angles: { yaw: 0, pitch: 0, roll: 0 } },
      geom: this.createCylinderGeom(0.02, 0.06),
    };

    /** Insert child 1 and child 2 element with Physical Props*/
    props.iModelDb.elements.insertElement(childElementProps);

    // ACME Breaker - Output hook point
    childElementProps.userLabel = "Output";
    childElementProps.placement!.origin = Point3d.create(0.75, 0.5, 1);
    props.iModelDb.elements.insertElement(childElementProps);

    const circuitBreakerElectricalPhysicalTypeId = ElectricalPhysicalType.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName, circuitBreakerPhysicalTemplateId, SubstationClassNames.DisconnectingCircuitBreakerPhysicalType, SubstationClassNames.DisconnectingCircuitBreaker);
    const circuitBreakerPhysicalId = ElectricalPhysicalEquipment.insert(props.iModelDb, props.physicalContainerId, props.equipmentDefinitionName, circuitBreakerCategoryId, circuitBreakerElectricalPhysicalTypeId, SubstationClassNames.DisconnectingCircuitBreaker, `${props.equipmentDefinitionName}Physical`);
    const circuitBreakerElectricalFunctionalId = ElectricalFunctionalEquipment.insert(props.iModelDb, props.functionalContainerId, props.equipmentDefinitionName, SubstationClassNames.DisconnectingCircuitBreakerFunctional);

    const physicalToFunctionalRelationship = props.iModelDb.relationships.createInstance({
      classFullName: PhysicalElementFulfillsFunction.classFullName,
      sourceId: circuitBreakerPhysicalId,
      targetId: circuitBreakerElectricalFunctionalId,
    });
    props.iModelDb.relationships.insertInstance(physicalToFunctionalRelationship);

    const circuitBreakerDefinitionId = ElectricalEquipmentDefinition.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName, circuitBreakerElectricalPhysicalTypeId, props.equipmentDefinitionName);
    this.insertDefGrpDefElementRelationship(props.iModelDb, props.definitionGroupId, circuitBreakerDefinitionId);
  }

  private insertSampleSurgeArrestor(props: SampleEquipmentDefinitionProps) {
    const surgeArresterPhysicalTemplateId = ElectricalPhysicalRecipe.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName);
    const surgeArresterCategoryId = props.standardDefinitionManager.tryGetSpatialCategoryId(SubstationClassNames.SurgeArrester, props.definitionContainerId)!;
    const surgeArresterPhysicalProps: PhysicalElementProps = {
      classFullName: SubstationFullClassNames.ElectricalGeometry3d,
      model: surgeArresterPhysicalTemplateId,
      category: props.genericEquipmentCategoryId,
      code: Code.createEmpty(), // empty in the template, should be set when an instance is placed
      userLabel: props.equipmentDefinitionName,
      placement: { origin: Point3d.createZero(), angles: { yaw: 0, pitch: 0, roll: 0 } },
      geom: this.createCylinderGeom(1),
    };

    props.iModelDb.elements.insertElement(surgeArresterPhysicalProps);

    const surgeArresterPhysicalTypeId = ElectricalPhysicalType.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName, surgeArresterPhysicalTemplateId, SubstationClassNames.SurgeArresterPhysicalType, SubstationClassNames.SurgeArrester);
    const surgeArresterPhysicalId = ElectricalPhysicalEquipment.insert(props.iModelDb, props.physicalContainerId, props.equipmentDefinitionName, surgeArresterCategoryId, surgeArresterPhysicalTypeId, SubstationClassNames.SurgeArrester, `${props.equipmentDefinitionName}Physical`);
    const surgeArresterFunctionalId = ElectricalFunctionalEquipment.insert(props.iModelDb, props.functionalContainerId, props.equipmentDefinitionName, SubstationClassNames.SurgeArresterFunctional);

    const physicalToFunctionalRelationship = props.iModelDb.relationships.createInstance({
      classFullName: PhysicalElementFulfillsFunction.classFullName,
      sourceId: surgeArresterPhysicalId,
      targetId: surgeArresterFunctionalId,
    });
    props.iModelDb.relationships.insertInstance(physicalToFunctionalRelationship);

    const surgeArrestorDefinitionId = ElectricalEquipmentDefinition.insert(props.iModelDb, props.definitionContainerId, props.equipmentDefinitionName, surgeArresterPhysicalTypeId, props.equipmentDefinitionName);
    this.insertDefGrpDefElementRelationship(props.iModelDb, props.definitionGroupId, surgeArrestorDefinitionId);
  }

  /** Inserts relationship instance for definition group and definition element.*/
  private insertDefGrpDefElementRelationship(iModelDb: IModelDb, sourceDefGroupId: string, targetDefId: string): void {
    iModelDb.relationships.insertInstance({
      classFullName: "BisCore.DefinitionGroupGroupsDefinitions",
      sourceId: sourceDefGroupId,
      targetId: targetDefId,
    });
  }

}
