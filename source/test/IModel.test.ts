/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Guid, Id64 } from "@bentley/bentleyjs-core/lib/Id";
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
import { SpatialViewDefinition, DisplayStyle3d } from "../ViewDefinition";
import { Point3d, Vector3d, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { GeometricElement2d } from "../Element";
import { ElementPropertyFormatter } from "../ElementPropertyFormatter";

describe("iModel", () => {
  let imodel: IModel;
  let imodel2: IModel;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("test.bim");
    imodel2 = await IModelTestUtils.openIModel("CompatibilityTestSeed.bim");
  });

  after(() => {
    imodel.closeDgnDb();
    imodel2.closeDgnDb();
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
    const elements: Elements = imodel.elements;
    assert.exists(elements);
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await elements.getElement(code1);
    assert.exists(el);
    const el2 = await elements.getElement(new Id64("0x34"));
    assert.exists(el2);
    const badCode = new Code({ spec: "0x10", scope: "0x11", value: "RF1_does_not_exist.dgn" });

    try {
      await elements.getElement(badCode); // throws Error
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      assert.isTrue(error instanceof Error);
    }

    const subCat = await elements.getElement(new Id64("0x2e"));
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
    const cat = await elements.getElement((subCat as SubCategory).getCategoryId());
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

    const phys = await elements.getElement(new Id64("0x38"));
    assert.isTrue(phys instanceof GeometricElement3d);

    const a2 = await imodel2.elements.getElement(new Id64("0x1d"));
    assert.exists(a2);
    assert.isTrue(a2.federationGuid!.value === "18eb4650-b074-414f-b961-d9cfaa6c8746");
    const el3 = await imodel2.elements.getElement(new Guid(a2.federationGuid!.value));
    assert.exists(el3);
    assert.notEqual(a2, el3);
    assert.isTrue(a2.id.equals(el3.id));
    testCopyAndJson(el3!);

    // const newEl = el3.copyForEdit<Element>();
    // newEl.federationGuid = undefined;
    // const newId = await imodel2.elements.insertElement(newEl);
    // assert.isTrue(newId.isValid(), "insert worked");
  });

  it("should have a valid root subject element", async () => {
    const rootSubject = await imodel.elements.getRootSubject();
    assert.exists(rootSubject);
    assert.isTrue(rootSubject instanceof Subject);
    assert.isAtLeast(rootSubject.code.getValue().length, 1);

    try {
      await rootSubject.getSubModel(); // throws error
      assert.isTrue(false, "Expected this line to be skipped");
    } catch (error) {
      assert.isTrue(error instanceof Error);
    }

    const childIds: Id64[] = await rootSubject.queryChildren();
    assert.isAtLeast(childIds.length, 1);
    for (const childId of childIds) {
      const childElement = await imodel.elements.getElement(childId);
      assert.exists(childElement);
      assert.isTrue(childElement instanceof Element);

      testCopyAndJson(childElement);
      assert.isTrue(childElement.parent!.id.getLow() === rootSubject.id.getLow());
      if (childElement instanceof InformationPartitionElement) {
        const childSubModel = await childElement.getSubModel();
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
    const models: Models = imodel.models;
    assert.exists(models);
    const model2 = await models.getModel(new Id64("0x1c"));
    assert.exists(model2);
    testCopyAndJson(model2);
    let model = await models.getModel(models.repositoryModelId);
    assert.exists(model);
    testCopyAndJson(model!);
    const code1 = new Code({ spec: "0x1d", scope: "0x1d", value: "A" });
    model = await models.getSubModel(code1);
    const geomModel = await ClassRegistry.getClass({ name: "PhysicalModel", schema: "BisCore" }, imodel);
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
    const el = await elements.getElement(code1);
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
    const { result: viewJson } = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + SpatialViewDefinition.sqlName);
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
    const { result: categoryJson } = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + Category.sqlName);
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
      const { result: subCategoryJson } = await imodel.executeQuery(queryString);
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
    const { result: drawingGraphicJson } = await imodel2.executeQuery("SELECT ECInstanceId as elementId FROM BisCore.DrawingGraphic");
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
    const { result: modelJson } = await imodel2.executeQuery(queryString);
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
    const {result: allrowsdata} = await imodel.executeQuery("SELECT * FROM bis.Element");

    if (!allrowsdata) {
      assert(false);
      return;
    }

    const rows: any = JSON.parse(allrowsdata);
    assert.isArray(rows);
    assert.notEqual(rows.length, 0);
    assert.notEqual(rows[0].ecinstanceid, "");
  });

  /* Needs work
  it("should get display properties", async () => {
    const el = await imodel.elements.getElement(new Id64("0x1"));
    const formatter = new ElementPropertyFormatter(imodel);
    const input = await formatter.formatProperties(el);
    if (undefined === input)
      assert.fail();
    else {
      var output : any =
      {
        'Descriptor': {
            'PreferredDisplayType': 'PropertyPane',
            'SelectClasses': [
                {
                    'SelectClassInfo': {
                        'Id': '206',
                        'Name': 'BisCore:Subject',
                        'Label': 'Subject'
                    },
                    'IsPolymorphic': false,
                    'PathToPrimaryClass': [ ],
                    'RelatedPropertyPaths': [ ]
                }
            ],
            'Fields': [
                {
                    'Category': {
                        'Name': 'Miscellaneous',
                        'DisplayLabel': 'Miscellaneous',
                        'Expand': false,
                        'Priority': 1000
                    },
                    'Name': 'Subject_CodeValue',
                    'DisplayLabel': 'Code',
                    'Type': 'string',
                    'IsReadOnly': false,
                    'Priority': 1000,
                    'Editor': '',
                    'Properties': [
                        {
                            'Property': {
                                'BaseClassInfo': {
                                    'Id': '63',
                                    'Name': 'BisCore:Element',
                                    'Label': 'Element'
                                },
                                'ActualClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'Name': 'CodeValue',
                                'Type': 'string'
                            },
                            'RelatedClassPath': [ ]
                        }
                    ]
                },
                {
                    'Category': {
                        'Name': 'Miscellaneous',
                        'DisplayLabel': 'Miscellaneous',
                        'Expand': false,
                        'Priority': 1000
                    },
                    'Name': 'Subject_UserLabel',
                    'DisplayLabel': 'User Label',
                    'Type': 'string',
                    'IsReadOnly': false,
                    'Priority': 1000,
                    'Editor': '',
                    'Properties': [
                        {
                            'Property': {
                                'BaseClassInfo': {
                                    'Id': '63',
                                    'Name': 'BisCore:Element',
                                    'Label': 'Element'
                                },
                                'ActualClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'Name': 'UserLabel',
                                'Type': 'string'
                            },
                            'RelatedClassPath': [ ]
                        }
                    ]
                },
                {
                    'Category': {
                        'Name': 'Miscellaneous',
                        'DisplayLabel': 'Miscellaneous',
                        'Expand': false,
                        'Priority': 1000
                    },
                    'Name': 'Subject_Description',
                    'DisplayLabel': 'Description',
                    'Type': 'string',
                    'IsReadOnly': false,
                    'Priority': 1000,
                    'Editor': '',
                    'Properties': [
                        {
                            'Property': {
                                'BaseClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'ActualClassInfo': {
                                    'Id': '206',
                                    'Name': 'BisCore:Subject',
                                    'Label': 'Subject'
                                },
                                'Name': 'Description',
                                'Type': 'string'
                            },
                            'RelatedClassPath': [ ]
                        }
                    ]
                }
            ],
            'SortingFieldIndex': -1,
            'SortDirection': 0,
            'ContentFlags': 8,
            'FilterExpression': ''
        },
        'ContentSet': [
            {
                'DisplayLabel': '',
                'ImageId': '',
                'Values': {
                    'Subject_CodeValue': 'TBD',
                    'Subject_UserLabel': null,
                    'Subject_Description': ''
                },
                'DisplayValues': {
                    'Subject_CodeValue': 'TBD',
                    'Subject_UserLabel': null,
                    'Subject_Description': ''
                },
                'ClassInfo': {
                    'Id': '206',
                    'Name': 'BisCore:Subject',
                    'Label': 'Subject'
                },
                'PrimaryKeys': [
                    {
                        'ECClassId': '206',
                        'ECInstanceId': '1'
                    }
                ],
                'MergedFieldNames': [ ],
                'FieldValueKeys': {
                    'Subject_CodeValue': [
                        {
                            'PropertyIndex': 0,
                            'Keys': [
                                {
                                    'ECClassId': '206',
                                    'ECInstanceId': '1'
                                }
                            ]
                        }
                    ],
                    'Subject_Description': [
                        {
                            'PropertyIndex': 0,
                            'Keys': [
                                {
                                    'ECClassId': '206',
                                    'ECInstanceId': '1'
                                }
                            ]
                        }
                    ],
                    'Subject_UserLabel': [
                        {
                            'PropertyIndex': 0,
                            'Keys': [
                                {
                                    'ECClassId': '206',
                                    'ECInstanceId': '1'
                                }
                            ]
                        }
                    ]
                }
            }
        ]
    };
    assert.equal(JSON.stringify(input), JSON.stringify(output));
  }

  });
  */

  function checkElementMetaData(metadataStr: string) {
    assert(metadataStr && metadataStr.length > 0);
    const obj: any = JSON.parse(metadataStr || "");
    assert.isNotNull(obj);
    assert.isString(obj.name);
    assert.equal(obj.name, "Element");
    assert.equal(obj.schema, "BisCore");
    assert.isArray(obj.baseClasses);
    assert.equal(obj.baseClasses.length, 0);

    assert.isArray(obj.customAttributes);
    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    for (const ca of obj.customAttributes) {
      if (ca.ecclass.name === "ClassHasHandler")
        foundClassHasHandler = true;
      else if (ca.ecclass.name === "ClassHasCurrentTimeStampProperty")
        foundClassHasCurrentTimeStampProperty = true;
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    assert.isDefined(obj.properties.federationGuid);
    assert.isDefined(obj.properties.federationGuid.primitiveECProperty);
    assert.equal(obj.properties.federationGuid.primitiveECProperty.type, "binary");
    assert.equal(obj.properties.federationGuid.primitiveECProperty.extendedType, "BeGuid");
  }

  it("should get metadata for class (sync)", async () => {
    const {result: metadataStr} = await imodel.getECClassMetaDataSync("BisCore", "Element");
    assert.notEqual(undefined, metadataStr);
    if (undefined !== metadataStr)
      checkElementMetaData(metadataStr);
    });

  it("should get metadata for class (async)", async () => {
    const {result: metadataStr} = await imodel.getECClassMetaData("BisCore", "Element");
    if (undefined === metadataStr)
      assert.fail();
    else
      checkElementMetaData(metadataStr);
  });

  function checkClassHasHandlerMetaData(metadataStr: string) {
    assert(metadataStr && metadataStr.length > 0);
    const obj: any = JSON.parse(metadataStr || "");
    assert.isDefined(obj.properties.restrictions);
    assert.isDefined(obj.properties.restrictions.primitiveArrayECProperty);
    assert.equal(obj.properties.restrictions.primitiveArrayECProperty.type, "string");
    assert.equal(obj.properties.restrictions.primitiveArrayECProperty.minOccurs, 0);
  }

  it("should get metadata for CA class just as well (and we'll see a array-typed property) (sync)", async () => {
    const {result: metadataStr} = await imodel.getECClassMetaDataSync("BisCore", "ClassHasHandler");
    if (undefined === metadataStr)
      assert.fail();
    else
      checkClassHasHandlerMetaData(metadataStr);
  });

  it("should get metadata for CA class just as well (and we'll see a array-typed property) (async)", async () => {
    const {result: metadataStr} = await imodel.getECClassMetaData("BisCore", "ClassHasHandler");
    if (undefined === metadataStr)
      assert.fail();
    else
      checkClassHasHandlerMetaData(metadataStr);
  });

});
