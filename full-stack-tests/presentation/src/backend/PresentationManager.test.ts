/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClientRequestContext, Guid } from "@bentley/bentleyjs-core";
import { IModelDb, SnapshotDb } from "@bentley/imodeljs-backend";
import { PresentationManager } from "@bentley/presentation-backend";
import { UnitSystemFormat } from "@bentley/presentation-backend/lib/presentation-backend/PresentationManager";
import {
  ContentSpecificationTypes, DisplayValuesArray, DisplayValuesMap, findFieldByLabel, KeySet, PresentationUnitSystem, Ruleset, RuleTypes,
} from "@bentley/presentation-common";
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
      await checkExpectedAreaDisplayValue("150.1235 cm²", PresentationUnitSystem.BritishImperial, imodel, keys, ruleset);
    });

    it("formats property using default format when it doesn't have format for requested unit system", async () => {
      const formatProps = {
        composite: {
          includeZero:true,
          spacer:" ",
          units: [
            { label:"ft²", name:"SQ_FT" },
          ],
        },
        formatTraits:"KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
        precision:4,
        type:"Decimal",
        uomSeparator:"",
      };

      const defaultFormats = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        AREA: { unitSystems: [PresentationUnitSystem.BritishImperial], format: formatProps },
      };

      await checkExpectedAreaDisplayValue("0.1616 ft²", PresentationUnitSystem.BritishImperial, imodel, keys, ruleset, defaultFormats);
    });

    it("formats property using provided format when it has provided format and default format for requested unit system", async () => {
      const formatProps = {
        composite: {
          includeZero:true,
          spacer:" ",
          units: [
            { label:"ft²", name:"SQ_FT" },
          ],
        },
        formatTraits:"KeepSingleZero|KeepDecimalPoint|ShowUnitLabel",
        precision:4,
        type:"Decimal",
        uomSeparator:"",
      };

      const defaultFormats = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        AREA: { unitSystems: [PresentationUnitSystem.Metric], format: formatProps },
      };

      await checkExpectedAreaDisplayValue("150.1235 cm²", PresentationUnitSystem.Metric, imodel, keys, ruleset, defaultFormats);
    });
  });

});

async function checkExpectedAreaDisplayValue(value: string, unitSystem: PresentationUnitSystem, imodel: IModelDb, keys: KeySet, ruleset: Ruleset, defaultFormats?: {[phenomenon: string]: UnitSystemFormat} ){
  const manager: PresentationManager = new PresentationManager({defaultFormats});
  const descriptor = await manager.getContentDescriptor({
    imodel,
    rulesetOrId: ruleset,
    keys,
    displayType: "Grid",
    requestContext: new ClientRequestContext(),
    unitSystem,
  });
  expect(descriptor).to.not.be.undefined;
  const field = findFieldByLabel(descriptor!.fields, "cm2")!;
  expect(field).not.to.be.undefined;
  const content = await manager.getContent({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, requestContext: new ClientRequestContext(), unitSystem });
  const displayValues = content!.contentSet[0].displayValues.rc_generic_PhysicalObject_ncc_MyProp_areaElementAspect as DisplayValuesArray;
  expect(displayValues.length).is.eq(1);
  expect(((displayValues[0] as DisplayValuesMap).displayValues as DisplayValuesMap)[field.name]!).to.eq(value);
}
