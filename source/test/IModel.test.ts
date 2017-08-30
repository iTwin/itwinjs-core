/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Code, IModel } from "../IModel";
import { ColorDef } from "../Render";
import { ElementProps, Element, GeometricElement3d, InformationPartitionElement, DefinitionPartition, LinkPartition, PhysicalPartition, GroupInformationPartition, DocumentPartition, Subject } from "../Element";
import { Entity, EntityCtor, EntityProps } from "../Entity";
import { Model, Models } from "../Model";
import { Category, SubCategory } from "../Category";
import { ClassRegistry } from "../ClassRegistry";
import { ModelSelector } from "../ViewDefinition";
import { Elements } from "../Elements";
import { IModelTestUtils } from "./IModelTestUtils";
import { BisCore } from "../BisCore";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { SpatialViewDefinition, DisplayStyle3d } from "../ViewDefinition";
import { Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { GeometricElement2d } from "../Element";
import { ElementPropertyFormatter } from "../ElementPropertyFormatter";

describe("iModel", () => {

  /** test the copy constructor and to/from Json methods for the supplied entity */
  const testCopyAndJson = (entity: Entity) => {
    assert.isTrue(entity.isPersistent());
    const copyOf = entity.copyForEdit() as Entity;
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

  let imodel: IModel;
  let imodel2: IModel;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("test.bim", true);
    assert.exists(imodel);
    imodel2 = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim", true);
    assert.exists(imodel);
  });

  after(() => {
    imodel.closeDgnDb();
    imodel2.closeDgnDb();
  });

  it("should use schema to look up classes by name", async () => {
    const { result: elementClass } = await BisCore.getClass(Element.name, imodel);
    const { result: categoryClass } = await BisCore.getClass(Category.name, imodel);
    assert.equal(elementClass!.name, "Element");
    assert.equal(categoryClass!.name, "Category");
  });

  it("should load a known element by Id from an existing iModel", async () => {
    const elements: Elements = imodel.elements;
    assert.exists(elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const { result: el } = await elements.getElement({ code: code1 });
    assert.exists(el);
    const { result: el2 } = await elements.getElement({ id: "0x34" });
    assert.exists(el2);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });
    const { result: bad } = await elements.getElement({ code: badCode });
    assert.isUndefined(bad);
    const { result: subCat } = await elements.getElement({ id: "0x2e" });
    assert.isTrue(subCat instanceof SubCategory);
    if (subCat instanceof SubCategory) {
      assert.isTrue(subCat.appearance.color.tbgr === 16777215);
      assert.isTrue(subCat.appearance.weight === 2);
      assert.isTrue(subCat.id.lo === 46);
      assert.isTrue(subCat.id.hi === 0);
      assert.isTrue(subCat.code.spec.lo === 30);
      assert.isTrue(subCat.code.spec.hi === 0);
      assert.isTrue(subCat.code.scope === "0X2D");
      assert.isTrue(subCat.code.value === "A-Z013-G-Legn");
      testCopyAndJson(subCat);
    }

    /// Get the parent Category of the subcategory.
    const { result: cat } = await elements.getElement({ id: (subCat as SubCategory).getCategoryId() });
    assert.isTrue(cat instanceof Category);
    if (cat instanceof Category) {
      assert.isTrue(cat.id.lo === 45);
      assert.isTrue(cat.id.hi === 0);
      assert.isTrue(cat.description === "Legends, symbols keys");
      assert.isTrue(cat.code.spec.lo === 22);
      assert.isTrue(cat.code.spec.hi === 0);
      assert.isTrue(cat.code.value === "A-Z013-G-Legn");
      testCopyAndJson(cat);
    }

    const { result: phys } = await elements.getElement({ id: "0x38", noGeometry: false });
    assert.isTrue(phys instanceof GeometricElement3d);

    const { result: a2 } = await imodel2.elements.getElement({ id: "0x1d" });
    assert.exists(a2);
    assert.isTrue(a2!.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const { result: el3 } = await imodel2.elements.getElement({ federationGuid: a2!.federationGuid!.value });
    assert.exists(el3);
    assert.notEqual(a2, el3);
    assert.isTrue(a2!.id.equals(el3!.id));
    testCopyAndJson(el3!);
  });

  it("should have a valid root subject element", async () => {
    const { result: rootSubject } = await imodel.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject!.code.getValue().length, 1);
    const { result: subModel } = await rootSubject!.getSubModel();
    assert.isUndefined(subModel, "Root subject should not have a subModel");

    const childIds: Id64[] = await rootSubject!.queryChildren();
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const { result: childElement } = await imodel.elements.getElement({ id: childId });
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);
      if (!childElement)
        continue;
      testCopyAndJson(childElement!);
      assert.isTrue(childElement.parent!.id.lo === rootSubject!.id.lo);
      if (childElement instanceof InformationPartitionElement) {
        const { result: childSubModel } = await childElement.getSubModel();
        assert.exists(childSubModel, "InformationPartitionElements should have a subModel");

        if ((childId.lo === 16) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof DefinitionPartition, "ChildId 0x00000010 should be a DefinitionPartition");
          assert.isTrue(childElement.code.value === "BisCore.DictionaryModel", "Definition Partition should have code value of BisCore.DictionaryModel");
        } else if ((childId.lo === 14) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof LinkPartition);
          assert.isTrue(childElement.code.value === "BisCore.RealityDataSources");
        } else if ((childId.lo === 17) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof LinkPartition, "ChildId 0x000000011 should be a LinkPartition");
          assert.isTrue(childElement.code.value === "Repository Links");
        }
      } else if (childElement instanceof Subject) {
        if ((childId.lo === 19) && (childId.hi === 0)) {
          assert.isTrue(childElement instanceof Subject);
          assert.isTrue(childElement.code.value === "DgnV8:mf3, A", "Subject should have code value of DgnV8:mf3, A");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8File === "mf3.dgn", "Subject should have jsonProperty Subject.Job.DgnV.V8File");
          assert.isTrue(childElement.jsonProperties.Subject.Job.DgnV8.V8RootModel === "A", "Subject should have jsonProperty Subject.Job.DgnV.V8RootModel");
        }
      }
    }
  });

  it("should load a known model by Id from an existing iModel", async () => {
    const models: Models = imodel.models;
    assert.exists(models);
    const { result: model2 } = await models.getModel({ id: "0x1c" });
    assert.exists(model2);
    testCopyAndJson(model2!);
    let { result: model } = await models.getModel({ id: "0x1" });
    assert.exists(model);
    testCopyAndJson(model!);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    ({ result: model } = await models.getModel({ code: code1 }));
    const { result: geomModel } = await ClassRegistry.getClass({ name: "PhysicalModel", schema: "BisCore" }, imodel);
    assert.exists(model);
    assert.isTrue(model instanceof geomModel!);
    testCopyAndJson(model!);
  });

  it("Model Selectors should hold models", async () => {
    const props: ElementProps = {
      iModel: imodel,
      classFullName: BisCore.name + "." + ModelSelector.name,
      model: new Id64([1, 1]),
      code: Code.createDefault(),
      id: new Id64(),
    };

    const modelObj = await ClassRegistry.createInstance(props);
    const selector1 = modelObj.result as ModelSelector;
    assert.exists(selector1);
    if (selector1) {
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 1]));
      selector1.addModel(new Id64([2, 3]));
    }
  });

  it("should produce an array of rows", async () => {
    const { result: allrowsdata } = await imodel.executeQuery("SELECT * FROM " + Category.sqlName);
    assert.exists(allrowsdata);
    const rows: any = JSON.parse(allrowsdata!);
    assert.isArray(rows);
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].eCInstanceId);
    assert.notEqual(rows[0].eCInstanceId, "");
  });

  it("ElementPropertyFormatter should format", async () => {
    const elements: Elements = imodel.elements;
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const { result: el } = await elements.getElement({ code: code1 });
    if (undefined === el)
      throw new Error();
    const formatter: ElementPropertyFormatter = new ElementPropertyFormatter(imodel);
    const { result: props } = await formatter.formatProperties(el);
    assert.isArray(props);
    assert.notEqual(props.length, 0);
    const item = props[0];
    assert.isString(item.category);
    assert.isArray(item.properties);
  });
});

describe("Views", () => {
  it("should be at least one view element", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: jsonString } = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + SpatialViewDefinition.sqlName);
    assert.exists(jsonString, "Should find some views");
    const viewIdList: any[] = JSON.parse(jsonString!);
    for (const thisViewId of viewIdList!) {
      const { result: thisView } = await imodel.elements.getElement({ id: thisViewId.elementId });
      assert.isTrue(thisView instanceof SpatialViewDefinition, "Should be instance of SpatialViewDefinition");
      if (!thisView)
        continue;
      if (!(thisView instanceof SpatialViewDefinition))
        continue;
      assert.isTrue(thisView.code.value === "A Views - View 1", "Code value is A Views - View 1");
      assert.isTrue(thisView.getDisplayStyleId().lo === 0x36, "Display Style Id is 0x36");
      assert.isTrue(thisView.getCategorySelectorId().lo === 0x37, "Category Id is 0x37");
      assert.isFalse(thisView.cameraOn, "The camera is not turned on");
      assert.isTrue(thisView.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
      assert.isTrue(thisView.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
      assert.isTrue(thisView.rotation.isAlmostEqual(RotMatrix.identity), "View rotation is identity");
      assert.isTrue(thisView.jsonProperties.viewDetails.gridOrient === 0, "Grid orientation as expected");
      assert.isTrue(thisView.jsonProperties.viewDetails.gridSpaceX === 0.001, "GridSpaceX as expected");

      // get the display style element
      const { result: thisDisplayStyle } = await imodel.elements.getElement({ id: thisView.getDisplayStyleId() });
      assert.isTrue(thisDisplayStyle instanceof DisplayStyle3d, "The Display Style should be a DisplayStyle3d");
      if (!(thisDisplayStyle instanceof DisplayStyle3d))
        continue;
      const bgColorDef: ColorDef = thisDisplayStyle.getBackgroundColor();
      assert.isTrue(bgColorDef.tbgr === 0, "The background as expected");
      const sceneBrightness: number = thisDisplayStyle.getSceneBrightness();
      assert.isTrue(sceneBrightness === 0);
    }
    imodel.closeDgnDb();
  });
});

describe("Categories", () => {
  it("should be some categories", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const { result: jsonString } = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + Category.sqlName);
    assert.exists(jsonString, "Should have some Category ids");
    const categoryIdList: any[] = JSON.parse(jsonString!);
    for (const thisCategoryIdString of categoryIdList!) {
      const thisCategoryId: Id64 = new Id64(thisCategoryIdString.elementId);
      const { result: thisCategory } = await imodel.elements.getElement({ id: thisCategoryId });
      assert.isTrue(thisCategory instanceof Category, "Should be instance of Category");
      if (!thisCategory)
        continue;
      if (!(thisCategory instanceof Category))
        continue;

      // verify the default subcategory.
      const subCategoryId: Id64 = thisCategory.myDefaultSubCategoryId();
      const { result: defaultSubCategory } = await imodel.elements.getElement({ id: subCategoryId });
      assert.isTrue(defaultSubCategory instanceof SubCategory, "defaultSubCategory should be instance of SubCategory");
      if (defaultSubCategory instanceof SubCategory) {
        assert.isTrue(defaultSubCategory.parent!.id.equals(thisCategoryId), "defaultSubCategory id should be prescribed value");
        assert.isTrue(defaultSubCategory.getSubCategoryName() === thisCategory.code.getValue(), "DefaultSubcategory name should match that of Category");
        assert.isTrue(defaultSubCategory.isDefaultSubCategory(), "isDefaultSubCategory should return true");
      }

      // get the subcategories
      const queryString: string = "SELECT EcInstanceId as elementId FROM " + SubCategory.sqlName + " WHERE Parent.Id=" + thisCategoryId;
      const { result: jsonString1 } = await imodel.executeQuery(queryString);
      assert.exists(jsonString1, "Should have at least one SubCategory");
      const subCategoryIdList: any[] = JSON.parse(jsonString1!);
      for (const thisSubCategoryId of subCategoryIdList) {
        const { result: thisSubCategory } = await imodel.elements.getElement({ id: thisSubCategoryId.elementId });
        assert.isTrue(thisSubCategory instanceof SubCategory);
        if (thisSubCategory instanceof SubCategory) {
          assert.isTrue(thisSubCategory.parent!.id.equals(thisCategoryId));
        }
      }
    }
    imodel.closeDgnDb();
  });
});

describe("2D Elements", () => {
  it("should be some 2D elements", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim", true);
    const { result: jsonString } = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM BisCore.DrawingGraphic");
    assert.exists(jsonString, "Should have some Drawing Graphics");
    const drawingGraphicIdList: any[] = JSON.parse(jsonString!);
    for (const thisDrawingGraphicIdString of drawingGraphicIdList!) {
      const thisDrawingGraphicId: Id64 = new Id64(thisDrawingGraphicIdString.elementId);
      const { result: thisDrawingGraphic } = await imodel.elements.getElement({ id: thisDrawingGraphicId });
      assert.isDefined(thisDrawingGraphic, "Retrieved valid DrawingGraphic");  // not undefined.
      assert.isTrue(thisDrawingGraphic!.constructor.name === "DrawingGraphic", "Should be instance of DrawingGraphic");
      assert.isTrue(thisDrawingGraphic instanceof GeometricElement2d, "Is instance of GeometricElement2d");
      if (!thisDrawingGraphic)
        continue;
      if (!(thisDrawingGraphic instanceof GeometricElement2d))
        continue;
      if (thisDrawingGraphic.id.lo === 0x25) {
        assert.isTrue(thisDrawingGraphic.placement.origin.x === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.origin.y === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.angle.radians === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.low.x === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.low.y === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.high.x === 1.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.high.y === 1.0);
        assert.isDefined(thisDrawingGraphic.geom);
      }
      if (thisDrawingGraphic.id.lo === 0x26) {
        assert.isTrue(thisDrawingGraphic.placement.origin.x === 1.0);
        assert.isTrue(thisDrawingGraphic.placement.origin.y === 1.0);
        assert.isTrue(thisDrawingGraphic.placement.angle.radians === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.low.x === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.low.y === 0.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.high.x === 2.0);
        assert.isTrue(thisDrawingGraphic.placement.bbox.high.y === 2.0);
        assert.isDefined(thisDrawingGraphic.geom);
      }
    }
    imodel.closeDgnDb();
  });
});

describe("Model Structure", () => {
  let imodel: IModel;
  let rootSubject: Subject;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim", true);
    assert.exists(imodel);
  });

  after(() => {
    imodel.closeDgnDb();
  });

  it("should be a root subject with id from rootSubjectId", async () => {
    const rootSubjectId: Id64 = imodel.elements.rootSubjectId;
    const { result: rootSubjectOut } = await imodel.elements.getElement({ id: rootSubjectId });
    assert.exists(rootSubjectOut);
    assert.isTrue(rootSubjectOut instanceof Subject);
    rootSubject = rootSubjectOut as Subject;
  });

  it("should be children of RootSubject", async () => {
    const queryString: string = "SELECT EcInstanceId as modelId from biscore.model WHERE parentmodel.id=" + rootSubject.id;
    const { result: jsonString } = await imodel.executeQuery(queryString);
    assert.exists(jsonString, "Should have at least one model within rootSubject");
    const modelIdList: any[] = JSON.parse(jsonString!);
    for (const thisModelId of modelIdList) {
      const { result: thisModel } = await imodel.models.getModel({ id: thisModelId.modelId });
      assert.exists(thisModel, "Model should exist");
      assert.isTrue(thisModel instanceof Model);

      if (!thisModel)
        continue;

      // should be an element with the same Id.
      const { result: modelElement } = await imodel.elements.getElement({ id: thisModelId.modelId });
      assert.exists(modelElement, "Model Element should exist");

      if (thisModel.constructor.name === "LinkModel") {
        // expect LinkModel to be accompanied by LinkPartition
        assert.isTrue(modelElement instanceof LinkPartition);
        continue;
      } else if (thisModel.constructor.name === "DictionaryModel") {
        assert.isTrue(modelElement instanceof DefinitionPartition);
        continue;
      } else if (thisModel.constructor.name === "PhysicalModel") {
        assert.isTrue(modelElement instanceof PhysicalPartition);
        continue;
      } else if (thisModel.constructor.name === "GroupModel") {
        assert.isTrue(modelElement instanceof GroupInformationPartition);
        continue;
      } else if (thisModel.constructor.name === "DocumentListModel") {
        assert.isTrue(modelElement instanceof DocumentPartition);
        continue;
      } else if (thisModel.constructor.name === "DefinitionModel") {
        assert.isTrue(modelElement instanceof DefinitionPartition);
        continue;
      } else {
        assert.isTrue(false, "Expected a known model type");
      }
    }
  });

}); // closes desdribe.

