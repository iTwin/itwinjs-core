/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaContext } from "../../Context";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { UnitConverter } from "../../UnitConversion/UnitConverter";

describe("Testing when unit conversion should throw", () => {
  const context = new SchemaContext();

  before(() => {
    const siSchemaFile = path.join(__dirname, "..", "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXmlSync(siSchemaXml, context);

    const metricSchemaFile = path.join(__dirname, "..", "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXmlSync(metricSchemaXml, context);

    const usSchemaFile = path.join(__dirname, "..", "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXmlSync(usSchemaXml, context);

    const auSchemaFile = path.join(__dirname, "..", "assets", "ValidationUnits.ecschema.xml");
    const auSchemaXml = fs.readFileSync(auSchemaFile, "utf-8");
    deserializeXmlSync(auSchemaXml, context);
  });

  it("should throw when schema name is not in context", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("MockSchema:CM", "SIUnits:M");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find from's and/or to's schema");
    }
    try {
      await converter.calculateConversion("SIUnits:M", "MockSchema:CM");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find from's and/or to's schema");
    }
  });

  it("should throw when schema item is not in schema ", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("SIUnits:MockUnit", "MetricUnits:CM");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
    try {
      await converter.calculateConversion("MetricUnits:CM", "SIUnits:MockUnit");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
  });

  it("should throw when source and target units are not the same phenomenon", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("USUnits:SQ_FT", "SIUnits:M");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not belong to same phenomenon");
    }
    try {
      await converter.calculateConversion("SIUnits:M", "USUnits:SQ_FT");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not belong to same phenomenon");
    }
  });

  it("should throw when unit in definition is not found in schema (deci is not in ValidationUnits schema)", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("ValidationUnits:DM", "ValidationUnits:KM");
      await converter.calculateConversion("ValidationUnits:KM", "ValidationUnits:DM");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
  });

  it("should throw when source and target units do not have the same base units", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("ValidationUnits:FT", "ValidationUnits:KM");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("ValidationUnits:KM", "ValidationUnits:FT");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }

    try {
      await converter.calculateConversion("ValidationUnits:YRD", "ValidationUnits:M");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("ValidationUnits:M", "ValidationUnits:YRD");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
  });

  it("should throw when source and target units do not have the same base units", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("ValidationUnits:MM_PER_SEC", "ValidationUnits:FT_PER_DAY");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("ValidationUnits:FT_PER_DAY", "ValidationUnits:MM_PER_SEC");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }

    try {
      await converter.calculateConversion("ValidationUnits:MM_PER_HR", "ValidationUnits:FT_PER_SEC");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
    try {
      await converter.calculateConversion("ValidationUnits:FT_PER_SEC", "ValidationUnits:MM_PER_HR");
    } catch (err: any) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Source and target units do not have matching base units");
    }
  });
});
