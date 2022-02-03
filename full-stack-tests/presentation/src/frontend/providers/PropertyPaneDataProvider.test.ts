/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { using } from "@itwin/core-bentley";
import type { ModelProps } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import { KeySet, RuleTypes } from "@itwin/presentation-common";
import { DEFAULT_PROPERTY_GRID_RULESET, PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import type { PropertyCategory } from "@itwin/components-react";
import { initialize, terminate } from "../../IntegrationTests";

describe("PropertyDataProvider", async () => {

  let imodel: IModelConnection;
  let provider: PresentationPropertyDataProvider;
  let physicalModelProps: ModelProps;

  before(async () => {
    await initialize();

    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    physicalModelProps = (await imodel.models.queryProps({ from: "bis.PhysicalModel" }))[0];
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  beforeEach(() => {
    provider = new PresentationPropertyDataProvider({ imodel, ruleset: DEFAULT_PROPERTY_GRID_RULESET });
  });

  afterEach(() => {
    provider.dispose();
  });

  const runTests = (configName: string, setup: () => void) => {

    describe(configName, () => {

      beforeEach(setup);

      afterEach(() => {
        sinon.restore();
      });

      it("creates empty result when properties requested for 0 instances", async () => {
        provider.keys = new KeySet();
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("creates property data when given key with concrete class", async () => {
        provider.keys = new KeySet([physicalModelProps]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("creates property data when given key with base class", async () => {
        provider.keys = new KeySet([{ className: "BisCore:Element", id: "0x75" }]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("favorites properties", async () => {
        sinon.stub(provider as any, "isFieldFavorite").returns(true);
        provider.keys = new KeySet([physicalModelProps]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("overrides default property category", async () => {
        provider.dispose();
        provider = new PresentationPropertyDataProvider({
          imodel,
          ruleset: {
            ...DEFAULT_PROPERTY_GRID_RULESET,
            rules: [
              ...DEFAULT_PROPERTY_GRID_RULESET.rules,
              {
                ruleType: RuleTypes.DefaultPropertyCategoryOverride,
                specification: {
                  id: "default",
                  label: "Custom Category",
                  description: "Custom description",
                  autoExpand: true,
                },
              },
              {
                ruleType: RuleTypes.ContentModifier,
                propertyOverrides: [{
                  name: "UserLabel",
                  isDisplayed: true,
                }],
              },
            ],
          },
        });
        provider.keys = new KeySet([{ className: "BisCore:Element", id: "0x1" }]);
        const properties = await provider.getData();
        expect(properties).to.matchSnapshot();
      });

      it("finds root property record keys", async () => {
        provider.keys = new KeySet([{ className: "BisCore:Element", id: "0x75" }]);
        const properties = await provider.getData();

        const category = properties.categories.find((c) => c.name === "/selected-item/");
        expect(category).to.not.be.undefined;

        const record = properties.records[category!.name].find((r) => r.property.displayLabel === "Code");
        expect(record).to.not.be.undefined;

        const keys = await provider.getPropertyRecordInstanceKeys(record!);
        expect(keys).to.deep.eq([{ className: "Generic:PhysicalObject", id: "0x75" }]);
      });

      it("finds nested property record keys", async () => {
        provider.keys = new KeySet([{ className: "BisCore:Element", id: "0x75" }]);
        const properties = await provider.getData();

        function findNestedCategory(categories: PropertyCategory[], label: string): PropertyCategory | undefined {
          for (const c of categories) {
            if (c.label === label)
              return c;

            const nested = findNestedCategory(c.childCategories ?? [], label);
            if (nested)
              return nested;
          }
          return undefined;
        }
        const category = findNestedCategory(properties.categories, "workingUnitsProp");
        expect(category).to.not.be.undefined;

        const record = properties.records[category!.name].find((r) => r.property.displayLabel === "Distance");
        expect(record).to.not.be.undefined;

        const keys = await provider.getPropertyRecordInstanceKeys(record!);
        expect(keys).to.deep.eq([{ className: "DgnCustomItemTypes_MyProp:workingUnitsPropElementAspect", id: "0x24" }]);
      });

    });

  };

  runTests("with flat property categories", () => provider.isNestedPropertyCategoryGroupingEnabled = false);
  runTests("with nested property categories", () => provider.isNestedPropertyCategoryGroupingEnabled = true);

  it("gets property data after re-initializing Presentation", async () => {
    const checkDataProvider = async () => {
      await using(new PresentationPropertyDataProvider({ imodel }), async (p) => {
        p.keys = new KeySet([physicalModelProps]);
        const properties = await p.getData();
        expect(properties.categories).to.not.be.empty;
      });
    };

    // first request something to make sure we get data back
    await checkDataProvider();

    // re-initialize
    Presentation.terminate();
    await Presentation.initialize({
      presentation: {
        activeLocale: "en-pseudo",
      },
    });

    // repeat request
    await checkDataProvider();
  });
});
