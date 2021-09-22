/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Guid, using } from "@bentley/bentleyjs-core";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { UnitSystemKey } from "@bentley/imodeljs-quantity";
import { PresentationManager, UnitSystemFormat } from "@bentley/presentation-backend";
import {
  ContentSpecificationTypes, DisplayValue, DisplayValuesArray, DisplayValuesMap, KeySet, Ruleset, RuleTypes,
} from "@bentley/presentation-common";
import { initialize, terminate } from "../IntegrationTests";
import { findFieldByLabel } from "../Utils";

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

  describe("Property value formatting", () => {

    const ruleset: Ruleset = {
      id: Guid.createValue(),
      rules: [{
        ruleType: RuleTypes.Content,
        specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
      }],
    };
    const keys = KeySet.fromJSON({ instanceKeys: [["Generic:PhysicalObject", ["0x74"]]], nodeKeys: [] });

    it("formats property with default kind of quantity format when it doesn't have format for requested unit system", async () => {
      expect(await getAreaDisplayValue("imperial")).to.eq("150.1235 cm²");
    });

    it("formats property using default format when it doesn't have format for requested unit system", async () => {
      const formatProps = {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [
            { label: "ft²", name: "SQ_FT" },
          ],
        },
        formatTraits: "KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
        precision: 4,
        type: "Decimal",
        uomSeparator: "",
      };

      const defaultFormats = {
        area: { unitSystems: ["imperial" as UnitSystemKey], format: formatProps },
      };

      expect(await getAreaDisplayValue("imperial", defaultFormats)).to.eq("0.1616 ft²");
    });

    it("formats property using provided format when it has provided format and default format for requested unit system", async () => {
      const formatProps = {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [
            { label: "ft²", name: "SQ_FT" },
          ],
        },
        formatTraits: "KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
        precision: 4,
        type: "Decimal",
        uomSeparator: "",
      };

      const defaultFormats = {
        area: { unitSystems: ["metric" as UnitSystemKey], format: formatProps },
      };

      expect(await getAreaDisplayValue("metric", defaultFormats)).to.eq("150.1235 cm²");
    });

    async function getAreaDisplayValue(unitSystem: UnitSystemKey, defaultFormats?: { [phenomenon: string]: UnitSystemFormat }): Promise<DisplayValue> {
      return using(new PresentationManager({ defaultFormats, defaultLocale: "en-PSEUDO" }), async (manager) => {
        const descriptor = await manager.getContentDescriptor({
          imodel,
          rulesetOrId: ruleset,
          keys,
          displayType: "Grid",
          unitSystem,
        });
        expect(descriptor).to.not.be.undefined;
        const field = findFieldByLabel(descriptor!.fields, "cm2")!;
        expect(field).not.to.be.undefined;
        const content = await manager.getContent({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, unitSystem });
        const displayValues = content!.contentSet[0].displayValues.rc_generic_PhysicalObject_ncc_MyProp_areaElementAspect as DisplayValuesArray;
        expect(displayValues.length).is.eq(1);
        return ((displayValues[0] as DisplayValuesMap).displayValues as DisplayValuesMap)[field.name]!;
      });
    }
  });

});
