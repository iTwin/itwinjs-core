/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { Code } from "../Code";
import { ColorDef } from "../Render";
import { ElementProps, Element, GeometricElement3d, GeometricElementProps, InformationPartitionElement, DefinitionPartition, LinkPartition, PhysicalPartition, GroupInformationPartition, DocumentPartition, Subject } from "../Element";
import { Entity, EntityCtor, EntityProps } from "../Entity";
import { Model } from "../Model";
import { Category, SubCategory } from "../Category";
import { ClassRegistry } from "../ClassRegistry";
import { ModelSelector } from "../ViewDefinition";
import { IModelError, IModelStatus } from "../IModelError";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";
import { SpatialViewDefinition, DisplayStyle3d } from "../ViewDefinition";
import { GeometricElement2d } from "../Element";
import { ElementPropertyFormatter } from "../backend/ElementPropertyFormatter";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelDb } from "../backend/IModelDb";
import { ECSqlStatement } from "../backend/ECSqlStatement";

describe("iModel", () => {
  let imodel: IModelDb;
  let imodel2: IModelDb;
  let imodel3: IModelDb;
  let imodel4: IModelDb;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("test.bim");
    imodel2 = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    imodel3 = await IModelTestUtils.openIModel("GetSetAutoHandledStructProperties.bim");
    imodel4 = await IModelTestUtils.openIModel("GetSetAutoHandledArrayProperties.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
    IModelTestUtils.closeIModel(imodel2);
    IModelTestUtils.closeIModel(imodel3);
    IModelTestUtils.closeIModel(imodel4);
  });

  /** test the copy constructor and to/from Json methods for the supplied entity */
  const testCopyAndJson = (entity: Entity) => {
    assert.isTrue(entity.isPersistent());
    const copyOf = entity.copyForEdit();
    assert.isFalse(copyOf.isPersistent());
    copyOf.setPersistent(); // just to allow deepEqual to work
    assert.deepEqual(entity, copyOf, "copyForEdit worked"); // make sure the copy is identical to original

    // now round trip the entity through a json string and back to a new entity.
    const jsonObj = JSON.parse(JSON.stringify(entity)) as EntityProps;
    jsonObj.iModel = entity.iModel; // this gets lost in the JSON string
    const el2 = new (entity.constructor as EntityCtor)(jsonObj); // create a new entity from the json
    el2.setPersistent(); // just to allow deepEqual to work
    assert.deepEqual(entity, el2, "json stringify worked");
  };

  it("should use schema to look up classes by name", async () => {
    const elementClass = await BisCore.getClass(Element.name, imodel);
    const categoryClass = await BisCore.getClass(Category.name, imodel);
    assert.equal(elementClass.name, "Element");
    assert.equal(categoryClass.name, "Category");
  });

  it("should load a known element by Id from an existing iModel", async () => {
    assert.exists(imodel.elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await imodel.elements.getElement(code1);
    assert.exists(el);
    const el2 = await imodel.elements.getElement(new Id64("0x34"));
    assert.exists(el2);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });

    try {
      await imodel.elements.getElement(badCode); // throws Error
      assert.fail(); // this line should be skipped
    } catch (error) {
      assert.isTrue(error instanceof Error);
      assert.isTrue(error instanceof IModelError);
    }

    const subCat = await imodel.elements.getElement(new Id64("0x2e"));
    assert.isTrue(subCat instanceof SubCategory);
    if (subCat instanceof SubCategory) {
      assert.isTrue(subCat.appearance.color.tbgr === 16777215);
      assert.isTrue(subCat.appearance.weight === 2);
      assert.isTrue(subCat.id.getLow() === 46);
      assert.isTrue(subCat.id.getHigh() === 0);
      assert.isTrue(subCat.code.spec.getLow() === 30);
      assert.isTrue(subCat.code.spec.getHigh() === 0);
      assert.isTrue(subCat.code.scope === "0X2D");
      assert.isTrue(subCat.code.value === "A-Z013-G-Legn");
      testCopyAndJson(subCat);
    }

    /// Get the parent Category of the subcategory.
    const cat = await imodel.elements.getElement((subCat as SubCategory).getCategoryId());
    assert.isTrue(cat instanceof Category);
    if (cat instanceof Category) {
      assert.isTrue(cat.id.getLow() === 45);
      assert.isTrue(cat.id.getHigh() === 0);
      assert.isTrue(cat.description === "Legends, symbols keys");
      assert.isTrue(cat.code.spec.getLow() === 22);
      assert.isTrue(cat.code.spec.getHigh() === 0);
      assert.isTrue(cat.code.value === "A-Z013-G-Legn");
      testCopyAndJson(cat);
    }

    const phys = await imodel.elements.getElement(new Id64("0x38"));
    assert.isTrue(phys instanceof GeometricElement3d);

    const a2 = await imodel2.elements.getElement(new Id64("0x1d"));
    assert.exists(a2);
    assert.isTrue(a2.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const el3 = await imodel2.elements.getElement(new Guid(a2.federationGuid!.value));
    assert.exists(el3);
    assert.notEqual(a2, el3);
    assert.isTrue(a2.id.equals(el3.id));
    testCopyAndJson(el3);

    const newEl = el3.copyForEdit<Element>();
    newEl.federationGuid = undefined;
    const newId = imodel2.elements.insertElement(newEl);
    assert.isTrue(newId.isValid(), "insert worked");
  });

  it("should create elements", async () => {
    const seedElement = await imodel2.elements.getElement(new Id64("0x1d"));
    assert.exists(seedElement);
    assert.isTrue(seedElement.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");

    for (let i = 0; i < 25; i++) {
      const elementProps: GeometricElementProps = {
        classFullName: "Generic:PhysicalObject",
        iModel: imodel2,
        model: seedElement.model,
        category: seedElement.category,
        id: new Id64(),
        code: Code.createEmpty(),
        federationGuid: new Guid(true),
        userLabel: "UserLabel-" + i,
      };

      const element: Element = await imodel2.elements.createElement(elementProps);
      element.setUserProperties("performanceTest", { s: "String-" + i, n: i });

      const elementId: Id64 = imodel2.elements.insertElement(element);
      assert.isTrue(elementId.isValid());
    }
  });

  it("should have a valid root subject element", async () => {
    const rootSubject = await imodel.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject.code.getValue().length, 1);

    try {
      await imodel.models.getSubModel(rootSubject.id); // throws error
      assert.fail(); // this line should be skipped
    } catch (error) {
      assert.isTrue(error instanceof Error);
      assert.isTrue(error instanceof IModelError);
      assert.equal(error.errorNumber, IModelStatus.NotFound);
      assert.equal(error.toDebugString(), "IModelStatus.NotFound");
    }

    const childIds: Id64[] = await imodel.elements.queryChildren(rootSubject.id);
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const childElement = await imodel.elements.getElement(childId);
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);

      testCopyAndJson(childElement);
      assert.isTrue(childElement.parent!.id.getLow() === rootSubject.id.getLow());
      if (childElement instanceof InformationPartitionElement) {
        const childSubModel: Model = await imodel.models.getSubModel(childElement.id);
        assert.exists(childSubModel, "InformationPartitionElements should have a subModel");

        if ((childId.getLow() === 16) && (childId.getHigh() === 0)) {
          assert.isTrue(childElement instanceof DefinitionPartition, "ChildId 0x00000010 should be a DefinitionPartition");
          assert.isTrue(childElement.code.value === "BisCore.DictionaryModel", "Definition Partition should have code value of BisCore.DictionaryModel");
        } else if ((childId.getLow() === 14) && (childId.getHigh() === 0)) {
          assert.isTrue(childElement instanceof LinkPartition);
          assert.isTrue(childElement.code.value === "BisCore.RealityDataSources");
        } else if ((childId.getLow() === 17) && (childId.getHigh() === 0)) {
          assert.isTrue(childElement instanceof LinkPartition, "ChildId 0x000000011 should be a LinkPartition");
          assert.isTrue(childElement.code.value === "Repository Links");
        }
      } else if (childElement instanceof Subject) {
        if ((childId.getLow() === 19) && (childId.getHigh() === 0)) {
          assert.isTrue(childElement instanceof Subject);
          assert.isTrue(childElement.code.value === "DgnV8:mf3, A", "Subject should have code value of DgnV8:mf3, A");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8File === "mf3.dgn", "Subject should have jsonProperty Subject.Job.DgnV.V8File");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8RootModel === "A", "Subject should have jsonProperty Subject.Job.DgnV.V8RootModel");
        }
      }
    }
  });

  it("should load a known model by Id from an existing iModel", async () => {
    assert.exists(imodel.models);
    const model2 = await imodel.models.getModel(new Id64("0x1c"));
    assert.exists(model2);
    testCopyAndJson(model2);
    let model = await imodel.models.getModel(imodel.models.repositoryModelId);
    assert.exists(model);
    testCopyAndJson(model!);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    model = await imodel.models.getSubModel(code1);
    const geomModel = await ClassRegistry.getClass("BisCore:PhysicalModel", imodel);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel!);
    testCopyAndJson(model!);
  });

  it("Model Selectors should hold models", async () => {
    const props: ElementProps = {
      iModel: imodel,
      classFullName: BisCore.name + ":" + ModelSelector.name,
      model: new Id64([1, 1]),
      code: Code.createEmpty(),
      id: new Id64(),
    };

    const entity = await ClassRegistry.createInstance(props);
    assert.isTrue(entity instanceof ModelSelector);
    const selector1 = entity as ModelSelector;
    assert.exists(selector1);
    if (selector1) {
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 3]));
    }
  });

  it("should produce an array of rows", async () => {
    const rowsJson: string = await imodel.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.exists(rowsJson);
    const rows: any = JSON.parse(rowsJson!);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].id);
    assert.notEqual(rows[0].id, "");
  });

  it("ElementPropertyFormatter should format", async () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await imodel.elements.getElement(code1);
    const formatter: ElementPropertyFormatter = new ElementPropertyFormatter(imodel);
    const props = await formatter.formatProperties(el);
    assert.exists(props);
    // WIP: format seems to have changed?
    // assert.isArray(props);
    // assert.notEqual(props.length, 0);
    // const item = props[0];
    // assert.isString(item.category);
    // assert.isArray(item.properties);
  });

  it("should be at least one view element", async () => {
    const viewJson: string = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + SpatialViewDefinition.sqlName);
    assert.exists(viewJson, "Should find some views");
    const viewRows: any[] = JSON.parse(viewJson!);
    for (const viewRow of viewRows!) {
      const viewId = new Id64(viewRow.elementId);
      const view = await imodel.elements.getElement(viewId);
      assert.isTrue(view instanceof SpatialViewDefinition, "Should be instance of SpatialViewDefinition");
      if (!view)
        continue;
      if (!(view instanceof SpatialViewDefinition))
        continue;
      assert.isTrue(view.code.value === "A Views - View 1", "Code value is A Views - View 1");
      assert.isTrue(view.getDisplayStyleId().getLow() === 0x36, "Display Style Id is 0x36");
      assert.isTrue(view.getCategorySelectorId().getLow() === 0x37, "Category Id is 0x37");
      assert.isFalse(view.cameraOn, "The camera is not turned on");
      assert.isTrue(view.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
      assert.isTrue(view.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
      assert.isTrue(view.rotation.isAlmostEqual(RotMatrix.identity), "View rotation is identity");
      assert.isTrue(view.jsonProperties.viewDetails.gridOrient === 0, "Grid orientation as expected");
      assert.isTrue(view.jsonProperties.viewDetails.gridSpaceX === 0.001, "GridSpaceX as expected");

      // get the display style element
      const displayStyle = await imodel.elements.getElement(view.getDisplayStyleId());
      assert.isTrue(displayStyle instanceof DisplayStyle3d, "The Display Style should be a DisplayStyle3d");
      if (!(displayStyle instanceof DisplayStyle3d))
        continue;
      const bgColorDef: ColorDef = displayStyle.getBackgroundColor();
      assert.isTrue(bgColorDef.tbgr === 0, "The background as expected");
      const sceneBrightness: number = displayStyle.getSceneBrightness();
      assert.isTrue(sceneBrightness === 0);
    }
  });

  it("should be some categories", async () => {
    const categoryJson: string = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + Category.sqlName);
    assert.exists(categoryJson, "Should have some Category ids");
    const categoryRows: any[] = JSON.parse(categoryJson!);
    for (const categoryRow of categoryRows!) {
      const categoryId: Id64 = new Id64(categoryRow.elementId);
      const category = await imodel.elements.getElement(categoryId);
      assert.isTrue(category instanceof Category, "Should be instance of Category");
      if (!category)
        continue;
      if (!(category instanceof Category))
        continue;

      // verify the default subcategory.
      const defaultSubCategoryId: Id64 = category.myDefaultSubCategoryId();
      const defaultSubCategory = await imodel.elements.getElement(defaultSubCategoryId);
      assert.isTrue(defaultSubCategory instanceof SubCategory, "defaultSubCategory should be instance of SubCategory");
      if (defaultSubCategory instanceof SubCategory) {
        assert.isTrue(defaultSubCategory.parent!.id.equals(categoryId), "defaultSubCategory id should be prescribed value");
        assert.isTrue(defaultSubCategory.getSubCategoryName() === category.code.getValue(), "DefaultSubcategory name should match that of Category");
        assert.isTrue(defaultSubCategory.isDefaultSubCategory(), "isDefaultSubCategory should return true");
      }

      // get the subcategories
      const queryString: string = "SELECT ECInstanceId as elementId FROM " + SubCategory.sqlName + " WHERE Parent.Id=" + categoryId;
      const subCategoryJson: string = await imodel.executeQuery(queryString);
      assert.exists(subCategoryJson, "Should have at least one SubCategory");
      const subCategoryRows: any[] = JSON.parse(subCategoryJson!);
      for (const subCategoryRow of subCategoryRows) {
        const subCategoryId = new Id64(subCategoryRow.elementId);
        const subCategory = await imodel.elements.getElement(subCategoryId);
        assert.isTrue(subCategory instanceof SubCategory);
        if (subCategory instanceof SubCategory) {
          assert.isTrue(subCategory.parent!.id.equals(categoryId));
        }
      }
    }
  });

  it("should be some 2d elements", async () => {
    const drawingGraphicJson: string = await imodel2.executeQuery("SELECT ECInstanceId as elementId FROM BisCore.DrawingGraphic");
    assert.exists(drawingGraphicJson, "Should have some Drawing Graphics");
    const drawingGraphicRows: any[] = JSON.parse(drawingGraphicJson!);
    for (const drawingGraphicRow of drawingGraphicRows!) {
      const drawingGraphicId: Id64 = new Id64(drawingGraphicRow.elementId);
      const drawingGraphic = await imodel2.elements.getElement(drawingGraphicId);
      assert.exists(drawingGraphic);
      assert.isTrue(drawingGraphic.constructor.name === "DrawingGraphic", "Should be instance of DrawingGraphic");
      assert.isTrue(drawingGraphic instanceof GeometricElement2d, "Is instance of GeometricElement2d");
      if (drawingGraphic.id.getLow() === 0x25) {
        assert.isTrue(drawingGraphic.placement.origin.x === 0.0);
        assert.isTrue(drawingGraphic.placement.origin.y === 0.0);
        assert.isTrue(drawingGraphic.placement.angle.radians === 0.0);
        assert.isTrue(drawingGraphic.placement.bbox.low.x === 0.0);
        assert.isTrue(drawingGraphic.placement.bbox.low.y === 0.0);
        assert.isTrue(drawingGraphic.placement.bbox.high.x === 1.0);
        assert.isTrue(drawingGraphic.placement.bbox.high.y === 1.0);
        assert.isDefined(drawingGraphic.geom);
      }
      if (drawingGraphic.id.getLow() === 0x26) {
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
  });

  it("should be children of RootSubject", async () => {
    const queryString: string = "SELECT ECInstanceId as modelId FROM " + Model.sqlName + " WHERE ParentModel.Id=" + imodel2.models.repositoryModelId;
    const modelJson: string = await imodel2.executeQuery(queryString);
    assert.exists(modelJson, "Should have at least one model within rootSubject");
    const modelRows: any[] = JSON.parse(modelJson!);
    for (const modelRow of modelRows) {
      const modelId = new Id64(modelRow.modelId);
      const model = await imodel2.models.getModel(modelId);
      assert.exists(model, "Model should exist");
      assert.isTrue(model instanceof Model);

      // should be an element with the same Id.
      const modeledElement = await imodel2.elements.getElement(modelId);
      assert.exists(modeledElement, "Modeled Element should exist");

      if (model.constructor.name === "LinkModel") {
        // expect LinkModel to be accompanied by LinkPartition
        assert.isTrue(modeledElement instanceof LinkPartition);
        continue;
      } else if (model.constructor.name === "DictionaryModel") {
        assert.isTrue(modeledElement instanceof DefinitionPartition);
        continue;
      } else if (model.constructor.name === "PhysicalModel") {
        assert.isTrue(modeledElement instanceof PhysicalPartition);
        continue;
      } else if (model.constructor.name === "GroupModel") {
        assert.isTrue(modeledElement instanceof GroupInformationPartition);
        continue;
      } else if (model.constructor.name === "DocumentListModel") {
        assert.isTrue(modeledElement instanceof DocumentPartition);
        continue;
      } else if (model.constructor.name === "DefinitionModel") {
        assert.isTrue(modeledElement instanceof DefinitionPartition);
        continue;
      } else {
        assert.isTrue(false, "Expected a known model type");
      }
    }
  });

  it("should produce an array of rows with executeQuery", async () => {
    const allrowsdata: string = await imodel.executeQuery("SELECT * FROM bis.Element");
    assert.exists(allrowsdata);
    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });

  /* TBD
  it("should load struct properties", async () => {
    const el1 = await imodel3.elements.getElement(new Id64("0x14"));
    assert.isDefined(el1);
    // *** TODO: Check that struct property was loaded
  });

  it("should load array properties", async () => {
    const el1 = await imodel3.elements.getElement(new Id64("0x14"));
    assert.isDefined(el1);
    // *** TODO: Check that array property was loaded
  });
  */

  it("should insert and update auto-handled properties", async () => {
    const testElem = await imodel4.elements.getElement(new Id64("0x14"));
    assert.isDefined(testElem);
    assert.equal(testElem.classFullName, "DgnPlatformTest:TestElementWithNoHandler");
    assert.isUndefined(testElem.integerProperty1);

    const newTestElem = testElem.copyForEdit<Element>();
    assert.equal(newTestElem.classFullName, testElem.classFullName);
    newTestElem.integerProperty1 = 999;
    assert.isTrue(testElem.arrayOfPoint3d[0].isAlmostEqual(newTestElem.arrayOfPoint3d[0]));

    const loc1 = { street: "Elm Street", city: { name: "Downingtown", state: "PA" } };
    const loc2 = { street: "Oak Street", city: { name: "Downingtown", state: "PA" } };
    // TODO: struct arrays   const loc3 = {street: "Chestnut Street", city: {name: "Philadelphia", state: "PA"}};
    // TODO: struct arrays    const arrayOfStructs = [loc2, loc3];
    newTestElem.location = loc1;
    // TODO: struct arrays    newTestElem.arrayOfStructs = arrayOfStructs;
    newTestElem.dtUtc = new Date("2015-03-25");
    newTestElem.p3d = new Point3d(1, 2, 3);

    const newTestElemId = imodel4.elements.insertElement(newTestElem);

    assert.isTrue(newTestElemId.isValid(), "insert worked");

    const newTestElemFetched = await imodel4.elements.getElement(newTestElemId);
    assert.isDefined(newTestElemFetched);
    assert.isTrue(newTestElemFetched.id.equals(newTestElemId));
    assert.equal(newTestElemFetched.classFullName, newTestElem.classFullName);
    assert.isDefined(newTestElemFetched.integerProperty1);
    assert.equal(newTestElemFetched.integerProperty1, newTestElem.integerProperty1);
    assert.isTrue(newTestElemFetched.arrayOfPoint3d[0].isAlmostEqual(newTestElem.arrayOfPoint3d[0]));
    assert.deepEqual(newTestElemFetched.location, loc1);
    // TODO: struct arrays   assert.deepEqual(newTestElem.arrayOfStructs, arrayOfStructs);
    // TODO: getElement must convert date ISO string to Date object    assert.deepEqual(newTestElemFetched.dtUtc, newTestElem.dtUtc);
    assert.isTrue(newTestElemFetched.p3d.isAlmostEqual(newTestElem.p3d));

    // ----------- updates ----------------
    const wasp3d = newTestElemFetched.p3d;
    const editElem = newTestElemFetched.copyForEdit() as Element;
    editElem.location = loc2;
    try {
      await imodel4.elements.updateElement(editElem);
    } catch (_err) {
      assert.fail("Element.update failed");
    }
    const afterUpdateElemFetched = await imodel4.elements.getElement(editElem.id);
    // TODO: autoHandlePropertiesToJson in native code must convert property names to lowercase - assert.deepEqual(afterUpdateElemFetched.location, loc2, " location property should be the new one");
    assert.deepEqual(afterUpdateElemFetched.id, editElem.id, " the id should not have changed.");
    assert.deepEqual(afterUpdateElemFetched.p3d, wasp3d, " p3d property should not have changed");

    // ------------ delete -----------------
    const elid = afterUpdateElemFetched.id;
    await imodel4.elements.deleteElement(afterUpdateElemFetched);
    try {
      await imodel4.elements.getElement(elid);
      assert.fail("should fail to load the element.");
    } catch (error) {
      // TODO: test that error is what I expect assert.equal(error.status == IModelStatus.)
    }
  });

  function checkElementMetaData(metadataStr: string) {
    assert(metadataStr && metadataStr.length > 0);
    const obj: any = JSON.parse(metadataStr || "");
    assert.isNotNull(obj);
    assert.equal(obj.ecclass, "BisCore:Element");
    assert.isArray(obj.baseClasses);
    assert.equal(obj.baseClasses.length, 0);

    assert.isArray(obj.customAttributes);
    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    for (const ca of obj.customAttributes) {
      if (ca.ecclass === "BisCore:ClassHasHandler")
        foundClassHasHandler = true;
      else if (ca.ecclass === "CoreCustomAttributes:ClassHasCurrentTimeStampProperty")
        foundClassHasCurrentTimeStampProperty = true;
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    assert.isDefined(obj.properties.federationGuid);
    assert.equal(obj.properties.federationGuid.primitiveType, 257);
    assert.equal(obj.properties.federationGuid.extendedType, "BeGuid");
  }

  it("should get metadata for class (async)", async () => {
    const metadataStr: string = await imodel.getECClassMetaData("BisCore", "Element");
    assert.exists(metadataStr);
    checkElementMetaData(metadataStr);
  });

  function checkClassHasHandlerMetaData(metadataStr: string) {
    assert(metadataStr && metadataStr.length > 0);
    const obj: any = JSON.parse(metadataStr || "");
    assert.isDefined(obj.properties.restrictions);
    assert.equal(obj.properties.restrictions.primitiveType, 2305);
    assert.equal(obj.properties.restrictions.minOccurs, 0);
  }

  it("should get metadata for CA class just as well (and we'll see a array-typed property) (sync)", async () => {
    const metadataStr: string = imodel.getECClassMetaDataSync("BisCore", "ClassHasHandler");
    assert.exists(metadataStr);
    checkClassHasHandlerMetaData(metadataStr);
  });

  it("should get metadata for CA class just as well (and we'll see a array-typed property) (async)", async () => {
    const metadataStr: string = await imodel.getECClassMetaData("BisCore", "ClassHasHandler");
    assert.exists(metadataStr);
    checkClassHasHandlerMetaData(metadataStr);
  });

  it("should exercise ECSqlStatement (backend only)", () => {
    // Reject an invalid statement
    try {
      imodel2.prepareECSqlStatement("select no_such_property, codeValue from bis.element");
      assert.fail("prepare should have failed with an exception");
    } catch (err) {
      assert.isTrue(err.constructor.name === "IModelError");
      assert.notEqual(err.status, DbResult.BE_SQLITE_OK);
    }
    let lastId: string = "";
    let firstCodeValue: string = "";
    imodel2.withPreparedECSqlStatement("select ecinstanceid, codeValue from bis.element", (stmt: ECSqlStatement) => {
      assert.isNotNull(stmt);
      // Reject an attempt to bind when there are no placeholders in the statement
      try {
        stmt.bindValues({foo: 1});
        assert.fail("bindValues should have failed with an exception");
      } catch (err2) {
        assert.isTrue(err2.constructor.name === "IModelError");
        assert.notEqual(err2.status, DbResult.BE_SQLITE_OK);
      }

      // Verify that we get a bunch of rows with the expected shape
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt.step()) {
        const row = stmt.getValues();
        assert.isNotNull(row);
        assert.isObject(row);
        assert.isTrue(row.id !== undefined);
        assert.isString(row.id);
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
        assert.isString(row.id);
        lastIterId = row.id;
        iteratorCount = iteratorCount + 1;
        if (row.codeValue !== undefined)
          firstCodeValueIter = row.codeValue;
      }
      assert.equal(iteratorCount, count, "iterator loop should find the same number of rows as the step loop");
      assert.equal(lastIterId, lastId, "iterator loop should see the same last row as the step loop");
      assert.equal(firstCodeValueIter, firstCodeValue, "iterator loop should find the first non-null code value as the step loop");
    });

    imodel2.withPreparedECSqlStatement("select ecinstanceid, codeValue from bis.element WHERE (ecinstanceid=?)", (stmt3: ECSqlStatement) => {
      // Now try a statement with a placeholder
      const idToFind: Id64 = new Id64(lastId);
      stmt3.bindValues([idToFind]);
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt3.step()) {
        count = count + 1;
        const row = stmt3.getValues();
        // Verify that we got the row that we asked for
        assert.isTrue(idToFind.equals(new Id64(row.id)));
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

    imodel2.withPreparedECSqlStatement("select ecinstanceid, codeValue from bis.element WHERE (codeValue = :codevalue)", (stmt4: ECSqlStatement) => {
      // Try a named placeholder
      const codeValueToFind = firstCodeValue;
      stmt4.bindValues({codeValue: codeValueToFind});
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt4.step()) {
        count = count + 1;
        const row = stmt4.getValues();
        // Verify that we got the row that we asked for
        assert.equal(row.codeValue, codeValueToFind);
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

  });

  /* TBD
      DgnCode physicalPartitionCode = PhysicalPartition::CreateCode(*m_db->Elements().GetRootSubject(), s_seedFileInfo.physicalPartitionName);
    m_defaultModelId = m_db->Models().QuerySubModelId(physicalPartitionCode);
    ASSERT_TRUE(m_defaultModelId.IsValid());

    m_defaultCategoryId = SpatialCategory::QueryCategoryId(GetDgnDb().GetDictionaryModel(), s_seedFileInfo.categoryName);
    ASSERT_TRUE(m_defaultCategoryId.IsValid());
  */

  it("should measure insert performance (backend))", async () => {

    // TODO: Make a copy of imodel3 before writing to it

    const theModel = new Id64("0X11"); // TODO: Look up model by code (i.e., codevalue of a child of root subject, where child has a PhysicalPartition)
    const defaultCategoryId = new Id64("0x12"); // (await IModelTestUtils.getSpatiallCategoryByName(imodel3, "DefaultCategory")).Id;

    const elementCount = 10000;
    for (let i = 0; i < elementCount; ++i) {

        const element: Element = imodel3.elements.createElementSync({
          classFullName: "DgnPlatformTest:TestElement",
          iModel: imodel3,
          model: theModel,
          id: new Id64(),
          code: Code.createDefault(),
          category: defaultCategoryId,
        });

        element.IntegerProperty1 = i;        // auto-handled
        element.IntegerProperty2 = i;        // auto-handled
        element.IntegerProperty3 = i;        // auto-handled
        element.IntegerProperty4 = i;        // auto-handled
        element.TestElementProperty = i;     // custom-handled
        element.DoubleProperty1 = i;
        element.DoubleProperty2 = i;
        element.DoubleProperty3 = i;
        element.DoubleProperty4 = i;
        element.b = (0 === (i % 100));
        const pt: Point3d = new Point3d(i, 0, 0);
        element.PointProperty1 = pt;
        element.PointProperty2 = pt;
        element.PointProperty3 = pt;
        element.PointProperty4 = pt;
        const dtUtc: Date = new Date("2013-09-15 12:05:39");
        element.dtUtc = dtUtc;

        assert.isTrue((imodel3.elements.insertElement(element)).isValid(), "insert worked");
        if (0 === (i % 100))
            imodel3.saveChanges();
        }

    imodel3.saveChanges();

    imodel3.withPreparedECSqlStatement("select count(*) as [count] from DgnPlatformTest.TestElement", (stmt: ECSqlStatement) => {
      assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
      const row = stmt.getValues();
      const expectedCountAsHex = "0X" + (elementCount + 1).toString(16).toUpperCase();
      assert.equal(row.count, expectedCountAsHex);
    });
  });
});
