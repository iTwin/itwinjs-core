/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { SchemaContext, Unit } from "../../ecschema-metadata";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { UnitQuery } from "../../UnitQuery/UnitQuery";

describe("Unit Querying tests", () => {
  const context = new SchemaContext();
  let query: UnitQuery;

  before(() => {
    const schemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
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
    query = new UnitQuery(context);
  });

  // Tests for findUnitByName
  it.only("should find units by unit names in Units schema", async () => {
    const unit1 = await query.findUnitByName("Units.KM");
    expect(unit1.fullName === "Units.KM", `Unit name should be Units.KM and not ${unit1.fullName}`).to.be.true;

    const unit2 = await query.findUnitByName("Units.KM_PER_HR");
    expect(unit2.fullName === "Units.KM_PER_HR", `Unit name should be Units.KM_PER_HR and not ${unit2.fullName}`).to.be.true;
  });

  it.only("should find units by unit names in MetricUnits schema", async () => {
    const unit1 = await query.findUnitByName("MetricUnits.KM");
    expect(unit1.fullName === "MetricUnits.KM", `Unit name should be MetricUnits.KM and not ${unit1.fullName}`).to.be.true;

    const unit2 = await query.findUnitByName("MetricUnits.M_PER_KM");
    expect(unit2.fullName === "MetricUnits.M_PER_KM", `Unit name should be MetricUnits.M_PER_KM and not ${unit2.fullName}`).to.be.true;
  });

  it.only("should throw when schema is not found", async () => {
    try {
      await query.findUnitByName("MockSchema.KM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema for unit");
    }
  });

  it.only("should throw when phenomenon is not found", async () => {
    try {
      await query.findUnitByName("Units.MOCKUNIT");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item/unit");
    }
  });

  // Tests for findUnitsByPhenomenon
  it.only("should find units that belong to Units.LENGTH phenomenon", async () => {
    const filteredUnits: Unit[] = await query.findUnitsByPhenomenon("Units.LENGTH");
    for (const unit of filteredUnits) {
      // console.log(unit.fullName);
      expect(unit.phenomenon?.fullName === "Units.LENGTH", `Phenomenon name should be Units.LENGTH and not ${unit.phenomenon?.fullName}`).to.be.true;
    }
  });

  it.only("should find units that belong to Units.VELOCITY phenomenon", async () => {
    const filteredUnits: Unit[] = await query.findUnitsByPhenomenon("Units.VELOCITY");
    for (const unit of filteredUnits) {
      expect(unit.phenomenon?.fullName === "Units.VELOCITY", `Phenomenon name should be Units.LENGTH and not ${unit.phenomenon?.fullName}`).to.be.true;
    }
  });

  it.only("should find units that belong to SIUnits.LENGTH phenomenon across multiple schemas", async () => {
    const filteredUnits: Unit[] = await query.findUnitsByPhenomenon("SIUnits.LENGTH");
    for (const unit of filteredUnits) {
      expect(unit.phenomenon?.fullName === "SIUnits.LENGTH", `Phenomenon name should be SIUnits.LENGTH and not ${unit.phenomenon?.fullName}`).to.be.true;
    }
    expect(filteredUnits).to.have.lengthOf(19);
  });

  it.only("should find units that belong to SIUnits.SLOPE phenomenon across multiple schemas", async () => {
    const filteredUnits: Unit[] = await query.findUnitsByPhenomenon("SIUnits.SLOPE");
    for (const unit of filteredUnits) {
      expect(unit.phenomenon?.fullName === "SIUnits.SLOPE", `Phenomenon name should be SIUnits.SLOPE and not ${unit.phenomenon?.fullName}`).to.be.true;
    }
    expect(filteredUnits).to.have.lengthOf(9);
  });

  it.only("should throw when schema is not found", async () => {
    try {
      await query.findUnitsByPhenomenon("MockSchema.VELOCITY");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema for phenomenon");
    }
  });

  it.only("should throw when phenomenon is not found", async () => {
    try {
      await query.findUnitsByPhenomenon("SIUnits.VELOCITY");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item/phenomenon");
    }
  });

  // Tests for findUnitsByDisplayLabel
  it.only("should find Units.DELTA_RANKINE with display label 'Δ°R'", async () => {
    const units1: Unit[] = await query.findUnitsByDisplayLabel("Δ°R");
    expect(units1.find((unit) => unit.fullName === "Units.DELTA_RANKINE") !== undefined, `Units array should contain Units.DELTA_RANKINE`).to.be.true;
    expect(units1).to.have.lengthOf(1);
  });

  it.only("should find Units.MILE and USUnits.MILE with display label 'mi'", async () => {
    const units1: Unit[] = await query.findUnitsByDisplayLabel("mi");
    expect(units1.find((unit) => unit.fullName === "Units.MILE") !== undefined, `Units array should contain Units.MILE`).to.be.true;
    expect(units1.find((unit) => unit.fullName === "USUnits.MILE") !== undefined, `Units array should contain USUnits.MILE`).to.be.true;
    expect(units1).to.have.lengthOf(2);
  });

  it.only("should only find Units.MILE with display label 'mi' with schemaName 'Units'",async () => {
    const units1: Unit[] = await query.findUnitsByDisplayLabel("mi", "Units");
    expect(units1.find((unit) => unit.fullName === "Units.MILE") !== undefined, `Units array should contain Units.MILE`).to.be.true;
    expect(units1).to.have.lengthOf(1);
  });

  it.only("should only find Units.FT for Units.LENGTH phenomena and USUnits.FT for SIUnits.LENGTH phenomena", async () => {
    const units1: Unit[] = await query.findUnitsByDisplayLabel("ft", undefined, "Units.LENGTH");
    expect(units1[0].fullName === "Units.FT", `Unit name should be Units.FT and not ${units1[0].fullName}`).to.be.true;
    expect(units1).to.have.lengthOf(1);

    const units2: Unit[] = await query.findUnitsByDisplayLabel("ft", undefined, "SIUnits.LENGTH");
    expect(units2[0].fullName === "USUnits.FT", `Unit name should be USUnits.FT and not ${units2[0].fullName}`).to.be.true;
    expect(units2).to.have.lengthOf(1);
  });

  it.only("should only find Units.FT for Units.USCUSTOM unitSystem and USUnits.FT for USUnits.USCUSTOM unitSystem", async () => {
    const units1: Unit[] = await query.findUnitsByDisplayLabel("ft", undefined, undefined, "Units.USCUSTOM");
    expect(units1[0].fullName === "Units.FT", `Unit name should be Units.FT and not ${units1[0].fullName}`).to.be.true;
    expect(units1).to.have.lengthOf(1);

    const units2: Unit[] = await query.findUnitsByDisplayLabel("ft", undefined, undefined, "USUnits.USCUSTOM");
    expect(units2[0].fullName === "USUnits.FT", `Unit name should be USUnits.FT and not ${units2[0].fullName}`).to.be.true;
    expect(units2).to.have.lengthOf(1);
  });

  // Tests for findUnitsByAltDisplayLabel
  it.only("should find Units.MILE by corresponding alternate display label", async () => {
    const units1: Unit[] = await query.findUnitsByAltDisplayLabel("mile");
    expect(units1[0].fullName === "Units.MILE", `Unit name should be Units.MILE and not ${units1[0].fullName}`).to.be.true;
    expect(units1).to.have.lengthOf(1);

    const units2: Unit[] = await query.findUnitsByAltDisplayLabel("Miles");
    expect(units2[0].fullName === "Units.MILE", `Unit name should be Units.MILE and not ${units2[0].fullName}`).to.be.true;
    expect(units2).to.have.lengthOf(1);

    const units3: Unit[] = await query.findUnitsByAltDisplayLabel("Mile");
    expect(units3[0].fullName === "Units.MILE", `Unit name should be Units.MILE and not ${units3[0].fullName}`).to.be.true;
    expect(units3).to.have.lengthOf(1);
  });

  it.only("should find Units.FT and Units.US_SURVEY_FT with 'FT' or 'ft'", async () => {
    const units1: Unit[] = await query.findUnitsByAltDisplayLabel("FT");
    expect(units1.find((unit) => unit.fullName === "Units.FT") !== undefined, `Units array should contain Units.FT`).to.be.true;
    expect(units1.find((unit) => unit.fullName === "Units.US_SURVEY_FT") !== undefined, `Units array should contain Units.US_SURVEY_FT`).to.be.true;
    expect(units1).to.have.lengthOf(2);

    const units2: Unit[] = await query.findUnitsByAltDisplayLabel("ft");
    expect(units2.find((unit) => unit.fullName === "Units.FT") !== undefined, `Units array should contain Units.FT`).to.be.true;
    expect(units2.find((unit) => unit.fullName === "Units.US_SURVEY_FT") !== undefined, `Units array should contain Units.US_SURVEY_FT`).to.be.true;
    expect(units2).to.have.lengthOf(2);
  });

  it.only("should only find Units.FT for USCUSTOM unitSystem and Units.US_SURVEY_FT for USSURVEY unitSystem", async () => {
    const units1: Unit[] = await query.findUnitsByAltDisplayLabel("FT", "Units.LENGTH", "Units.USCUSTOM");
    expect(units1[0].fullName === "Units.FT", `Unit name should be Units.FT and not ${units1[0].fullName}`).to.be.true;
    expect(units1).to.have.lengthOf(1);

    const units2: Unit[] = await query.findUnitsByAltDisplayLabel("FT", "Units.LENGTH", "Units.USSURVEY");
    expect(units2[0].fullName === "Units.US_SURVEY_FT", `Unit name should be Units.US_SURVEY_FT and not ${units2[0].fullName}`).to.be.true;
    expect(units2).to.have.lengthOf(1);
  });

  it.only("should only find Units.CM for LENGTH phenomena and Units.CUB_M for VOLUME phenomena", async () => {
    const units1: Unit[] = await query.findUnitsByAltDisplayLabel("cm", "Units.LENGTH");
    expect(units1[0].fullName === "Units.CM", `Unit name should be Units.CM and not ${units1[0].fullName}`).to.be.true;
    expect(units1).to.have.lengthOf(1);

    const units2: Unit[] = await query.findUnitsByAltDisplayLabel("cm", "Units.VOLUME");
    expect(units2[0].fullName === "Units.CUB_M", `Unit name should be Units.CUB_M and not ${units2[0].fullName}`).to.be.true;
    expect(units2).to.have.lengthOf(1);
  });

  it.only("should only find Units.CM for METRIC unitSystem and Units.CUB_M for SI unitSystem", async () => {
    const units1: Unit[] = await query.findUnitsByAltDisplayLabel("cm", undefined, "Units.METRIC");
    expect(units1[0].fullName === "Units.CM", `Unit name should be Units.CM and not ${units1[0].fullName}`).to.be.true;
    expect(units1).to.have.lengthOf(1);

    const units2: Unit[] = await query.findUnitsByAltDisplayLabel("cm", undefined, "Units.SI");
    expect(units2[0].fullName === "Units.CUB_M", `Unit name should be Units.CUB_M and not ${units2[0].fullName}`).to.be.true;
    expect(units2).to.have.lengthOf(1);
  });

  it.only("should not find any units when alternate display label, phenomenon, or unitSystem is not found", async () => {
    const units1: Unit[] = await query.findUnitsByAltDisplayLabel("MockAltDisplayLabel");
    expect(units1).to.have.lengthOf(0);

    const units2: Unit[] = await query.findUnitsByAltDisplayLabel("Units.M", "MockPhenomenon");
    expect(units2).to.have.lengthOf(0);

    const units3: Unit[] = await query.findUnitsByAltDisplayLabel("Units.M", "Units.LENGTH", "MockUnitSystem");
    expect(units3).to.have.lengthOf(0);
  });
});
