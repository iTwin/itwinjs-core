/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Guid, using } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { Content, ContentSpecificationTypes, DisplayValue, FormatsMap, InstanceKey, KeySet, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { PresentationManager, PresentationManagerProps } from "@itwin/presentation-frontend";
import { collect, getFieldByLabel } from "../../Utils";
import {
  buildTestIModelConnection,
  importSchema,
  insertElementAspect,
  insertPhysicalElement,
  insertPhysicalModelWithPartition,
  insertSpatialCategory,
} from "../../IModelSetupUtils";
import { UnitSystemKey } from "@itwin/core-quantity";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { describeContentTestSuite, getDisplayValue } from "./Utils";

describeContentTestSuite("Property value formatting", ({ getDefaultSuiteIModel }) => {
  const ruleset: Ruleset = {
    id: Guid.createValue(),
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [{ specType: ContentSpecificationTypes.SelectedNodeInstances }],
      },
    ],
  };

  describe("with formats from different sources", () => {
    const key = { className: "Generic:PhysicalObject", id: "0x74" };
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
      const content = await getContent(await getDefaultSuiteIModel(), key, unitSystem, defaultFormats);
      return getDisplayValue(content, [getFieldByLabel(content.descriptor.fields, "area"), getFieldByLabel(content.descriptor.fields, "cm2")]);
    }
  });

  describe("of properties in different places of content", () => {
    it("formats direct properties", async function () {
      let elementKey!: InstanceKey;
      const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const schema = importSchema(
          this,
          db,
          `
              <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
              <ECSchemaReference name="Units" version="01.00.07" alias="u" />
              <ECSchemaReference name="Formats" version="01.00.00" alias="f" />
              <KindOfQuantity typeName="LENGTH" persistenceUnit="u:M" presentationUnits="f:DefaultRealU(1)[u:M]" relativeError="0.0001" />
              <ECEntityClass typeName="X">
                <BaseClass>bis:PhysicalElement</BaseClass>
                <ECProperty propertyName="Prop" typeName="double" kindOfQuantity="LENGTH" />
              </ECEntityClass>
            `,
        );
        const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
        const category = insertSpatialCategory({ db, codeValue: "category" });
        elementKey = insertPhysicalElement({
          db,
          classFullName: schema.items.X.fullName,
          modelId: model.id,
          categoryId: category.id,
          ["Prop"]: 123.456,
        });
      });
      const content = await getContent(imodel, elementKey);
      const displayValue = getDisplayValue(content, [getFieldByLabel(content.descriptor.fields, "Prop")]);
      expect(displayValue).to.eq("123.5 m");
    });

    it("formats related properties", async function () {
      let elementKey!: InstanceKey;
      const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const schema = importSchema(
          this,
          db,
          `
              <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
              <ECSchemaReference name="Units" version="01.00.07" alias="u" />
              <ECSchemaReference name="Formats" version="01.00.00" alias="f" />
              <KindOfQuantity typeName="LENGTH" persistenceUnit="u:M" presentationUnits="f:DefaultRealU(1)[u:M]" relativeError="0.0001" />
              <ECEntityClass typeName="A">
                <BaseClass>bis:ElementUniqueAspect</BaseClass>
                <ECProperty propertyName="Prop" typeName="double" kindOfQuantity="LENGTH" />
              </ECEntityClass>
              <ECEntityClass typeName="X">
                <BaseClass>bis:PhysicalElement</BaseClass>
              </ECEntityClass>
            `,
        );
        const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
        const category = insertSpatialCategory({ db, codeValue: "category" });
        elementKey = insertPhysicalElement({
          db,
          classFullName: schema.items.X.fullName,
          modelId: model.id,
          categoryId: category.id,
        });
        insertElementAspect({
          db,
          classFullName: schema.items.A.fullName,
          elementId: elementKey.id,
          ["Prop"]: 123.456,
        });
      });
      const content = await getContent(imodel, elementKey);
      const displayValue = getDisplayValue(content, [getFieldByLabel(content.descriptor.fields, "A"), getFieldByLabel(content.descriptor.fields, "Prop")]);
      expect(displayValue).to.eq("123.5 m");
    });

    it("formats array item properties", async function () {
      let elementKey!: InstanceKey;
      const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const schema = importSchema(
          this,
          db,
          `
              <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
              <ECSchemaReference name="Units" version="01.00.07" alias="u" />
              <ECSchemaReference name="Formats" version="01.00.00" alias="f" />
              <KindOfQuantity typeName="LENGTH" persistenceUnit="u:M" presentationUnits="f:DefaultRealU(1)[u:M]" relativeError="0.0001" />
              <ECEntityClass typeName="X">
                <BaseClass>bis:PhysicalElement</BaseClass>
                <ECArrayProperty propertyName="Prop" typeName="double" kindOfQuantity="LENGTH" />
              </ECEntityClass>
            `,
        );
        const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
        const category = insertSpatialCategory({ db, codeValue: "category" });
        elementKey = insertPhysicalElement({
          db,
          classFullName: schema.items.X.fullName,
          modelId: model.id,
          categoryId: category.id,
          ["Prop"]: [123.456, 456.789],
        });
      });
      const content = await getContent(imodel, elementKey);
      const displayValue = getDisplayValue(content, [getFieldByLabel(content.descriptor.fields, "Prop")]);
      expect(displayValue).to.deep.eq(["123.5 m", "456.8 m"]);
    });

    it("formats struct member properties", async function () {
      let elementKey!: InstanceKey;
      const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const schema = importSchema(
          this,
          db,
          `
              <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
              <ECSchemaReference name="Units" version="01.00.07" alias="u" />
              <ECSchemaReference name="Formats" version="01.00.00" alias="f" />
              <KindOfQuantity typeName="LENGTH" persistenceUnit="u:M" presentationUnits="f:DefaultRealU(1)[u:M]" relativeError="0.0001" />
              <ECStructClass typeName="MyStruct">
                <ECProperty propertyName="MemberProp" typeName="double" kindOfQuantity="LENGTH" />
              </ECStructClass>
              <ECEntityClass typeName="X">
                <BaseClass>bis:PhysicalElement</BaseClass>
                <ECStructProperty propertyName="StructProp" typeName="MyStruct" />
              </ECEntityClass>
            `,
        );
        const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
        const category = insertSpatialCategory({ db, codeValue: "category" });
        elementKey = insertPhysicalElement({
          db,
          classFullName: schema.items.X.fullName,
          modelId: model.id,
          categoryId: category.id,
          ["StructProp"]: {
            ["MemberProp"]: 123.456,
          },
        });
      });
      const content = await getContent(imodel, elementKey);
      const displayValue = getDisplayValue(content, [
        getFieldByLabel(content.descriptor.fields, "StructProp"),
        getFieldByLabel(content.descriptor.fields, "MemberProp"),
      ]);
      expect(displayValue).to.eq("123.5 m");
    });

    it("formats struct array member properties", async function () {
      let elementKey!: InstanceKey;
      const imodel = await buildTestIModelConnection(this.test!.title, async (db) => {
        const schema = importSchema(
          this,
          db,
          `
              <ECSchemaReference name="BisCore" version="01.00.16" alias="bis" />
              <ECSchemaReference name="Units" version="01.00.07" alias="u" />
              <ECSchemaReference name="Formats" version="01.00.00" alias="f" />
              <KindOfQuantity typeName="LENGTH" persistenceUnit="u:M" presentationUnits="f:DefaultRealU(1)[u:M]" relativeError="0.0001" />
              <ECStructClass typeName="MyStruct">
                <ECProperty propertyName="MemberProp" typeName="double" kindOfQuantity="LENGTH" />
              </ECStructClass>
              <ECEntityClass typeName="X">
                <BaseClass>bis:PhysicalElement</BaseClass>
                <ECStructArrayProperty propertyName="StructArrayProp" typeName="MyStruct" />
              </ECEntityClass>
            `,
        );
        const model = insertPhysicalModelWithPartition({ db, codeValue: "model" });
        const category = insertSpatialCategory({ db, codeValue: "category" });
        elementKey = insertPhysicalElement({
          db,
          classFullName: schema.items.X.fullName,
          modelId: model.id,
          categoryId: category.id,
          ["StructArrayProp"]: [
            {
              ["MemberProp"]: 123.456,
            },
            {
              ["MemberProp"]: 456.789,
            },
          ],
        });
      });
      const content = await getContent(imodel, elementKey);
      const displayValue = getDisplayValue(content, [getFieldByLabel(content.descriptor.fields, "StructArrayProp")]);
      expect(displayValue).to.deep.eq([{ ["MemberProp"]: "123.5 m" }, { ["MemberProp"]: "456.8 m" }]);
    });
  });

  async function getContent(imodel: IModelConnection, key: InstanceKey, unitSystem?: UnitSystemKey, defaultFormats?: FormatsMap): Promise<Content> {
    const keys = new KeySet([key]);
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
      const content = await manager
        .getContentIterator({ imodel, rulesetOrId: ruleset, keys, descriptor: descriptor!, unitSystem })
        .then(async (x) => x && new Content(x.descriptor, await collect(x.items)));
      expect(content).to.not.be.undefined;
      return content!;
    });
  }
});
