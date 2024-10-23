/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import * as semver from "semver";
import * as sinon from "sinon";
import { DbResult, Guid, GuidString, Id64, Id64String, Logger, OpenMode, ProcessDetector, using } from "@itwin/core-bentley";
import {
  AxisAlignedBox3d, BisCodeSpec, BriefcaseIdValue, ChangesetIdWithIndex, Code, CodeScopeSpec, CodeSpec, ColorByName, ColorDef, DefinitionElementProps,
  DisplayStyleProps, DisplayStyleSettings, DisplayStyleSettingsProps, EcefLocation, ElementProps, EntityMetaData, EntityProps, FilePropertyProps,
  FontMap, FontType, GeoCoordinatesRequestProps, GeoCoordStatus, GeographicCRS, GeographicCRSProps, GeometricElementProps, GeometryParams, GeometryStreamBuilder,
  ImageSourceFormat, IModel, IModelCoordinatesRequestProps, IModelError, IModelStatus, LightLocationProps, MapImageryProps, PhysicalElementProps,
  PointWithStatus, PrimitiveTypeCode, RelatedElement, RenderMode, SchemaState, SpatialViewDefinitionProps, SubCategoryAppearance, SubjectProps, TextureMapping,
  TextureMapProps, TextureMapUnits, ViewDefinitionProps, ViewFlagProps, ViewFlags,
} from "@itwin/core-common";
import {
  Geometry, GeometryQuery, LineString3d, Loop, Matrix4d, Point3d, PolyfaceBuilder, Range3d, StrokeOptions, Transform, XYZProps, YawPitchRollAngles,
} from "@itwin/core-geometry";
import { V2CheckpointAccessProps } from "../../BackendHubAccess";
import { V2CheckpointManager } from "../../CheckpointManager";
import {
  _nativeDb, BisCoreSchema, Category, ClassRegistry, DefinitionContainer, DefinitionGroup, DefinitionGroupGroupsDefinitions,
  DefinitionModel, DefinitionPartition, DictionaryModel, DisplayStyle3d, DisplayStyleCreationOptions, DocumentPartition, DrawingGraphic, ECSqlStatement,
  Element, ElementDrivesElement, ElementGroupsMembers, ElementOwnsChildElements, Entity, GeometricElement2d, GeometricElement3d,
  GeometricModel, GroupInformationPartition, IModelDb, IModelHost, IModelJsFs, InformationPartitionElement, InformationRecordElement, LightLocation,
  LinkPartition, Model, PhysicalElement, PhysicalModel, PhysicalObject, PhysicalPartition, RenderMaterialElement, RenderMaterialElementParams, SnapshotDb, SpatialCategory,
  SqliteStatement, SqliteValue, SqliteValueType, StandaloneDb, SubCategory, Subject, Texture, ViewDefinition,
} from "../../core-backend";
import { BriefcaseDb, SnapshotDbOpenArgs } from "../../IModelDb";
import { HubMock } from "../../HubMock";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelTestUtils } from "../IModelTestUtils";
import { DisableNativeAssertions } from "../TestUtils";
import { samplePngTexture } from "../imageData";
import { performance } from "perf_hooks";
// spell-checker: disable

async function getIModelError<T>(promise: Promise<T>): Promise<IModelError | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err instanceof IModelError ? err : undefined;
  }
}

function expectIModelError(expectedErrorNumber: IModelStatus | DbResult, error: IModelError | undefined): void {
  expect(error).not.to.be.undefined;
  expect(error).instanceof(IModelError);
  expect(error!.errorNumber).to.equal(expectedErrorNumber);
}

describe("iModel", () => {
  let imodel1: SnapshotDb;
  let imodel2: SnapshotDb;
  let imodel3: SnapshotDb;
  let imodel4: SnapshotDb;
  let imodel5: SnapshotDb;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };

    IModelTestUtils.registerTestBimSchema();
    imodel1 = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
    imodel2 = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "CompatibilityTestSeed.bim"), IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
    imodel3 = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("GetSetAutoHandledStructProperties.bim"));
    imodel4 = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "GetSetAutoHandledArrayProperties.bim"), IModelTestUtils.resolveAssetFile("GetSetAutoHandledArrayProperties.bim"));
    imodel5 = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "mirukuru.ibim"), IModelTestUtils.resolveAssetFile("mirukuru.ibim"));

    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel1.importSchemas([schemaPathname]); // will throw an exception if import fails
  });

  after(() => {
    process.env = originalEnv;
    imodel1.close();
    imodel2.close();
    imodel3.close();
    imodel4.close();
    imodel5.close();
  });

  afterEach(() => {
    sinon.restore();
  });

  /** Roundtrip the entity through a json string and back to a new entity. */
  const roundtripThroughJson = (entity1: Entity): Entity => {
    const string1 = JSON.stringify(entity1);
    const props1 = JSON.parse(string1) as EntityProps;
    const entity2 = new (entity1.constructor as any)(props1, entity1.iModel); // create a new entity from the EntityProps
    const string2 = JSON.stringify(entity2);
    assert.equal(string1, string2);
    return entity2;
  };

  it("should be able to get properties of an iIModel", () => {
    expect(imodel1.name).equals("TBD"); // That's the name of the root subject!
    const extents: AxisAlignedBox3d = imodel1.projectExtents;
    assert(!extents.isNull);

    // make sure we can construct a new element even if we haven't loaded its metadata (will be loaded in ctor)
    assert.isUndefined(imodel1.classMetaDataRegistry.find("biscore:lightlocation"));
    const e1 = imodel1.constructEntity<LightLocation, LightLocationProps>({ category: "0x11", classFullName: "BisCore:LightLocation", model: "0x01", code: Code.createEmpty() });
    assert.isDefined(e1);
    assert.isDefined(imodel1.classMetaDataRegistry.find("biscore:lightlocation")); // should have been loaded in ctor
  });

  it("should use schema to look up classes by name", () => {
    const elementClass = ClassRegistry.findRegisteredClass(Element.classFullName);
    const categoryClass = ClassRegistry.findRegisteredClass(Category.classFullName);
    assert.isDefined(elementClass);
    assert.isDefined(categoryClass);
    assert.equal(elementClass!.schema, BisCoreSchema);
    assert.equal(categoryClass!.schema, BisCoreSchema);
    assert.equal(elementClass!.className, "Element");
    assert.equal(categoryClass!.className, "Category");
  });

  it("FontMap", () => {
    const fonts1 = imodel1.fontMap;
    assert.equal(fonts1.fonts.size, 4, "font map size should be 4");
    assert.equal(FontType.TrueType, fonts1.getFont(1)!.type, "get font 1 type is TrueType");
    assert.equal("Arial", fonts1.getFont(1)!.name, "get Font 1 name");
    assert.equal(1, fonts1.getFont("Arial")!.id, "get Font 1, by name");
    assert.equal(FontType.Rsc, fonts1.getFont(2)!.type, "get font 2 type is Rsc");
    assert.equal("Font0", fonts1.getFont(2)!.name, "get Font 2 name");
    assert.equal(2, fonts1.getFont("Font0")!.id, "get Font 2, by name");
    assert.equal(FontType.Shx, fonts1.getFont(3)!.type, "get font 1 type is Shx");
    assert.equal("ShxFont0", fonts1.getFont(3)!.name, "get Font 3 name");
    assert.equal(3, fonts1.getFont("ShxFont0")!.id, "get Font 3, by name");
    assert.equal(FontType.TrueType, fonts1.getFont(4)!.type, "get font 4 type is TrueType");
    assert.equal("Calibri", fonts1.getFont(4)!.name, "get Font 4 name");
    assert.equal(4, fonts1.getFont("Calibri")!.id, "get Font 3, by name");
    assert.isUndefined(fonts1.getFont("notfound"), "attempt lookup of a font that should not be found");
    assert.deepEqual(new FontMap(fonts1.toJSON()), fonts1, "toJSON on FontMap");
  });

  it("should load a known element by Id from an existing iModel", () => {
    assert.exists(imodel1.elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel1.elements.getElement(code1);
    assert.exists(el);
    const el2ById = imodel1.elements.getElement("0x34");
    assert.exists(el2ById);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });

    try {
      imodel1.elements.getElement(badCode); // throws Error
      assert.fail(); // this line should be skipped
    } catch (error: any) {
      assert.instanceOf(error, Error);
      assert.instanceOf(error, IModelError);
      assert.equal(error.errorNumber, IModelStatus.NotFound);
    }

    const element1 = imodel1.elements.tryGetElement(code1);
    const element2 = imodel1.elements.tryGetElement("0x34");
    const element3 = imodel1.elements.tryGetElement(badCode);
    assert.isDefined(element1);
    assert.isDefined(element2);
    assert.isUndefined(element3);
    const elementProps1 = imodel1.elements.tryGetElementProps(code1);
    const elementProps2 = imodel1.elements.tryGetElementProps("0x34");
    const elementProps3 = imodel1.elements.tryGetElementProps(badCode);
    assert.isDefined(elementProps1);
    assert.isDefined(elementProps2);
    assert.isUndefined(elementProps3);

    const model1 = imodel1.models.tryGetModel(IModel.dictionaryId);
    const modelProps1 = imodel1.models.tryGetModelProps(IModel.dictionaryId);
    const subModel1 = imodel1.models.tryGetSubModel(IModel.dictionaryId);
    assert.isDefined(model1);
    assert.isDefined(modelProps1);
    assert.isDefined(subModel1);
    const badModel1 = imodel1.models.tryGetModel(Id64.fromUint32Pair(999, 999));
    const badModelProps1 = imodel1.models.tryGetModelProps(Id64.fromUint32Pair(999, 999));
    const badSubModel1 = imodel1.models.tryGetSubModel(IModel.rootSubjectId);
    const badSubModel2 = imodel1.models.tryGetSubModel(badCode);
    assert.isUndefined(badModel1);
    assert.isUndefined(badModelProps1);
    assert.isUndefined(badSubModel1);
    assert.isUndefined(badSubModel2);

    const subCat = imodel1.elements.getElement("0x2e");
    assert.isTrue(subCat instanceof SubCategory);
    if (subCat instanceof SubCategory) {
      assert.isTrue(subCat.appearance.color.tbgr === 16777215);
      assert.isTrue(subCat.appearance.weight === 2);
      assert.equal(Id64.getLocalId(subCat.id), 46);
      assert.equal(Id64.getBriefcaseId(subCat.id), 0);
      assert.equal(Id64.getLocalId(subCat.code.spec), 30);
      assert.equal(Id64.getBriefcaseId(subCat.code.spec), 0);
      assert.isTrue(subCat.code.scope === "0x2d");
      assert.isTrue(subCat.code.value === "A-Z013-G-Legn");
      roundtripThroughJson(subCat);
    }

    /// Get the parent Category of the subcategory.
    const cat = imodel1.elements.getElement((subCat as SubCategory).getCategoryId());
    assert.isTrue(cat instanceof Category);
    if (cat instanceof Category) {
      assert.equal(Id64.getLocalId(cat.id), 45);
      assert.equal(Id64.getBriefcaseId(cat.id), 0);
      assert.isTrue(cat.description === "Legends, symbols keys");
      assert.equal(Id64.getLocalId(cat.code.spec), 22);
      assert.equal(Id64.getBriefcaseId(cat.code.spec), 0);
      assert.isTrue(cat.code.value === "A-Z013-G-Legn");
      roundtripThroughJson(cat);
    }

    const phys = imodel1.elements.getElement("0x38");
    assert.isTrue(phys instanceof GeometricElement3d);

    const locateMsg = phys.getToolTipMessage();
    assert.isDefined(locateMsg);

    const a2 = imodel2.elements.getElement("0x1d");
    assert.exists(a2);
    expect(a2.federationGuid).equal("18eb4650-b074-414f-b961-d9cfaa6c8746");
    const el3 = imodel2.elements.getElement(a2.federationGuid!);
    assert.exists(el3);
    assert.notEqual(a2, el3);
    assert.equal(a2.id, el3.id);
    roundtripThroughJson(el3);

    const newEl = el3.toJSON();
    newEl.federationGuid = undefined;
    newEl.code = { scope: "bad scope", spec: "0x10", value: "new code" };
    expect(() => imodel2.elements.insertElement(newEl)).throws("invalid code scope").to.have.property("metadata");
    newEl.code.scope = "0x34322"; // valid id, but element doesn't exist
    expect(() => imodel2.elements.insertElement(newEl)).throws("invalid code scope").to.have.property("metadata");

    newEl.code.scope = el3.federationGuid!;
    const newId = imodel2.elements.insertElement(newEl); // code scope from FederationGuid should get converted to ElementId
    const a4 = imodel2.elements.getElementProps(newId);
    expect(a4.code.scope).equal(el3.id);

    a4.code.scope = "0x13343";
    expect(() => imodel2.elements.updateElement(a4)).throws("invalid code scope").to.have.property("metadata");

    a4.code.scope = "0x1";
    imodel2.elements.updateElement(a4); // should change the code scope to new element
    let a5 = imodel2.elements.getElementProps(newId);
    expect(a5.code.scope).equal("0x1");

    // only pass minimum, but expect model and classFullName to be added.
    const newProps = { id: a4.id, code: a4.code, classFullName: undefined, model: undefined };
    newProps.code.scope = el3.federationGuid!; // should convert FederationGuid to ElementId
    imodel2.elements.updateElement(newProps);
    expect(newProps.classFullName).eq(a4.classFullName);
    expect(newProps.model).eq(a4.model);

    a5 = imodel2.elements.getElementProps(newId);
    expect(a5.code.scope).equal(el3.id);
  });

  it("should optionally detect class mismatches", () => {
    // tryGetElement
    const subjectUnvalidated = imodel1.elements.tryGetElement<Subject>(IModel.rootSubjectId);
    assert.isDefined(subjectUnvalidated);
    const subjectValidated = imodel1.elements.tryGetElement<Subject>(IModel.rootSubjectId, Subject);
    assert.isDefined(subjectValidated);
    const physicalElementUnvalidated = imodel1.elements.tryGetElement<PhysicalElement>(IModel.rootSubjectId);
    assert.isDefined(physicalElementUnvalidated); // wrong type, but class to validate was not passed
    const physicalElementValidated = imodel1.elements.tryGetElement<PhysicalElement>(IModel.rootSubjectId, PhysicalElement); // abstract class
    assert.isUndefined(physicalElementValidated); // wrong type
    const physicalObjectUnvalidated = imodel1.elements.tryGetElement<PhysicalObject>(IModel.rootSubjectId);
    assert.isDefined(physicalObjectUnvalidated); // wrong type, but class to validate was not passed
    const physicalObjectValidated = imodel1.elements.tryGetElement<PhysicalObject>(IModel.rootSubjectId, PhysicalObject); // concrete class
    assert.isUndefined(physicalObjectValidated); // wrong type
    // tryGetModel
    const dictionaryUnvalidated = imodel1.models.tryGetModel<DictionaryModel>(IModel.dictionaryId);
    assert.isDefined(dictionaryUnvalidated);
    const dictionaryValidated = imodel1.models.tryGetModel<DictionaryModel>(IModel.dictionaryId, DictionaryModel);
    assert.isDefined(dictionaryValidated);
    const geometricModelUnvalidated = imodel1.models.tryGetModel<GeometricModel>(IModel.dictionaryId);
    assert.isDefined(geometricModelUnvalidated); // wrong type, but class to validate was not passed
    const geometricModelValidated = imodel1.models.tryGetModel<GeometricModel>(IModel.dictionaryId, GeometricModel); // abstract class
    assert.isUndefined(geometricModelValidated); // wrong type
    const physicalModelUnvalidated = imodel1.models.tryGetModel<PhysicalModel>(IModel.dictionaryId);
    assert.isDefined(physicalModelUnvalidated); // wrong type, but class to validate was not passed
    const physicalModelValidated = imodel1.models.tryGetModel<PhysicalModel>(IModel.dictionaryId, PhysicalModel); // concrete class
    assert.isUndefined(physicalModelValidated); // wrong type
    // tryGetSubModel
    const dictionarySubUnvalidated = imodel1.models.tryGetSubModel<DictionaryModel>(IModel.dictionaryId);
    assert.isDefined(dictionarySubUnvalidated);
    const dictionarySubValidated = imodel1.models.tryGetSubModel<DictionaryModel>(IModel.dictionaryId, DictionaryModel);
    assert.isDefined(dictionarySubValidated);
    const geometricSubModelUnvalidated = imodel1.models.tryGetSubModel<GeometricModel>(IModel.dictionaryId);
    assert.isDefined(geometricSubModelUnvalidated); // wrong type, but class to validate was not passed
    const geometricSubModelValidated = imodel1.models.tryGetSubModel<GeometricModel>(IModel.dictionaryId, GeometricModel); // abstract class
    assert.isUndefined(geometricSubModelValidated); // wrong type
    const physicalSubModelUnvalidated = imodel1.models.tryGetSubModel<PhysicalModel>(IModel.dictionaryId);
    assert.isDefined(physicalSubModelUnvalidated); // wrong type, but class to validate was not passed
    const physicalSubModelValidated = imodel1.models.tryGetSubModel<PhysicalModel>(IModel.dictionaryId, PhysicalModel); // concrete class
    assert.isUndefined(physicalSubModelValidated); // wrong type
  });

  it("should create elements", () => {
    const seedElement = imodel2.elements.getElement<GeometricElement3d>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    for (let i = 0; i < 25; i++) {
      const elementProps: GeometricElementProps = {
        classFullName: "Generic:PhysicalObject",
        model: seedElement.model,
        category: seedElement.category,
        code: Code.createEmpty(),
        federationGuid: Guid.createValue(),
        userLabel: `UserLabel-${i}`,
      };

      const element: Element = imodel2.elements.createElement(elementProps);
      element.setUserProperties("performanceTest", { s: `String-${i}`, n: i });

      const elementId = imodel2.elements.insertElement(element.toJSON());
      assert.isTrue(Id64.isValidId64(elementId));
    }
  });

  it("should insert a RenderMaterial", () => {
    const model = imodel2.models.getModel<DictionaryModel>(IModel.dictionaryId);
    expect(model).not.to.be.undefined;

    const testMaterialName = "test material name";
    const testPaletteName = "test palette name";
    const testDescription = "test description";
    const color = [0.3, 0.7, 0.8];
    const specularColor = [0.1, 1, 0];
    const finish = 0.4;
    const transmit = 0.1;
    const diffuse = 0.24;
    const specular = 0.9;
    const reflect = 0.3;
    const reflectColor = [1, 0, 0.5];
    /* eslint-disable @typescript-eslint/naming-convention */
    const textureMapProps: TextureMapProps = {
      pattern_angle: 3.0,
      pattern_u_flip: false,
      pattern_flip: false,
      pattern_scale: [1.0, 1.0],
      pattern_offset: [0.0, 0.0],
      pattern_scalemode: TextureMapUnits.Inches,
      pattern_mapping: TextureMapping.Mode.Planar,
      pattern_weight: 0.5,
      TextureId: "test_textureid",
    };

    /* eslint-enable @typescript-eslint/naming-convention */
    const renderMaterialParams: RenderMaterialElementParams = {
      paletteName: testPaletteName,
      description: testDescription,
      color,
      specularColor,
      finish,
      transmit,
      diffuse,
      specular,
      reflect,
      reflectColor,
      patternMap: textureMapProps,
    };

    const renderMaterialId = RenderMaterialElement.insert(imodel2, IModel.dictionaryId, testMaterialName, renderMaterialParams);

    const renderMaterial = imodel2.elements.getElement<RenderMaterialElement>(renderMaterialId);
    assert((renderMaterial instanceof RenderMaterialElement) === true, "did not retrieve an instance of RenderMaterial");
    expect(renderMaterial.paletteName).to.equal(testPaletteName);
    expect(renderMaterial.description).to.equal(testDescription);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasBaseColor).to.equal(true);
    expect(JSON.stringify(renderMaterial.jsonProperties.materialAssets.renderMaterial.color)).to.equal(JSON.stringify(color));
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasSpecularColor).to.equal(true);
    expect(JSON.stringify(renderMaterial.jsonProperties.materialAssets.renderMaterial.specular_color)).to.equal(JSON.stringify(specularColor));
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasFinish).to.equal(true);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.finish).to.equal(finish);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasTransmit).to.equal(true);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.transmit).to.equal(transmit);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasDiffuse).to.equal(true);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.diffuse).to.equal(diffuse);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasSpecular).to.equal(true);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.specular).to.equal(specular);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasReflect).to.equal(true);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.reflect).to.equal(reflect);
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.HasReflectColor).to.equal(true);
    expect(JSON.stringify(renderMaterial.jsonProperties.materialAssets.renderMaterial.reflect_color)).to.equal(JSON.stringify(reflectColor));
    expect(renderMaterial.jsonProperties.materialAssets.renderMaterial.Map).not.to.be.undefined;

    const patternMap = renderMaterial.jsonProperties.materialAssets.renderMaterial.Map.Pattern;
    expect(patternMap).not.to.be.undefined;
    expect(patternMap.pattern_angle).to.equal(textureMapProps.pattern_angle);
    expect(patternMap.pattern_u_flip).to.equal(textureMapProps.pattern_u_flip);
    expect(patternMap.pattern_flip).to.equal(textureMapProps.pattern_flip);
    expect(JSON.stringify(patternMap.pattern_scale)).to.equal(JSON.stringify(textureMapProps.pattern_scale));
    expect(JSON.stringify(patternMap.pattern_offset)).to.equal(JSON.stringify(textureMapProps.pattern_offset));
    expect(patternMap.pattern_scalemode).to.equal(textureMapProps.pattern_scalemode);
    expect(patternMap.pattern_mapping).to.equal(textureMapProps.pattern_mapping);
    expect(patternMap.pattern_weight).to.equal(textureMapProps.pattern_weight);
    expect(patternMap.TextureId).to.equal(textureMapProps.TextureId);
  });

  it("attempt to apply material to new element in imodel5", () => {
    const testTextureName = "fake texture name";
    const testTextureFormat = ImageSourceFormat.Png;
    const testTextureDescription = "empty description";

    const texId = Texture.insertTexture(imodel5, IModel.dictionaryId, testTextureName, testTextureFormat, samplePngTexture.base64, testTextureDescription);

    /* eslint-disable @typescript-eslint/naming-convention */
    const matId = RenderMaterialElement.insert(imodel5, IModel.dictionaryId, "test material name",
      {
        paletteName: "TestPaletteName",
        patternMap: {
          TextureId: texId,
          pattern_offset: [0, 0],
          pattern_scale: [1, 1],
          pattern_scalemode: TextureMapUnits.Relative,
        },
      });
    /* eslint-enable @typescript-eslint/naming-convention */

    /** Create a simple flat mesh with 4 points (2x2) */
    const width = imodel5.projectExtents.xLength() * 0.2;
    const height = imodel5.projectExtents.yLength() * 0.2;
    let shape: GeometryQuery;
    const doPolyface = true;
    if (doPolyface) {
      const options = StrokeOptions.createForFacets();
      options.shouldTriangulate = false;
      const builder = PolyfaceBuilder.create(options);

      const quad = [
        Point3d.create(0.0, 0.0, 0.0),
        Point3d.create(width, 0.0, 0.0),
        Point3d.create(width, height, 0.0),
        Point3d.create(0.0, height, 0.0),
      ];

      builder.addQuadFacet(quad);
      shape = builder.claimPolyface();
    } else {
      shape = Loop.create(LineString3d.create([
        Point3d.create(0, 0, 0),
        Point3d.create(width, 0, 0),
        Point3d.create(width, height, 0),
        Point3d.create(0, height, 0),
        Point3d.create(0, 0, 0),
      ]));
    }

    const modelId = PhysicalModel.insert(imodel5, IModelDb.rootSubjectId, "test_render_material_model_name");

    const categoryId = SpatialCategory.insert(imodel5, IModel.dictionaryId, "GeoJSON Feature", { color: ColorDef.white.toJSON() });

    /** generate a geometry stream containing the polyface */
    const gsBuilder = new GeometryStreamBuilder();
    const params = new GeometryParams(categoryId);
    params.materialId = matId;
    gsBuilder.appendGeometryParamsChange(params);
    gsBuilder.appendGeometry(shape);
    const geometry = gsBuilder.geometryStream;
    // geometry[0].material = { materialId: matId };

    const props: PhysicalElementProps = {
      classFullName: "Generic:PhysicalObject",
      placement: { origin: imodel5.projectExtents.center, angles: new YawPitchRollAngles() },
      model: modelId,
      code: Code.createEmpty(),
      category: categoryId,
      geom: geometry,
    };
    imodel5.elements.insertElement(props);
    imodel5.saveChanges();
  });

  it("should insert a DisplayStyle", () => {
    const model = imodel2.models.getModel<DictionaryModel>(IModel.dictionaryId);
    expect(model).not.to.be.undefined;

    const settings: DisplayStyleSettingsProps = {
      backgroundColor: ColorDef.blue.toJSON(),
      viewflags: ViewFlags.fromJSON({
        renderMode: RenderMode.SolidFill,
      }),
    };

    const props: DisplayStyleProps = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId, value: "test style" },
      isPrivate: false,
      jsonProperties: {
        styles: settings,
      },
    };

    const styleId = imodel2.elements.insertElement(props);
    let style = imodel2.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;
    expect(style.code.spec).equal(imodel2.codeSpecs.getByName(BisCodeSpec.displayStyle).id);

    expect(style.settings.viewFlags.renderMode).to.equal(RenderMode.SolidFill);
    expect(style.settings.backgroundColor.equals(ColorDef.blue)).to.be.true;

    const newFlags = style.settings.viewFlags.copy({ renderMode: RenderMode.SmoothShade });
    style.settings.viewFlags = newFlags;
    style.settings.backgroundColor = ColorDef.red;
    style.settings.monochromeColor = ColorDef.green;
    expect(style.jsonProperties.styles.viewflags.renderMode).to.equal(RenderMode.SmoothShade);

    imodel2.elements.updateElement(style.toJSON());
    style = imodel2.elements.getElement<DisplayStyle3d>(styleId);
    expect(style instanceof DisplayStyle3d).to.be.true;

    expect(style.settings.viewFlags.renderMode).to.equal(RenderMode.SmoothShade);
    expect(style.settings.backgroundColor.equals(ColorDef.red)).to.be.true;
    expect(style.settings.monochromeColor.equals(ColorDef.green)).to.be.true;
  });

  it("should create display styles", () => {
    const defaultViewFlags = new ViewFlags().toJSON();
    const defaultMapImagery = new DisplayStyleSettings({}).toJSON().mapImagery;

    const viewFlags = new ViewFlags({ patterns: false, visibleEdges: true });
    const viewflags: ViewFlagProps = { noWhiteOnWhiteReversal: true, shadows: true, noTransp: true };

    const mapImagery: MapImageryProps = {
      backgroundBase: ColorDef.red.tbgr,
      backgroundLayers: [{
        name: "x",
        url: "y",
        transparency: 0.5,
        formatId: "WMS",
        visible: true,
      }],
    };

    const props: DisplayStyleSettingsProps = {
      mapImagery,
      excludedElements: ["0x123", "0xfed"],
      timePoint: 42,
      backgroundColor: ColorDef.green.tbgr,
    };

    type TestCase = [DisplayStyleCreationOptions | undefined, ViewFlagProps, boolean];
    const testCases: TestCase[] = [
      [undefined, defaultViewFlags, false],
      [{ viewFlags }, viewFlags.toJSON(), false],
      [{ viewflags }, viewflags, false],
      [{ viewflags, viewFlags }, viewFlags.toJSON(), false],
      [props, defaultViewFlags, false],
      [{ ...props, viewflags }, viewflags, false],
      [{ backgroundColor: ColorDef.blue }, defaultViewFlags, false],
      [{ backgroundColor: ColorDef.from(1, 2, 3, 4) }, defaultViewFlags, false],
      [{ backgroundColor: ColorDef.blue.tbgr }, defaultViewFlags, false],
      [{ backgroundColor: ColorDef.from(1, 2, 3, 4).tbgr }, defaultViewFlags, false],
    ];

    let suffix = 123;
    for (const test of testCases) {
      const expected = test[0] ?? {};
      const styleId = DisplayStyle3d.insert(imodel2, IModel.dictionaryId, `TestStyle${suffix++}`, expected);
      const style = imodel2.elements.getElement<DisplayStyle3d>(styleId).toJSON();
      expect(style.jsonProperties.styles).not.to.be.undefined;

      expect(style.jsonProperties).not.to.be.undefined;
      expect(style.jsonProperties.styles).not.to.be.undefined;
      const actual = style.jsonProperties.styles!;

      expect(actual.viewflags).not.to.be.undefined;
      const expectedVf = ViewFlags.fromJSON(test[1]);
      const actualVf = ViewFlags.fromJSON(actual.viewflags);
      expect(actualVf.toJSON()).to.deep.equal(expectedVf.toJSON());

      const expectedBGColor = expected.backgroundColor instanceof ColorDef ? expected.backgroundColor.toJSON() : expected.backgroundColor;
      expect(actual.backgroundColor).to.equal(expectedBGColor);

      // DisplayStyleSettings constructor always initializes json.mapImagery.
      expect(actual.mapImagery).to.deep.equal(expected.mapImagery ?? defaultMapImagery);
      expect(actual.excludedElements).to.deep.equal(expected.excludedElements);
      expect(actual.timePoint).to.deep.equal(expected.timePoint);
    }
  });

  it("should have a valid root subject element", () => {
    const rootSubject = imodel1.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject.code.value.length, 1);
    assert.isFalse(imodel1.elements.hasSubModel(IModel.rootSubjectId));

    try {
      imodel1.models.getSubModel(rootSubject.id); // throws error
      assert.fail(); // this line should be skipped
    } catch (error: any) {
      assert.isTrue(error instanceof Error);
      assert.isTrue(error instanceof IModelError);
      assert.equal(error.errorNumber, IModelStatus.NotFound);
    }

    const childIds: Id64String[] = imodel1.elements.queryChildren(rootSubject.id);
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const childElement = imodel1.elements.getElement(childId);
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);

      roundtripThroughJson(childElement);
      assert.equal(rootSubject.id, childElement.parent!.id);

      const childLocalId = Id64.getLocalId(childId);
      const childBcId = Id64.getBriefcaseId(childId);
      if (childElement instanceof InformationPartitionElement) {
        assert.isTrue(imodel1.elements.hasSubModel(childElement.id));
        const childSubModel: Model = imodel1.models.getSubModel(childElement.id);
        assert.exists(childSubModel, "InformationPartitionElements should have a subModel");

        if (childLocalId === 16 && childBcId === 0) {
          assert.isTrue(childElement instanceof DefinitionPartition, "ChildId 0x00000010 should be a DefinitionPartition");
          assert.isTrue(childElement.code.value === "BisCore.DictionaryModel", "Definition Partition should have code value of BisCore.DictionaryModel");
        } else if (childLocalId === 14 && childBcId === 0) {
          assert.isTrue(childElement instanceof LinkPartition);
          assert.isTrue(childElement.code.value === "BisCore.RealityDataSources");
        } else if (childLocalId === 17 && childBcId === 0) {
          assert.isTrue(childElement instanceof LinkPartition, "ChildId 0x000000011 should be a LinkPartition");
          assert.isTrue(childElement.code.value === "Repository Links");
        }
      } else if (childElement instanceof Subject) {
        assert.isFalse(imodel1.elements.hasSubModel(childElement.id));
        if (childLocalId === 19 && childBcId === 0) {
          assert.isTrue(childElement instanceof Subject);
          assert.isTrue(childElement.code.value === "DgnV8:mf3, A", "Subject should have code value of DgnV8:mf3, A");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8File === "mf3.dgn", "Subject should have jsonProperty Subject.Job.DgnV.V8File");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8RootModel === "A", "Subject should have jsonProperty Subject.Job.DgnV.V8RootModel");
        }
      }
    }
  });

  it("should load a known model by Id from an existing iModel", () => {
    assert.exists(imodel1.models);
    const model2 = imodel1.models.getModel("0x1c");
    assert.exists(model2);
    const formatter = model2.getJsonProperty("formatter");
    assert.exists(formatter, "formatter should exist as json property");
    assert.equal(formatter.fmtFlags.angMode, 1, "fmtFlags");
    assert.equal(formatter.mastUnit.label, "m", "mastUnit is meters");
    roundtripThroughJson(model2);
    let model = imodel1.models.getModel(IModel.repositoryModelId);
    assert.exists(model);
    roundtripThroughJson(model);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    model = imodel1.models.getSubModel(code1);
    // By this point, we expect the submodel's class to be in the class registry *cache*
    const geomModel = ClassRegistry.getClass(PhysicalModel.classFullName, imodel1);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel);
    roundtripThroughJson(model);
    const modelExtents: AxisAlignedBox3d = (model as PhysicalModel).queryExtents();

    assert.isBelow(modelExtents.low.x, modelExtents.high.x);
    assert.isBelow(modelExtents.low.y, modelExtents.high.y);
    assert.isBelow(modelExtents.low.z, modelExtents.high.z);
  });

  it("should find a tile tree for a geometric model", async () => {
    // Note: this is an empty model.
    const tree = await imodel1.tiles.requestTileTreeProps("0x1c");
    expect(tree).not.to.be.undefined;

    expect(tree.id).to.equal("0x1c");
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    // Empty model => identity transform
    const tf = Transform.fromJSON(tree.location);
    expect(tf.matrix.isIdentity).to.be.true;
    expect(tf.origin.x).to.equal(0);
    expect(tf.origin.y).to.equal(0);
    expect(tf.origin.z).to.equal(0);

    expect(tree.rootTile.contentId).to.equal("0/0/0/0/1");

    // Empty model => null range
    const range = Range3d.fromJSON(tree.rootTile.range);
    expect(range.isNull).to.be.true;

    expect(tree.rootTile.maximumSize).to.equal(0.0); // empty model => undisplayable root tile => size = 0.0
    expect(tree.rootTile.isLeaf).to.be.true; // empty model => empty tile
    expect(tree.rootTile.contentRange).to.be.undefined;
  });

  it("should throw on invalid tile requests", async () => {
    await using(new DisableNativeAssertions(), async (_r) => {
      let error = await getIModelError(imodel1.tiles.requestTileTreeProps("0x12345"));
      expectIModelError(IModelStatus.InvalidId, error);

      error = await getIModelError(imodel1.tiles.requestTileTreeProps("NotAValidId"));
      expectIModelError(IModelStatus.InvalidId, error);

      error = await getIModelError(imodel1.tiles.requestTileContent("0x1c", "0/0/0/0"));
      expectIModelError(IModelStatus.InvalidId, error);

      error = await getIModelError(imodel1.tiles.requestTileContent("0x12345", "0/0/0/0/1"));
      expectIModelError(IModelStatus.InvalidId, error);

      error = await getIModelError(imodel1.tiles.requestTileContent("0x1c", "V/W/X/Y/Z"));
      expectIModelError(IModelStatus.InvalidId, error);

      error = await getIModelError(imodel1.tiles.requestTileContent("0x1c", "NotAValidId"));
      expectIModelError(IModelStatus.InvalidId, error);
    });
  });

  // NOTE: this test can be removed when the deprecated executeQuery method is removed
  it("should produce an array of rows", () => {
    const rows: any[] = IModelTestUtils.executeQuery(imodel1, `SELECT * FROM ${Category.classFullName}`);
    assert.exists(rows);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].id);
    assert.notEqual(rows[0].id.value, "");
  });

  it("should be some categories", () => {
    const categorySql = `SELECT ECInstanceId FROM ${Category.classFullName}`;
    imodel1.withPreparedStatement(categorySql, (categoryStatement: ECSqlStatement): void => {
      let numCategories = 0;
      while (DbResult.BE_SQLITE_ROW === categoryStatement.step()) {
        numCategories++;
        const categoryId = categoryStatement.getValue(0).getId();
        const category: Element = imodel1.elements.getElement(categoryId);
        assert.isTrue(category instanceof Category, "Should be instance of Category");

        // verify the default subcategory.
        const defaultSubCategoryId = (category as Category).myDefaultSubCategoryId();
        const defaultSubCategory: Element = imodel1.elements.getElement(defaultSubCategoryId);
        assert.isTrue(defaultSubCategory instanceof SubCategory, "defaultSubCategory should be instance of SubCategory");
        if (defaultSubCategory instanceof SubCategory) {
          assert.isTrue(defaultSubCategory.parent!.id === categoryId, "defaultSubCategory id should be prescribed value");
          assert.isTrue(defaultSubCategory.getSubCategoryName() === category.code.value, "DefaultSubcategory name should match that of Category");
          assert.isTrue(defaultSubCategory.isDefaultSubCategory, "isDefaultSubCategory should return true");
        }

        // get the subcategories
        const subCategorySql = `SELECT ECInstanceId FROM ${SubCategory.classFullName} WHERE Parent.Id=:parentId`;
        imodel1.withPreparedStatement(subCategorySql, (subCategoryStatement: ECSqlStatement): void => {
          let numSubCategories = 0;
          subCategoryStatement.bindId("parentId", categoryId);
          while (DbResult.BE_SQLITE_ROW === subCategoryStatement.step()) {
            numSubCategories++;
            const subCategoryId = subCategoryStatement.getValue(0).getId();
            const subCategory: Element = imodel1.elements.getElement(subCategoryId);
            assert.isTrue(subCategory instanceof SubCategory);
            assert.isTrue(subCategory.parent!.id === categoryId);
          }
          assert.isAtLeast(numSubCategories, 1, "Expected query to find at least one SubCategory");
        });
      }
      assert.isAtLeast(numCategories, 1, "Expected query to find some categories");
    });
  });

  it("should be some 2d elements", () => {
    const sql = `SELECT ECInstanceId FROM ${DrawingGraphic.classFullName}`;
    imodel2.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      let numDrawingGraphics = 0;
      let found25: boolean = false;
      let found26: boolean = false;
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        numDrawingGraphics++;
        const drawingGraphicId = statement.getValue(0).getId();
        const drawingGraphic = imodel2.elements.getElement<GeometricElement2d>({ id: drawingGraphicId, wantGeometry: true });
        assert.exists(drawingGraphic);
        assert.isTrue(drawingGraphic.className === "DrawingGraphic", "Should be instance of DrawingGraphic");
        assert.isTrue(drawingGraphic instanceof DrawingGraphic, "Is instance of DrawingGraphic");
        assert.isTrue(drawingGraphic instanceof GeometricElement2d, "Is instance of GeometricElement2d");
        if (Id64.getLocalId(drawingGraphic.id) === 0x25) {
          found25 = true;
          assert.isTrue(drawingGraphic.placement.origin.x === 0.0);
          assert.isTrue(drawingGraphic.placement.origin.y === 0.0);
          assert.isTrue(drawingGraphic.placement.angle.radians === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.x === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.y === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.x === 1.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.y === 1.0);
          assert.isDefined(drawingGraphic.geom);
        } else if (Id64.getLocalId(drawingGraphic.id) === 0x26) {
          found26 = true;
          assert.isTrue(drawingGraphic.placement.origin.x === 1.0);
          assert.isTrue(drawingGraphic.placement.origin.y === 1.0);
          assert.isTrue(drawingGraphic.placement.angle.radians === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.x === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.low.y === 0.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.x === 2.0);
          assert.isTrue(drawingGraphic.placement.bbox.high.y === 2.0);
          assert.isDefined(drawingGraphic.geom);
        }
      }
      assert.isAtLeast(numDrawingGraphics, 1, "Expected query to find some DrawingGraphics");
      assert.isTrue(found25, "Expected to find a specific element");
      assert.isTrue(found26, "Expected to find a specific element");
    });
  });

  it("should be able to query for ViewDefinitionProps", () => {
    const viewDefinitionProps: ViewDefinitionProps[] = imodel2.views.queryViewDefinitionProps(); // query for all ViewDefinitions
    assert.isAtLeast(viewDefinitionProps.length, 3);
    assert.isTrue(viewDefinitionProps[0].classFullName.includes("ViewDefinition"));
    assert.isFalse(viewDefinitionProps[1].isPrivate);

    const spatialViewDefinitionProps = imodel2.views.queryViewDefinitionProps("BisCore.SpatialViewDefinition") as SpatialViewDefinitionProps[]; // limit query to SpatialViewDefinitions
    assert.isAtLeast(spatialViewDefinitionProps.length, 3);
    assert.exists(spatialViewDefinitionProps[2].modelSelectorId);
  });

  it("should iterate ViewDefinitions", () => {
    // imodel2 contains 3 SpatialViewDefinitions and no other views.
    let numViews = 0;
    let result = imodel2.views.iterateViews(IModelDb.Views.defaultQueryParams, (_view: ViewDefinition) => {
      ++numViews;
      return true;
    });

    expect(result).to.be.true;
    expect(numViews).to.equal(3);

    // Query specifically for spatial views
    numViews = 0;
    result = imodel2.views.iterateViews({ from: "BisCore.SpatialViewDefinition" }, (view: ViewDefinition) => {
      if (view.isSpatialView())
        ++numViews;

      return view.isSpatialView();
    });
    expect(result).to.be.true;
    expect(numViews).to.equal(3);

    // Query specifically for 2d views
    numViews = 0;
    result = imodel2.views.iterateViews({ from: "BisCore.ViewDefinition2d" }, (_view: ViewDefinition) => {
      ++numViews;
      return true;
    });

    expect(result).to.be.true;
    expect(numViews).to.equal(0);

    // Terminate iteration on first view
    numViews = 0;
    result = imodel2.views.iterateViews(IModelDb.Views.defaultQueryParams, (_view: ViewDefinition) => {
      ++numViews;
      return false;
    });

    expect(result).to.be.false;
    expect(numViews).to.equal(1);
  });

  it("should be children of RootSubject", () => {
    const sql = `SELECT ECInstanceId FROM ${Model.classFullName} WHERE ParentModel.Id=:parentModelId`;
    imodel2.withPreparedStatement(sql, (statement: ECSqlStatement): void => {
      statement.bindId("parentModelId", IModel.repositoryModelId);
      let numModels = 0;
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        numModels++;
        const modelId = statement.getValue(0).getId();
        const model = imodel2.models.getModel(modelId);
        assert.exists(model, "Model should exist");
        assert.isTrue(model instanceof Model);

        // should be an element with the same Id.
        const modeledElement = imodel2.elements.getElement(modelId);
        assert.exists(modeledElement, "Modeled Element should exist");

        if (model.className === "LinkModel") {
          // expect LinkModel to be accompanied by LinkPartition
          assert.isTrue(modeledElement instanceof LinkPartition);
          continue;
        } else if (model.className === "DictionaryModel") {
          assert.isTrue(modeledElement instanceof DefinitionPartition);
          continue;
        } else if (model.className === "PhysicalModel") {
          assert.isTrue(modeledElement instanceof PhysicalPartition);
          continue;
        } else if (model.className === "GroupModel") {
          assert.isTrue(modeledElement instanceof GroupInformationPartition);
          continue;
        } else if (model.className === "DocumentListModel") {
          assert.isTrue(modeledElement instanceof DocumentPartition);
          continue;
        } else if (model.className === "DefinitionModel") {
          assert.isTrue(modeledElement instanceof DefinitionPartition);
          continue;
        } else {
          assert.isTrue(false, "Expected a known model type");
        }
      }
      assert.isAtLeast(numModels, 1, "Expected query to find some Models");
    });
  });

  it("should insert and update auto-handled properties", () => {
    const testElem = imodel4.elements.getElement("0x14");
    assert.isDefined(testElem);
    assert.equal(testElem.classFullName, "DgnPlatformTest:TestElementWithNoHandler");
    assert.isUndefined(testElem.asAny.integerProperty1);

    const newTestElem = roundtripThroughJson(testElem) as Element;
    assert.equal(newTestElem.classFullName, testElem.classFullName);
    newTestElem.asAny.integerProperty1 = 999;
    assert.isTrue(testElem.asAny.arrayOfPoint3d[0].isAlmostEqual(newTestElem.asAny.arrayOfPoint3d[0]));

    const loc1 = { street: "Elm Street", city: { name: "Downingtown", state: "PA" } };
    const loc2 = { street: "Oak Street", city: { name: "Downingtown", state: "PA" } };
    const loc3 = { street: "Chestnut Street", city: { name: "Philadelphia", state: "PA" } };
    const arrayOfStructs = [loc2, loc3];
    newTestElem.asAny.location = loc1;
    newTestElem.asAny.arrayOfStructs = arrayOfStructs;
    newTestElem.asAny.dtUtc = new Date("2015-03-25");
    newTestElem.asAny.p3d = new Point3d(1, 2, 3);

    const newTestElemId = imodel4.elements.insertElement(newTestElem.toJSON());

    assert.isTrue(Id64.isValidId64(newTestElemId), "insert worked");

    const newTestElemFetched = imodel4.elements.getElement(newTestElemId);
    assert.isDefined(newTestElemFetched);
    assert.isTrue(newTestElemFetched.id === newTestElemId);
    assert.equal(newTestElemFetched.classFullName, newTestElem.classFullName);
    assert.isDefined(newTestElemFetched.asAny.integerProperty1);
    assert.equal(newTestElemFetched.asAny.integerProperty1, newTestElem.asAny.integerProperty1);
    assert.isTrue(newTestElemFetched.asAny.arrayOfPoint3d[0].isAlmostEqual(newTestElem.asAny.arrayOfPoint3d[0]));
    assert.deepEqual(newTestElemFetched.asAny.location, loc1);
    assert.deepEqual(newTestElem.asAny.arrayOfStructs, arrayOfStructs);
    // TODO: getElement must convert date ISO string to Date object    assert.deepEqual(newTestElemFetched.dtUtc, newTestElem.dtUtc);
    assert.deepEqual(newTestElemFetched.asAny.dtUtc, newTestElem.asAny.dtUtc.toJSON());
    assert.isTrue(newTestElemFetched.asAny.p3d.isAlmostEqual(newTestElem.asAny.p3d));

    // ----------- updates ----------------
    const wasp3d = newTestElemFetched.asAny.p3d;
    const editElem = newTestElemFetched;
    editElem.asAny.location = loc2;
    try {
      imodel4.elements.updateElement(editElem.toJSON());
    } catch {
      assert.fail("Element.update failed");
    }
    const afterUpdateElemFetched = imodel4.elements.getElement(editElem.id);
    assert.deepEqual(afterUpdateElemFetched.asAny.location, loc2, " location property should be the new one");
    assert.deepEqual(afterUpdateElemFetched.asAny.id, editElem.id, " the id should not have changed.");
    assert.deepEqual(afterUpdateElemFetched.asAny.p3d, wasp3d, " p3d property should not have changed");

    // Make array shorter
    assert.equal(afterUpdateElemFetched.asAny.arrayOfInt.length, 300);

    afterUpdateElemFetched.asAny.arrayOfInt = [99, 3];
    imodel4.elements.updateElement(afterUpdateElemFetched.toJSON());

    const afterShortenArray = imodel4.elements.getElement(afterUpdateElemFetched.id);
    assert.equal(afterUpdateElemFetched.asAny.arrayOfInt.length, 2);
    assert.deepEqual(afterShortenArray.asAny.arrayOfInt, [99, 3]);

    // Make array longer
    afterShortenArray.asAny.arrayOfInt = [1, 2, 3];
    imodel4.elements.updateElement(afterShortenArray.toJSON());
    const afterLengthenArray = imodel4.elements.getElement(afterShortenArray.id);
    assert.equal(afterLengthenArray.asAny.arrayOfInt.length, 3);
    assert.deepEqual(afterLengthenArray.asAny.arrayOfInt, [1, 2, 3]);

    // ------------ delete -----------------
    const elid = afterUpdateElemFetched.id;
    imodel4.elements.deleteElement(elid);
    assert.throws(() => imodel4.elements.getElement(elid), IModelError);
  });

  it("should handle parent and child deletion properly", () => {
    const categoryId = SpatialCategory.insert(imodel4, IModel.dictionaryId, "MyTestCategory", new SubCategoryAppearance());
    const category = imodel4.elements.getElement<SpatialCategory>(categoryId);
    const subCategory = imodel4.elements.getElement<SubCategory>(category.myDefaultSubCategoryId());
    expect(() => imodel4.elements.deleteElement(categoryId)).throws("error deleting element").to.have.property("metadata");
    assert.exists(imodel4.elements.getElement(categoryId), "Category deletes should be blocked in native code");
    assert.exists(imodel4.elements.getElement(subCategory.id), "Children should not be deleted if parent delete is blocked");

    const modelId = PhysicalModel.insert(imodel4, IModel.rootSubjectId, "MyTestPhysicalModel");
    const elementProps: GeometricElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
    };
    const parentId = imodel4.elements.insertElement(elementProps);
    elementProps.parent = new ElementOwnsChildElements(parentId);
    const childId1 = imodel4.elements.insertElement(elementProps);
    const childId2 = imodel4.elements.insertElement(elementProps);
    assert.exists(imodel4.elements.getElement(parentId));
    assert.exists(imodel4.elements.getElement(childId1));
    assert.exists(imodel4.elements.getElement(childId2));
    imodel4.elements.deleteElement(parentId);
    assert.throws(() => imodel4.elements.getElement(parentId), IModelError);
    assert.throws(() => imodel4.elements.getElement(childId1), IModelError);
    assert.throws(() => imodel4.elements.getElement(childId2), IModelError);
  });

  function checkElementMetaData(obj: EntityMetaData) {
    assert.isNotNull(obj);
    assert.equal(obj.ecclass, Element.classFullName);
    assert.isArray(obj.baseClasses);
    assert.equal(obj.baseClasses.length, 0);

    assert.isArray(obj.customAttributes);
    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    if (obj.customAttributes !== undefined) {
      for (const ca of obj.customAttributes) {
        if (ca.ecclass === "BisCore:ClassHasHandler")
          foundClassHasHandler = true;
        else if (ca.ecclass === "CoreCustomAttributes:ClassHasCurrentTimeStampProperty")
          foundClassHasCurrentTimeStampProperty = true;
      }
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    assert.isDefined(obj.properties.federationGuid);
    assert.equal(obj.properties.federationGuid.primitiveType, 257);
    assert.equal(obj.properties.federationGuid.extendedType, "BeGuid");
  }

  it("should get metadata for class", () => {
    const metaData: EntityMetaData = imodel1.getMetaData(Element.classFullName);
    assert.exists(metaData);
    checkElementMetaData(metaData);
  });

  it("update the project extents", async () => {
    const originalExtents = imodel1.projectExtents;
    const newExtents = Range3d.create(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50;
    newExtents.low.y -= 25;
    newExtents.low.z -= 189;
    newExtents.high.x += 1087;
    newExtents.high.y += 19;
    newExtents.high.z += .001;
    imodel1.updateProjectExtents(newExtents);

    const updatedProps = imodel1[_nativeDb].getIModelProps();
    assert.isTrue(updatedProps.hasOwnProperty("projectExtents"), "Returned property JSON object has project extents");
    const updatedExtents = Range3d.fromJSON(updatedProps.projectExtents);
    assert.isTrue(newExtents.isAlmostEqual(updatedExtents), "Project extents successfully updated in database");
  });

  it("read view thumbnail", () => {
    const viewId = "0x24";
    const thumbnail = imodel5.views.getThumbnail(viewId);
    assert.exists(thumbnail);
    if (!thumbnail)
      return;
    assert.equal(thumbnail.format, "jpeg");
    assert.equal(thumbnail.height, 768);
    assert.equal(thumbnail.width, 768);
    assert.equal(thumbnail.image.length, 18062);

    thumbnail.width = 100;
    thumbnail.height = 200;
    thumbnail.format = "png";
    thumbnail.image = new Uint8Array(200);
    thumbnail.image.fill(12);
    const stat = imodel5.views.saveThumbnail(viewId, thumbnail);
    assert.equal(stat, 0, "save thumbnail");

    const thumbnail2 = imodel5.views.getThumbnail(viewId);
    assert.exists(thumbnail2);
    if (!thumbnail2)
      return;
    assert.equal(thumbnail2.format, "png");
    assert.equal(thumbnail2.height, 200);
    assert.equal(thumbnail2.width, 100);
    assert.equal(thumbnail2.image.length, 200);
    assert.equal(thumbnail2.image[0], 12);
  });

  it("ecefLocation for iModels", () => {
    assert.isTrue(imodel5.isGeoLocated);
    const center = { x: 289095, y: 3803860, z: 10 }; // near center of project extents, 10 meters above ground.
    const ecefPt = imodel5.spatialToEcef(center);
    const pt = { x: -3575156.3661052254, y: 3873432.0891543664, z: 3578996.012643183 };
    assert.isTrue(ecefPt.isAlmostEqual(pt), "spatialToEcef");

    const z2 = imodel5.ecefToSpatial(ecefPt);
    assert.isTrue(z2.isAlmostEqual(center), "ecefToSpatial");

    const carto = imodel5.spatialToCartographicFromEcef(center);
    assert.approximately(carto.longitudeDegrees, 132.70683882277805, .1); // this data is in Japan
    assert.approximately(carto.latitudeDegrees, 34.35462768786055, .1);
    const c2 = { longitude: 2.3161712773709127, latitude: 0.5996013664499733, height: 10 };
    assert.isTrue(carto.equalsEpsilon(c2, .001), "spatialToCartographic");

    imodel5.cartographicToSpatialFromEcef(carto, z2);
    assert.isTrue(z2.isAlmostEqual(center, .001), "cartographicToSpatial");

    assert.isTrue(imodel5.geographicCoordinateSystem !== undefined);
    assert.isTrue(imodel5.geographicCoordinateSystem!.horizontalCRS !== undefined);
    assert.isTrue(imodel5.geographicCoordinateSystem!.verticalCRS !== undefined);
    assert.isTrue(imodel5.geographicCoordinateSystem!.verticalCRS!.id !== undefined);
    assert.isTrue(imodel5.geographicCoordinateSystem!.horizontalCRS!.id === "UTM84-53N");
    assert.isTrue(imodel5.geographicCoordinateSystem!.verticalCRS!.id === "ELLIPSOID");
  });

  function checkClassHasHandlerMetaData(obj: EntityMetaData) {
    assert.isDefined(obj.properties.restrictions);
    assert.equal(obj.properties.restrictions.primitiveType, 2305);
    assert.equal(obj.properties.restrictions.minOccurs, 0);
  }

  it("should get metadata for CA class just as well (and we'll see a array-typed property)", () => {
    const metaData: EntityMetaData = imodel1.getMetaData("BisCore:ClassHasHandler");
    assert.exists(metaData);
    checkClassHasHandlerMetaData(metaData);
  });

  it("should get metadata for CA class just as well (and we'll see a array-typed property)", () => {
    const metaData = imodel1.getMetaData("BisCore:ClassHasHandler");
    assert.exists(metaData);
    checkClassHasHandlerMetaData(metaData);
  });

  it("should exercise ECSqlStatement (backend only)", () => {
    // Reject an invalid statement
    try {
      imodel2.prepareStatement("select no_such_property, codeValue from bis.element", false);
      assert.fail("prepare should have failed with an exception");
    } catch (err: any) {
      assert.isTrue(err.constructor.name === "IModelError");
      assert.notEqual(err.status, DbResult.BE_SQLITE_OK);
    }
    let lastId: string = "";
    let firstCodeValue: string = "";
    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element", (stmt: ECSqlStatement) => {
      assert.isNotNull(stmt);
      // Reject an attempt to bind when there are no placeholders in the statement
      try {
        stmt.bindStruct(1, { foo: 1 });
        assert.fail("bindStruct should have failed with an exception");
      } catch (err2: any) {
        assert.isTrue(err2.constructor.name === "IModelError");
        assert.notEqual(err2.status, DbResult.BE_SQLITE_OK);
      }

      // Verify that we get a bunch of rows with the expected shape
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const row = stmt.getRow();
        assert.isNotNull(row);
        assert.isObject(row);
        assert.isTrue(row.id !== undefined);
        assert.isTrue(Id64.isValid(Id64.fromJSON(row.id)));
        lastId = row.id;
        if (row.codeValue !== undefined)
          firstCodeValue = row.codeValue;
        count = count + 1;
      }
      assert.isTrue(count > 1);
      assert.notEqual(lastId, "");
      assert.notEqual(firstCodeValue, "");

      // Try iterator style
      let firstCodeValueIter: string = "";
      let iteratorCount = 0;
      let lastIterId: string = "";
      stmt.reset();
      for (const row of stmt) {
        assert.isNotNull(row);
        assert.isObject(row);
        assert.isTrue(row.id !== undefined);
        assert.isTrue(Id64.isValid(Id64.fromJSON(row.id)));
        lastIterId = row.id;
        iteratorCount = iteratorCount + 1;
        if (row.codeValue !== undefined)
          firstCodeValueIter = row.codeValue;
      }
      assert.equal(iteratorCount, count, "iterator loop should find the same number of rows as the step loop");
      assert.equal(lastIterId, lastId, "iterator loop should see the same last row as the step loop");
      assert.equal(firstCodeValueIter, firstCodeValue, "iterator loop should find the first non-null code value as the step loop");
    });

    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element WHERE (ecinstanceid=?)", (stmt3: ECSqlStatement) => {
      // Now try a statement with a placeholder
      const idToFind = Id64.fromJSON(lastId);
      stmt3.bindId(1, idToFind);
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt3.step()) {
        count = count + 1;
        const row = stmt3.getRow();
        // Verify that we got the row that we asked for
        assert.isTrue(idToFind === Id64.fromJSON(row.id));
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

    let firstCodeValueId: Id64String | undefined;
    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element WHERE (codeValue = :codevalue)", (stmt4: ECSqlStatement) => {
      // Try a named placeholder
      const codeValueToFind = firstCodeValue;
      stmt4.bindString("codeValue", codeValueToFind);
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt4.step()) {
        count = count + 1;
        const row = stmt4.getRow();
        // Verify that we got the row that we asked for
        assert.equal(row.codeValue, codeValueToFind);
        firstCodeValueId = row.id;
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

    // make sure we can use parameterized values for queryEnityId (test on parameterized codevalue)
    const ids = imodel2.queryEntityIds({ from: "bis.element", where: "codevalue=:cv", bindings: { cv: firstCodeValue } });
    assert.equal(ids.values().next().value, firstCodeValueId);

    imodel2.withPreparedStatement("select ecinstanceid as id, codevalue from bis.element", (stmt5: ECSqlStatement) => {
      while (DbResult.BE_SQLITE_ROW === stmt5.step()) {
        imodel2.withPreparedStatement("select codevalue from bis.element where ecinstanceid=?", (stmt6: ECSqlStatement) => {
          stmt6.bindId(1, stmt5.getRow().id);
          while (DbResult.BE_SQLITE_ROW === stmt6.step()) {
            assert.equal(stmt6.getRow().codevalue, stmt5.getRow().codevalue);
          }
        });
      }
    });

    // make sure queryEnityIds works fine when all params are specified
    const physicalObjectIds = imodel2.queryEntityIds({ from: "generic.PhysicalObject", where: "codevalue is null", limit: 1, offset: 1, only: true, orderBy: "ecinstanceid desc" });
    assert.equal(physicalObjectIds.size, 1);
  });

  it("validate BisCodeSpecs", async () => {
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.nullCodeSpec).scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.subCategory).scopeType, CodeScopeSpec.Type.ParentElement);
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.viewDefinition).scopeType, CodeScopeSpec.Type.Model);
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.subject).scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);
  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = imodel2;
    const codeSpec = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId = testImodel.codeSpecs.insert(codeSpec); // throws in case of error
    assert.deepEqual(codeSpecId, codeSpec.id);
    assert.equal(codeSpec.scopeType, CodeScopeSpec.Type.Model);
    assert.equal(codeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);

    // Should not be able to insert a duplicate.
    const codeSpecDup = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
    assert.throws(() => testImodel.codeSpecs.insert(codeSpecDup), "CodeSpec already exists");

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2 = CodeSpec.create(testImodel, "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec2Id = testImodel.codeSpecs.insert(codeSpec2); // throws in case of error
    assert.deepEqual(codeSpec2Id, codeSpec2.id);
    assert.notDeepEqual(codeSpec2Id, codeSpecId);

    // make sure CodeScopeSpec.Type.Repository works
    const codeSpec3 = CodeSpec.create(testImodel, "CodeSpec3", CodeScopeSpec.Type.Repository, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec3Id = testImodel.codeSpecs.insert(codeSpec3); // throws in case of error
    assert.notDeepEqual(codeSpec2Id, codeSpec3Id);

    const codeSpec4 = testImodel.codeSpecs.getById(codeSpec3Id);
    codeSpec4.name = "CodeSpec4";
    const codeSpec4Id = testImodel.codeSpecs.insert(codeSpec4); // throws in case of error
    assert.notDeepEqual(codeSpec3Id, codeSpec4Id);
    assert.equal(codeSpec4.scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(codeSpec4.scopeReq, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const copyOfCodeSpec4 = testImodel.codeSpecs.getById(codeSpec4Id);
    assert.deepEqual(codeSpec4, copyOfCodeSpec4);

    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec1"));
    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec2"));
    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec3"));
    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec4"));
    assert.isFalse(testImodel.codeSpecs.hasName("CodeSpec5"));

    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec.id));
    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec2.id));
    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec3.id));
    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec4.id));
    assert.isFalse(testImodel.codeSpecs.hasId(Id64.invalid));
  });

  it("validate CodeSpec properties", async () => {
    const iModelFileName: string = IModelTestUtils.prepareOutputFile("IModel", "ReadWriteCodeSpec.bim");
    const codeSpecName = "CodeSpec1";

    // Write new CodeSpec to iModel
    if (true) {
      const iModelDb = IModelTestUtils.createSnapshotFromSeed(iModelFileName, IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim"));
      const codeSpec = CodeSpec.create(iModelDb, codeSpecName, CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
      const codeSpecId = iModelDb.codeSpecs.insert(codeSpec);
      assert.isTrue(Id64.isValidId64(codeSpec.id));
      assert.equal(codeSpec.id, codeSpecId);
      assert.equal(codeSpec.name, codeSpecName);
      assert.equal(codeSpec.scopeType, CodeScopeSpec.Type.Model);
      assert.equal(codeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.FederationGuid);
      iModelDb.saveChanges();
      iModelDb.close();
    }

    // Reopen iModel (ensure CodeSpec cache is cleared) and reconfirm CodeSpec properties
    if (true) {
      const iModelDb = SnapshotDb.openFile(iModelFileName);
      const codeSpec = iModelDb.codeSpecs.getByName(codeSpecName);
      assert.isTrue(Id64.isValidId64(codeSpec.id));
      assert.equal(codeSpec.name, codeSpecName);
      assert.equal(codeSpec.scopeType, CodeScopeSpec.Type.Model);
      assert.equal(codeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.FederationGuid);
      iModelDb.close();
    }
  });

  it("snapping", async () => {
    const worldToView = Matrix4d.createIdentity();
    const response = await imodel2.requestSnap("0x222", { testPoint: { x: 1, y: 2, z: 3 }, closePoint: { x: 1, y: 2, z: 3 }, id: "0x111", worldToView: worldToView.toJSON() });
    assert.isDefined(response.status);
  });

  it("should import schemas", async () => {
    const classMetaData = imodel1.getMetaData("TestBim:TestDocument"); // will throw on failure
    assert.isDefined(classMetaData.properties.testDocumentProperty);
    assert.isTrue(classMetaData.properties.testDocumentProperty.primitiveType === PrimitiveTypeCode.Integer);
  });

  it("should do CRUD on models", () => {

    const testImodel = imodel2;

    const [modeledElementId, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, Code.createEmpty(), true);

    const newModelPersist = testImodel.models.getModel(newModelId);

    // Check that it has the properties that we set.
    assert.equal(newModelPersist.classFullName, PhysicalModel.classFullName);
    assert.isTrue(newModelPersist.isPrivate);
    assert.deepEqual(newModelPersist.modeledElement.id, modeledElementId);

    // Update the model
    newModelPersist.isPrivate = false;
    testImodel.models.updateModel(newModelPersist.toJSON());
    //  ... and check that it updated the model in the db
    const newModelPersist2 = testImodel.models.getModel(newModelId);
    assert.isFalse(newModelPersist2.isPrivate);

    // Delete the model
    testImodel.models.deleteModel(newModelId);

    // Test insertModel error handling
    assert.throws(() => {
      testImodel.models.insertModel({
        classFullName: DefinitionModel.classFullName,
        modeledElement: { id: "0x10000000bad" },
      });
    }, IModelError);
  });

  it("should create model with custom relationship to modeled element", async () => {
    const testImodel = imodel1;

    assert.isDefined(testImodel.getMetaData("TestBim:TestModelModelsElement"), "TestModelModelsElement is expected to be defined in TestBim.ecschema.xml");

    let newModelId1: Id64String;
    let newModelId2: Id64String;
    let relClassName1: string | undefined;
    let relClassName2: string | undefined;

    if (true) {
      const newPartition1 = IModelTestUtils.createAndInsertPhysicalPartition(testImodel, Code.createEmpty());
      relClassName1 = "TestBim:TestModelModelsElement";
      const modeledElementRef = new RelatedElement({ id: newPartition1, relClassName: relClassName1 });
      newModelId1 = IModelTestUtils.createAndInsertPhysicalModel(testImodel, modeledElementRef);
      assert.isTrue(Id64.isValidId64(newModelId1));
    }

    if (true) {
      [, newModelId2] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, Code.createEmpty());
      const newModel2 = testImodel.models.getModel(newModelId2);
      relClassName2 = newModel2.modeledElement.relClassName;
    }

    const model1 = testImodel.models.getModel(newModelId1);
    const model2 = testImodel.models.getModel(newModelId2);

    const foundRelClassName1 = model1.modeledElement.relClassName;
    const foundRelClassName2 = model2.modeledElement.relClassName;

    assert.equal(foundRelClassName1, relClassName1);
    assert.equal(foundRelClassName2, relClassName2);
  });

  it("should create link table relationship instances", () => {
    const snapshotFile2: string = IModelTestUtils.prepareOutputFile("IModel", "CreateLinkTable.bim");
    const testImodel = StandaloneDb.createEmpty(snapshotFile2, { rootSubject: { name: "test1" }, allowEdit: JSON.stringify({ txns: true }) });
    const elements = testImodel.elements;

    // Create a new physical model
    const newModelId = PhysicalModel.insert(testImodel, IModel.rootSubjectId, "TestModel");

    // create a SpatialCategory
    const spatialCategoryId = SpatialCategory.insert(testImodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));

    // Create a couple of physical elements.
    const elementProps: GeometricElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: newModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
    };

    const id0 = elements.insertElement(elementProps);
    const id1 = elements.insertElement(elementProps);
    const id2 = elements.insertElement(elementProps);

    const geometricModel = testImodel.models.getModel<GeometricModel>(newModelId);
    assert.throws(() => geometricModel.queryExtents()); // no geometry

    // Create grouping relationships from 0 to 1 and from 0 to 2
    const r1 = ElementGroupsMembers.create(testImodel, id0, id1, 1);
    r1.insert();
    const r2 = ElementGroupsMembers.create(testImodel, id0, id2);
    r2.insert();

    // Look up by id
    const g1 = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, r1.id);
    const g2 = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, r2.id);

    assert.deepEqual(g1.id, r1.id);
    assert.equal(g1.classFullName, ElementGroupsMembers.classFullName);
    assert.equal(g1.memberPriority, 1, "g1.memberPriority");
    assert.deepEqual(g2.id, r2.id);
    assert.equal(g2.classFullName, ElementGroupsMembers.classFullName);
    assert.equal(g2.memberPriority, 0, "g2.memberPriority");  // The memberPriority parameter defaults to 0 in ElementGroupsMembers.create

    // Look up by source and target
    const g1byst = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, { sourceId: r1.sourceId, targetId: r1.targetId });
    assert.deepEqual(g1byst, g1);

    // Update relationship instance property
    r1.asAny.memberPriority = 2;
    r1.update();

    const g11 = ElementGroupsMembers.getInstance<ElementGroupsMembers>(testImodel, r1.id);
    assert.equal(g11.memberPriority, 2, "g11.memberPriority");
    testImodel.saveChanges("step 1");

    // Delete relationship instance property
    g11.delete();
    testImodel.saveChanges("step 2");
    assert.throws(() => ElementGroupsMembers.getInstance(testImodel, r1.id), IModelError);

    const d0 = elements.insertElement(elementProps);
    const d1 = elements.insertElement(elementProps);
    const ede1 = ElementDrivesElement.create(testImodel, d0, d1, 0);
    ede1.insert();
    testImodel.saveChanges("step 3");

    ede1.delete();
    testImodel.saveChanges("step 4");
    testImodel.close();
  });

  it("should insert DefinitionSets", () => {
    const iModelFileName: string = IModelTestUtils.prepareOutputFile("IModel", "DefinitionSets.bim");
    const iModelDb = SnapshotDb.createEmpty(iModelFileName, { rootSubject: { name: "DefinitionSets" }, createClassViews: true });
    const definitionContainerId = DefinitionContainer.insert(iModelDb, IModel.dictionaryId, Code.createEmpty());
    assert.exists(iModelDb.elements.getElement<DefinitionContainer>(definitionContainerId));
    assert.exists(iModelDb.models.getModel<DefinitionModel>(definitionContainerId));
    const categoryId1 = SpatialCategory.insert(iModelDb, definitionContainerId, "Category1", new SubCategoryAppearance());
    const categoryId2 = SpatialCategory.insert(iModelDb, definitionContainerId, "Category2", new SubCategoryAppearance());
    const categoryId3 = SpatialCategory.insert(iModelDb, definitionContainerId, "Category3", new SubCategoryAppearance());
    const definitionGroupId = DefinitionGroup.create(iModelDb, definitionContainerId, Code.createEmpty()).insert();
    DefinitionGroupGroupsDefinitions.insert(iModelDb, definitionGroupId, categoryId1);
    DefinitionGroupGroupsDefinitions.insert(iModelDb, definitionGroupId, categoryId2);
    DefinitionGroupGroupsDefinitions.insert(iModelDb, definitionGroupId, categoryId3);
    const numMembers = iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${DefinitionGroupGroupsDefinitions.classFullName}`, (statement: ECSqlStatement): number => {
      return statement.step() === DbResult.BE_SQLITE_ROW ? statement.getValue(0).getInteger() : 0;
    });
    assert.equal(numMembers, 3);
    iModelDb.saveChanges();
    iModelDb.close();
  });

  it("should set EC properties of various types", async () => {

    const testImodel = imodel1;
    testImodel.getMetaData("TestBim:TestPhysicalObject");

    // Create a new physical model
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(testImodel, Code.createEmpty(), true);

    // Find or create a SpatialCategory
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(testImodel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId) {
      spatialCategoryId = SpatialCategory.insert(testImodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance());
    }

    const trelClassName = "TestBim:TestPhysicalObjectRelatedToTestPhysicalObject";

    let id1: Id64String;
    let id2: Id64String;

    if (true) {
      // Create a couple of TestPhysicalObjects
      const elementProps: GeometricElementProps = {
        classFullName: "TestBim:TestPhysicalObject",
        model: newModelId,
        category: spatialCategoryId,
        code: Code.createEmpty(),
      };

      id1 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
      assert.isTrue(Id64.isValidId64(id1));

      // The second one should point to the first.
      elementProps.id = Id64.invalid;
      (elementProps as any).relatedElement = { id: id1, relClassName: trelClassName };
      elementProps.parent = { id: id1, relClassName: trelClassName };
      (elementProps as any).longProp = 4294967295;     // make sure that we can save values in the range 0 ... UINT_MAX

      id2 = testImodel.elements.insertElement(testImodel.elements.createElement(elementProps).toJSON());
      assert.isTrue(Id64.isValidId64(id2));
    }

    if (true) {
      // Test that el2 points to el1
      const el2 = testImodel.elements.getElement(id2);
      assert.equal(el2.classFullName, "TestBim:TestPhysicalObject");
      assert.isTrue("relatedElement" in el2);
      assert.isTrue("id" in el2.asAny.relatedElement);
      assert.deepEqual(el2.asAny.relatedElement.id, id1);
      assert.equal(el2.asAny.longProp, 4294967295);

      // Even though I didn't set it, the platform knows the relationship class and reports it.
      assert.isTrue("relClassName" in el2.asAny.relatedElement);
      assert.equal(el2.asAny.relatedElement.relClassName.replace(".", ":"), trelClassName);
    }

    if (true) {
      // Change el2 to point to itself.
      const el2Modified = testImodel.elements.getElement(id2);
      el2Modified.asAny.relatedElement = { id: id2, relClassName: trelClassName };
      testImodel.elements.updateElement(el2Modified.toJSON());
      // Test that el2 points to itself.
      const el2after: Element = testImodel.elements.getElement(id2);
      assert.deepEqual(el2after.asAny.relatedElement.id, id2);
      assert.equal(el2after.asAny.relatedElement.relClassName.replace(".", ":"), trelClassName);
    }

    if (true) {
      // Test that we can null out the navigation property
      const el2Modified = testImodel.elements.getElement(id2);
      el2Modified.asAny.relatedElement = null;
      testImodel.elements.updateElement(el2Modified.toJSON());
      // Test that el2 has no relatedElement property value
      const el2after: Element = testImodel.elements.getElement(id2);
      assert.isUndefined(el2after.asAny.relatedElement);
    }
  });

  it("should be able to create a snapshot IModel", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const iModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot.bim"), args);
    assert.equal(iModel.iModelId, args.guid);
    assert.equal(iModel.rootSubject.name, args.rootSubject.name);
    assert.equal(iModel.rootSubject.description, args.rootSubject.description);
    assert.equal(iModel.projectExtents.low.x, args.projectExtents.low.x);
    assert.equal(iModel.projectExtents.low.y, args.projectExtents.low.y);
    assert.equal(iModel.projectExtents.low.z, args.projectExtents.low.z);
    assert.equal(iModel.globalOrigin.x, args.globalOrigin.x);
    assert.equal(iModel.globalOrigin.y, args.globalOrigin.y);
    assert.equal(iModel.globalOrigin.z, 0);

    const client = iModel.queryFilePropertyString({ name: "Client", namespace: "dgn_Db" });
    assert.equal(client, args.client, "query Client property");

    const dbguid = iModel.queryFilePropertyBlob({ name: "DbGuid", namespace: "be_Db" });
    assert.equal(dbguid!.byteLength, 16, "query guid property");

    const myPropsStr: FilePropertyProps = { name: "MyProp", namespace: "test1", id: 1, subId: 1 };
    const myStrVal = "this is a test";
    iModel.saveFileProperty(myPropsStr, myStrVal);
    const readFromDb = iModel.queryFilePropertyString(myPropsStr);
    assert.equal(readFromDb, myStrVal, "query string after save");

    const myPropsBlob: FilePropertyProps = { name: "MyBlob", namespace: "test1", id: 10 };
    const testRange = new Uint8Array(500);
    testRange.fill(11);
    iModel.saveFileProperty(myPropsBlob, undefined, testRange);
    const blobFromDb = iModel.queryFilePropertyBlob(myPropsBlob);
    assert.deepEqual(blobFromDb, testRange, "query blob after save");

    let next = iModel.queryNextAvailableFileProperty(myPropsBlob);
    assert.equal(11, next, "queryNextAvailableFileProperty blob");

    next = iModel.queryNextAvailableFileProperty(myPropsStr);
    assert.equal(2, next, "queryNextAvailableFileProperty str");
    iModel.deleteFileProperty(myPropsStr);
    assert.isUndefined(iModel.queryFilePropertyString(myPropsStr), "property was deleted");
    next = iModel.queryNextAvailableFileProperty(myPropsStr);
    assert.equal(0, next, "queryNextAvailableFileProperty, should return 0 when none present");

    const testLocal = "TestLocal";
    const testValue = "this is a test";
    const nativeDb = iModel[_nativeDb];
    assert.isUndefined(nativeDb.queryLocalValue(testLocal));
    nativeDb.saveLocalValue(testLocal, testValue);
    assert.equal(nativeDb.queryLocalValue(testLocal), testValue);

    iModel.close();
  });

  it("should be able to create a snapshot IModel and set geolocation by GCS", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const gcs = new GeographicCRS({
      horizontalCRS: {
        id: "10TM115-27",
        description: "",
        source: "Mentor Software Client",
        deprecated: false,
        datumId: "NAD27",
        unit: "Meter",
        projection: {
          method: "TransverseMercator",
          centralMeridian: -115,
          latitudeOfOrigin: 0,
          scaleFactor: 0.9992,
          falseEasting: 0.0,
          falseNorthing: 0.0,
        },
        extent: {
          southWest: { latitude: 48, longitude: -120.5 },
          northEast: { latitude: 84, longitude: -109.5 },
        },
      },
      verticalCRS: { id: "GEOID" },
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 10.0,
          translationY: 15.0,
          translationZ: 0.02,
          rotDeg: 1.2,
          scale: 1.0001,
        },
      },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot2.bim");
    const iModel = SnapshotDb.createEmpty(testFile, args);

    let eventListenedTo = false;
    const gcsListener = (previousGCS: GeographicCRS | undefined) => {
      assert.equal(previousGCS, undefined);
      assert.isTrue(iModel.geographicCoordinateSystem !== undefined);
      assert.isTrue(iModel.geographicCoordinateSystem!.equals(gcs));
      eventListenedTo = true;
    };
    iModel.onGeographicCoordinateSystemChanged.addListener(gcsListener);

    assert.isTrue(iModel.geographicCoordinateSystem === undefined);

    assert.isFalse(eventListenedTo);

    iModel.geographicCoordinateSystem = gcs;

    assert.isTrue(eventListenedTo);

    iModel.updateIModelProps();
    iModel.saveChanges();
    iModel.close();

    const iModel2 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel2.geographicCoordinateSystem !== undefined);

    // The reloaded gcs will be different as the datum definition will have been expanded
    assert.isFalse(iModel2.geographicCoordinateSystem!.equals(gcs));

    // But other properties will be identical
    assert.isTrue(iModel2.geographicCoordinateSystem !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.verticalCRS !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.verticalCRS!.equals(gcs.verticalCRS!));
    assert.isTrue(iModel2.geographicCoordinateSystem!.additionalTransform !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.additionalTransform!.equals(gcs.additionalTransform!));
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.projection !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.projection!.equals(gcs.horizontalCRS!.projection!));
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.id !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.id === gcs.horizontalCRS!.id!);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.extent !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.extent!.equals(gcs.horizontalCRS!.extent!));

    // The following were not in initial definition but were completed after storage.
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.datum !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.datum!.additionalTransformPaths !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.datum!.additionalTransformPaths!.length >= 0);

    // When a gcs is present then the ECEF is automatically defined.
    assert.isTrue(iModel2.ecefLocation !== undefined);

    iModel2.close();
  });

  if (!ProcessDetector.isIOSAppBackend) {
    it("should be able to reproject with iModel coordinates to or from any other GeographicCRS", async () => {
      const convertTest = async (fileName: string, fileGCS: GeographicCRSProps, datum: string | GeographicCRSProps, inputCoord: XYZProps, outputCoord: PointWithStatus) => {

        const args = {
          rootSubject: { name: "TestSubject", description: "test project" },
          client: "ABC Engineering",
          globalOrigin: { x: 0.0, y: 0.0 },
          projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
          guid: Guid.createValue(),
        };

        let datumOrGCS: string;
        if (typeof datum === "object")
          datumOrGCS = JSON.stringify(datum);
        else
          datumOrGCS = datum;

        const testFile = IModelTestUtils.prepareOutputFile("IModel", fileName);
        const iModel = SnapshotDb.createEmpty(testFile, args);

        iModel.setGeographicCoordinateSystem(fileGCS);
        iModel.updateIModelProps();
        iModel.saveChanges();

        const testPoint1: XYZProps[] = [];
        testPoint1.push(inputCoord);
        const requestProps1: GeoCoordinatesRequestProps = { target: datumOrGCS, iModelCoords: testPoint1 };
        const response1 = await iModel.getGeoCoordinatesFromIModelCoordinates(requestProps1);

        expect(response1.geoCoords[0].s === outputCoord.s).to.be.true;

        // If success or warning we compare result
        if (outputCoord.s === GeoCoordStatus.Success || outputCoord.s === GeoCoordStatus.OutOfUsefulRange) {

          const expectedPt1 = Point3d.fromJSON(outputCoord.p);
          const outPt1 = Point3d.fromJSON(response1.geoCoords[0].p);

          expect(Geometry.isSamePoint3dXY(expectedPt1, outPt1)).to.be.true;
          expect(Math.abs(expectedPt1.z - outPt1.z) < 0.0001).to.be.true;

          // No point testing reversal when Out of useful range since reversibility is doubtful
          if (outputCoord.s !== GeoCoordStatus.OutOfUsefulRange) {
            const testPoint2: XYZProps[] = [];
            testPoint2.push(outputCoord.p);
            const requestProps2: IModelCoordinatesRequestProps = { source: datumOrGCS, geoCoords: testPoint2 };
            const response2 = await iModel.getIModelCoordinatesFromGeoCoordinates(requestProps2);

            const expectedPt2 = Point3d.fromJSON(inputCoord);
            const outPt2 = Point3d.fromJSON(response2.iModelCoords[0].p);

            expect(expectedPt2.distanceXY(outPt2) < 0.001).to.be.true;
            expect(Math.abs(expectedPt2.z - outPt2.z) < 0.001).to.be.true;
          }
        }

        iModel.close();
      };

      const EWRGCS: GeographicCRSProps = {
        horizontalCRS: {
          id: "EPSG:27700",
          description: "OSGB 1936 / British National Grid",
          source: "EPSG V6 [Large and medium scale topographic mapping and engin]",
          datumId: "EPSG:6277",
          datum: {
            id: "EPSG:6277",
            description: "OSGB36 - Use OSGB-7P-2. Consider OSGB/OSTN15 instead",
            deprecated: true,
            source: "EPSG V6.12 operation EPSG:1314 [EPSG]",
            ellipsoidId: "EPSG:7001",
            ellipsoid: {
              equatorialRadius: 6377563.396,
              polarRadius: 6356256.909237,
              id: "EPSG:7001",
              description: "Airy 1830",
              source: "EPSG, Version 6 [EPSG]",
            },
            transforms: [
              {
                method: "PositionalVector",
                sourceEllipsoid: {
                  equatorialRadius: 6377563.396,
                  polarRadius: 6356256.909237,
                  id: "EPSG:7001",
                },
                targetEllipsoid: {
                  equatorialRadius: 6378137,
                  polarRadius: 6356752.3142,
                  id: "WGS84",
                },
                positionalVector: {
                  delta: {
                    x: 446.448,
                    y: -125.157,
                    z: 542.06,
                  },
                  rotation: {
                    x: 0.15,
                    y: 0.247,
                    z: 0.842,
                  },
                  scalePPM: -20.489,
                },
              }],
          },
          unit: "Meter",
          projection: {
            method: "TransverseMercator",
            falseEasting: 400000,
            falseNorthing: -100000,
            centralMeridian: -2,
            latitudeOfOrigin: 49,
            scaleFactor: 0.999601272737422,
          },
          extent: {
            southWest: {
              latitude: 49.96,
              longitude: -7.56,
            },
            northEast: {
              latitude: 60.84,
              longitude: 1.78,
            },
          },
        },
        verticalCRS: {
          id: "ELLIPSOID",
        },
        additionalTransform: {
          helmert2DWithZOffset: {
            translationX: 284597.3343,
            translationY: 79859.4651,
            translationZ: 0,
            rotDeg: 0.5263624458992088,
            scale: 0.9996703340508721,
          },
        },
      };

      await convertTest("ExtonCampus1.bim", { horizontalCRS: { id: "EPSG:2272" }, verticalCRS: { id: "NAVD88" } }, "WGS84", { x: 775970.3155166894, y: 83323.24543981979, z: 130.74977547686285 }, { p: { x: -75.68712011112366, y: 40.06524845273591, z: 95.9769083 }, s: GeoCoordStatus.Success });

      await convertTest("UTM83-10-NGVD29-10.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NAVD88" } }, { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "NGVD29" } }, { x: 548296.472, y: 4179414.470, z: 0.8457 }, { p: { x: 548392.9689991799, y: 4179217.683834238, z: -0.0006774162750405877 }, s: GeoCoordStatus.Success });

      await convertTest("BritishNatGrid-EllipsoidHelmert1.bim", EWRGCS, "WGS84", { x: 199247.08883859176, y: 150141.68625139236, z: 0.0 }, { p: { x: -0.80184489371471, y: 51.978341907041205, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("BritishNatGrid-Ellipsoid1.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: 170370.718, y: 11572.405, z: 0.0 }, { p: { x: -5.2020119082059511, y: 49.959453295440234, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("BritishNatGrid-Ellipsoid2.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, "ETRF89", { x: 170370.718, y: 11572.405, z: 0.0 }, { p: { x: -5.2030365061523707, y: 49.960007477936202, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("BritishNatGrid-Ellipsoid3.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, "OSGB", { x: 170370.718, y: 11572.405, z: 0.0 }, { p: { x: -5.2020119082059511, y: 49.959453295440234, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("GermanyDHDN-3-Ellipsoid1.bim", { horizontalCRS: { id: "DHDN/3.GK3d-4/EN" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: 4360857.005, y: 5606083.067, z: 0.0 }, { p: { x: 10.035413954488630, y: 50.575070810112159, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("GermanyDHDN-3-Ellipsoid2.bim", { horizontalCRS: { id: "DHDN/3.GK3d-4/EN" }, verticalCRS: { id: "ELLIPSOID" } }, "DHDN/3", { x: 4360857.005, y: 5606083.067, z: 0.0 }, { p: { x: 10.035413954488630, y: 50.575070810112159, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("GermanyDHDN-3-Ellipsoid3.bim", { horizontalCRS: { id: "DHDN/3.GK3d-4/EN" }, verticalCRS: { id: "ELLIPSOID" } }, "WGS84", { x: 4360857.005, y: 5606083.067, z: 0.0 }, { p: { x: 10.034215937440818, y: 50.573862480894853, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-1.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, "", { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-2.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, "NAD83", { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: -30.12668428839329 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-3.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, "WGS84", { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: -30.12668428839329 }, s: GeoCoordStatus.Success });
      await convertTest("UTM27-10-Ellipsoid1.bim", { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: 623075.328, y: 4265650.532, z: 0.0 }, { p: { x: -121.58798236995744, y: 38.532616292207997, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("UTM27-10-Ellipsoid2.bim", { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "ELLIPSOID" } }, "NAD83", { x: 623075.328, y: 4265650.532, z: 0.0 }, { p: { x: -121.58905088839697, y: 38.532522753851708, z: 0.0 }, s: GeoCoordStatus.Success });

      await convertTest("UTM83-10-NGVD29-4.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "LL84" }, verticalCRS: { id: "ELLIPSOID" } }, { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: -30.12668428839329 }, s: GeoCoordStatus.Success });

      await convertTest("UTM83-10-NGVD29-5.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "LL84" }, verticalCRS: { id: "GEOID" } }, { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: 0.7621583779125531 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-6.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "CA83-II" }, verticalCRS: { id: "NAVD88" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-7.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "CA83-II" }, verticalCRS: { id: "GEOID" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-8.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "CA83-II" }, verticalCRS: { id: "NGVD29" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.0 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-9.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { epsg: 26942 }, verticalCRS: { id: "NAVD88" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });
      await convertTest("UTM83-10-NGVD29-10.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NAVD88" } }, { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "NGVD29" } }, { x: 548296.472, y: 4179414.470, z: 0.8457 }, { p: { x: 548392.9689991799, y: 4179217.683834238, z: -0.0006774162750405877 }, s: GeoCoordStatus.Success });

      await convertTest("BritishNatGrid-Ellipsoid4.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "HS2_Snake_2015" }, verticalCRS: { id: "GEOID" } }, { x: 473327.251, y: 257049.636, z: 0.0 }, { p: { x: 237732.58101946692, y: 364048.01547843055, z: -47.874172425966336 }, s: GeoCoordStatus.Success });

      await convertTest("BritishNatGrid-Ellipsoid5.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } },
        {
          horizontalCRS: {
            id: "HS2-MOCK",
            description: "USES CUSTOM DATUM",
            source: "Test",
            deprecated: false,
            datumId: "HS2SD_2015",
            unit: "Meter",
            projection: {
              method: "TransverseMercator",
              centralMeridian: -1.5,
              latitudeOfOrigin: 52.30,
              scaleFactor: 1.0,
              falseEasting: 198873.0046,
              falseNorthing: 375064.3871,
            },
          },
          verticalCRS: {
            id: "GEOID",
          },
        }
        , { x: 473327.251, y: 257049.636, z: 0.0 }, { p: { x: 237732.58101952373, y: 364048.01548327296, z: -47.874172425966336 }, s: GeoCoordStatus.Success });

      await convertTest("BritishNatGrid-Ellipsoid.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "OSGB-GPS-2015" }, verticalCRS: { id: "GEOID" } }, { x: 473327.251, y: 257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.Success });

      await convertTest("UTM83-10-NGVD29-12.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } },
        {
          horizontalCRS: {
            id: "California2",
            description: "USES CUSTOM DATUM",
            source: "Test",
            deprecated: false,
            datumId: "NAD83",
            unit: "Meter",
            projection: {
              method: "LambertConformalConicTwoParallels",
              longitudeOfOrigin: -122,
              latitudeOfOrigin: 37.66666666667,
              standardParallel1: 39.833333333333336,
              standardParallel2: 38.333333333333336,
              falseEasting: 2000000.0,
              falseNorthing: 500000.0,
            },
            extent: {
              southWest: {
                latitude: 35,
                longitude: -125,
              },
              northEast: {
                latitude: 39.1,
                longitude: -120.45,
              },
            },
          },
          verticalCRS: {
            id: "GEOID",
          },
        }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });

      // Do some test that return errors
      // First test uses one GCS in Eastern USA and the other in UK. This will produce a hard domain error
      await convertTest("Error1.bim", { horizontalCRS: { id: "UTM84-17N" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "OSGB-GPS-2015" }, verticalCRS: { id: "GEOID" } }, { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.OutOfMathematicalDomain });

      // This test performs conversion in a region outside normal use of GCS but still mathematically valid (soft domain error)
      await convertTest("Error2.bim", { horizontalCRS: { id: "DanishS34-S99" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: -6618.5925260757449, y: 36058.097489683532, z: 0.0 }, { p: { x: 13.53250346041385, y: 54.71216475341563, z: 0.0 }, s: GeoCoordStatus.OutOfUsefulRange });
      // -6618.5925260757449, 36058.097489683532
      // { x: -221748.034, y: -10012.784, z: 0.0 } { p: { x: 10.36481105, y: 54.38462506, z: 0.0 }
      // This test makes use of a GCS using a grid file that does not even exist and will return a datum conversion error.
      const userGCSWithinexistentGridFile: GeographicCRSProps = {
        horizontalCRS: {
          id: "User1",
          datumId: "UserDatum1",
          datum: {
            id: "UserDatum1",
            ellipsoidId: "CLRK66",
            transforms: [
              {
                method: "GridFiles",
                sourceEllipsoid: {
                  id: "CLRK66",
                  equatorialRadius: 6378160.0,
                  polarRadius: 6356774.719195306,
                },
                targetEllipsoid: {
                  id: "WGS84",
                  equatorialRadius: 6378160.0,
                  polarRadius: 6356774.719195306,
                },
                gridFile: {
                  files: [
                    { fileName: "./user/inexistent.gdc", format: "NTv2", direction: "Direct" },
                  ],
                },
              },
            ],
          },
          unit: "Meter",
          projection: {
            method: "TransverseMercator",
            centralMeridian: -115,
            latitudeOfOrigin: 0,
            scaleFactor: 0.9992,
            falseEasting: 1.0,
            falseNorthing: 2.0,
          },
          extent: {
            southWest: { latitude: 48, longitude: -120.5 },
            northEast: { latitude: 84, longitude: -109.5 },
          },
        }, verticalCRS: { id: "ELLIPSOID" },
      };

      await convertTest("Error3.bim", userGCSWithinexistentGridFile, "WGS84", { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.NoDatumConverter });

      // The model GCS is not valid
      await convertTest("Error4.bim", { horizontalCRS: { id: "badfood" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "OSGB-GPS-2015" }, verticalCRS: { id: "GEOID" } }, { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.NoGCSDefined });

      // The given GCS is not valid
      await convertTest("Error5.bim", { horizontalCRS: { id: "UTM84-17N" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "badfood" }, verticalCRS: { id: "GEOID" } }, { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.NoGCSDefined });

    });
  }

  it("should be able to create a snapshot IModel and set geolocation by ECEF", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const ecef = new EcefLocation({
      origin: [42, 21, 0],
      orientation: { yaw: 1, pitch: 1, roll: -1 },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot3.bim");
    const iModel = SnapshotDb.createEmpty(testFile, args);

    assert.isTrue(iModel.ecefLocation === undefined);

    iModel.ecefLocation = ecef;

    iModel.updateIModelProps();
    iModel.saveChanges();
    iModel.close();

    const iModel2 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel2.ecefLocation !== undefined);
    assert.isTrue(iModel2.ecefLocation!.isAlmostEqual(ecef));

    iModel2.close();
  });

  it("should be able to create a snapshot IModel and set geolocation by ECEF with 0,0,0 rotation", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const ecef = new EcefLocation({
      origin: [42, 21, 0],
      orientation: { yaw: 0, pitch: 0, roll: 0 },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot3_000.bim");
    const iModel = SnapshotDb.createEmpty(testFile, args);

    assert.isTrue(iModel.ecefLocation === undefined);

    iModel.ecefLocation = ecef;

    iModel.updateIModelProps();
    iModel.saveChanges();
    iModel.close();

    const iModel2 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel2.ecefLocation !== undefined);
    assert.isTrue(iModel2.ecefLocation!.isAlmostEqual(ecef));

    iModel2.close();
  });

  it("presence of a GCS imposes the ecef value", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const gcs = new GeographicCRS({
      horizontalCRS: {
        id: "10TM115-27",
        description: "",
        source: "Mentor Software Client",
        deprecated: false,
        datumId: "NAD27",
        unit: "Meter",
        projection: {
          method: "TransverseMercator",
          centralMeridian: -115,
          latitudeOfOrigin: 0,
          scaleFactor: 0.9992,
          falseEasting: 0.0,
          falseNorthing: 0.0,
        },
        extent: {
          southWest: { latitude: 48, longitude: -120.5 },
          northEast: { latitude: 84, longitude: -109.5 },
        },
      },
      verticalCRS: { id: "GEOID" },
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 10.0,
          translationY: 15.0,
          translationZ: 0.02,
          rotDeg: 1.2,
          scale: 1.0001,
        },
      },
    });

    const ecef = new EcefLocation({
      origin: [42, 21, 0],
      orientation: { yaw: 1, pitch: 1, roll: -1 },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot4.bim");

    const iModel = SnapshotDb.createEmpty(testFile, args);

    iModel.ecefLocation = ecef;

    iModel.updateIModelProps();
    iModel.saveChanges();
    iModel.close();

    const iModel2 = SnapshotDb.openForApplyChangesets(testFile);

    assert.isTrue(iModel2.ecefLocation !== undefined);
    assert.isTrue(iModel2.ecefLocation!.isAlmostEqual(ecef));

    assert.isTrue(iModel2.geographicCoordinateSystem === undefined);

    iModel2.geographicCoordinateSystem = gcs;

    iModel2.updateIModelProps();
    iModel2.saveChanges();
    iModel2.close();

    const iModel3 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel3.geographicCoordinateSystem !== undefined);

    // When a gcs is present then ecef value is imposed by the gcs disregarding previous value.
    assert.isTrue(iModel3.ecefLocation !== undefined);
    assert.isFalse(iModel3.ecefLocation!.isAlmostEqual(ecef));

    iModel3.close();
  });

  it("should be able to open checkpoints for RPC", async () => {
    const changeset: ChangesetIdWithIndex = { id: "fakeChangeSetId", index: 10 };
    const iTwinId = "fakeIModelId";
    const iModelId = "fakeIModelId";
    const cloudContainer = { accessToken: "sas" };
    const fakeSnapshotDb: any =
    {
      cloudContainer,
      isReadonly: () => true,
      isOpen: () => true,
      getIModelId: () => iModelId,
      getITwinId: () => iTwinId,
      getCurrentChangeset: () => changeset,
      setIModelDb: () => { },
      closeFile: () => { },
    };

    const errorLogStub = sinon.stub(Logger, "logError").callsFake(() => { });
    const infoLogStub = sinon.stub(Logger, "logInfo").callsFake(() => { });

    // Mock iModelHub
    const mockCheckpointV2: V2CheckpointAccessProps = {
      accountName: "testAccount",
      containerId: "imodelblocks-123",
      sasToken: "testSAS",
      dbName: "testDb",
      storageType: "azure?sas=1",
    };

    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => {
      return { dbName: "fakeDb", container: { accessToken: "sas" } as any };
    });
    const queryStub = sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
    sinon.stub(IModelDb.prototype, "loadIModelSettings" as any);

    const accessToken = "token";
    const checkpoint = await SnapshotDb.openCheckpointFromRpc({ accessToken, iTwinId, iModelId, changeset });
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("fakeDb");

    const props = checkpoint.getRpcProps();
    assert.equal(props.iModelId, iModelId);
    assert.equal(props.iTwinId, iTwinId);
    assert.equal(props.changeset?.id, changeset.id);
    assert.equal(errorLogStub.callCount, 1);
    assert.include(errorLogStub.args[0][1], "attached with timestamp that expires before");

    errorLogStub.resetHistory();
    expect(cloudContainer.accessToken).equal("sas");
    await checkpoint.refreshContainerForRpc(accessToken);
    expect(cloudContainer.accessToken).equal("testSAS");

    assert.equal(errorLogStub.callCount, 1);
    assert.include(errorLogStub.args[0][1], "attached with timestamp that expires before");
    assert.equal(infoLogStub.callCount, 2);
    assert.include(infoLogStub.args[0][1], "attempting to refresh");
    assert.include(infoLogStub.args[1][1], "refreshed checkpoint");

    errorLogStub.resetHistory();
    queryStub.callsFake(async () => {
      throw new Error("no checkpoint");
    });
    await expect(checkpoint.refreshContainerForRpc(accessToken)).to.eventually.be.rejectedWith("no checkpoint");

    checkpoint.close();
  });

  it("should throw for missing/invalid checkpoint in hub", async () => {
    process.env.CHECKPOINT_CACHE_DIR = "/foo/";
    sinon.stub(IModelHost, "hubAccess").get(() => HubMock);
    sinon.stub(IModelHost.hubAccess, "queryV2Checkpoint").callsFake(async () => undefined);

    const accessToken = "token";
    const error = await getIModelError(SnapshotDb.openCheckpointFromRpc({ accessToken, iTwinId: Guid.createValue(), iModelId: Guid.createValue(), changeset: IModelTestUtils.generateChangeSetId() }));
    expectIModelError(IModelStatus.NotFound, error);
  });

  it("attempting to re-attach a non-checkpoint snapshot should be a no-op", async () => {
    process.env.CHECKPOINT_CACHE_DIR = "/foo/";
    const accessToken = "token";
    await imodel1.refreshContainerForRpc(accessToken);
  });

  function hasClassView(db: IModelDb, name: string): boolean {
    try {
      return db.withSqliteStatement(`SELECT ECInstanceId FROM [${name}]`, (): boolean => true, false);
    } catch {
      return false;
    }
  }

  it("Check busyTimeout option", () => {
    const standaloneFile = IModelTestUtils.prepareOutputFile("IModel", "StandaloneReadWrite.bim");
    const tryOpen = (fileName: string, options?: SnapshotDbOpenArgs) => {
      const start = performance.now();
      let didThrow = false;
      try {
        StandaloneDb.openFile(fileName, OpenMode.ReadWrite, options);
      } catch (e: any) {
        assert.strictEqual(e.errorNumber, DbResult.BE_SQLITE_BUSY, "Expect error 'Db is busy'");
        didThrow = true;
      }
      assert.isTrue(didThrow);
      return performance.now() - start;
    };
    const seconds = (s: number) => s * 1000;

    const db = StandaloneDb.createEmpty(standaloneFile, { rootSubject: { name: "Standalone" } });
    db.saveChanges();
    // lock db so another connection cannot write to it.
    db.saveFileProperty({ name: "test", namespace: "test" }, "");

    assert.isAtMost(tryOpen(standaloneFile, { busyTimeout: seconds(0) }), seconds(1), "open should fail with busy error instantly");
    assert.isAtLeast(tryOpen(standaloneFile, { busyTimeout: seconds(1) }), seconds(1), "open should fail with atleast 1 sec delay due to retry");
    assert.isAtLeast(tryOpen(standaloneFile, { busyTimeout: seconds(2) }), seconds(2), "open should fail with atleast 2 sec delay due to retry");
    assert.isAtLeast(tryOpen(standaloneFile, { busyTimeout: seconds(3) }), seconds(3), "open should fail with atleast 3 sec delay due to retry");

    db.abandonChanges();
    db.close();
  });

  it("Standalone iModel properties", () => {
    const standaloneRootSubjectName = "Standalone";
    const standaloneFile1 = IModelTestUtils.prepareOutputFile("IModel", "Standalone1.bim");
    let standaloneDb1 = StandaloneDb.createEmpty(standaloneFile1, { rootSubject: { name: standaloneRootSubjectName } });
    assert.isTrue(standaloneDb1.isStandaloneDb());
    assert.isTrue(standaloneDb1.isStandalone);
    assert.isFalse(standaloneDb1.isReadonly, "Expect standalone iModels to be read-write during create");
    assert.equal(standaloneDb1.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(standaloneDb1.pathName, standaloneFile1);
    assert.equal(standaloneDb1, StandaloneDb.tryFindByKey(standaloneDb1.key), "Should be in the list of open StandaloneDbs");
    assert.equal(standaloneDb1.elements.getRootSubject().code.value, standaloneRootSubjectName);
    assert.isTrue(standaloneDb1.isOpen);
    assert.isTrue(Guid.isV4Guid(standaloneDb1.iModelId));
    assert.equal(standaloneDb1.iTwinId, Guid.empty);
    assert.strictEqual("", standaloneDb1.changeset.id);
    assert.strictEqual(0, standaloneDb1.changeset.index);
    assert.equal(standaloneDb1.openMode, OpenMode.ReadWrite);
    standaloneDb1.close();
    assert.isFalse(standaloneDb1.isOpen);
    standaloneDb1.close(); // calling `close()` a second time is a no-op
    assert.isUndefined(StandaloneDb.tryFindByKey(standaloneDb1.key));
    standaloneDb1 = StandaloneDb.openFile(standaloneFile1);
    assert.equal(standaloneDb1, StandaloneDb.tryFindByKey(standaloneDb1.key));
    assert.isFalse(standaloneDb1.isReadonly, "By default, StandaloneDbs are opened read/write");
    standaloneDb1.close();
    assert.isUndefined(StandaloneDb.tryFindByKey(standaloneDb1.key));
  });

  it("Snapshot iModel properties", () => {
    const snapshotRootSubjectName = "Snapshot";
    const snapshotFile1 = IModelTestUtils.prepareOutputFile("IModel", "Snapshot1.bim");
    const snapshotFile2 = IModelTestUtils.prepareOutputFile("IModel", "Snapshot2.bim");
    const snapshotFile3 = IModelTestUtils.prepareOutputFile("IModel", "Snapshot3.bim");
    let snapshotDb1 = SnapshotDb.createEmpty(snapshotFile1, { rootSubject: { name: snapshotRootSubjectName }, createClassViews: true });
    let snapshotDb2 = SnapshotDb.createFrom(snapshotDb1, snapshotFile2);
    let snapshotDb3 = SnapshotDb.createFrom(imodel1, snapshotFile3, { createClassViews: true });
    assert.isTrue(snapshotDb1.isSnapshotDb());
    assert.isTrue(snapshotDb2.isSnapshotDb());
    assert.isTrue(snapshotDb3.isSnapshotDb());
    assert.isTrue(snapshotDb1.isSnapshot);
    assert.isTrue(snapshotDb2.isSnapshot);
    assert.isTrue(snapshotDb3.isSnapshot);
    assert.isFalse(snapshotDb1.isReadonly, "Expect snapshots to be read-write during create");
    assert.isFalse(snapshotDb2.isReadonly, "Expect snapshots to be read-write during create");
    assert.isFalse(snapshotDb3.isReadonly, "Expect snapshots to be read-write during create");
    assert.equal(snapshotDb1.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(snapshotDb2.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(snapshotDb3.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(imodel1.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(snapshotDb1.pathName, snapshotFile1);
    assert.equal(snapshotDb2.pathName, snapshotFile2);
    assert.equal(snapshotDb3.pathName, snapshotFile3);
    assert.equal(snapshotDb1, SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.equal(snapshotDb2, SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.equal(snapshotDb3, SnapshotDb.tryFindByKey(snapshotDb3.key));
    const iModelGuid1: GuidString = snapshotDb1.iModelId;
    const iModelGuid2: GuidString = snapshotDb2.iModelId;
    const iModelGuid3: GuidString = snapshotDb3.iModelId;
    assert.notEqual(iModelGuid1, iModelGuid2, "Expect different iModel GUIDs for each snapshot");
    assert.notEqual(iModelGuid2, iModelGuid3, "Expect different iModel GUIDs for each snapshot");
    const rootSubjectName1 = snapshotDb1.elements.getRootSubject().code.value;
    const rootSubjectName2 = snapshotDb2.elements.getRootSubject().code.value;
    const rootSubjectName3 = snapshotDb3.elements.getRootSubject().code.value;
    const imodel1RootSubjectName = imodel1.elements.getRootSubject().code.value;
    assert.equal(rootSubjectName1, snapshotRootSubjectName);
    assert.equal(rootSubjectName1, rootSubjectName2, "Expect a snapshot to maintain the root Subject name from its seed");
    assert.equal(rootSubjectName3, imodel1RootSubjectName, "Expect a snapshot to maintain the root Subject name from its seed");
    assert.isTrue(snapshotDb1.isOpen);
    assert.isTrue(snapshotDb2.isOpen);
    assert.isTrue(snapshotDb3.isOpen);
    snapshotDb1.close();
    snapshotDb2.close();
    snapshotDb3.close();
    assert.isFalse(snapshotDb1.isOpen);
    assert.isFalse(snapshotDb2.isOpen);
    assert.isFalse(snapshotDb3.isOpen);
    snapshotDb1.close(); // calling `close()` a second time is a no-op
    snapshotDb2.close(); // calling `close()` a second time is a no-op
    snapshotDb3.close(); // calling `close()` a second time is a no-op
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb3.key));
    snapshotDb1 = SnapshotDb.openFile(snapshotFile1);
    snapshotDb2 = SnapshotDb.openFile(snapshotFile2);
    snapshotDb3 = SnapshotDb.openFile(snapshotFile3);
    assert.equal(snapshotDb1, SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.equal(snapshotDb2, SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.equal(snapshotDb3, SnapshotDb.tryFindByKey(snapshotDb3.key));
    assert.equal(snapshotDb3, SnapshotDb.findByKey(snapshotDb3.key));
    assert.equal(snapshotDb3, IModelDb.findByKey(snapshotDb3.key));
    assert.throws(() => BriefcaseDb.findByKey(snapshotDb1.key)); // lookup of key for SnapshotDb via BriefcaseDb should throw
    assert.throws(() => StandaloneDb.findByKey(snapshotDb1.key)); // likewise for StandaloneDb
    assert.isTrue(snapshotDb1.isReadonly, "Expect snapshots to be read-only after open");
    assert.isTrue(snapshotDb2.isReadonly, "Expect snapshots to be read-only after open");
    assert.isTrue(snapshotDb3.isReadonly, "Expect snapshots to be read-only after open");
    assert.isTrue(hasClassView(snapshotDb1, "bis.Element"));
    assert.isTrue(hasClassView(snapshotDb1, "bis.ElementAspect"));
    assert.isTrue(hasClassView(snapshotDb1, "bis.Model"));
    assert.isTrue(hasClassView(snapshotDb1, "bis.ElementRefersToElements"));
    assert.isFalse(hasClassView(snapshotDb2, "bis.Element"));
    assert.isTrue(hasClassView(snapshotDb3, "bis.Element"));

    snapshotDb1.close();
    snapshotDb2.close();
    snapshotDb3.close();

    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb3.key));
  });

  it("upgrade the domain schema in a StandaloneDb", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile("UpgradeIModel", "testImodel.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("testImodel.bim");
    IModelJsFs.copySync(seedFileName, testFileName);

    let iModel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    const beforeVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(beforeVersion!, "= 1.0.0"));
    iModel.close();

    const schemaState: SchemaState = StandaloneDb.validateSchemas(testFileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    StandaloneDb.upgradeStandaloneSchemas(testFileName);

    iModel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    const afterVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(afterVersion!, ">= 1.0.10"));
    iModel.close();
  });

  it("Run plain SQL", () => {
    imodel1.withPreparedSqliteStatement("CREATE TABLE Test(Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Code INTEGER)", (stmt: SqliteStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });

    imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
      stmt.bindValue(1, "Dummy 1");
      stmt.bindValue(2, 100);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });

    imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
      stmt.bindValues(["Dummy 2", 200]);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });

    imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
      stmt.bindValue(":p1", "Dummy 3");
      stmt.bindValue(":p2", 300);
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });

    imodel1.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
      stmt.bindValues({ ":p1": "Dummy 4", ":p2": 400 });
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });

    imodel1.saveChanges();

    imodel1.withPreparedSqliteStatement("SELECT Id,Name,Code FROM Test ORDER BY Id", (stmt: SqliteStatement) => {
      for (let i: number = 1; i <= 4; i++) {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        assert.equal(stmt.getColumnCount(), 3);
        const val0: SqliteValue = stmt.getValue(0);
        assert.equal(val0.columnName, "Id");
        assert.equal(val0.type, SqliteValueType.Integer);
        assert.isFalse(val0.isNull);
        assert.equal(val0.getInteger(), i);

        const val1: SqliteValue = stmt.getValue(1);
        assert.equal(val1.columnName, "Name");
        assert.equal(val1.type, SqliteValueType.String);
        assert.isFalse(val1.isNull);
        assert.equal(val1.getString(), `Dummy ${i}`);

        const val2: SqliteValue = stmt.getValue(2);
        assert.equal(val2.columnName, "Code");
        assert.equal(val2.type, SqliteValueType.Integer);
        assert.isFalse(val2.isNull);
        assert.equal(val2.getInteger(), i * 100);

        const row: any = stmt.getRow();
        assert.equal(row.id, i);
        assert.equal(row.name, `Dummy ${i}`);
        assert.equal(row.code, i * 100);
      }
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });

    imodel1.withPreparedSqliteStatement("SELECT 1 FROM ec_CustomAttribute WHERE ContainerId=? AND Instance LIKE '<IsMixin%' COLLATE NOCASE", (stmt: SqliteStatement) => {
      stmt.bindValue(1, "0x1f");
      assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
    });
  });

  it("Run plain SQL against readonly connection", () => {
    let iModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "sqlitesqlreadonlyconnection.bim"), { rootSubject: { name: "test" } });
    const iModelPath = iModel.pathName;
    iModel.close();
    iModel = SnapshotDb.openFile(iModelPath);

    iModel.withPreparedSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace='ec_Db'", (stmt: SqliteStatement) => {
      let rowCount: number = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        assert.equal(stmt.getColumnCount(), 2);
        const nameVal: SqliteValue = stmt.getValue(0);
        assert.equal(nameVal.columnName, "Name");
        assert.equal(nameVal.type, SqliteValueType.String);
        assert.isFalse(nameVal.isNull);
        const name: string = nameVal.getString();

        const versionVal: SqliteValue = stmt.getValue(1);
        assert.equal(versionVal.columnName, "StrData");
        assert.equal(versionVal.type, SqliteValueType.String);
        assert.isFalse(versionVal.isNull);
        const profileVersion: any = JSON.parse(versionVal.getString());

        assert.isTrue(name === "SchemaVersion" || name === "InitialSchemaVersion");
        if (name === "SchemaVersion") {
          assert.equal(profileVersion.major, 4);
          assert.equal(profileVersion.minor, 0);
          assert.equal(profileVersion.sub1, 0);
          assert.isAtLeast(profileVersion.sub2, 1);
        } else if (name === "InitialSchemaVersion") {
          assert.equal(profileVersion.major, 4);
          assert.equal(profileVersion.minor, 0);
          assert.equal(profileVersion.sub1, 0);
          assert.isAtLeast(profileVersion.sub2, 1);
        }
      }
      assert.equal(rowCount, 2);
    });
    iModel.close();
  });

  it("tryPrepareStatement", () => {
    const sql = `SELECT * FROM ${Element.classFullName} LIMIT 1`;
    const invalidSql = "SELECT * FROM InvalidSchemaName:InvalidClassName LIMIT 1";
    assert.throws(() => imodel1.prepareStatement(invalidSql, false));
    assert.isUndefined(imodel1.tryPrepareStatement(invalidSql));
    const statement: ECSqlStatement | undefined = imodel1.tryPrepareStatement(sql);
    assert.isDefined(statement);
    assert.isTrue(statement?.isPrepared);
    statement!.dispose();
  });

  it("containsClass", () => {
    assert.isTrue(imodel1.containsClass(Element.classFullName));
    assert.isTrue(imodel1.containsClass("BisCore:Element"));
    assert.isTrue(imodel1.containsClass("BisCore.Element"));
    assert.isTrue(imodel1.containsClass("biscore:element"));
    assert.isTrue(imodel1.containsClass("biscore.element"));
    assert.isTrue(imodel1.containsClass("bis:Element"));
    assert.isTrue(imodel1.containsClass("bis.Element"));
    assert.isTrue(imodel1.containsClass("bis:element"));
    assert.isTrue(imodel1.containsClass("bis.element"));
    assert.isFalse(imodel1.containsClass("BisCore:Element:InvalidExtra"));
    assert.isFalse(imodel1.containsClass("BisCore"));
    assert.isFalse(imodel1.containsClass(":Element"));
    assert.isFalse(imodel1.containsClass("BisCore:InvalidClassName"));
    assert.isFalse(imodel1.containsClass("InvalidSchemaName:Element"));
  });

  it("should update Element code", () => {
    const elementId = imodel4.elements.insertElement({
      classFullName: "DgnPlatformTest:TestInformationRecord",
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
    });
    let element = imodel4.elements.getElement<InformationRecordElement>(elementId, InformationRecordElement);
    assert.isTrue(Code.isValid(element.code));
    assert.isTrue(Code.isEmpty(element.code));
    const codeSpecId = imodel4.codeSpecs.insert("TestCodeSpec", CodeScopeSpec.Type.Model);
    const codeValue = `${element.className}-1`;
    element.code = new Code({ spec: codeSpecId, scope: IModel.repositoryModelId, value: codeValue });
    element.update();
    element = imodel4.elements.getElement<InformationRecordElement>(elementId, InformationRecordElement);
    assert.isTrue(Code.isValid(element.code));
    assert.isFalse(Code.isEmpty(element.code));
    assert.equal(element.code.value, codeValue);
  });

  it("should update UserLabel", () => {
    // type coercion reminder!
    const s: string = "";
    assert.isTrue(s === "");
    assert.isFalse(s ? true : false);

    // insert element with an undefined UserLabel
    const elementProps: DefinitionElementProps = {
      classFullName: SpatialCategory.classFullName,
      model: IModel.dictionaryId,
      code: SpatialCategory.createCode(imodel1, IModel.dictionaryId, "TestCategoryForClearUserLabel"),
    };
    const elementId = imodel1.elements.insertElement(elementProps);
    let element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.userLabel);

    // update element with a defined userLabel
    element.userLabel = "UserLabel";
    element.update();
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.equal(element.userLabel, "UserLabel");

    // make sure userLabel is not updated when not part of the specified ElementProps
    imodel1.elements.updateElement({
      id: element.id,
      classFullName: element.classFullName,
      model: element.model,
      code: element.code,
    });
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.equal(element.userLabel, "UserLabel"); // NOTE: userLabel is not modified when userLabel is not part of the input ElementProps

    const elProps = imodel1.elements.getElementProps({ id: elementId, onlyBaseProperties: true });
    expect(elProps.userLabel).equal(element.userLabel);
    expect(elProps.classFullName).equal(SpatialCategory.classFullName);
    expect(elProps.model).equal(element.model);
    expect(elProps.code.value).equal(element.code.value);
    expect(elProps.code.scope).equal(element.code.scope);
    expect(elProps.code.spec).equal(element.code.spec);
    expect(elProps.federationGuid).equal(element.federationGuid);
    expect((elProps as any).isPrivate).undefined;
    expect((elProps as any).isInstanceOfEntity).undefined;

    // remove userlabel by setting it to the blank string
    element.userLabel = "";
    element.update();
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.userLabel); // NOTE: userLabel is cleared when the empty string is specified
  });

  it("should update FederationGuid", () => {
    // insert element with an undefined FederationGuid
    const elementProps: DefinitionElementProps = {
      classFullName: SpatialCategory.classFullName,
      model: IModel.dictionaryId,
      federationGuid: Guid.empty,
      code: SpatialCategory.createCode(imodel1, IModel.dictionaryId, "TestCategoryForClearFederationGuid"),
    };
    const elementId = imodel1.elements.insertElement(elementProps);
    let element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.federationGuid);
    assert.isFalse(element.isPrivate);

    // update element with a defined FederationGuid
    const federationGuid = Guid.createValue();
    element.federationGuid = federationGuid;
    element.isPrivate = true;
    element.update();
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.equal(element.federationGuid, federationGuid);
    assert.isTrue(element.isPrivate);

    // make sure FederationGuid is not updated when not part of the specified ElementProps
    imodel1.elements.updateElement({
      id: element.id,
      classFullName: element.classFullName,
      model: element.model,
      code: element.code,
    });
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.equal(element.federationGuid, federationGuid);
    assert.isTrue(element.isPrivate);

    // remove federationGuid by setting it to undefined in ElementProps
    const elProps = element.toJSON();
    elProps.federationGuid = undefined;
    imodel1.elements.updateElement(elProps);
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.federationGuid);

    // ensure that update doesn't change federationGuid from an element immediately after insert (toJSON should remove undefined value)
    const subject5 = Subject.create(imodel1, IModel.rootSubjectId, "Subject5");
    const s5Id = subject5.insert();
    const s5pre = imodel1.elements.getElement<Subject>(s5Id);
    subject5.description = "new descr";
    subject5.update();
    const s5post = imodel1.elements.getElement<Subject>(s5Id);
    expect(s5pre.federationGuid).equal(s5post.federationGuid);
    expect(s5post.description).equal(subject5.description);
  });

  it("should support partial update", () => {
    // Insert Subject elements - initializing Description and UserLabel to similar values
    let subject1 = Subject.create(imodel1, IModel.rootSubjectId, "Subject1", "Description1");
    let subject2 = Subject.create(imodel1, IModel.rootSubjectId, "Subject2", "Description2");
    let subject3 = Subject.create(imodel1, IModel.rootSubjectId, "Subject3", "");
    let subject4 = Subject.create(imodel1, IModel.rootSubjectId, "Subject4");
    subject1.userLabel = "UserLabel1";
    subject2.userLabel = "UserLabel2";
    subject3.userLabel = "";
    subject4.userLabel = undefined;
    const federationGuid1 = Guid.createValue();
    const federationGuid2 = Guid.createValue();
    subject1.federationGuid = federationGuid1;
    subject2.federationGuid = federationGuid2;
    subject3.federationGuid = "";
    subject4.federationGuid = Guid.empty;
    const subjectId1 = subject1.insert();
    const subjectId2 = subject2.insert();
    const subjectId3 = subject3.insert();
    const subjectId4 = subject4.insert();
    subject1 = imodel1.elements.getElement<Subject>(subjectId1, Subject);
    subject2 = imodel1.elements.getElement<Subject>(subjectId2, Subject);
    subject3 = imodel1.elements.getElement<Subject>(subjectId3, Subject);
    subject4 = imodel1.elements.getElement<Subject>(subjectId4, Subject);

    // Subject.Description is an auto-handled property
    assert.equal(subject1.description, "Description1");
    assert.equal(subject2.description, "Description2");
    assert.equal(subject3.description, ""); // NOTE: different behavior between auto-handled and custom-handled
    assert.isUndefined(subject4.description);

    // Test toJSON
    assert.equal(subject1.toJSON().description, "Description1");
    assert.equal(subject2.toJSON().description, "Description2");
    assert.equal(subject3.toJSON().description, "");
    assert.isUndefined(subject4.toJSON().description);

    // Element.UserLabel is a custom-handled property
    assert.equal(subject1.userLabel, "UserLabel1");
    assert.equal(subject2.userLabel, "UserLabel2");
    assert.isUndefined(subject3.userLabel); // NOTE: different behavior between auto-handled and custom-handled
    assert.isUndefined(subject4.userLabel);

    // Element.FederationGuid is a custom-handled property
    assert.equal(subject1.federationGuid, federationGuid1);
    assert.equal(subject2.federationGuid, federationGuid2);
    assert.isUndefined(subject4.federationGuid);

    // test partial update of Description (auto-handled)
    imodel1.elements.updateElement<SubjectProps>({ id: subject1.id, description: "Description1-Updated" });
    subject1 = imodel1.elements.getElement<Subject>(subjectId1, Subject);
    assert.equal(subject1.description, "Description1-Updated"); // should have been updated
    assert.isDefined(subject1.model);
    assert.isDefined(subject1.parent);
    assert.equal(subject1.code.value, "Subject1"); // should not have changed
    assert.equal(subject1.userLabel, "UserLabel1"); // should not have changed
    assert.equal(subject1.federationGuid, federationGuid1); // should not have changed

    // test partial update of UserLabel (custom-handled)
    imodel1.elements.updateElement<SubjectProps>({ id: subject2.id, userLabel: "UserLabel2-Updated" });
    subject2 = imodel1.elements.getElement<Subject>(subjectId2, Subject);
    assert.isDefined(subject2.model);
    assert.isDefined(subject2.parent);
    assert.equal(subject2.userLabel, "UserLabel2-Updated"); // should have been updated
    assert.equal(subject2.code.value, "Subject2"); // should not have changed
    assert.equal(subject2.description, "Description2"); // should not have changed
    assert.equal(subject2.federationGuid, federationGuid2); // should not have changed

    // Update Subject elements - setting Description and UserLabel to similar values
    subject1.description = undefined;
    subject2.description = "";
    subject3.description = "Description3";
    subject4.description = "Description4";
    subject2.userLabel = "";
    subject3.userLabel = "UserLabel3";
    subject4.userLabel = "UserLabel4";
    subject1.update();
    subject2.update();
    subject3.update();
    subject4.update();
    subject1 = imodel1.elements.getElement<Subject>(subjectId1, Subject);
    subject2 = imodel1.elements.getElement<Subject>(subjectId2, Subject);
    subject3 = imodel1.elements.getElement<Subject>(subjectId3, Subject);
    subject4 = imodel1.elements.getElement<Subject>(subjectId4, Subject);

    // Subject.Description is an auto-handled property
    assert.isUndefined(subject1.description);
    assert.equal(subject2.description, ""); // NOTE: different behavior between auto-handled and custom-handled
    assert.equal(subject3.description, "Description3");
    assert.equal(subject4.description, "Description4");

    // Element.UserLabel is a custom-handled property
    assert.isUndefined(subject2.userLabel); // NOTE: different behavior between auto-handled and custom-handled
    assert.equal(subject3.userLabel, "UserLabel3");
    assert.equal(subject4.userLabel, "UserLabel4");

    // test partial update of Description to undefined
    const s3Fed = subject3.federationGuid;
    imodel1.elements.updateElement<SubjectProps>({ id: subject3.id, description: undefined });
    subject3 = imodel1.elements.getElement<Subject>(subjectId3, Subject);
    assert.isUndefined(subject3.description); // should have been updated
    assert.isDefined(subject3.model);
    assert.isDefined(subject3.parent);
    assert.equal(subject3.code.value, "Subject3"); // should not have changed
    assert.equal(subject3.userLabel, "UserLabel3"); // should not have changed
    assert.equal(subject3.federationGuid, s3Fed); // should not have changed

    // test partial update of UserLabel to undefined
    imodel1.elements.updateElement<SubjectProps>({ id: subject4.id, userLabel: undefined });
    subject4 = imodel1.elements.getElement<Subject>(subjectId4, Subject);
    assert.isDefined(subject4.model);
    assert.isDefined(subject4.parent);
    // assert.isUndefined(subject4.userLabel); // should have been updated  - WIP WIP WIP
    assert.equal(subject4.code.value, "Subject4"); // should not have changed
    assert.equal(subject4.description, "Description4"); // should not have changed
    assert.isUndefined(subject4.federationGuid); // should not have changed

  });

  it('should allow untrimmed codes when using "exact" codeValueBehavior', () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "codeValueBehavior.bim");
    const imodel = SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "codeValueBehaviors" } });

    const getNumberedCodeValAndProps = (n: number) => {
      const trimmedCodeVal = `CodeValue${n}`;
      const untrimmedCodeVal = `${trimmedCodeVal}\xa0`;
      const spec = imodel.codeSpecs.getByName(SpatialCategory.getCodeSpecName()).id;
      const props: ElementProps = {
        // the [[Code]] class still (as it always has) trims unicode space, so avoid it
        code: { spec, scope: IModelDb.dictionaryId, value: untrimmedCodeVal },
        model: IModelDb.dictionaryId,
        classFullName: SpatialCategory.classFullName,
      };
      return { trimmedCodeVal, untrimmedCodeVal, props };
    };

    expect(imodel.codeValueBehavior).to.equal("trim-unicode-whitespace");

    const code1 = getNumberedCodeValAndProps(1);
    const categ1Id = imodel.elements.insertElement(code1.props);
    const categ1 = imodel.elements.getElementJson({ id: categ1Id });
    expect(categ1.code.value).to.equal(code1.trimmedCodeVal);

    imodel.codeValueBehavior = "exact";
    const code2 = getNumberedCodeValAndProps(2);
    const categ2Id = imodel.elements.insertElement(code2.props);
    const categ2 = imodel.elements.getElementJson({ id: categ2Id });
    expect(categ2.code.value).to.equal(code2.untrimmedCodeVal);

    imodel.codeValueBehavior = "trim-unicode-whitespace";
    const code3 = getNumberedCodeValAndProps(3);
    const categ3Id = imodel.elements.insertElement(code3.props);
    const categ3 = imodel.elements.getElement({ id: categ3Id });
    expect(categ3.code.value).to.equal(code3.trimmedCodeVal);

    imodel.close();
  });

  it("throws NotFound when attempting to access element props after closing the iModel", () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "accessAfterClose.bim");
    const imodel = SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "accessAfterClose" } });

    const elem = imodel.elements.getElement<Subject>(IModel.rootSubjectId);
    expect(elem.id).to.equal(IModel.rootSubjectId);

    imodel.close();

    expect(() => imodel.elements.getElement<Subject>(IModel.rootSubjectId)).to.throw(IModelError, "Element=0x1", "Not Found");
  });
});
