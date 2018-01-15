/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Code, CodeSpec, CodeScopeSpec } from "../common/Code";
import { EntityProps } from "../common/EntityProps";
import { ModelSelectorState } from "../common/ViewState";
import { IModelError, IModelStatus } from "../common/IModelError";
import { Entity, EntityCtor, EntityMetaData, PrimitiveTypeCode } from "../backend/Entity";
import { Model, DictionaryModel } from "../backend/Model";
import { Category, SubCategory, SpatialCategory } from "../backend/Category";
import { ClassRegistry } from "../backend/ClassRegistry";
import { BisCore } from "../backend/BisCore";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import { GeometricElementProps, ModelSelectorProps } from "../common/ElementProps";
import {
  Element, GeometricElement2d, GeometricElement3d, InformationPartitionElement, DefinitionPartition,
  LinkPartition, PhysicalPartition, GroupInformationPartition, DocumentPartition, Subject,
} from "../backend/Element";
import { ElementPropertyFormatter } from "../backend/ElementPropertyFormatter";
import { IModelDb } from "../backend/IModelDb";
import { ModelSelector } from "../backend/ViewDefinition";
import { IModelTestUtils } from "./IModelTestUtils";
import { ModelProps } from "../common/ModelProps";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { ElementGroupsMembers } from "../backend/LinkTableRelationship";
import { Appearance } from "../common/SubCategoryAppearance";
import { ColorDef } from "../common/ColorDef";
import { IModel } from "../common/IModel";

/* tslint:disable: no-console */
/* spell-checker: disable */

describe("iModel", () => {
  let imodel1: IModelDb;
  let imodel2: IModelDb;
  let imodel3: IModelDb;
  let imodel4: IModelDb;

  before(() => {
    imodel1 = IModelTestUtils.openIModel("test.bim");
    imodel2 = IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
    imodel3 = IModelTestUtils.openIModel("GetSetAutoHandledStructProperties.bim");
    imodel4 = IModelTestUtils.openIModel("GetSetAutoHandledArrayProperties.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel1);
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
    const el2 = new (entity.constructor as EntityCtor)(jsonObj, entity.iModel); // create a new entity from the json
    el2.setPersistent(); // just to allow deepEqual to work
    assert.deepEqual(entity, el2, "json stringify worked");
  };

  it("should be able to get the name of the IModel", () => {
    expect(imodel1.name).equals("TBD"); // That's the name of the root subject!
  });

  it("should be able to get extents of the IModel", () => {
    const extents: AxisAlignedBox3d = imodel1.projectExtents;
    assert(!extents.isNull());
  });

  it("should use schema to look up classes by name", () => {
    const elementClass = BisCore.getClass(Element.name, imodel1);
    const categoryClass = BisCore.getClass(Category.name, imodel1);
    assert.isDefined(elementClass);
    assert.isDefined(categoryClass);
    assert.equal(elementClass!.name, "Element");
    assert.equal(categoryClass!.name, "Category");
  });

  it("should load a known element by Id from an existing iModel", () => {
    assert.exists(imodel1.elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel1.elements.getElement(code1);
    assert.exists(el);
    const el2 = imodel1.elements.getElement(new Id64("0x34"));
    assert.exists(el2);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });

    try {
      imodel1.elements.getElement(badCode); // throws Error
      assert.fail(); // this line should be skipped
    } catch (error) {
      assert.instanceOf(error, Error);
      assert.instanceOf(error, IModelError);
      assert.equal(error.errorNumber, IModelStatus.NotFound);
      assert.equal(error.name, "IModelStatus.NotFound");
      assert.isTrue(error.toString().startsWith("IModelStatus.NotFound"));
    }

    const subCat = imodel1.elements.getElement(new Id64("0x2e"));
    assert.isTrue(subCat instanceof SubCategory);
    if (subCat instanceof SubCategory) {
      assert.isTrue(subCat.appearance.color.tbgr === 16777215);
      assert.isTrue(subCat.appearance.weight === 2);
      assert.isTrue(subCat.id.getLow() === 46);
      assert.isTrue(subCat.id.getHigh() === 0);
      assert.isTrue(subCat.code.spec.getLow() === 30);
      assert.isTrue(subCat.code.spec.getHigh() === 0);
      assert.isTrue(subCat.code.scope === "0x2d");
      assert.isTrue(subCat.code.value === "A-Z013-G-Legn");
      testCopyAndJson(subCat);
    }

    /// Get the parent Category of the subcategory.
    const cat = imodel1.elements.getElement((subCat as SubCategory).getCategoryId());
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

    const phys = imodel1.elements.getElement(new Id64("0x38"));
    assert.isTrue(phys instanceof GeometricElement3d);

    const a2 = imodel2.elements.getElement(new Id64("0x1d"));
    assert.exists(a2);
    assert.isTrue(a2.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const el3: Element = imodel2.elements.getElement(new Guid(a2.federationGuid!.value));
    assert.exists(el3);
    assert.notEqual(a2, el3);
    assert.isTrue(a2.id.equals(el3.id));
    testCopyAndJson(el3);

    const newEl = el3.copyForEdit<Element>();
    newEl.federationGuid = undefined;
    const newId: Id64 = imodel2.elements.insertElement(newEl);
    assert.isTrue(newId.isValid(), "insert worked");
  });

  it("should create elements", () => {
    const seedElement = imodel2.elements.getElement(new Id64("0x1d"));
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

      const element: Element = imodel2.elements.createElement(elementProps);
      element.setUserProperties("performanceTest", { s: "String-" + i, n: i });

      const elementId: Id64 = imodel2.elements.insertElement(element);
      assert.isTrue(elementId.isValid());
    }
  });

  it("should have a valid root subject element", () => {
    const rootSubject = imodel1.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject.code.getValue().length, 1);

    try {
      imodel1.models.getSubModel(rootSubject.id); // throws error
      assert.fail(); // this line should be skipped
    } catch (error) {
      assert.isTrue(error instanceof Error);
      assert.isTrue(error instanceof IModelError);
      assert.equal(error.errorNumber, IModelStatus.NotFound);
      assert.equal(error.name, "IModelStatus.NotFound");
    }

    const childIds: Id64[] = imodel1.elements.queryChildren(rootSubject.id);
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const childElement = imodel1.elements.getElement(childId);
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);

      testCopyAndJson(childElement);
      assert.isTrue(rootSubject.id.equals(childElement.parent!.id));
      if (childElement instanceof InformationPartitionElement) {
        const childSubModel: Model = imodel1.models.getSubModel(childElement.id);
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

  it("should load a known model by Id from an existing iModel", () => {
    assert.exists(imodel1.models);
    const model2 = imodel1.models.getModel(new Id64("0x1c"));
    assert.exists(model2);
    testCopyAndJson(model2);
    let model = imodel1.models.getModel(imodel1.models.repositoryModelId);
    assert.exists(model);
    testCopyAndJson(model!);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    model = imodel1.models.getSubModel(code1);
    // By this point, we expect the submodel's class to be in the class registry *cache*
    const geomModel = ClassRegistry.getClass("BisCore:PhysicalModel", imodel1);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel!);
    testCopyAndJson(model!);
  });

  it("Model Selectors should hold models", () => {
    const props: ModelSelectorProps = {
      classFullName: BisCore.name + ":" + ModelSelector.name,
      model: new Id64([1, 1]),
      code: Code.createEmpty(),
      id: new Id64(),
      models: ["0x1"],
    };

    const selector = new ModelSelectorState(props, imodel1);
    selector.addModel(new Id64([2, 1]));
    selector.addModel(new Id64([2, 1]));
    selector.addModel(new Id64([2, 3]));
    assert.equal(selector.models.size, 3);
    const out = selector.toJSON();
    assert.isArray(out.models);
    assert.equal(out.models.length, 3);
    out.iModel = imodel1;
    const sel2 = imodel1.constructEntity(out);
    assert.instanceOf(sel2, ModelSelector);
    assert.equal(sel2.models.length, 3);
    const sel3 = selector.clone();
    assert.deepEqual(sel3, selector, "clone worked");
  });

  it("should produce an array of rows", () => {
    const rows: any[] = imodel1.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.exists(rows);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].id);
    assert.notEqual(rows[0].id, "");
  });

  it("ElementPropertyFormatter should format", () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel1.elements.getElement(code1);
    const formatter: ElementPropertyFormatter = new ElementPropertyFormatter(imodel1);
    const props = formatter.formatProperties(el);
    assert.exists(props);
    // WIP: format seems to have changed?
    // assert.isArray(props);
    // assert.notEqual(props.length, 0);
    // const item = props[0];
    // assert.isString(item.category);
    // assert.isArray(item.properties);
  });

  it("should be some categories", () => {
    const categoryRows: any[] = imodel1.executeQuery("SELECT EcInstanceId as elementId FROM " + Category.sqlName);
    assert.exists(categoryRows, "Should have some Category ids");
    for (const categoryRow of categoryRows!) {
      const categoryId: Id64 = new Id64(categoryRow.elementId);
      const category = imodel1.elements.getElement(categoryId);
      assert.isTrue(category instanceof Category, "Should be instance of Category");
      if (!category)
        continue;
      if (!(category instanceof Category))
        continue;

      // verify the default subcategory.
      const defaultSubCategoryId: Id64 = category.myDefaultSubCategoryId();
      const defaultSubCategory = imodel1.elements.getElement(defaultSubCategoryId);
      assert.isTrue(defaultSubCategory instanceof SubCategory, "defaultSubCategory should be instance of SubCategory");
      if (defaultSubCategory instanceof SubCategory) {
        assert.isTrue(defaultSubCategory.parent!.id.equals(categoryId), "defaultSubCategory id should be prescribed value");
        assert.isTrue(defaultSubCategory.getSubCategoryName() === category.code.getValue(), "DefaultSubcategory name should match that of Category");
        assert.isTrue(defaultSubCategory.isDefaultSubCategory(), "isDefaultSubCategory should return true");
      }

      // get the subcategories
      const queryString: string = "SELECT ECInstanceId as elementId FROM " + SubCategory.sqlName + " WHERE Parent.Id=?";
      const subCategoryRows: any[] = imodel1.executeQuery(queryString, [categoryId]);
      assert.exists(subCategoryRows, "Should have at least one SubCategory");
      for (const subCategoryRow of subCategoryRows) {
        const subCategoryId = new Id64(subCategoryRow.elementId);
        const subCategory = imodel1.elements.getElement(subCategoryId);
        assert.isTrue(subCategory instanceof SubCategory);
        if (subCategory instanceof SubCategory) {
          assert.isTrue(subCategory.parent!.id.equals(categoryId));
        }
      }
    }
  });

  it("should be some 2d elements", () => {
    const drawingGraphicRows: any[] = imodel2.executeQuery("SELECT ECInstanceId as elementId FROM BisCore.DrawingGraphic");
    assert.exists(drawingGraphicRows, "Should have some Drawing Graphics");
    for (const drawingGraphicRow of drawingGraphicRows!) {
      const drawingGraphicId: Id64 = new Id64(drawingGraphicRow.elementId);
      const drawingGraphic = imodel2.elements.getElement(drawingGraphicId);
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

  it("should be children of RootSubject", () => {
    const queryString: string = "SELECT ECInstanceId as modelId FROM " + Model.sqlName + " WHERE ParentModel.Id=" + imodel2.models.repositoryModelId;
    const modelRows: any[] = imodel2.executeQuery(queryString);
    assert.exists(modelRows, "Should have at least one model within rootSubject");
    for (const modelRow of modelRows) {
      const modelId = new Id64(modelRow.modelId);
      const model = imodel2.models.getModel(modelId);
      assert.exists(model, "Model should exist");
      assert.isTrue(model instanceof Model);

      // should be an element with the same Id.
      const modeledElement = imodel2.elements.getElement(modelId);
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

  it("should produce an array of rows with executeQuery", () => {
    const rows: any[] = imodel1.executeQuery("SELECT * FROM bis.Element");
    assert.exists(rows);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });

  /* TBD
  it("should load struct properties", () => {
    const el1 = imodel3.elements.getElement(new Id64("0x14"));
    assert.isDefined(el1);
    // *** TODO: Check that struct property was loaded
  });

  it("should load array properties", () => {
    const el1 = imodel3.elements.getElement(new Id64("0x14"));
    assert.isDefined(el1);
    // *** TODO: Check that array property was loaded
  });
  */

  it("should insert and update auto-handled properties", () => {
    const testElem = imodel4.elements.getElement(new Id64("0x14"));
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

    const newTestElemFetched = imodel4.elements.getElement(newTestElemId);
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
    const editElem = newTestElemFetched.copyForEdit<Element>();
    editElem.location = loc2;
    try {
      imodel4.elements.updateElement(editElem);
    } catch (_err) {
      assert.fail("Element.update failed");
    }
    const afterUpdateElemFetched = imodel4.elements.getElement(editElem.id);
    assert.deepEqual(afterUpdateElemFetched.location, loc2, " location property should be the new one");
    assert.deepEqual(afterUpdateElemFetched.id, editElem.id, " the id should not have changed.");
    assert.deepEqual(afterUpdateElemFetched.p3d, wasp3d, " p3d property should not have changed");

    // ------------ delete -----------------
    const elid = afterUpdateElemFetched.id;
    imodel4.elements.deleteElement(elid);
    try {
      imodel4.elements.getElement(elid);
      assert.fail("should fail to load the element.");
    } catch (error) {
      // TODO: test that error is what I expect assert.equal(error.status == IModelStatus.)
    }
  });

  function checkElementMetaData(obj: EntityMetaData) {
    assert.isNotNull(obj);
    assert.equal(obj.ecclass, "BisCore:Element");
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
    const metaData: EntityMetaData = imodel1.getMetaData("BisCore:Element");
    assert.exists(metaData);
    checkElementMetaData(metaData);
  });

  it.skip("should update the imodel project extents", async () => {
    const originalExtents = imodel1.projectExtents;
    const newExtents = new AxisAlignedBox3d(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50; newExtents.low.y -= 25; newExtents.low.z -= 189;
    newExtents.high.x += 1087; newExtents.high.y += 19; newExtents.high.z += .001;
    imodel1.updateProjectExtents(newExtents);

    assert.isDefined(imodel1.briefcaseInfo, "Briefcase info should be defined before getting iModel props");
    const updatedProps = JSON.parse(imodel1.briefcaseInfo!.nativeDb.getIModelProps());
    assert.isTrue(updatedProps.hasOwnProperty("projectExtents"), "Returned property JSON object has project extents");
    const updatedExtents = AxisAlignedBox3d.fromJSON(updatedProps.projectExtents);
    assert.isTrue(newExtents.isAlmostEqual(updatedExtents), "Project extents successfully updated in database");
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
    const metaData: EntityMetaData = imodel1.getMetaData("BisCore:ClassHasHandler");
    assert.exists(metaData);
    checkClassHasHandlerMetaData(metaData);
  });

  it("should exercise ECSqlStatement (backend only)", () => {
    // Reject an invalid statement
    try {
      imodel2.prepareStatement("select no_such_property, codeValue from bis.element");
      assert.fail("prepare should have failed with an exception");
    } catch (err) {
      assert.isTrue(err.constructor.name === "IModelError");
      assert.notEqual(err.status, DbResult.BE_SQLITE_OK);
    }
    let lastId: string = "";
    let firstCodeValue: string = "";
    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element", (stmt: ECSqlStatement) => {
      assert.isNotNull(stmt);
      // Reject an attempt to bind when there are no placeholders in the statement
      try {
        stmt.bindValues({ foo: 1 });
        assert.fail("bindValues should have failed with an exception");
      } catch (err2) {
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

    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element WHERE (ecinstanceid=?)", (stmt3: ECSqlStatement) => {
      // Now try a statement with a placeholder
      const idToFind: Id64 = new Id64(lastId);
      stmt3.bindValues([idToFind]);
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt3.step()) {
        count = count + 1;
        const row = stmt3.getRow();
        // Verify that we got the row that we asked for
        assert.isTrue(idToFind.equals(new Id64(row.id)));
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

    imodel2.withPreparedStatement("select ecinstanceid, codeValue from bis.element WHERE (codeValue = :codevalue)", (stmt4: ECSqlStatement) => {
      // Try a named placeholder
      const codeValueToFind = firstCodeValue;
      stmt4.bindValues({ codeValue: codeValueToFind });
      let count = 0;
      while (DbResult.BE_SQLITE_ROW === stmt4.step()) {
        count = count + 1;
        const row = stmt4.getRow();
        // Verify that we got the row that we asked for
        assert.equal(row.codeValue, codeValueToFind);
      }
      // Verify that we got the row that we asked for
      assert.equal(count, 1);
    });

  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = imodel2;

    const codeSpec: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec1", CodeScopeSpec.Type.Model);
    // TODO: codeSpec.buildResourcesRequest + tesetImodel.requestResources
    const codeSpecId: Id64 = testImodel.codeSpecs.insert(codeSpec); // throws in case of error
    assert.deepEqual(codeSpecId, codeSpec.id);

    // Should not be able to insert a duplicate.
    try {
      const codeSpecDup: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec1", CodeScopeSpec.Type.Model);
      testImodel.codeSpecs.insert(codeSpecDup); // throws in case of error
      assert.fail();
    } catch (err) {
      // We expect this to fail.
    }

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec2Id: Id64 = testImodel.codeSpecs.insert(codeSpec2); // throws in case of error
    assert.deepEqual(codeSpec2Id, codeSpec2.id);

    assert.notDeepEqual(codeSpec2Id, codeSpecId);

    // make sure CodeScopeSpec.Type.Repository works
    const codeSpec3: CodeSpec = new CodeSpec(testImodel, new Id64(), "CodeSpec3", CodeScopeSpec.Type.Repository, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec3Id: Id64 = testImodel.codeSpecs.insert(codeSpec3); // throws in case of error
    assert.notDeepEqual(codeSpec2Id, codeSpec3Id);

  });

  it("should import schemas", () => {
    const schemaPathname = path.join(__dirname, "assets", "TestBim.ecschema.xml");
    imodel1.importSchema(schemaPathname); // will throw an exception in import fails

    const classMetaData = imodel1.getMetaData("TestBim:TestDocument"); // will throw on failure
    assert.isDefined(classMetaData.properties.testDocumentProperty);
    assert.isTrue(classMetaData.properties.testDocumentProperty.primitiveType === PrimitiveTypeCode.Integer);
  });

  it("should do CRUD on models", () => {

    const testImodel = imodel2;

    let modeledElementId: Id64;
    let newModelId: Id64;
    [modeledElementId, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(testImodel, Code.createEmpty(), true);

    const newModelPersist: Model = testImodel.models.getModel(newModelId);

    // Check that it has the properties that we set.
    assert.equal(newModelPersist.classFullName, "BisCore:PhysicalModel");
    assert.isTrue(newModelPersist.isPrivate);
    assert.deepEqual(newModelPersist.modeledElement, modeledElementId);

    // Update the model
    const changedModelProps: ModelProps = Object.assign({}, newModelPersist);
    changedModelProps.isPrivate = false;
    testImodel.models.updateModel(changedModelProps);
    //  ... and check that it updated the model in the db
    const newModelPersist2: Model = testImodel.models.getModel(newModelId);
    assert.isFalse(newModelPersist2.isPrivate);

    // Delete the model
    testImodel.models.deleteModel(newModelPersist);
    try {
      assert.fail();
    } catch (err) {
      // this is expected
    }
  });

  it("should create link table relationship instances", () => {

    const testImodel: IModelDb = imodel1;

    // Create a new physical model
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(testImodel, Code.createEmpty(), true);

    // Find or create a SpatialCategory
    const dictionary: DictionaryModel = testImodel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
    let spatialCategoryId: Id64 | undefined = SpatialCategory.queryCategoryIdByName(dictionary, "MySpatialCategory");
    if (undefined === spatialCategoryId) {
      spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, "MySpatialCategory", new Appearance({ color: new ColorDef("rgb(255,0,0)") }));
    }

    // Create a couple of physical elements.
    const id0: Id64 = testImodel.elements.insertElement(IModelTestUtils.createPhysicalObject(testImodel, newModelId, spatialCategoryId));
    const id1: Id64 = testImodel.elements.insertElement(IModelTestUtils.createPhysicalObject(testImodel, newModelId, spatialCategoryId));
    const id2: Id64 = testImodel.elements.insertElement(IModelTestUtils.createPhysicalObject(testImodel, newModelId, spatialCategoryId));

    // Create grouping relationships from 0 to 1 and from 0 to 2
    const r1: ElementGroupsMembers = ElementGroupsMembers.create(testImodel, id0, id1);
    testImodel.linkTableRelationships.insertInstance(r1);
    const r2: ElementGroupsMembers = ElementGroupsMembers.create(testImodel, id0, id2);
    testImodel.linkTableRelationships.insertInstance(r2);

    // Look up by id
    const g1: ElementGroupsMembers = testImodel.linkTableRelationships.getInstance(ElementGroupsMembers.sqlName, r1.id) as ElementGroupsMembers;
    const g2: ElementGroupsMembers = testImodel.linkTableRelationships.getInstance(ElementGroupsMembers.sqlName, r2.id) as ElementGroupsMembers;

    assert.deepEqual(g1.id, r1.id);
    assert.equal(g1.classFullName, "BisCore:ElementGroupsMembers");
    assert.deepEqual(g2.id, r2.id);
    assert.equal(g2.classFullName, "BisCore:ElementGroupsMembers");

    // Look up by source and target
    const g1byst: ElementGroupsMembers = testImodel.linkTableRelationships.getInstance(ElementGroupsMembers.sqlName, { sourceId: r1.sourceId, targetId: r1.targetId }) as ElementGroupsMembers;
    assert.deepEqual(g1byst, g1);

    // TODO: Do an ECSql query to verify that 0->1 and 0->2 relationships can be found

    // Update relationship instance property
    r1.memberPriority = 1;
    testImodel.linkTableRelationships.updateInstance(r1);

    const g11: ElementGroupsMembers = testImodel.linkTableRelationships.getInstance(ElementGroupsMembers.sqlName, r1.id) as ElementGroupsMembers;
    assert.equal(g11.memberPriority, 1);

    // Delete relationship instance property
    testImodel.linkTableRelationships.deleteInstance(r1);

    // TODO: Do an ECSql query to verify that 0->1 is gone but 0->2 is still there.

    testImodel.saveChanges("");

  });

  it.skip("ImodelJsTest.MeasureInsertPerformance", () => {

    const ifperfimodel = IModelTestUtils.openIModel("DgnPlatformSeedManager_OneSpatialModel10.bim", { copyFilename: "ImodelJsTest_MeasureInsertPerformance.bim", enableTransactions: true });

    const dictionary: DictionaryModel = ifperfimodel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;

    // tslint:disable-next-line:no-console
    console.time("ImodelJsTest.MeasureInsertPerformance");

    // TODO: Look up model by code (i.e., codevalue of a child of root subject, where child has a PhysicalPartition)
    // const physicalPartitionCode: Code = PhysicalPartition::CreateCode(*m_db->Elements().GetRootSubject(), "DefaultModel");
    // const modelId: Id64 = ifperfimodel.models.querySubModelId(physicalPartitionCode);
    const modelId = new Id64("0X11");

    const defaultCategoryId: Id64 | undefined = SpatialCategory.queryCategoryIdByName(dictionary, "DefaultCategory");
    assert.isFalse(undefined === defaultCategoryId);

    const elementCount = 10000;
    for (let i = 0; i < elementCount; ++i) {

      const element: Element = ifperfimodel.elements.createElement({ classFullName: "DgnPlatformTest:ImodelJsTestElement", iModel: ifperfimodel, model: modelId, id: new Id64(), code: Code.createEmpty(), category: defaultCategoryId });

      element.integerProperty1 = i;
      element.integerProperty2 = i;
      element.integerProperty3 = i;
      element.integerProperty4 = i;
      element.doubleProperty1 = i;
      element.doubleProperty2 = i;
      element.doubleProperty3 = i;
      element.doubleProperty4 = i;
      element.b = (0 === (i % 100));
      const pt: Point3d = new Point3d(i, 0, 0);
      element.pointProperty1 = pt;
      element.pointProperty2 = pt;
      element.pointProperty3 = pt;
      element.pointProperty4 = pt;
      // const dtUtc: Date = new Date("2013-09-15 12:05:39Z");    // Dates are so expensive to parse in native code that this skews the performance results
      // element.dtUtc = dtUtc;

      assert.isTrue((ifperfimodel.elements.insertElement(element)).isValid(), "insert worked");
      if (0 === (i % 100))
        ifperfimodel.saveChanges();
    }

    ifperfimodel.saveChanges();

    ifperfimodel.withPreparedStatement("select count(*) as [count] from DgnPlatformTest.ImodelJsTestElement", (stmt: ECSqlStatement) => {
      assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
      const row = stmt.getRow();
      const expectedCountAsHex = "0X" + elementCount.toString(16).toUpperCase();
      assert.equal(row.count, expectedCountAsHex);
    });

    // tslint:disable-next-line:no-console
    console.timeEnd("ImodelJsTest.MeasureInsertPerformance");

  });
});
