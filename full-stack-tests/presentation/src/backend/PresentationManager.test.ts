/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { Guid, using } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { PresentationManager, UnitSystemFormat } from "@itwin/presentation-backend";
import {
  ContentSpecificationTypes, DisplayValue, DisplayValuesArray, DisplayValuesMap, KeySet, Ruleset, RuleTypes,
} from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";
import { getFieldByLabel } from "../Utils";

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
    const keys = new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]);

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
        const field = getFieldByLabel(descriptor!.fields, "cm2");
        const content = await manager.getContent({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, unitSystem });
        const displayValues = content!.contentSet[0].displayValues.rc_generic_PhysicalObject_ncc_MyProp_areaElementAspect as DisplayValuesArray;
        expect(displayValues.length).is.eq(1);
        return ((displayValues[0] as DisplayValuesMap).displayValues as DisplayValuesMap)[field.name]!;
      });
    }
  });

});
