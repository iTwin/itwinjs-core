/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { Schema, SchemaContext, SchemaInfo } from "../../ecschema-metadata";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { SchemaUnitProvider } from "../../UnitProvider/SchemaUnitProvider";
import { UNIT_EXTRA_DATA } from "./UnitData";
import { UnitProps } from "@itwin/core-quantity";
import { ISchemaLocater } from "../../Context";
import { SchemaMatchType } from "../../ECObjects";
import { SchemaKey } from "../../SchemaKey";

class TestSchemaLocater implements ISchemaLocater {
  public async getSchema<T extends Schema>(schemaKey: Readonly<SchemaKey>, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined> {
    return this.getSchemaSync(schemaKey, matchType, context) as T;
  }

  public async getSchemaInfo(schemaKey: Readonly<SchemaKey>, matchType: SchemaMatchType, context?: SchemaContext | undefined): Promise<SchemaInfo | undefined> {
    return this.getSchema(schemaKey, matchType, context);
  }
  public getSchemaSync<T extends Schema>(schemaKey: Readonly<SchemaKey>, _matchType: SchemaMatchType, context?: SchemaContext): T | undefined {
    if (schemaKey.name !== "Units")
      return undefined;

    const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    const schema = deserializeXmlSync(schemaXml, context || new SchemaContext());
    if (schema !== undefined)
      return schema as T;

    return undefined;
  }
}

describe("Unit Provider tests", () => {
  let context: SchemaContext;
  let provider: SchemaUnitProvider;

  describe("Initialized with SchemaContext", () => {

    before(() => {
      context = new SchemaContext();

      const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
      const schemaXml = fs.readFileSync(schemaFile, "utf-8");
      deserializeXmlSync(schemaXml, context);

      const siSchemaFile = path.join(__dirname, "..", "assets", "SIUnits.ecschema.xml");
      const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
      deserializeXmlSync(siSchemaXml, context);

      const metricSchemaFile = path.join(__dirname, "..", "assets", "MetricUnits.ecschema.xml");
      const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
      deserializeXmlSync(metricSchemaXml, context);

      const usSchemaFile = path.join(__dirname, "..", "assets", "USUnits.ecschema.xml");
      const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
      deserializeXmlSync(usSchemaXml, context);

      provider = new SchemaUnitProvider(context, UNIT_EXTRA_DATA);
    });

    // Tests for findUnitByName
    it("should find units by unit names in Units schema", async () => {
      const unit1 = await provider.findUnitByName("Units.KM");
      expect(unit1.name === "Units.KM", `Unit name should be Units.KM and not ${unit1.name}`).to.be.true;

      const unit2 = await provider.findUnitByName("Units.KM_PER_HR");
      expect(unit2.name === "Units.KM_PER_HR", `Unit name should be Units.KM_PER_HR and not ${unit2.name}`).to.be.true;
    });

    it("should find units by unit names in MetricUnits schema", async () => {
      const unit1 = await provider.findUnitByName("MetricUnits.KM");
      expect(unit1.name === "MetricUnits.KM", `Unit name should be MetricUnits.KM and not ${unit1.name}`).to.be.true;

      const unit2 = await provider.findUnitByName("MetricUnits.M_PER_KM");
      expect(unit2.name === "MetricUnits.M_PER_KM", `Unit name should be MetricUnits.M_PER_KM and not ${unit2.name}`).to.be.true;
    });

    it("should throw when schema is not found", async () => {
      try {
        await provider.findUnitByName("MockSchema.KM");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find schema for unit");
      }
    });

    it("should throw when phenomenon is not found", async () => {
      try {
        await provider.findUnitByName("Units.MOCKUNIT");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find schema item/unit");
      }
    });

    // Tests for findUnitsByPhenomenon
    it("should find units that belong to Units.LENGTH phenomenon", async () => {
      const filteredUnits: UnitProps[] = await provider.getUnitsByFamily("Units.LENGTH");
      for (const unit of filteredUnits) {
        expect(unit.phenomenon === "Units.LENGTH", `Phenomenon name should be Units.LENGTH and not ${unit.phenomenon}`).to.be.true;
      }
    });

    it("should find units that belong to Units.VELOCITY phenomenon", async () => {
      const filteredUnits: UnitProps[] = await provider.getUnitsByFamily("Units.VELOCITY");
      for (const unit of filteredUnits) {
        expect(unit.phenomenon === "Units.VELOCITY", `Phenomenon name should be Units.LENGTH and not ${unit.phenomenon}`).to.be.true;
      }
    });

    it("should find units that belong to SIUnits.LENGTH phenomenon across multiple schemas", async () => {
      const filteredUnits: UnitProps[] = await provider.getUnitsByFamily("SIUnits.LENGTH");
      for (const unit of filteredUnits) {
        expect(unit.phenomenon === "SIUnits.LENGTH", `Phenomenon name should be SIUnits.LENGTH and not ${unit.phenomenon}`).to.be.true;
      }
      expect(filteredUnits).to.have.lengthOf(19);
    });

    it("should find units that belong to SIUnits.SLOPE phenomenon across multiple schemas", async () => {
      const filteredUnits: UnitProps[] = await provider.getUnitsByFamily("SIUnits.SLOPE");
      for (const unit of filteredUnits) {
        expect(unit.phenomenon === "SIUnits.SLOPE", `Phenomenon name should be SIUnits.SLOPE and not ${unit.phenomenon}`).to.be.true;
      }
      expect(filteredUnits).to.have.lengthOf(9);
    });

    it("should throw when schema is not found", async () => {
      try {
        await provider.getUnitsByFamily("MockSchema.VELOCITY");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find schema for phenomenon");
      }
    });

    it("should throw when phenomenon is not found", async () => {
      try {
        await provider.getUnitsByFamily("SIUnits.VELOCITY");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find schema item/phenomenon");
      }
    });

    // Tests for getAlternateDisplayLabels
    it("should find alternate display labels of Units.US_SURVEY_FT", () => {
      const altDisplayLabels = provider.getAlternateDisplayLabels("Units.US_SURVEY_FT");
      const expectedLabels = ["ft", "SF", "USF", "ft (US Survey)"];
      expect(altDisplayLabels, `Alternate display labels should be ${expectedLabels}`).to.include.members(expectedLabels);
      expect(altDisplayLabels).to.have.lengthOf(4);
    });

    it("should find alternate display labels of Units.CUB_US_SURVEY_FT", () => {
      const altDisplayLabels = provider.getAlternateDisplayLabels("Units.CUB_US_SURVEY_FT");
      const expectedLabels = ["cf"];
      expect(altDisplayLabels, `Alternate display labels should be ${expectedLabels}`).to.include.members(expectedLabels);
      expect(altDisplayLabels).to.have.lengthOf(1);
    });

    it("should not find any alternate display labels of Unit", () => {
      const altDisplayLabels = provider.getAlternateDisplayLabels("Units.CELSIUS");
      const expectedLabels: string[] = [];
      expect(altDisplayLabels, `Alternate display labels should be ${expectedLabels}`).to.include.members(expectedLabels);
      expect(altDisplayLabels).to.have.lengthOf(0);
    });

    // Tests for findUnitsByDisplayLabel of findUnit
    it("should find Units.DELTA_RANKINE with display label 'Δ°R'", async () => {
      const unit = await provider.findUnit("Δ°R");
      expect(unit.name === "Units.DELTA_RANKINE", `Unit name should be Units.DELTA_RANKINE and not ${unit.name}`).to.be.true;
    });

    it("should find Units.MICROMOL_PER_CUB_DM with display label 'µmol/dm³'", async () => {
      const unit = await provider.findUnit("µmol/dm³");
      expect(unit.name === "Units.MICROMOL_PER_CUB_DM", `Unit name should be Units.MICROMOL_PER_CUB_DM and not ${unit.name}`).to.be.true;
    });

    it("should find Units.FT with display label 'ft'", async () => {
      const unit = await provider.findUnit("ft");
      expect(unit.name === "Units.FT", `Unit name should be Units.FT and not ${unit.name}`).to.be.true;
    });

    it("should find USUnits.FT with display label 'ft' with schemaName 'USUnits'", async () => {
      const unit = await provider.findUnit("ft", "USUnits");
      expect(unit.name === "USUnits.FT", `Unit name should be USUnits.FT and not ${unit.name}`).to.be.true;
    });

    it("should find USUnits.FT with display label 'ft' and SIUnits.LENGTH phenomena", async () => {
      const unit = await provider.findUnit("ft", undefined, "SIUnits.LENGTH");
      expect(unit.name === "USUnits.FT", `Unit name should be USUnits.FT and not ${unit.name}`).to.be.true;
    });

    it("should find Units.FT with display label 'ft' and Units.LENGTH phenomena", async () => {
      const unit = await provider.findUnit("ft", undefined, "Units.LENGTH");
      expect(unit.name === "Units.FT", `Unit name should be Units.FT and not ${unit.name}`).to.be.true;
    });

    it("should only find USUnits.FT for USUnits.USCUSTOM unitSystem", async () => {
      const unit = await provider.findUnit("ft", undefined, undefined, "USUnits.USCUSTOM");
      expect(unit.name === "USUnits.FT", `Unit name should be USUnits.FT and not ${unit.name}`).to.be.true;
    });

    it("should only find Units.FT with display label 'ft' for Units.USCUSTOM unitSystem", async () => {
      const unit = await provider.findUnit("ft", undefined, undefined, "Units.USCUSTOM");
      expect(unit.name === "Units.FT", `Unit name should be Units.FT and not ${unit.name}`).to.be.true;
    });

    // Tests for findUnitsByAltDisplayLabel of findUnit
    it("should find Units.YRD by corresponding alternate display labels", async () => {
      const unit1 = await provider.findUnit("YRD");
      expect(unit1.name === "Units.YRD", `Unit name should be Units.YRD and not ${unit1.name}`).to.be.true;

      const unit2 = await provider.findUnit("yrd");
      expect(unit2.name === "Units.YRD", `Unit name should be Units.YRD and not ${unit2.name}`).to.be.true;
    });

    it("should find Units.ARC_SECOND with alternate display label 'sec'", async () => {
      const unit = await provider.findUnit("sec");
      expect(unit.name === "Units.ARC_SECOND", `Unit name should be Units.ARC_SECOND and not ${unit.name}`).to.be.true;
    });

    it("should find Units.S with alternate display label 'sec' and phenomenon Units.TIME", async () => {
      const unit = await provider.findUnit("sec", undefined, "Units.TIME");
      expect(unit.name === "Units.S", `Unit name should be Units.S and not ${unit.name}`).to.be.true;
    });

    it("should find Units.S with alternate display label 'sec' and unitSystem Units.SI", async () => {
      const unit = await provider.findUnit("sec", undefined, undefined, "Units.SI");
      expect(unit.name === "Units.S", `Unit name should be Units.S and not ${unit.name}`).to.be.true;
    });

    it("should find Units.ARC_MINUTE with display label ''' ", async () => {
      const unit = await provider.findUnit("'");
      expect(unit.name === "Units.ARC_MINUTE", `Unit name should be Units.ARC_MINUTE and not ${unit.name}`).to.be.true;
    });

    it("should find Units.FT with alternate display label ''' and phenomenon Units.LENGTH", async () => {
      const unit = await provider.findUnit("'", undefined, "Units.LENGTH");
      expect(unit.name === "Units.FT", `Unit name should be Units.FT and not ${unit.name}`).to.be.true;
    });

    it("should find Units.FT with alternate display label ''' and unitSystem Units.USCUSTOM", async () => {
      const unit = await provider.findUnit("'", undefined, undefined, "Units.USCUSTOM");
      expect(unit.name === "Units.FT", `Unit name should be Units.FT and not ${unit.name}`).to.be.true;
    });

    // Tests for invalid cases
    it("should not find any units when unitLabel does not match any display labels or alternate display labels", async () => {
      try {
        await provider.findUnit("MockUnitLabel");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }
    });

    it("should not find any units when schemaName does not exist within context", async () => {
      try {
        await provider.findUnit("ft", "MockSchema");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }

      try {
        await provider.findUnit("sec", "MockSchema");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }
    });

    it("should not find any units when phenomenon does not match any unit", async () => {
      try {
        await provider.findUnit("ft", undefined, "MockPhenomenon");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }

      try {
        await provider.findUnit("sec", undefined, "MockPhenomenon");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }
    });

    it("should not find any units when unitSystem does not match any unit", async () => {
      try {
        await provider.findUnit("ft", undefined, undefined, "MockUnitSystem");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }

      try {
        await provider.findUnit("sec", undefined, undefined, "MockUnitSystem");
      } catch (err: any) {
        expect(err).to.be.an("error");
        expect(err.message).to.equal("Cannot find unit with label");
      }
    });
  });

  describe("Initialized with ISchemaLocater", () => {
    before(() => {
      const locater = new TestSchemaLocater();
      provider = new SchemaUnitProvider(locater, UNIT_EXTRA_DATA);
    });

    it("should find units by unit names in Units schema", async () => {
      const unit1 = await provider.findUnitByName("Units.KM");
      expect(unit1.name === "Units.KM", `Unit name should be Units.KM and not ${unit1.name}`).to.be.true;

      const unit2 = await provider.findUnitByName("Units.KM_PER_HR");
      expect(unit2.name === "Units.KM_PER_HR", `Unit name should be Units.KM_PER_HR and not ${unit2.name}`).to.be.true;
    });
  });
});
