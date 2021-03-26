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
});
