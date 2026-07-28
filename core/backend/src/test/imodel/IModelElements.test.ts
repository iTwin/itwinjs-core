/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Guid, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { EditTxn, withEditTxn } from "../../EditTxn";
import {
  AxisAlignedBox3d, Code, CodeScopeSpec, ColorDef, DefinitionElementProps, ElementProps,
  GeometricElementProps, GeometryParams, GeometryStreamBuilder,
  ImageSourceFormat, IModel, IModelError, LightLocationProps, PhysicalElementProps,
  SubCategoryAppearance, SubjectProps, TextureMapping,
  TextureMapProps, TextureMapUnits, TypeDefinitionElementProps,
} from "@itwin/core-common";
import {
  GeometryQuery, LineString3d, Loop, Matrix4d, Point3d, PolyfaceBuilder, StrokeOptions, YawPitchRollAngles,
} from "@itwin/core-geometry";
import {
  Category,
  DefinitionModel, DefinitionPartition, DictionaryModel,
  Element, ElementOwnsChildElements, GenericGraphicalType2d, GeometricElement3d,
  GeometricModel, IModelDb, InformationPartitionElement, InformationRecordElement, LightLocation,
  LinkPartition, Model, PhysicalElement, PhysicalModel, PhysicalObject, RenderMaterialElement, RenderMaterialElementParams, SnapshotDb, SpatialCategory,
  SubCategory, Subject, Texture,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { samplePngTexture } from "../imageData";
import { EntityClass } from "@itwin/ecschema-metadata";
import { createIModelFromSeed, generateTestSnapshot, roundtripThroughJson } from "./IModelTestFixtures";

// spell-checker: disable

describe("iModel elements", () => {
  let testBimReadonly: SnapshotDb;
  let compatibilityReadonly: SnapshotDb;
  const mutableIModels: SnapshotDb[] = [];

  before(async () => {
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();

    const testBimWritable = await generateTestSnapshot("elements-test.bim", "test.bim");
    const testBimPath = testBimWritable.pathName;
    testBimWritable.close();
    testBimReadonly = SnapshotDb.openFile(testBimPath);

    const compatibilityWritable = createIModelFromSeed("elements-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim");
    const compatibilityPath = compatibilityWritable.pathName;
    compatibilityWritable.close();
    compatibilityReadonly = SnapshotDb.openFile(compatibilityPath);
  });

  after(async () => {
    if (testBimReadonly !== undefined && testBimReadonly.isOpen)
      testBimReadonly.close();
    if (compatibilityReadonly !== undefined && compatibilityReadonly.isOpen)
      compatibilityReadonly.close();
    for (const imodel of mutableIModels.splice(0)) {
      if (imodel.isOpen)
        imodel.close();
    }
  });

  afterEach(() => {
    for (const imodel of mutableIModels.splice(0)) {
      if (imodel.isOpen)
        imodel.close();
    }
  });

  const trackMutableIModel = (imodel: SnapshotDb): SnapshotDb => {
    mutableIModels.push(imodel);
    return imodel;
  };

  it("should be able to get properties of an iModel", () => {
    const imodel1 = testBimReadonly;
    expect(imodel1.name).equals("TBD"); // That's the name of the root subject!
    const extents: AxisAlignedBox3d = imodel1.projectExtents;
    assert(!extents.isNull);

    // make sure we can construct a new element even if we haven't loaded its metadata (will be loaded in ctor)
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.isUndefined(imodel1.classMetaDataRegistry.find("biscore:lightlocation"));
    const e1 = imodel1.constructEntity<LightLocation, LightLocationProps>({ category: "0x11", classFullName: "BisCore:LightLocation", model: "0x01", code: Code.createEmpty() });
    assert.isDefined(e1);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.isDefined(imodel1.classMetaDataRegistry.find("biscore:lightlocation")); // should have been loaded in ctor
  });

  it("should load a known element by Id from an existing iModel", () => {
    const imodel1 = testBimReadonly;
    const imodel2 = trackMutableIModel(createIModelFromSeed("elements-load-known-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim"));
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
    const txn = new EditTxn(imodel2, "code scope mutation test");
    txn.start();

    const newEl = el3.toJSON();
    newEl.federationGuid = undefined;
    newEl.code = { scope: "bad scope", spec: "0x10", value: "new code" };
    expect(() => txn.insertElement(newEl)).throws("invalid code scope").to.have.property("metadata");
    newEl.code.scope = "0x34322"; // valid id, but element doesn't exist
    expect(() => txn.insertElement(newEl)).throws("invalid code scope").to.have.property("metadata");

    newEl.code.scope = el3.federationGuid!;
    const newId = txn.insertElement(newEl); // code scope from FederationGuid should get converted to ElementId
    const a4 = imodel2.elements.getElementProps(newId);
    expect(a4.code.scope).equal(el3.id);

    a4.code.scope = "0x13343";
    expect(() => txn.updateElement(a4)).throws("invalid code scope").to.have.property("metadata");

    a4.code.scope = "0x1";
    txn.updateElement(a4); // should change the code scope to new element
    let a5 = imodel2.elements.getElementProps(newId);
    expect(a5.code.scope).equal("0x1");

    // only pass minimum, but expect model and classFullName to be added.
    const newProps = { id: a4.id, code: a4.code, classFullName: undefined, model: undefined };
    newProps.code.scope = el3.federationGuid!; // should convert FederationGuid to ElementId
    txn.updateElement(newProps);
    expect(newProps.classFullName).eq(a4.classFullName);
    expect(newProps.model).eq(a4.model);

    a5 = imodel2.elements.getElementProps(newId);
    expect(a5.code.scope).equal(el3.id);
    txn.end();
  });

  it("should optionally detect class mismatches", () => {
    const imodel1 = testBimReadonly;
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
    const imodel2 = trackMutableIModel(createIModelFromSeed("elements-create-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim"));
    const seedElement = imodel2.elements.getElement<GeometricElement3d>("0x1d");
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid! === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    withEditTxn(imodel2, (txn) => {
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

        const elementId = txn.insertElement(element.toJSON());
        assert.isTrue(Id64.isValidId64(elementId));
      }
    });
  });

  it("should insert a RenderMaterial", () => {
    const imodel2 = trackMutableIModel(createIModelFromSeed("elements-render-material-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim"));
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

    const renderMaterialId = withEditTxn(imodel2, (txn) => RenderMaterialElement.insert(txn, IModel.dictionaryId, testMaterialName, renderMaterialParams));

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
    const imodel5 = trackMutableIModel(createIModelFromSeed("elements-mirukuru.ibim", "mirukuru.ibim"));
    const testTextureName = "fake texture name";
    const testTextureFormat = ImageSourceFormat.Png;
    const testTextureDescription = "empty description";
    const txn = new EditTxn(imodel5, "apply material to new element");
    txn.start();

    const texId = Texture.insertTexture(txn, IModel.dictionaryId, testTextureName, testTextureFormat, samplePngTexture.base64, testTextureDescription);

    /* eslint-disable @typescript-eslint/naming-convention */
    const matId = RenderMaterialElement.insert(txn, IModel.dictionaryId, "test material name",
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

    const modelId = PhysicalModel.insert(txn, IModelDb.rootSubjectId, "test_render_material_model_name");

    const categoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "GeoJSON Feature", { color: ColorDef.white.toJSON() });

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
    txn.insertElement(props);
    txn.end();
  });

  it("should have a valid root subject element", () => {
    const imodel1 = testBimReadonly;
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

  it("should insert and update auto-handled properties", () => {
    const imodel4 = trackMutableIModel(createIModelFromSeed("elements-auto-handled-array.bim", "GetSetAutoHandledArrayProperties.bim"));
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

    const txn = new EditTxn(imodel4, "insert and update auto-handled properties");
    txn.start();
    const newTestElemId = txn.insertElement(newTestElem.toJSON());

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
      txn.updateElement(editElem.toJSON());
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
    txn.updateElement(afterUpdateElemFetched.toJSON());

const afterShortenArray = imodel4.elements.getElement(afterUpdateElemFetched.id);
assert.equal(afterShortenArray.asAny.arrayOfInt.length, 2);
assert.deepEqual(afterShortenArray.asAny.arrayOfInt, [99, 3]);

    // Make array longer
    afterShortenArray.asAny.arrayOfInt = [1, 2, 3];
    txn.updateElement(afterShortenArray.toJSON());
    const afterLengthenArray = imodel4.elements.getElement(afterShortenArray.id);
    assert.equal(afterLengthenArray.asAny.arrayOfInt.length, 3);
    assert.deepEqual(afterLengthenArray.asAny.arrayOfInt, [1, 2, 3]);

    // ------------ delete -----------------
    const elid = afterUpdateElemFetched.id;
    txn.deleteElement(elid);
    assert.throws(() => imodel4.elements.getElement(elid), IModelError);
    txn.end();
  });

  it("should handle parent and child deletion properly", () => {
    const imodel4 = trackMutableIModel(createIModelFromSeed("elements-parent-child-array.bim", "GetSetAutoHandledArrayProperties.bim"));
    const txn = new EditTxn(imodel4, "handle parent and child deletion");
    txn.start();
    const categoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "MyTestCategory", new SubCategoryAppearance());
    const category = imodel4.elements.getElement<SpatialCategory>(categoryId);
    const subCategory = imodel4.elements.getElement<SubCategory>(category.myDefaultSubCategoryId());
    expect(() => txn.deleteElement(categoryId)).throws("error deleting element").to.have.property("metadata");
    assert.exists(imodel4.elements.getElement(categoryId), "Category deletes should be blocked in native code");
    assert.exists(imodel4.elements.getElement(subCategory.id), "Children should not be deleted if parent delete is blocked");

    const modelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "MyTestPhysicalModel");
    const elementProps: GeometricElementProps = {
      classFullName: PhysicalObject.classFullName,
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
    };
    const parentId = txn.insertElement(elementProps);
    elementProps.parent = new ElementOwnsChildElements(parentId);
    const childId1 = txn.insertElement(elementProps);
    const childId2 = txn.insertElement(elementProps);
    assert.exists(imodel4.elements.getElement(parentId));
    assert.exists(imodel4.elements.getElement(childId1));
    assert.exists(imodel4.elements.getElement(childId2));
    txn.deleteElement(parentId);
    assert.throws(() => imodel4.elements.getElement(parentId), IModelError);
    assert.throws(() => imodel4.elements.getElement(childId1), IModelError);
    assert.throws(() => imodel4.elements.getElement(childId2), IModelError);
    txn.end();
  });



  it("snapping", async () => {
    const imodel2 = compatibilityReadonly;
    const worldToView = Matrix4d.createIdentity();
    const response = await imodel2.requestSnap("0x222", { testPoint: { x: 1, y: 2, z: 3 }, closePoint: { x: 1, y: 2, z: 3 }, id: "0x111", worldToView: worldToView.toJSON() });
    assert.isDefined(response.status);
  });

  it("should set EC properties of various types", async () => {

    const testImodel = trackMutableIModel(await generateTestSnapshot("elements-ec-properties.bim", "test.bim"));
    assert.doesNotThrow(() => testImodel.schemaContext.getSchemaItemSync("TestBim:TestPhysicalObject", EntityClass), "TestPhysicalObject is expected to be defined in TestBim.ecschema.xml");
    const txn = new EditTxn(testImodel, "set EC properties of various types");
    txn.start();

    // Create a new physical model
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true);

    // Find or create a SpatialCategory
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(testImodel, IModel.dictionaryId, "MySpatialCategory")!;
    if (undefined === spatialCategoryId) {
      spatialCategoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance());
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

      id1 = txn.insertElement(testImodel.elements.createElement(elementProps).toJSON());
      assert.isTrue(Id64.isValidId64(id1));

      // The second one should point to the first.
      elementProps.id = Id64.invalid;
      (elementProps as any).relatedElement = { id: id1, relClassName: trelClassName };
      elementProps.parent = { id: id1, relClassName: trelClassName };
      (elementProps as any).longProp = 4294967295;     // make sure that we can save values in the range 0 ... UINT_MAX

      id2 = txn.insertElement(testImodel.elements.createElement(elementProps).toJSON());
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
      txn.updateElement(el2Modified.toJSON());
      // Test that el2 points to itself.
      const el2after: Element = testImodel.elements.getElement(id2);
      assert.deepEqual(el2after.asAny.relatedElement.id, id2);
      assert.equal(el2after.asAny.relatedElement.relClassName.replace(".", ":"), trelClassName);
    }

    if (true) {
      // Test that we can null out the navigation property
      const el2Modified = testImodel.elements.getElement(id2);
      el2Modified.asAny.relatedElement = null;
      txn.updateElement(el2Modified.toJSON());
      // Test that el2 has no relatedElement property value
      const el2after: Element = testImodel.elements.getElement(id2);
      assert.isUndefined(el2after.asAny.relatedElement);
    }

    txn.end();
  });





  it("should update Element code", () => {
    const imodel4 = trackMutableIModel(createIModelFromSeed("elements-update-code-array.bim", "GetSetAutoHandledArrayProperties.bim"));
    const txn = new EditTxn(imodel4, "update element code");
    txn.start();
    const elementId = txn.insertElement({
      classFullName: "DgnPlatformTest:TestInformationRecord",
      model: IModel.repositoryModelId,
      code: Code.createEmpty(),
    });
    let element = imodel4.elements.getElement<InformationRecordElement>(elementId, InformationRecordElement);
    assert.isTrue(Code.isValid(element.code));
    assert.isTrue(Code.isEmpty(element.code));
    const codeSpecId = imodel4.codeSpecs.insert(txn, "TestCodeSpec", CodeScopeSpec.Type.Model);
    const codeValue = `${element.className}-1`;
    element.code = new Code({ spec: codeSpecId, scope: IModel.repositoryModelId, value: codeValue });
    element.update(txn);
    txn.end();
    element = imodel4.elements.getElement<InformationRecordElement>(elementId, InformationRecordElement);
    assert.isTrue(Code.isValid(element.code));
    assert.isFalse(Code.isEmpty(element.code));
    assert.equal(element.code.value, codeValue);
  });

  it("should update UserLabel", async () => {
    const imodel1 = trackMutableIModel(await generateTestSnapshot("elements-update-user-label.bim", "test.bim"));
    const txn = new EditTxn(imodel1, "update user label");
    txn.start();
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
    const elementId = txn.insertElement(elementProps);
    let element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.userLabel);

    // update element with a defined userLabel
    element.userLabel = "UserLabel";
    element.update(txn);
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.equal(element.userLabel, "UserLabel");

    // make sure userLabel is not updated when not part of the specified ElementProps
    txn.updateElement({
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
    expect((elProps as any).isPrivate).to.be.oneOf([false, undefined]);
    expect((elProps as any).isInstanceOfEntity).undefined;

    // remove userlabel by setting it to the blank string
    element.userLabel = "";
    element.update(txn);
    txn.end();
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.userLabel); // NOTE: userLabel is cleared when the empty string is specified
  });

  it("should update FederationGuid", async () => {
    const imodel1 = trackMutableIModel(await generateTestSnapshot("elements-update-federation-guid.bim", "test.bim"));
    const txn = new EditTxn(imodel1, "update federation guid");
    txn.start();
    // insert element with an undefined FederationGuid
    const elementProps: DefinitionElementProps = {
      classFullName: SpatialCategory.classFullName,
      model: IModel.dictionaryId,
      federationGuid: Guid.empty,
      code: SpatialCategory.createCode(imodel1, IModel.dictionaryId, "TestCategoryForClearFederationGuid"),
    };
    const elementId = txn.insertElement(elementProps);
    let element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.federationGuid);
    assert.isFalse(element.isPrivate);

    // update element with a defined FederationGuid
    const federationGuid = Guid.createValue();
    element.federationGuid = federationGuid;
    element.isPrivate = true;
    element.update(txn);
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.equal(element.federationGuid, federationGuid);
    assert.isTrue(element.isPrivate);

    // make sure FederationGuid is not updated when not part of the specified ElementProps
    txn.updateElement({
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
    txn.updateElement(elProps);
    element = imodel1.elements.getElement<SpatialCategory>(elementId);
    assert.isUndefined(element.federationGuid);

    // ensure that update doesn't change federationGuid from an element immediately after insert (toJSON should remove undefined value)
    const subject5 = Subject.create(imodel1, IModel.rootSubjectId, "Subject5");
    const s5Id = subject5.insert(txn);
    const s5pre = imodel1.elements.getElement<Subject>(s5Id);
    subject5.description = "new descr";
    subject5.update(txn);
    txn.end();
    const s5post = imodel1.elements.getElement<Subject>(s5Id);
    expect(s5pre.federationGuid).equal(s5post.federationGuid);
    expect(s5post.description).equal(subject5.description);
  });

  it("should support partial update", async () => {
    const imodel1 = trackMutableIModel(await generateTestSnapshot("elements-partial-update.bim", "test.bim"));
    const txn = new EditTxn(imodel1, "partial element update");
    txn.start();
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
    const subjectId1 = subject1.insert(txn);
    const subjectId2 = subject2.insert(txn);
    const subjectId3 = subject3.insert(txn);
    const subjectId4 = subject4.insert(txn);
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
    txn.updateElement<SubjectProps>({ id: subject1.id, description: "Description1-Updated" });
    subject1 = imodel1.elements.getElement<Subject>(subjectId1, Subject);
    assert.equal(subject1.description, "Description1-Updated"); // should have been updated
    assert.isDefined(subject1.model);
    assert.isDefined(subject1.parent);
    assert.equal(subject1.code.value, "Subject1"); // should not have changed
    assert.equal(subject1.userLabel, "UserLabel1"); // should not have changed
    assert.equal(subject1.federationGuid, federationGuid1); // should not have changed

    // test partial update of UserLabel (custom-handled)
    txn.updateElement<SubjectProps>({ id: subject2.id, userLabel: "UserLabel2-Updated" });
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
    subject1.update(txn);
    subject2.update(txn);
    subject3.update(txn);
    subject4.update(txn);
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
    txn.updateElement<SubjectProps>({ id: subject3.id, description: undefined });
    subject3 = imodel1.elements.getElement<Subject>(subjectId3, Subject);
    assert.isUndefined(subject3.description); // should have been updated
    assert.isDefined(subject3.model);
    assert.isDefined(subject3.parent);
    assert.equal(subject3.code.value, "Subject3"); // should not have changed
    assert.equal(subject3.userLabel, "UserLabel3"); // should not have changed
    assert.equal(subject3.federationGuid, s3Fed); // should not have changed

    // test partial update of UserLabel to undefined
    txn.updateElement<SubjectProps>({ id: subject4.id, userLabel: undefined });
    txn.end();
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
    const imodel = trackMutableIModel(SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "codeValueBehaviors" } }));
    const txn = new EditTxn(imodel, "codeValueBehavior");
    txn.start();

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
    const categ1Id = txn.insertElement(code1.props);
    const categ1 = imodel.elements.getElementProps({ id: categ1Id });
    expect(categ1.code.value).to.equal(code1.trimmedCodeVal);

    imodel.codeValueBehavior = "exact";
    const code2 = getNumberedCodeValAndProps(2);
    const categ2Id = txn.insertElement(code2.props);
    const categ2 = imodel.elements.getElementProps({ id: categ2Id });
    expect(categ2.code.value).to.equal(code2.untrimmedCodeVal);

    imodel.codeValueBehavior = "trim-unicode-whitespace";
    const code3 = getNumberedCodeValAndProps(3);
    const categ3Id = txn.insertElement(code3.props);
    const categ3 = imodel.elements.getElement({ id: categ3Id });
    expect(categ3.code.value).to.equal(code3.trimmedCodeVal);

    txn.end();
    imodel.close();
  });

  it("should throw iTwinErrors on element CRUD operation fails", async () => {
    const imodel1 = trackMutableIModel(await generateTestSnapshot("elements-crud-errors.bim", "test.bim"));
    const txn = new EditTxn(imodel1, "element CRUD failure cases");
    txn.start();
    const code = Code.createEmpty();
    code.value = "foo";

    const props: TypeDefinitionElementProps = {
      classFullName: GenericGraphicalType2d.classFullName,
      model: IModel.dictionaryId,
      code,
    };
    txn.insertElement(props);

    expect(() => txn.insertElement(props)).throws("Error inserting element [duplicate code]").to.have.property("iTwinErrorId");
    const updateProps: TypeDefinitionElementProps = {
      id: Id64.fromString("0x111111"),
      classFullName: GenericGraphicalType2d.classFullName,
      model: IModel.dictionaryId,
      code,
    };
    expect(() => txn.updateElement(updateProps)).throws(`Error updating element [missing id], id: ${updateProps.id}`).to.have.property("iTwinErrorId");
    expect(() => txn.deleteElement(updateProps.id!)).throws(`Error deleting element [missing id], id: ${updateProps.id}`).to.have.property("iTwinErrorId");

    expect(() => txn.insertModel({ classFullName: DefinitionModel.classFullName, modeledElement: { id: "0x10000000bad" } })).throws("Error inserting model [error=10004], class=BisCore:DefinitionModel").to.have.property("iTwinErrorId");
    expect(() => txn.updateModel({
      id: Id64.fromString("0x111111"),
      modeledElement: { id: Id64.fromString("0x111111") },
      classFullName: ""
    })).throws(`Error updating model [missing id], id: ${Id64.fromString("0x111111")}`).to.have.property("iTwinErrorId");
    expect(() => txn.deleteModel(Id64.fromString("0x111111"))).throws(`Error deleting model [missing id], id: ${Id64.fromString("0x111111")}`).to.have.property("iTwinErrorId");
    txn.end("abandon");
  });

  it("should update codeValues that are switched between elements", async () => {
    const dbFileName = IModelTestUtils.prepareOutputFile("IModel", "change-codeValues.bim");
    const imodelDb = trackMutableIModel(SnapshotDb.createEmpty(dbFileName, {
      rootSubject: { name: "change-codeValues" },
    }));
    let categoryA = SpatialCategory.create(
      imodelDb,
      IModel.dictionaryId,
      "A"
    );
    let categoryB = SpatialCategory.create(
      imodelDb,
      IModel.dictionaryId,
      "B"
    );
    categoryA.userLabel = "A";
    categoryB.userLabel = "B";
    const txn = new EditTxn(imodelDb, "change codeValues");
    txn.start();
    categoryA.insert(txn);
    categoryB.insert(txn);
    txn.saveChanges();

    categoryA = imodelDb.elements.getElement(
      SpatialCategory.createCode(imodelDb, IModel.dictionaryId, "A")
    );
    categoryB = imodelDb.elements.getElement(
      SpatialCategory.createCode(imodelDb, IModel.dictionaryId, "B")
    );
    categoryA.code.value = "temp";
    categoryA.update(txn);
    categoryB.code.value = "A";
    categoryB.update(txn);
    categoryA.code.value = "B";
    categoryA.update(txn);
    txn.end();

    categoryA = imodelDb.elements.getElement(
      SpatialCategory.createCode(imodelDb, IModel.dictionaryId, "A")
    );
    categoryB = imodelDb.elements.getElement(
      SpatialCategory.createCode(imodelDb, IModel.dictionaryId, "B")
    );

    expect(categoryA.userLabel).to.equal("B", `categoryA.userLabel mismatch in ${imodelDb.name}`);
    expect(categoryB.userLabel).to.equal("A", `categoryB.userLabel mismatch in ${imodelDb.name}`);
    imodelDb.close();
  });

});
