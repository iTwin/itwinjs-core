/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as chaiJestSnapshot from "chai-jest-snapshot";
import * as sinon from "sinon";
import { assert, BeDuration, BeTimePoint, Guid, Id64, using } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes,
  ContentFlags, ContentSpecificationTypes, DefaultContentDisplayTypes, Descriptor, DisplayValue, DisplayValueGroup, DisplayValuesArray, DisplayValuesMap, Field, FieldDescriptor, FormatsMap, InstanceKey, KeySet,
  NestedContentField, PresentationError, PresentationStatus, RelationshipDirection, Ruleset, RuleTypes,
} from "@itwin/presentation-common";
import { Presentation, PresentationManager, PresentationManagerProps } from "@itwin/presentation-frontend";
import { ECClassHierarchy, ECClassHierarchyInfo } from "../ECClasHierarchy";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldByLabel } from "../Utils";
import { buildTestIModelConnection, insertDocumentPartition, insertPhysicalElement, insertPhysicalModel, insertSpatialCategory } from "../IModelSetupUtils";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";

describe("Content", () => {

  let imodel: IModelConnection;
  const openIModel = async () => {
    if (!imodel || !imodel.isOpen)
      imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  };

  const closeIModel = async () => {
    if (imodel && imodel.isOpen)
      await imodel.close();
  };

  before(async () => {
    await initialize();
    await openIModel();
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Input Keys", () => {

    it("associates content items with given input keys", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentRelatedInstances,
            relationshipPaths: [{
              relationship: { schemaName: "BisCore", className: "ElementOwnsChildElements" },
              direction: RelationshipDirection.Forward,
              count: "*",
            }],
          }],
        }],
      };
      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {
          contentFlags: ContentFlags.IncludeInputKeys,
        },

        keys: new KeySet([{
          className: "BisCore:Element",
          id: "0x1",
        }, {
          className: "BisCore:Element",
          id: "0x12",
        }]),
      });
      expect(content?.contentSet.length).to.eq(9);
      expect(content!.contentSet.map((item) => ({ itemId: item.primaryKeys[0].id, inputIds: item.inputKeys!.map((ik) => ik.id) }))).to.containSubset([{
        itemId: "0xe", inputIds: ["0x1"],
      }, {
        itemId: "0x10", inputIds: ["0x1"],
      }, {
        itemId: "0x12", inputIds: ["0x1"],
      }, {
        itemId: "0x13", inputIds: ["0x1", "0x12"],
      }, {
        itemId: "0x14", inputIds: ["0x1", "0x12"],
      }, {
        itemId: "0x15", inputIds: ["0x1", "0x12"],
      }, {
        itemId: "0x16", inputIds: ["0x1", "0x12"],
      }, {
        itemId: "0x1b", inputIds: ["0x1", "0x12"],
      }, {
        itemId: "0x1c", inputIds: ["0x1", "0x12"],
      }]);
    });

  });

  describe("Distinct Values", () => {

    async function validatePagedDistinctValuesResponse(db: IModelConnection, ruleset: Ruleset, keys: KeySet, descriptor: Descriptor | {}, fieldDescriptor: FieldDescriptor, expectedResult: DisplayValueGroup[]) {
      // first request all pages and confirm the result is valid
      const allDistinctValues = await Presentation.presentation.getPagedDistinctValues({ imodel: db, rulesetOrId: ruleset, keys, descriptor, fieldDescriptor });
      expect(allDistinctValues).to.be.deep.equal({
        total: expectedResult.length,
        items: expectedResult,
      });

      // then request in pages and confirm it's still okay
      const pageSize = 2;
      const pagesCount = Math.ceil(expectedResult.length / pageSize);
      for (let i = 0; i < pagesCount; ++i) {
        const pagedDistinctValues = await Presentation.presentation.getPagedDistinctValues({ imodel: db, rulesetOrId: ruleset, keys, descriptor, fieldDescriptor, paging: { size: pageSize, start: i * pageSize } });
        expect(pagedDistinctValues).to.be.deep.equal({
          total: expectedResult.length,
          items: expectedResult.slice(i * pageSize, (i + 1) * pageSize),
        });
      }
    }

    it("gets paged distinct primitive content values", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        }],
      };
      const keys = new KeySet([
        { className: "PCJ_TestSchema:TestClass", id: "0x61" },
        { className: "PCJ_TestSchema:TestClass", id: "0x70" },
        { className: "PCJ_TestSchema:TestClass", id: "0x6a" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
        { className: "PCJ_TestSchema:TestClass", id: "0x71" },
      ]);
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;

      let field = getFieldByLabel(descriptor.fields, "User Label");
      await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      }]);

      field = getFieldByLabel(descriptor.fields, "True-False");
      await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "False",
        groupedRawValues: [false],
      }, {
        displayValue: "True",
        groupedRawValues: [true],
      }]);

      field = getFieldByLabel(descriptor.fields, "<0");
      await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "0.00",
        groupedRawValues: [1e-7, 0.0007575],
      }, {
        displayValue: "0.12",
        groupedRawValues: [0.123456789],
      }]);

      field = getFieldByLabel(descriptor.fields, "<100");
      await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "100.01",
        groupedRawValues: [100.01],
      }, {
        displayValue: "75.75",
        groupedRawValues: [75.75],
      }, {
        displayValue: "99.01",
        groupedRawValues: [99.01],
      }]);
    });

    it("gets paged distinct related primitive content values", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.SelectedNodeInstances,
            relatedProperties: [{
              propertiesSource: [{
                relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                direction: RelationshipDirection.Backward,
              }, {
                relationship: { schemaName: "BisCore", className: "ModelModelsElement" },
                direction: RelationshipDirection.Forward,
                targetClass: { schemaName: "BisCore", className: "Element" },
              }],
              properties: [{
                name: "CodeValue",
                labelOverride: "Model Label",
              }],
            }],
          }],
        }],
      };
      const keys = new KeySet([
        { className: "PCJ_TestSchema:TestClass", id: "0x61" },
        { className: "PCJ_TestSchema:TestClass", id: "0x70" },
        { className: "PCJ_TestSchema:TestClass", id: "0x6a" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
        { className: "PCJ_TestSchema:TestClass", id: "0x71" },
      ]);
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;
      const field = getFieldByLabel(descriptor.fields, "Model Label");
      await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "Properties_60InstancesWithUrl2",
        groupedRawValues: ["Properties_60InstancesWithUrl2"],
      }]);
    });

    it("gets paged distinct related content values", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        }],
      };
      const keys = new KeySet([
        { className: "PCJ_TestSchema:TestClass", id: "0x61" },
        { className: "PCJ_TestSchema:TestClass", id: "0x70" },
        { className: "PCJ_TestSchema:TestClass", id: "0x6a" },
        { className: "PCJ_TestSchema:TestClass", id: "0x3c" },
        { className: "PCJ_TestSchema:TestClass", id: "0x71" },
      ]);
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;
      const field = getFieldByLabel(descriptor.fields, "Name");
      await validatePagedDistinctValuesResponse(imodel, ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "Properties_60InstancesWithUrl2.dgn",
        groupedRawValues: ["Properties_60InstancesWithUrl2.dgn"],
      }]);
    });

    it("gets distinct content values using consolidated descriptor", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        }],
      };
      const consolidatedKeys = new KeySet([{
        className: "PCJ_TestSchema:TestClass",
        id: Id64.invalid,
      }, {
        className: "Generic:PhysicalObject",
        id: Id64.invalid,
      }]);
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys: consolidatedKeys, displayType: "" }))!;
      const field = getFieldByLabel(descriptor.fields, "User Label");

      await validatePagedDistinctValuesResponse(imodel, ruleset, consolidatedKeys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "",
        groupedRawValues: [undefined],
      }, {
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      }]);

      const typeOneKey = new KeySet([{
        className: "PCJ_TestSchema:TestClass",
        id: Id64.invalid,
      }]);
      await validatePagedDistinctValuesResponse(imodel, ruleset, typeOneKey, descriptor, field.getFieldDescriptor(), [{
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      }]);

      const typeTwoKey = new KeySet([{
        className: "Generic:PhysicalObject",
        id: Id64.invalid,
      }]);
      await validatePagedDistinctValuesResponse(imodel, ruleset, typeTwoKey, descriptor, field.getFieldDescriptor(), [{
        displayValue: "",
        groupedRawValues: [undefined],
      }]);
    });

    it("gets distinct content values based on hierarchy level descriptor", async function () {
      // create an imodel with Model -> Elements relationship
      const testIModel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        const categoryKey = insertSpatialCategory(db, "Category");
        const modelKeyA = insertPhysicalModel(db, "Model A");
        insertPhysicalElement(db, "Element A1", modelKeyA.id, categoryKey.id);
        insertPhysicalElement(db, "Element A2", modelKeyA.id, categoryKey.id);
        const modelKeyB = insertPhysicalModel(db, "Model B");
        insertPhysicalElement(db, "Element B", modelKeyB.id, categoryKey.id);
        insertPhysicalElement(db, "Element B", modelKeyB.id, categoryKey.id);
      });

      // set up ruleset
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: [{
              schemaName: "BisCore",
              classNames: ["PhysicalModel"],
              arePolymorphic: false,
            }],
            groupByClass: false,
            groupByLabel: false,
          }],
        }, {
          ruleType: RuleTypes.ChildNodes,
          condition: `ParentNode.IsOfClass("Model", "BisCore")`,
          specifications: [
            {
              specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
              relationshipPaths: [
                {
                  relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
                  direction: "Forward",
                },
              ],
              groupByClass: false,
              groupByLabel: false,
            },
          ],
        }],
      };
      const rootNodes = await Presentation.presentation.getNodes({ imodel: testIModel, rulesetOrId: ruleset });
      expect(rootNodes.length).to.eq(2);
      const descriptor = await Presentation.presentation.getNodesDescriptor({ imodel: testIModel, rulesetOrId: ruleset, parentKey: rootNodes[0].key });
      assert(!!descriptor);

      // ensure descriptor contains the ruleset used to create it
      expect(descriptor.ruleset!.rules).to.deep.equal([{
        ruleType: "Content",
        specifications: [{
          specType: "ContentRelatedInstances",
          relationshipPaths: [{
            relationship: {
              schemaName: "BisCore",
              className: "ModelContainsElements",
            },
            direction: "Forward",
          }],
        }],
      }]);

      const userLabelField = getFieldByLabel(descriptor.fields, "User Label");
      // user labels are different for every child element, expect 2 unique values
      await validatePagedDistinctValuesResponse(testIModel, descriptor.ruleset!, new KeySet([rootNodes[0].key]), {}, userLabelField.getFieldDescriptor(), [
        {
          displayValue: "Element A1",
          groupedRawValues: ["Element A1"],
        },
        {
          displayValue: "Element A2",
          groupedRawValues: ["Element A2"],
        },
      ]);

      // user label is the same for every child element, expect only 1 unique value
      await validatePagedDistinctValuesResponse(testIModel, descriptor.ruleset!, new KeySet([rootNodes[1].key]), {}, userLabelField.getFieldDescriptor(), [{
        displayValue: "Element B",
        groupedRawValues: ["Element B"],
      }]);
    });

    it("filters distinct content values using descriptor's instance filter", async function () {
      const testIModel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        insertDocumentPartition(db, "A", "A");
        insertDocumentPartition(db, "B1", "B");
        insertDocumentPartition(db, "B2", "B");
      });

      // set up ruleset
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: {
              schemaName: "BisCore",
              classNames: ["DocumentPartition"],
            },
          }],
        }],
      };

      const descriptor = await Presentation.presentation.getContentDescriptor({ imodel: testIModel, rulesetOrId: ruleset, keys: new KeySet(), displayType: "" });
      assert(!!descriptor);

      const userLabelField = getFieldByLabel(descriptor.fields, "User Label");
      descriptor.instanceFilter = { expression: "this.UserLabel = \"B\"", selectClassName: "BisCore:DocumentPartition" };
      await validatePagedDistinctValuesResponse(testIModel, ruleset, new KeySet(), descriptor, userLabelField.getFieldDescriptor(), [{
        displayValue: "B",
        groupedRawValues: ["B"],
      }]);
    });

    it("filters distinct content values using descriptor's fields filter", async function () {
      const testIModel = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        insertDocumentPartition(db, "A", "A");
        insertDocumentPartition(db, "B1", "B");
        insertDocumentPartition(db, "B2", "B");
      });

      // set up ruleset
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: {
              schemaName: "BisCore",
              classNames: ["DocumentPartition"],
            },
          }],
        }],
      };

      const descriptor = await Presentation.presentation.getContentDescriptor({ imodel: testIModel, rulesetOrId: ruleset, keys: new KeySet(), displayType: "" });
      assert(!!descriptor);

      const userLabelField = getFieldByLabel(descriptor.fields, "User Label");
      descriptor.fieldsFilterExpression = `${userLabelField.name} = "B"`;
      await validatePagedDistinctValuesResponse(testIModel, ruleset, new KeySet(), descriptor, userLabelField.getFieldDescriptor(), [{
        displayValue: "B",
        groupedRawValues: ["B"],
      }]);
    });

  });

  describe("Fields Selector", () => {

    it("excludes fields from content", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
            instanceFilter: `this.ECInstanceId = 1`,
          }],
        }],
      };

      const content1 = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      });
      expect(content1?.contentSet.length).to.eq(1);
      const fieldsCount = content1!.descriptor.fields.length;

      const content2 = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {
          fieldsSelector: {
            type: "exclude",
            fields: [content1!.descriptor.fields[0].getFieldDescriptor()],
          },
        },
        keys: new KeySet(),
      });
      expect(content2?.contentSet.length).to.eq(1);
      expect(content2!.descriptor.fields.length).to.eq(fieldsCount - 1);
    });

    it("exclusively includes fields in content", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
            instanceFilter: `this.ECInstanceId = 1`,
          }],
        }],
      };

      const content1 = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      });
      expect(content1?.contentSet.length).to.eq(1);
      expect(content1!.descriptor.fields.length).to.be.greaterThan(1);

      const content2 = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {
          fieldsSelector: {
            type: "include",
            fields: [content1!.descriptor.fields[0].getFieldDescriptor()],
          },
        },
        keys: new KeySet(),
      });
      expect(content2?.contentSet.length).to.eq(1);
      expect(content2!.descriptor.fields.length).to.eq(1);
    });

  });

  describe("Calculated Properties", () => {

    it("creates calculated fields", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Element"], arePolymorphic: true },
            instanceFilter: `this.ECInstanceId = 1`,
          }],
        }, {
          ruleType: RuleTypes.ContentModifier,
          class: { schemaName: "BisCore", className: "Element" },
          calculatedProperties: [{
            label: "Test",
            value: `"Value"`,
          }],
        }],
      };

      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        descriptor: {},
        keys: new KeySet(),
      });
      const field = getFieldByLabel(content!.descriptor.fields, "Test");

      expect(content?.contentSet.length).to.eq(1);
      expect(content?.contentSet[0].values[field.name]).to.eq("Value");
      expect(content?.contentSet[0].displayValues[field.name]).to.eq("Value");
    });

  });

  describe("Guid properties", () => {

    it("creates guid fields", async function () {
      const guid = Guid.createValue();
      let instanceKey: InstanceKey;
      const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        instanceKey = insertDocumentPartition(db, "Test", undefined, guid);
      });

      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.SelectedNodeInstances,
            propertyOverrides: [{
              name: "FederationGuid",
              isDisplayed: true,
            }],
          }],
        }],
      };
      const content = await Presentation.presentation.getContent({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      });
      const field = getFieldByLabel(content!.descriptor.fields, "Federation GUID");

      expect(content?.contentSet.length).to.eq(1);
      expect(content?.contentSet[0].values[field.name]).to.eq(guid);
      expect(content?.contentSet[0].displayValues[field.name]).to.eq(guid);
    });

  });

  describe("Navigation Properties", () => {

    it("creates navigation fields", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.SelectedNodeInstances,
          }],
        }],
      };

      const keys = new KeySet([
        { className: "PCJ_TestSchema:TestClass", id: "0x70" },
      ]);
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "" }))!;
      const field = getFieldByLabel(descriptor.fields, "Model");

      assert(field.isPropertiesField());

      expect(field.properties.length).to.eq(1);
      expect(field.properties[0].property.navigationPropertyInfo).is.not.null;
      expect(field.properties[0].property.navigationPropertyInfo?.isForwardRelationship).to.eq(false);
      expect(field.properties[0].property.navigationPropertyInfo?.classInfo.id).to.eq("0x40");
      expect(field.properties[0].property.navigationPropertyInfo?.targetClassInfo.id).to.eq("0x41");

    });

  });

  describe("Custom categories", () => {

    it("creates child class category", async function () {
      let instanceKey: InstanceKey;
      const imodelConnection = await buildTestIModelConnection(this.test!.fullTitle(), async (db) => {
        instanceKey = insertDocumentPartition(db, "Test");
      });

      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.SelectedNodeInstances,
            propertyCategories: [{
              id: "custom-category",
              label: "Custom Category",
            }],
            propertyOverrides: [{
              name: "*",
              categoryId: { type: "Id", categoryId: "custom-category", createClassCategory: true },
            }],
          }],
        }],
      };
      const content = await Presentation.presentation.getContent({
        imodel: imodelConnection,
        rulesetOrId: ruleset,
        keys: new KeySet([instanceKey!]),
        descriptor: {},
      });

      expect(content!.descriptor.categories).to.containSubset([
        { label: "Document Partition" },
        { label: "Custom Category" },
      ]);

      expect(content!.descriptor.fields).to.containSubset([{
        category: {
          label: "Document Partition",
          parent: {
            label: "Custom Category",
          },
        },
      }]);
    });

  });

  describe("Instance filter", () => {

    it("filters content instances using direct property", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: [{ schemaName: "PCJ_TestSchema", classNames: ["TestClass"] }],
          }],
        }],
      };

      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {
          instanceFilter: {
            selectClassName: "PCJ_TestSchema:TestClass",
            expression: "this.String_Property_4 = \"Yoda\"",
          },
        },
      });

      expect(content?.contentSet.length).to.be.eq(6);
    });

    it("filters content instances using related property", async () => {
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: [{ schemaName: "BisCore", classNames: ["GeometricElement3d"], arePolymorphic: true }],
          }],
        }],
      };

      const content = await Presentation.presentation.getContent({
        imodel,
        rulesetOrId: ruleset,
        keys: new KeySet(),
        descriptor: {
          instanceFilter: {
            selectClassName: "Generic:PhysicalObject",
            expression: "related.Btu__x002F__lb__x0020____x005B__Btu__x0020__per__x0020__pound__x0020__mass__x005D__ = 1475.699",
            relatedInstances: [{
              pathFromSelectToPropertyClass: [{
                sourceClassName: "Generic:PhysicalObject",
                targetClassName: "DgnCustomItemTypes_MyProp:area__x0020__per__x0020__time__x0020__squaredElementAspect",
                relationshipName: "BisCore:ElementOwnsMultiAspects",
                isForwardRelationship: true,
              }],
              alias: "related",
            }],
          },
        },
      });

      expect(content?.contentSet.length).to.be.eq(1);
    });

  });

  describe("Class descriptor", () => {

    it("creates base class descriptor usable for subclasses", async () => {
      const classHierarchy = await ECClassHierarchy.create(imodel);
      const createRuleset = (schemaName: string, className: string): Ruleset => ({
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
            classes: {
              schemaName,
              classNames: [className],
              arePolymorphic: true,
            },
            handlePropertiesPolymorphically: true,
          }],
        }],
      });

      const descriptorGeometricElement = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: createRuleset("BisCore", "GeometricElement"),
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet(),
      });
      // sanity check - ensure filtering the fields by the class we used for request doesn't filter out anything
      const fieldsGeometricElement = filterFieldsByClass(descriptorGeometricElement!.fields, await classHierarchy.getClassInfo("BisCore", "GeometricElement"));
      expect(getFieldLabels(fieldsGeometricElement)).to.deep.eq(getFieldLabels(descriptorGeometricElement!));

      // request properties of Generic.PhysicalObject and ensure it's matches our filtered result of `descriptorGeometricElement`
      const descriptorPhysicalObject = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: createRuleset("Generic", "PhysicalObject"),
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet(),
      });
      const fieldsPhysicalObject = filterFieldsByClass(descriptorGeometricElement!.fields, await classHierarchy.getClassInfo("Generic", "PhysicalObject"));
      expect(getFieldLabels(fieldsPhysicalObject)).to.deep.eq(getFieldLabels(descriptorPhysicalObject!));

      // request properties of PCJ_TestSchema.TestClass and ensure it's matches our filtered result of `descriptorGeometricElement`
      const descriptorTestClass = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: createRuleset("PCJ_TestSchema", "TestClass"),
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet(),
      });
      const fieldsTestClass = filterFieldsByClass(descriptorGeometricElement!.fields, await classHierarchy.getClassInfo("PCJ_TestSchema", "TestClass"));
      expect(getFieldLabels(fieldsTestClass)).to.deep.eq(getFieldLabels(descriptorTestClass!));
    });

  });

  describe("Content sources", () => {

    it("retrieves content sources for given class", async function () {
      // we want to compare against the same snapshot - that requires reconfiguring chai-jest-snapshot by resetting it's config
      // and supplying file name and snapshot name to `matchSnapshot`. otherwise each call to `matchSnapshot` generates a new snapshot
      // in the snapshot file.
      chaiJestSnapshot.setFilename("");
      chaiJestSnapshot.setTestName("");
      const snapshotFilePath = `${this.test!.file!.replace("lib", "src").replace(/\.(jsx?|tsx?)$/, "")}.snap`;
      const snapshotName = this.test!.fullTitle();

      let sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJ_TestSchema.TestClass"] });
      expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);

      sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJ_TestSchema:TestClass"] });
      expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);

      sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJTest.TestClass"] });
      expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);

      sources = await Presentation.presentation.getContentSources({ imodel, classes: ["PCJTest:TestClass"] });
      expect(sources).to.matchSnapshot(snapshotFilePath, snapshotName);
    });

  });

  describe("Content instance keys", () => {

    it("retrieves content instance keys for given input", async () => {
      const ruleset: Ruleset = {
        id: "model elements",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentRelatedInstances,
            relationshipPaths: [{
              relationship: { schemaName: "BisCore", className: "ModelContainsElements" },
              direction: RelationshipDirection.Forward,
            }],
          }],
        }],
      };
      const modelKeys = new KeySet([{ className: "BisCore:DictionaryModel", id: "0x10" }]);
      const result = await Presentation.presentation.getContentInstanceKeys({
        imodel,
        rulesetOrId: ruleset,
        keys: modelKeys,
      });
      expect(result.total).to.eq(7);

      const resultKeys = [];
      for await (const key of result.items())
        resultKeys.push(key);
      expect(resultKeys).to.deep.eq([{
        className: "BisCore:LineStyle",
        id: "0x1d",
      }, {
        className: "BisCore:LineStyle",
        id: "0x1e",
      }, {
        className: "BisCore:LineStyle",
        id: "0x1f",
      }, {
        className: "BisCore:LineStyle",
        id: "0x20",
      }, {
        className: "BisCore:LineStyle",
        id: "0x21",
      }, {
        className: "BisCore:LineStyle",
        id: "0x22",
      }, {
        className: "BisCore:LineStyle",
        id: "0x23",
      }]);
    });

  });

  describe("Property value formatting", () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [
        {
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        },
      ],
    };
    const keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);
    const baseFormatProps = {
      formatTraits: "KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
      type: "Decimal",
      precision: 4,
      uomSeparator: " ",
    };

    it("formats property with default kind of quantity format when it doesn't have format for requested unit system", async () => {
      expect(await getAreaDisplayValue("imperial")).to.eq("150.1235 cm²");
    });

    it("formats property value using default format when the property doesn't have format for requested unit system", async () => {
      const formatProps = {
        ...baseFormatProps,
        composite: {
          units: [{ label: "ft²", name: "Units.SQ_FT" }],
        },
      };
      const defaultFormats = {
        area: [{ unitSystems: ["imperial" as UnitSystemKey], format: formatProps }],
      };
      expect(await getAreaDisplayValue("imperial", defaultFormats)).to.eq("0.1616 ft²");
    });

    it("formats property value using property format when it has one for requested unit system in addition to default format", async () => {
      const formatProps = {
        ...baseFormatProps,
        composite: {
          units: [{ label: "ft²", name: "Units.SQ_FT" }],
        },
      };
      const defaultFormats = {
        area: [{ unitSystems: ["metric" as UnitSystemKey], format: formatProps }],
      };
      expect(await getAreaDisplayValue("metric", defaultFormats)).to.eq("150.1235 cm²");
    });

    it("formats property value using different unit system formats in defaults formats map", async () => {
      const defaultFormats = {
        area: [
          {
            unitSystems: ["imperial", "usCustomary"] as UnitSystemKey[],
            format: {
              ...baseFormatProps,
              composite: {
                units: [{ label: "in²", name: "Units.SQ_IN" }],
              },
            },
          },
          {
            unitSystems: ["usSurvey"] as UnitSystemKey[],
            format: {
              ...baseFormatProps,
              composite: {
                units: [{ label: "yrd² (US Survey)", name: "Units.SQ_US_SURVEY_YRD" }],
              },
            },
          },
        ],
      };
      expect(await getAreaDisplayValue("imperial", defaultFormats)).to.eq("23.2692 in²");
      expect(await getAreaDisplayValue("usCustomary", defaultFormats)).to.eq("23.2692 in²");
      expect(await getAreaDisplayValue("usSurvey", defaultFormats)).to.eq("0.018 yrd² (US Survey)");
    });

    async function getAreaDisplayValue(unitSystem: UnitSystemKey, defaultFormats?: FormatsMap): Promise<DisplayValue> {
      const props: PresentationManagerProps = {
        defaultFormats,
        activeLocale: "en-PSEUDO",
        schemaContextProvider: (schemaIModel) => {
          const schemas = new SchemaContext();
          schemas.addLocater(new ECSchemaRpcLocater(schemaIModel));
          return schemas;
        },
      };
      return using(PresentationManager.create(props), async (manager) => {
        const descriptor = await manager.getContentDescriptor({
          imodel,
          rulesetOrId: ruleset,
          keys,
          displayType: "Grid",
          unitSystem,
        });
        expect(descriptor).to.not.be.undefined;
        const field = getFieldByLabel(descriptor!.fields, "cm2");
        const content = await manager.getContent({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, unitSystem });
        const displayValues = content!.contentSet[0].values.rc_generic_PhysicalObject_ncc_MyProp_areaElementAspect as DisplayValuesArray;
        expect(displayValues.length).is.eq(1);
        return ((displayValues[0] as DisplayValuesMap).displayValues as DisplayValuesMap)[field.name]!;
      });
    }
  });

  describe("waits for frontend timeout when request exceeds the backend timeout time", () => {

    let raceStub: sinon.SinonStub<[readonly unknown[]], Promise<unknown>>;
    const frontendTimeout = 50;

    beforeEach(async () => {
      await closeIModel();
      await terminate();
      await initialize({
        // this defaults to 0, which means "no timeouts" - reinitialize with something else
        backendTimeout: 1,
        frontendTimeout,
      });
      await openIModel();

      // mock `Promise.race` to always reject
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const realRace = Promise.race;
      const rejectedPromise = Promise.reject();
      raceStub = sinon.stub(Promise, "race").callsFake(async (values) => {
        (values as Array<Promise<any>>).splice(0, 0, rejectedPromise);
        return realRace.call(Promise, values);
      });
    });

    afterEach(async () => {
      await closeIModel();
      raceStub.restore();
    });

    it("should throw PresentationError", async () => {
      const ruleset: Ruleset = {
        id: "test",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
        }],
      };
      const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
      const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
      const keys = new KeySet([key1, key2]);
      const start = BeTimePoint.now();
      await expect(Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset, keys, displayType: "Grid" }))
        .to.be.eventually.rejectedWith(PresentationError).and.have.property("errorNumber", PresentationStatus.BackendTimeout);
      expect(BeTimePoint.now().milliseconds).to.be.greaterThanOrEqual(start.plus(BeDuration.fromMilliseconds(frontendTimeout)).milliseconds);
    });

  });

});

type FieldLabels = Array<string | { label: string, nested: FieldLabels }>;
function getFieldLabels(fields: Descriptor | Field[]): FieldLabels {
  if (fields instanceof Descriptor)
    fields = fields.fields;

  return fields.map((f) => {
    if (f.isNestedContentField())
      return { label: f.label, nested: getFieldLabels(f.nestedFields) };
    return f.label;
  }).sort((lhs, rhs) => {
    if (typeof lhs === "string" && typeof rhs === "string")
      return lhs.localeCompare(rhs);
    if (typeof lhs === "string")
      return -1;
    if (typeof rhs === "string")
      return 1;
    return lhs.label.localeCompare(rhs.label);
  });
}

function cloneFilteredNestedContentField(field: NestedContentField, filterClassInfo: ECClassHierarchyInfo) {
  const clone = field.clone();
  clone.nestedFields = filterNestedContentFieldsByClass(clone.nestedFields, filterClassInfo);
  return clone;
}
function filterNestedContentFieldsByClass(fields: Field[], classInfo: ECClassHierarchyInfo) {
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField() && f.actualPrimaryClassIds.some((id) => classInfo.id === id || classInfo.derivedClasses.some((info) => info.id === id))) {
      const clone = cloneFilteredNestedContentField(f, classInfo);
      if (clone.nestedFields.length > 0)
        filteredFields.push(clone);
    } else {
      filteredFields.push(f);
    }
  });
  return filteredFields;
}
function filterFieldsByClass(fields: Field[], classInfo: ECClassHierarchyInfo) {
  const filteredFields = new Array<Field>();
  fields.forEach((f) => {
    if (f.isNestedContentField()) {
      // always include nested content field if its `actualPrimaryClassIds` contains either id of given class itself or one of its derived class ids
      // note: nested content fields might have more nested fields inside them and these deeply nested fields might not apply for given class - for
      // that we need to clone the field and pick only property fields and nested fields that apply.
      const appliesForGivenClass = f.actualPrimaryClassIds.some((id) => classInfo.id === id || classInfo.derivedClasses.some((info) => info.id === id));
      if (appliesForGivenClass) {
        const clone = cloneFilteredNestedContentField(f, classInfo);
        if (clone.nestedFields.length > 0)
          filteredFields.push(clone);
      }
    } else if (f.isPropertiesField()) {
      // always include the field is at least one property in the field belongs to either base or derived class of given class
      const appliesForGivenClass = f.properties.some((p) => {
        const propertyClassId = p.property.classInfo.id;
        return propertyClassId === classInfo.id
          || classInfo.baseClasses.some((info) => info.id === propertyClassId)
          || classInfo.derivedClasses.some((info) => info.id === propertyClassId);
      });
      if (appliesForGivenClass)
        filteredFields.push(f);
    } else {
      filteredFields.push(f);
    }
  });
  return filteredFields;
}
