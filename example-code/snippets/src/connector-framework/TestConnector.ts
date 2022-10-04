/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken, Id64String } from "@itwin/core-bentley";
import { assert, IModelStatus } from "@itwin/core-bentley";
import type { DisplayStyleCreationOptions, PhysicalElement, RelationshipProps} from "@itwin/core-backend";
import { Subject } from "@itwin/core-backend";
import {
  CategorySelector, DefinitionModel, DefinitionPartition, DisplayStyle3d, ElementGroupsMembers, GeometryPart, GroupInformationPartition, IModelJsFs,
  ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalPartition, RenderMaterialElement, SpatialCategory, SubCategory, SubjectOwnsPartitionElements,
} from "@itwin/core-backend";
import type { ColorDefProps, GeometryPartProps, InformationPartitionElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { CodeScopeSpec, CodeSpec, ColorByName, ColorDef, GeometryStreamBuilder, IModel, IModelError, RenderMode, ViewFlags } from "@itwin/core-common";
import type { SolidPrimitive } from "@itwin/core-geometry";
import { Box, Cone, LinearSweep, Loop, Point3d, StandardViewIndex, Vector3d } from "@itwin/core-geometry";

import type { SourceDocument, SourceItem, SynchronizationResults } from "../../src/Synchronizer";
import { ItemState } from "../../src/Synchronizer";
import { BaseConnector } from "../../src/BaseConnector";
import { TestConnectorSchema } from "./TestConnectorSchema";
import { TestConnectorGroupModel } from "./TestConnectorModels";
import type { TestConnectorGroupProps } from "./TestConnectorElements";
import { Categories, CodeSpecs, EquilateralTriangleTile, GeometryParts, IsoscelesTriangleTile, LargeSquareTile, Materials, RectangleTile, RightTriangleTile, SmallSquareTile, TestConnectorGroup } from "./TestConnectorElements";
import type { QuadCasing, TriangleCasing } from "./TestConnectorGeometry";
import { Casings, EquilateralTriangleCasing, IsoscelesTriangleCasing, LargeSquareCasing, RectangleCasing, RectangularMagnetCasing, RightTriangleCasing, SmallSquareCasing } from "./TestConnectorGeometry";
import * as hash from "object-hash";
import * as fs from "fs";
import * as path from "path";

// __PUBLISH_EXTRACT_START__ TestConnector-extendsBaseConnector.example-code
export default class TestConnector extends BaseConnector {
// __PUBLISH_EXTRACT_END__

  private _data: any;
  private _sourceDataState: ItemState = ItemState.New;
  private _sourceData?: string;
  private _repositoryLinkId?: Id64String;

  public static override async create(): Promise<TestConnector> {
    return new TestConnector();
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private get repositoryLinkId(): Id64String {
    assert(this._repositoryLinkId !== undefined);
    return this._repositoryLinkId;
  }

  // __PUBLISH_EXTRACT_START__ TestConnector-initializeJob.example-code
  public async initializeJob(): Promise<void> {
    if (ItemState.New === this._sourceDataState) {
      this.createGroupModel();
      this.createPhysicalModel();
      this.createDefinitionModel();
    }
  }

  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-openSourceData.example-code
  public async openSourceData(sourcePath: string): Promise<void> {
    // ignore the passed in source and open the test file
    const json = fs.readFileSync(sourcePath, "utf8");
    this._data = JSON.parse(json);
    this._sourceData = sourcePath;

    const documentStatus = this.getDocumentStatus(); // make sure the repository link is created now, while we are in the repository channel
    this._sourceDataState = documentStatus.itemState;
    assert(documentStatus.elementProps.id !== undefined);
    this._repositoryLinkId = documentStatus.elementProps.id;
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-importDomainSchema.example-code
  public async importDomainSchema(_requestContext: AccessToken): Promise<any> {

    if (this._sourceDataState === ItemState.Unchanged) {
      return;
    }
    TestConnectorSchema.registerSchema();

    // WIP: JIT compiler in ts-node means that __dirname will be different when we require() this
    // connector. Hard-code as a hack, I strongly recommend placing the responsibility of the
    // require() on the node wrapper. I'm open to tooling suggestions too.

    // Not sure how nativeDb.importSchemas reads files, we use an absolute path, which seems to
    // work.

    // const fileName = TestConnectorSchema.schemaFilePath;
    const fileName = path.join(__dirname, "..", "..", "..", "test", "assets", "TestConnector.ecschema.xml");

    await this.synchronizer.imodel.importSchemas([fileName]);
  }
  // __PUBLISH_EXTRACT_END__

  public async importDynamicSchema(requestContext: AccessToken): Promise<any> {
    if (null === requestContext)
      return;
  }

  // __PUBLISH_EXTRACT_START__ TestConnector-importDefinitions.example-code

  // importDefinitions is for definitions that are written to shared models such as DictionaryModel
  public async importDefinitions(): Promise<any> {
    if (this._sourceDataState === ItemState.Unchanged) {
      return;
    }
    this.insertCodeSpecs();
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ TestConnector-updateExistingData.example-code
  public async updateExistingData() {
    const groupModelId = this.queryGroupModel();
    const physicalModelId = this.queryPhysicalModel();
    const definitionModelId = this.queryDefinitionModel();
    if (undefined === groupModelId || undefined === physicalModelId || undefined === definitionModelId) {
      const error = `Unable to find model Id for ${undefined === groupModelId ? ModelNames.Group : (undefined === physicalModelId ? ModelNames.Physical : ModelNames.Definition)}`;
      throw new IModelError(IModelStatus.BadArg, error);
    }

    this.issueReporter?.reportIssue(physicalModelId, "source", "Warning", "Test", "Test Message", "Type");

    if (this._sourceDataState === ItemState.New) {
      this.insertCategories();
      this.insertMaterials();
      this.insertGeometryParts();

      // Create this (unused) Subject here just to generate the following code path for the tests:
      // While running in its own private channel ...
      // ... a connector inserts an element that is a child of its channel parent ...
      // ... and that element is inserted into the repository model.
      // That is perfectly legal ... as long as the correct locks are held. The HubMock and integration
      // tests should fail if the correct locks are not held.
      Subject.insert(this.synchronizer.imodel, this.jobSubject.id, "Child Subject");
    }

    this.convertGroupElements(groupModelId);
    this.convertPhysicalElements(physicalModelId, definitionModelId, groupModelId);
    this.synchronizer.imodel.views.setDefaultViewId(this.createView(definitionModelId, physicalModelId, "TestConnectorView"));
  }
  // __PUBLISH_EXTRACT_END__

  public getApplicationVersion(): string {
    return "1.0.0.0";
  }
  public getConnectorName(): string {
    return "TestConnector";
  }

  private getDocumentStatus(): SynchronizationResults {
    let timeStamp = Date.now();
    assert(this._sourceData !== undefined, "we should not be in this method if the source file has not yet been opened");
    const stat = IModelJsFs.lstatSync(this._sourceData); // will throw if this._sourceData names a file that does not exist. That would be a bug. Let it abort the job.
    if (undefined !== stat) {
      timeStamp = stat.mtimeMs;
    }

    const sourceDoc: SourceDocument = {
      docid: this._sourceData,
      lastModifiedTime: timeStamp.toString(),
      checksum: () => undefined,
    };
    const documentStatus = this.synchronizer.recordDocument(sourceDoc);
    if (undefined === documentStatus) {
      const error = `Failed to retrieve a RepositoryLink for ${this._sourceData}`;
      throw new IModelError(IModelStatus.BadArg, error);
    }
    return documentStatus;
  }

  private createGroupModel(): Id64String {
    const existingId = this.queryGroupModel();
    if (undefined !== existingId) {
      return existingId;
    }
    // Create an InformationPartitionElement for the TestConnectorGroupModel to model
    const partitionProps: InformationPartitionElementProps = {
      classFullName: GroupInformationPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(this.jobSubject.id),
      code: GroupInformationPartition.createCode(this.synchronizer.imodel, this.jobSubject.id, ModelNames.Group),
    };
    const partitionId = this.synchronizer.imodel.elements.insertElement(partitionProps);

    return this.synchronizer.imodel.models.insertModel({ classFullName: TestConnectorGroupModel.classFullName, modeledElement: { id: partitionId } });
  }

  private queryGroupModel(): Id64String | undefined {
    return this.synchronizer.imodel.elements.queryElementIdByCode(GroupInformationPartition.createCode(this.synchronizer.imodel, this.jobSubject.id, ModelNames.Group));

  }
  private createPhysicalModel(): Id64String {
    const existingId = this.queryPhysicalModel();
    if (undefined !== existingId) {
      return existingId;
    }

    const modelid = PhysicalModel.insert(this.synchronizer.imodel, this.jobSubject.id, ModelNames.Physical);

    // relate this model to the source data
    const relationshipProps: RelationshipProps = {
      sourceId: modelid,
      targetId: this.repositoryLinkId,
      classFullName: "BisCore.ElementHasLinks",
    };
    this.synchronizer.imodel.relationships.insertInstance(relationshipProps);
    return modelid;
  }

  private queryPhysicalModel(): Id64String | undefined {
    return this.synchronizer.imodel.elements.queryElementIdByCode(PhysicalPartition.createCode(this.synchronizer.imodel, this.jobSubject.id, ModelNames.Physical));
  }

  private createDefinitionModel(): Id64String {
    const existingId = this.queryDefinitionModel();
    if (undefined !== existingId) {
      return existingId;
    }

    // Create an InformationPartitionElement for the TestConnectorDefinitionModel to model
    const partitionProps: InformationPartitionElementProps = {
      classFullName: DefinitionPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(this.jobSubject.id),
      code: DefinitionPartition.createCode(this.synchronizer.imodel, this.jobSubject.id, ModelNames.Definition),
    };
    const partitionId = this.synchronizer.imodel.elements.insertElement(partitionProps);

    return this.synchronizer.imodel.models.insertModel({ classFullName: DefinitionModel.classFullName, modeledElement: { id: partitionId } });
  }

  private queryDefinitionModel(): Id64String | undefined {
    const code = DefinitionPartition.createCode(this.synchronizer.imodel, this.jobSubject.id, ModelNames.Definition);
    return this.synchronizer.imodel.elements.queryElementIdByCode(code);
  }

  private insertCodeSpecs() {
    if (this.synchronizer.imodel.codeSpecs.hasName(CodeSpecs.Group)) {
      return;
    }
    const spec = CodeSpec.create(this.synchronizer.imodel, CodeSpecs.Group, CodeScopeSpec.Type.Model);
    this.synchronizer.imodel.codeSpecs.insert(spec);
  }

  private insertCategories() {
    const categoryId = this.insertCategory(Categories.Category, ColorByName.white);
    this.insertSubCategory(categoryId, Categories.Casing, ColorByName.white);
    this.insertSubCategory(categoryId, Categories.Magnet, ColorByName.darkGrey);
  }

  private insertCategory(name: string, colorDef: ColorDefProps): Id64String {
    const opts: SubCategoryAppearance.Props = {
      color: colorDef,
    };
    return SpatialCategory.insert(this.synchronizer.imodel, this.queryDefinitionModel()!, name, opts);
  }

  private insertSubCategory(categoryId: Id64String, name: string, colorDef: ColorDefProps) {
    const opts: SubCategoryAppearance.Props = {
      color: colorDef,
    };
    return SubCategory.insert(this.synchronizer.imodel, categoryId, name, opts);
  }

  private insertMaterials() {
    this.insertMaterial(Materials.ColoredPlastic, this.getColoredPlasticParams());
    this.insertMaterial(Materials.MagnetizedFerrite, this.getMagnetizedFerriteParams());
  }

  private insertMaterial(materialName: string, params: RenderMaterialElement.Params) {
    RenderMaterialElement.insert(this.synchronizer.imodel, this.queryDefinitionModel()!, materialName, params);
  }

  private getColoredPlasticParams(): RenderMaterialElement.Params {
    const params = new RenderMaterialElement.Params(Palettes.TestConnector);
    params.transmit = 0.5;
    return params;
  }

  private getMagnetizedFerriteParams(): RenderMaterialElement.Params {
    const params = new RenderMaterialElement.Params(Palettes.TestConnector);
    const darkGrey = this.toRgbFactor(ColorByName.darkGrey);
    params.specularColor = darkGrey;
    params.color = darkGrey;
    return params;
  }

  private toRgbFactor(color: number): number[] {
    const numbers = ColorDef.getColors(color);
    const factor: number[] = [
      numbers.r,
      numbers.g,
      numbers.b,
    ];
    return factor;
  }

  private insertGeometryParts() {
    const definitionModel = this.queryDefinitionModel()!;
    this.insertBox(definitionModel, new SmallSquareCasing());
    this.insertBox(definitionModel, new LargeSquareCasing());
    this.insertBox(definitionModel, new RectangleCasing());
    this.insertTriangle(definitionModel, new EquilateralTriangleCasing());
    this.insertTriangle(definitionModel, new IsoscelesTriangleCasing());
    this.insertTriangle(definitionModel, new RightTriangleCasing());
    this.insertBox(definitionModel, new RectangularMagnetCasing());
    this.insertCircularMagnet(definitionModel);
  }

  private insertBox(definitionModelId: Id64String, casing: QuadCasing) {
    const center = casing.center();
    const size = casing.size();
    const vectorX = Vector3d.unitX();
    const vectorY = Vector3d.unitY();
    const baseX = size.x;
    const baseY = size.y;
    const topX = size.x;
    const topY = size.y;
    const halfHeight: number = size.z / 2;

    const baseCenter = new Point3d(center.x, center.y, center.z - halfHeight);
    const topCenter = new Point3d(center.x, center.y, center.z + halfHeight);

    let baseOrigin = this.fromSumOf(baseCenter, vectorX, baseX * -0.5);
    baseOrigin = this.fromSumOf(baseOrigin, vectorY, baseY * -0.5);

    let topOrigin = this.fromSumOf(topCenter, vectorX, baseX * -0.5);
    topOrigin = this.fromSumOf(topOrigin, vectorY, baseY * -0.5);

    const box = Box.createDgnBox(baseOrigin, vectorX, vectorY, topOrigin, baseX, baseY, topX, topY, true);
    if (undefined === box) {
      throw new IModelError(IModelStatus.NoGeometry, `Unable to create geometry for ${casing.name()}`);
    }
    this.insertGeometry(definitionModelId, casing.name(), box);
  }

  private insertTriangle(definitionModelId: Id64String, casing: TriangleCasing) {
    const loop = Loop.createPolygon(casing.points());
    const sweep = LinearSweep.create(loop, casing.vec(), true);
    if (undefined === sweep) {
      throw new IModelError(IModelStatus.NoGeometry, `Unable to create geometry for ${casing.name()}`);
    }
    this.insertGeometry(definitionModelId, casing.name(), sweep);
  }

  private insertCircularMagnet(definitionModelId: Id64String) {
    const radius = Casings.MagnetRadius;
    const baseCenter = new Point3d(0.0, 0.0, -Casings.MagnetThickness / 2);
    const topCenter = new Point3d(0.0, 0.0, Casings.MagnetThickness / 2);
    const cone = Cone.createAxisPoints(baseCenter, topCenter, radius, radius, true);
    const name = GeometryParts.CircularMagnet;
    if (undefined === cone) {
      throw new IModelError(IModelStatus.NoGeometry, `Unable to create geometry for ${name}`);
    }
    this.insertGeometry(definitionModelId, name, cone);
  }

  private insertGeometry(definitionModelId: Id64String, name: string, primitive: SolidPrimitive): Id64String {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(primitive);

    const geometryPartProps: GeometryPartProps = {
      classFullName: GeometryPart.classFullName,
      model: definitionModelId,
      code: GeometryPart.createCode(this.synchronizer.imodel, definitionModelId, name),
      geom: geometryStreamBuilder.geometryStream,
    };
    return this.synchronizer.imodel.elements.insertElement(geometryPartProps);
  }

  private fromSumOf(p: Point3d, v: Vector3d, scale: number): Point3d {
    const result = new Point3d();
    result.x = p.x + v.x * scale;
    result.y = p.y + v.y * scale;
    result.z = p.z + v.z * scale;
    return result;
  }

  private convertGroupElements(groupModelId: Id64String) {
    for (const group of this._data.Groups) {
      const xse = this.synchronizer.getExternalSourceElementByLinkId(this.repositoryLinkId);

      const str = JSON.stringify(group);
      const sourceItem: SourceItem = {
        source: xse?.id,
        scope: groupModelId,
        kind: "Group",
        id: group.guid,
        checksum: () => hash.MD5(str),
      };
      const results = this.synchronizer.detectChanges(sourceItem);
      if (results.state === ItemState.Unchanged) {
        this.synchronizer.onElementSeen(results.id!);
        continue;
      }
      if (group.name === undefined) {
        throw new IModelError(IModelStatus.BadArg, "Name undefined for TestConnector group");
      }

      const code = TestConnectorGroup.createCode(this.synchronizer.imodel, groupModelId, group.name);
      const props: TestConnectorGroupProps = {
        classFullName: TestConnectorGroup.classFullName,
        model: groupModelId,
        code,
        groupType: group.groupType,
        manufactureDate: group.manufactureDate,
        manufactureLocation: group.manufactureLocation,
      };
      const sync: SynchronizationResults = {
        elementProps: props,
        itemState: results.state,
      };
      if (results.id !== undefined) // in case this is an update
        sync.elementProps.id = results.id;
      this.synchronizer.updateIModel(sync, sourceItem);
    }
  }

  private convertPhysicalElements(physicalModelId: Id64String, definitionModelId: Id64String, groupModelId: Id64String) {
    if ("testConnector_skipTiles" in process.env)
      return;

    for (const shape of Object.keys(this._data.Tiles)) {
      if (Array.isArray(this._data.Tiles[shape])) {
        for (const tile of this._data.Tiles[shape]) {
          this.convertTile(physicalModelId, definitionModelId, groupModelId, tile, shape);
        }
      } else {
        this.convertTile(physicalModelId, definitionModelId, groupModelId, this._data.Tiles[shape], shape);
      }
    }
  }

  private convertTile(physicalModelId: Id64String, definitionModelId: Id64String, groupModelId: Id64String, tile: any, shape: string) {
    const xse = this.synchronizer.getExternalSourceElementByLinkId(this.repositoryLinkId);
    const str = JSON.stringify(tile);
    const sourceItem: SourceItem = {
      source: xse?.id,
      scope: physicalModelId,
      kind: "Tile",
      id: tile.guid,
      checksum: () => hash.MD5(str),
    };
    const results = this.synchronizer.detectChanges(sourceItem);
    if (results.state === ItemState.Unchanged) {
      this.synchronizer.onElementSeen(results.id!);
      return;
    }
    if (tile.casingMaterial === undefined) {
      throw new IModelError(IModelStatus.BadArg, `casingMaterial undefined for TestConnector Tile ${tile.guid}`);
    }

    let element: PhysicalElement;
    switch (shape) {
      case "SmallSquareTile":
        element = SmallSquareTile.create(this.synchronizer.imodel, physicalModelId, definitionModelId, tile);
        break;
      case "LargeSquareTile":
        element = LargeSquareTile.create(this.synchronizer.imodel, physicalModelId, definitionModelId, tile);
        break;
      case "IsoscelesTriangleTile":
        element = IsoscelesTriangleTile.create(this.synchronizer.imodel, physicalModelId, definitionModelId, tile);
        break;
      case "EquilateralTriangleTile":
        element = EquilateralTriangleTile.create(this.synchronizer.imodel, physicalModelId, definitionModelId, tile);
        break;
      case "RightTriangleTile":
        element = RightTriangleTile.create(this.synchronizer.imodel, physicalModelId, definitionModelId, tile);
        break;
      case "RectangleTile":
        element = RectangleTile.create(this.synchronizer.imodel, physicalModelId, definitionModelId, tile);
        break;
      default:
        throw new IModelError(IModelStatus.BadArg, `unknown tile shape ${shape}`);
    }
    if (undefined !== results.id) {
      element.id = results.id;
    }
    const sync: SynchronizationResults = {
      elementProps: element.toJSON(),
      itemState: results.state,
    };
    this.synchronizer.updateIModel(sync, sourceItem);
    if (!tile.hasOwnProperty("Group")) {
      return;
    }

    // for testing purposes only: double check that what I calculated is what was saved in the briefcase
    // const persistentTile = this.synchronizer.imodel.elements.getElement<TestConnectorPhysicalElement>(sync.elementProps.id!); // not sure why next line is erroring
    // assert(persistentTile.placement.origin.isExactEqual((sync.elementProps as TestConnectorPhysicalElement).placement.origin));

    const groupCode = TestConnectorGroup.createCode(this.synchronizer.imodel, groupModelId, tile.Group);
    const groupElement = this.synchronizer.imodel.elements.queryElementIdByCode(groupCode);
    assert(groupElement !== undefined);
    let doCreate = results.state === ItemState.New;
    if (results.state === ItemState.Changed) {
      try {
        ElementGroupsMembers.getInstance(this.synchronizer.imodel, { sourceId: groupElement, targetId: element.id });
        doCreate = false;
      } catch (err) {
        doCreate = true;
      }
    }
    if (doCreate) {
      const rel = ElementGroupsMembers.create(this.synchronizer.imodel, groupElement, sync.elementProps.id!);
      rel.insert();
    }

  }

  private createView(definitionModelId: Id64String, physicalModelId: Id64String, name: string): Id64String {
    const code = OrthographicViewDefinition.createCode(this.synchronizer.imodel, definitionModelId, name);
    const viewId = this.synchronizer.imodel.elements.queryElementIdByCode(code);
    if (undefined !== viewId) {
      return viewId;
    }

    const categorySelectorId = this.createCategorySelector(definitionModelId);
    const modelSelectorId = this.createModelSelector(definitionModelId, physicalModelId);
    const displayStyleId = this.createDisplayStyle(definitionModelId);
    const view = OrthographicViewDefinition.create(this.synchronizer.imodel, definitionModelId, name, modelSelectorId, categorySelectorId, displayStyleId, this.synchronizer.imodel.projectExtents, StandardViewIndex.Iso);
    view.insert();
    return view.id;
  }

  private createCategorySelector(definitionModelId: Id64String): Id64String {
    const code = CategorySelector.createCode(this.synchronizer.imodel, definitionModelId, "Default");
    const selectorId = this.synchronizer.imodel.elements.queryElementIdByCode(code);
    if (undefined !== selectorId) {
      return selectorId;
    }

    const categoryId = SpatialCategory.queryCategoryIdByName(this.synchronizer.imodel, definitionModelId, Categories.Category);
    if (undefined === categoryId) {
      throw new IModelError(IModelStatus.BadElement, "Unable to find TestConnector Category");
    }
    return CategorySelector.insert(this.synchronizer.imodel, definitionModelId, "Default", [categoryId]);
  }

  private createModelSelector(definitionModelId: Id64String, physicalModelId: Id64String): Id64String {
    const code = ModelSelector.createCode(this.synchronizer.imodel, definitionModelId, "Default");
    const selectorId = this.synchronizer.imodel.elements.queryElementIdByCode(code);
    if (undefined !== selectorId) {
      return selectorId;
    }
    return ModelSelector.insert(this.synchronizer.imodel, definitionModelId, "Default", [physicalModelId]);
  }

  private createDisplayStyle(definitionModelId: Id64String): Id64String {
    const code = DisplayStyle3d.createCode(this.synchronizer.imodel, definitionModelId, "Default");
    const displayStyleId = this.synchronizer.imodel.elements.queryElementIdByCode(code);
    if (undefined !== displayStyleId) {
      return displayStyleId;
    }
    const viewFlags: ViewFlags = new ViewFlags({ renderMode: RenderMode.SmoothShade });
    const options: DisplayStyleCreationOptions = {
      backgroundColor: ColorDef.fromTbgr(ColorByName.white),
      viewFlags,
    };
    const displayStyle: DisplayStyle3d = DisplayStyle3d.create(this.synchronizer.imodel, definitionModelId, "Default", options);
    displayStyle.insert();
    return displayStyle.id;
  }
}

export enum ModelNames {
  Physical = "TestConnector_Physical",
  Definition = "TestConnector_Definitions",
  Group = "TestConnector_Groups",
}

enum Palettes {
  TestConnector = "TestConnector", // eslint-disable-line @typescript-eslint/no-shadow
}
