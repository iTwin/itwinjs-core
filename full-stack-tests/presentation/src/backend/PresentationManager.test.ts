/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelDb, SnapshotDb } from "@itwin/core-backend";
import { BeEvent, Guid } from "@itwin/core-bentley";
import { UnitSystemKey } from "@itwin/core-quantity";
import { Schema, SchemaContext, SchemaInfo, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { PresentationManager, PresentationManagerProps } from "@itwin/presentation-backend";
import {
  ChildNodeSpecificationTypes,
  ContentSpecificationTypes,
  DisplayValue,
  DisplayValuesArray,
  DisplayValuesMap,
  ElementProperties,
  FormatsMap,
  KeySet,
  PresentationError,
  PresentationStatus,
  Ruleset,
  RuleTypes,
} from "@itwin/presentation-common";
import { initialize, terminate, testLocalization } from "../IntegrationTests.js";
import { getFieldByLabel } from "../Utils.js";

describe("PresentationManager", () => {
  let imodel: IModelDb;
  before(async () => {
    await initialize({ imodelAppProps: { localization: testLocalization } });
    imodel = SnapshotDb.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).is.not.null;
  });

  after(async () => {
    imodel.close();
    await terminate();
  });

  describe("Property value formatting", () => {
    [
      {
        name: "with native formatter",
        config: {},
      },
      {
        name: "with TS formatter",
        config: {
          schemaContextProvider: (schemaIModel) => {
            const schemas = new SchemaContext();
            schemas.addLocater({
              getSchemaSync() {
                throw new Error(`getSchemaSync not implemented`);
              },
              async getSchemaInfo(key: SchemaKey, matchType: SchemaMatchType, schemaContext: SchemaContext): Promise<SchemaInfo | undefined> {
                const schemaInfo = await Schema.startLoadingFromJson(schemaIModel.getSchemaProps(key.name), schemaContext);
                if (schemaInfo !== undefined && schemaInfo.schemaKey.matches(key, matchType)) {
                  return schemaInfo;
                }
                return undefined;
              },
              async getSchema(key: SchemaKey, matchType: SchemaMatchType, schemaContext: SchemaContext): Promise<Schema | undefined> {
                await this.getSchemaInfo(key, matchType, schemaContext);
                const schema = await schemaContext.getCachedSchema(key, matchType);
                return schema;
              },
            });
            return schemas;
          },
        } as Partial<PresentationManagerProps>,
      },
    ].map(({ name, config }) => {
      describe(name, () => {
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

        // eslint-disable-next-line @typescript-eslint/no-deprecated
        async function getAreaDisplayValue(unitSystem: UnitSystemKey, defaultFormats?: FormatsMap): Promise<DisplayValue> {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          using manager = new PresentationManager({ defaultFormats, ...config });
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
        }
      });
    });
  });

  describe("getElementProperties", () => {
    it("returns properties for some elements of class 'PhysicalObject", async () => {
      using manager = new PresentationManager();
      const properties: ElementProperties[] = [];
      const { iterator } = await manager.getElementProperties({ imodel, elementClasses: ["Generic:PhysicalObject"] });
      for await (const items of iterator()) {
        properties.push(...items);
      }
      expect(properties).to.matchSnapshot();
    });

    it("returns properties of specific elements by element ID", async () => {
      using manager = new PresentationManager();
      const properties: ElementProperties[] = [];
      const { iterator } = await manager.getElementProperties({ imodel, elementIds: ["0x74", "0x1", "0x75"] });
      for await (const items of iterator()) {
        properties.push(...items);
      }
      expect(properties).to.matchSnapshot();
    });
  });

  describe("Cancel request", () => {
    it("cancels 'getNodes' request", async () => {
      using manager = new PresentationManager();
      const cancelEvent = new BeEvent<() => void>();
      const promise = manager.getNodes({
        imodel,
        rulesetOrId: {
          id: "ruleset",
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [
                {
                  specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                  classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
                },
              ],
            },
          ],
        },
        cancelEvent,
      });
      cancelEvent.raiseEvent();
      await expect(promise).to.eventually.be.rejectedWith(PresentationError).and.have.property("errorNumber", PresentationStatus.Canceled);
    });
  });
});
