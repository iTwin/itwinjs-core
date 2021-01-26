/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClientRequestContext, Guid } from "@bentley/bentleyjs-core";
import { IModelDb, SnapshotDb } from "@bentley/imodeljs-backend";
import { PresentationManager } from "@bentley/presentation-backend";
import { ContentSpecificationTypes, Field, KeySet, PresentationUnitSystem, Ruleset, RuleTypes } from "@bentley/presentation-common";
import { initialize, terminate } from "../IntegrationTests";

describe("PresentationManager", () => {

  let imodel: IModelDb;
  before(async () => {
    await initialize();
    imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    imodel.close();
    await terminate();
  });

  describe("Calculated Properties", () => {
    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [{
        ruleType: RuleTypes.Content,
        specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
      }],
    };

    const keys = KeySet.fromJSON({ instanceKeys: [["Generic:PhysicalObject", ["0x74"]]], nodeKeys: [] });
    it("creates calculated fields without defaultMap", async () => {
      const manager: PresentationManager = new PresentationManager();
      const descriptor = await manager.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        keys,
        displayType: "Grid",
        requestContext: new ClientRequestContext(),
        unitSystem: PresentationUnitSystem.BritishImperial,
      });
      expect(descriptor).to.not.be.undefined;
      const field = findFieldByLabel(descriptor!.fields, "cm2")!;
      expect(field).not.to.be.undefined;
      const allDistinctValues =await manager.getPagedDistinctValues({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, fieldDescriptor: field.getFieldDescriptor(), requestContext: new ClientRequestContext() });
      expect(allDistinctValues.items[0].displayValue).to.eq("150.1235 cm²");
    });
    it("creates calculated fields with defaultMap", async () => {
      const formatProps = {
        composite:
        {includeZero:true,
          spacer:" ",
          units:[{label:"ft²",name:"SQ_FT"}],
        },
        formatTraits:"KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
        precision:4,
        type:"Decimal",
        uomSeparator:""};

      const map = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        AREA: {unitSystems: ["Undefined"], format: formatProps},
      };

      const manager: PresentationManager = new PresentationManager({defaultFormatsMap: map});
      const descriptor = await manager.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        keys,
        displayType: "Grid",
        requestContext: new ClientRequestContext(),
        unitSystem: PresentationUnitSystem.BritishImperial,
      });
      expect(descriptor).to.not.be.undefined;
      const field = findFieldByLabel(descriptor!.fields, "cm2")!;
      expect(field).not.to.be.undefined;
      const allDistinctValues = await manager.getPagedDistinctValues({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, fieldDescriptor: field.getFieldDescriptor(), requestContext: new ClientRequestContext() });
      expect(allDistinctValues.items[0].displayValue).to.eq("0.1616 ft²");
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
  });

});
