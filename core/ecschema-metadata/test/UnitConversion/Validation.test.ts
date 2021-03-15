/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaContext } from "../../src/ecschema-metadata";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { deserializeXml } from "./DeserializeSchema";
import { UnitConverter } from "../../src/UnitConversion/UnitConverter";

interface TestData {
  FromSchema: string;
  From: string;
  ToSchema: string;
  To: string;
  Input: number;
  Expect: number;
}

describe("Testing when unit conversion should throw", () => {
  const context = new SchemaContext();

  before(() => {
    const siSchemaFile = path.join(__dirname, "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXml(context, siSchemaXml);

    const metricSchemaFile = path.join(__dirname, "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXml(context, metricSchemaXml);

    const usSchemaFile = path.join(__dirname, "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXml(context, usSchemaXml);

    const auSchemaFile = path.join(__dirname, "assets", "AlteredUnits.ecschema.xml");
    const auSchemaXml = fs.readFileSync(auSchemaFile, "utf-8");
    deserializeXml(context, auSchemaXml);
  });

  it("should throw when schema name is not in context", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("MockSchema:CM", "SIUnits:M");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find from's and/or to's schema");
    }
    try {
      await converter.calculateConversion("SIUnits:M", "MockSchema:CM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find from's and/or to's schema");
    }
  });

  it("should throw when schema item is not in schema ", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("SIUnits:MockUnit", "MetricUnits:CM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
    try {
      await converter.calculateConversion("MetricUnits:CM", "SIUnits:MockUnit");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
  });

  it("should throw when source and target units are not the same phenomenon", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("USUnits:SQ_FT", "SIUnits:M");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not belong to same phenomenon");
    }
    try {
      await converter.calculateConversion("SIUnits:M", "USUnits:SQ_FT");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not belong to same phenomenon");
    }
  })

  it("should throw when unit in definition is not found in schema (deci is not in AlteredUnits schema)", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("AlteredUnits:DM", "AlteredUnits:KM");
      await converter.calculateConversion("AlteredUnits:KM", "AlteredUnits:DM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
  })

  it("should throw when source and target units do not have the same base units", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("AlteredUnits:FT", "AlteredUnits:KM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("AlteredUnits:KM", "AlteredUnits:FT");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }

    try {
      await converter.calculateConversion("AlteredUnits:YRD", "AlteredUnits:M");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("AlteredUnits:M", "AlteredUnits:YRD");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
  })

  it("should throw when source and target units do not have the same base units", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("AlteredUnits:MM_PER_SEC", "AlteredUnits:FT_PER_DAY");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("AlteredUnits:FT_PER_DAY", "AlteredUnits:MM_PER_SEC");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }

    try {
      await converter.calculateConversion("AlteredUnits:MM_PER_HR", "AlteredUnits:FT_PER_SEC");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("AlteredUnits:FT_PER_SEC", "AlteredUnits:MM_PER_HR");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
  })
});
