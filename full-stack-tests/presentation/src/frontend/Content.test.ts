/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import {
  ContentSpecificationTypes, Descriptor, DisplayValueGroup, Field, FieldDescriptor, InstanceKey, KeySet, PresentationError, PresentationStatus,
  RelationshipDirection, Ruleset, RuleTypes,
} from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { initialize, terminate } from "../IntegrationTests";

import sinon = require("sinon");

/* eslint-disable deprecation/deprecation */

describe("Content", () => {

  let imodel: IModelConnection;
  const openIModel = async () => {
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  };

  before(async () => {
    await initialize();
    await openIModel();
  });

  after(async () => {
    await terminate();
  });

  describe("Distinct Values", () => {

    it("[deprecated] gets distinct content values", async () => {
      const ruleset: Ruleset = {
        id: "getRelatedDistinctValues",
        rules: [{
          ruleType: RuleTypes.Content,
          specifications: [{
            specType: ContentSpecificationTypes.ContentRelatedInstances,
            relatedClasses: {
              schemaName: "BisCore",
              classNames: [
                "SubCategory",
                "LinkPartition",
                "DefinitionPartition",
                "PhysicalPartition",
              ],
            },
          }],
        }],
      };
      const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
      const key2: InstanceKey = { id: Id64.fromString("0x17"), className: "BisCore:SpatialCategory" };
      const keys = new KeySet([key1, key2]);
      const descriptor = await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "Grid", keys, undefined);
      expect(descriptor).to.not.be.undefined;
      const field = descriptor!.getFieldByName("pc_bis_Element_Model");
      expect(field).to.not.be.undefined;
      const distinctValues = await Presentation.presentation.getDistinctValues({ imodel, rulesetOrId: ruleset }, descriptor!, keys, field!.name);
      expect(distinctValues).to.be.deep.equal([
        "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default",
        "DgnV8Bridge",
      ]);
    });

    async function validatePagedDistinctValuesResponse(ruleset: Ruleset, keys: KeySet, descriptor: Descriptor, fieldDescriptor: FieldDescriptor, expectedResult: DisplayValueGroup[]) {
      // first request all pages and confirm the result is valid
      const allDistinctValues = await Presentation.presentation.getPagedDistinctValues({ imodel, rulesetOrId: ruleset, keys, descriptor, fieldDescriptor });
      expect(allDistinctValues).to.be.deep.equal({
        total: expectedResult.length,
        items: expectedResult,
      });

      // then request in pages and confirm it's still okay
      const pageSize = 2;
      const pagesCount = Math.ceil(expectedResult.length / pageSize);
      for (let i = 0; i < pagesCount; ++i) {
        const pagedDistinctValues = await Presentation.presentation.getPagedDistinctValues({ imodel, rulesetOrId: ruleset, keys, descriptor, fieldDescriptor, paging: { size: pageSize, start: i * pageSize } });
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
      const keys = KeySet.fromJSON({ instanceKeys: [["PCJ_TestSchema:TestClass", ["0x61", "0x70", "0x6a", "0x3c", "0x71"]]], nodeKeys: [] });
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "", keys, undefined))!;

      let field = findFieldByLabel(descriptor.fields, "User Label")!;
      await validatePagedDistinctValuesResponse(ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      }]);

      field = findFieldByLabel(descriptor.fields, "True-False")!;
      await validatePagedDistinctValuesResponse(ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "False",
        groupedRawValues: [false],
      }, {
        displayValue: "True",
        groupedRawValues: [true],
      }]);

      field = findFieldByLabel(descriptor.fields, "<0")!;
      await validatePagedDistinctValuesResponse(ruleset, keys, descriptor, field.getFieldDescriptor(), [{
        displayValue: "0.00",
        groupedRawValues: [1e-7, 0.0007575],
      }, {
        displayValue: "0.12",
        groupedRawValues: [0.123456789],
      }]);

      field = findFieldByLabel(descriptor.fields, "<100")!;
      await validatePagedDistinctValuesResponse(ruleset, keys, descriptor, field.getFieldDescriptor(), [{
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
      const keys = KeySet.fromJSON({ instanceKeys: [["PCJ_TestSchema:TestClass", ["0x61", "0x70", "0x6a", "0x3c", "0x71"]]], nodeKeys: [] });
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "", keys, undefined))!;
      const field = findFieldByLabel(descriptor.fields, "Model Label")!;
      await validatePagedDistinctValuesResponse(ruleset, keys, descriptor, field.getFieldDescriptor(), [{
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
      const keys = KeySet.fromJSON({ instanceKeys: [["PCJ_TestSchema:TestClass", ["0x61", "0x70", "0x6a", "0x3c", "0x71"]]], nodeKeys: [] });
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "", keys, undefined))!;
      const field = findFieldByLabel(descriptor.fields, "$óúrçè Fílê Ñâmé")!;
      await validatePagedDistinctValuesResponse(ruleset, keys, descriptor, field.getFieldDescriptor(), [{
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
      const descriptor = (await Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "", consolidatedKeys, undefined))!;
      const field = findFieldByLabel(descriptor.fields, "User Label")!;

      await validatePagedDistinctValuesResponse(ruleset, consolidatedKeys, descriptor, field.getFieldDescriptor(), [{
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
      await validatePagedDistinctValuesResponse(ruleset, typeOneKey, descriptor, field.getFieldDescriptor(), [{
        displayValue: "TestClass",
        groupedRawValues: ["TestClass"],
      }]);

      const typeTwoKey = new KeySet([{
        className: "Generic:PhysicalObject",
        id: Id64.invalid,
      }]);
      await validatePagedDistinctValuesResponse(ruleset, typeTwoKey, descriptor, field.getFieldDescriptor(), [{
        displayValue: "",
        groupedRawValues: [undefined],
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
            classes: { schemaName: "BisCore", classNames: ["Element"] },
            handleInstancesPolymorphically: true,
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
            classes: { schemaName: "BisCore", classNames: ["Element"] },
            handleInstancesPolymorphically: true,
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
            classes: { schemaName: "BisCore", classNames: ["Element"] },
            handleInstancesPolymorphically: true,
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
      const field = findFieldByLabel(content!.descriptor.fields, "Test")!;

      expect(content?.contentSet.length).to.eq(1);
      expect(content?.contentSet[0].values[field.name]).to.eq("Value");
      expect(content?.contentSet[0].displayValues[field.name]).to.eq("Value");
    });

  });

  describe("when request in the backend exceeds the backend timeout time", () => {

    let raceStub: sinon.SinonStub<[Iterable<unknown>], Promise<unknown>>;

    beforeEach(async () => {
      // re-initialize to set backend response timeout to 500 ms
      await terminate();
      await initialize(500);
      await openIModel();

      // mock `Promise.race` to always reject
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const realRace = Promise.race;
      raceStub = sinon.stub(Promise, "race").callsFake(async (values) => {
        (values as any).push(new Promise((_resolve, reject) => { reject("something"); }));
        return realRace.call(Promise, values);
      });
    });

    afterEach(() => {
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
      await expect(Presentation.presentation.getContentDescriptor({ imodel, rulesetOrId: ruleset }, "Grid", keys, undefined))
        .to.be.eventually.rejectedWith(PresentationError).and.have.property("errorNumber", PresentationStatus.BackendTimeout);
    });

  });

});

function findFieldByLabel(fields: Field[], label: string, allFields?: Field[]): Field | undefined {
  const isTopLevel = (undefined === allFields);
  if (!allFields)
    allFields = new Array<Field>();
  for (const field of fields) {
    if (field.label === label)
      return field;

    if (field.isNestedContentField()) {
      const nestedMatchingField = findFieldByLabel(field.nestedFields, label, allFields);
      if (nestedMatchingField)
        return nestedMatchingField;
    }

    allFields.push(field);
  }
  if (isTopLevel) {
    // eslint-disable-next-line no-console
    console.error(`Field '${label}' not found. Available fields: [${allFields.map((f) => `"${f.label}"`).join(", ")}]`);
  }
  return undefined;
}
