/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption } from "@itwin/core-quantity";
import { describe, expect, it } from "vitest";
import { AbstractSchemaItemType, SchemaItemType } from "../../ECObjects";
import { Authoring, SchemaDocument } from "../../Authoring/SchemaDocument";

describe("SchemaDocument units / formats", () => {
  describe("UnitSystem", () => {
    it("carries only the common item envelope", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const si = doc.createUnitSystem("SI", { label: "International System of Units", description: "desc" });
      expect(si.schemaItemType).to.equal(SchemaItemType.UnitSystem);
      expect(si.name).to.equal("SI");
      expect(si.label).to.equal("International System of Units");
      expect(si.description).to.equal("desc");
      expect(doc.getItemOfType("SI", SchemaItemType.UnitSystem)).to.equal(si);
    });
  });

  describe("Phenomenon", () => {
    it("holds its defining expression as plain data", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const area = doc.createPhenomenon("AREA", "LENGTH(2)", { label: "Area" });
      expect(area.schemaItemType).to.equal(SchemaItemType.Phenomenon);
      expect(area.definition).to.equal("LENGTH(2)");
      expect(doc.getItemOfType("AREA", SchemaItemType.Phenomenon)).to.equal(area);
    });
  });

  describe("Unit", () => {
    it("captures references and definition; factor components stay unset unless given", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const meter = doc.createUnit("M", "LENGTH", "SI", "M");
      expect(meter.schemaItemType).to.equal(SchemaItemType.Unit);
      expect(meter.phenomenon).to.equal("LENGTH");
      expect(meter.unitSystem).to.equal("SI");
      expect(meter.definition).to.equal("M");
      // undefined = not explicitly set; reads as 1/1/0 and is not persisted
      expect(meter.numerator).to.be.undefined;
      expect(meter.denominator).to.be.undefined;
      expect(meter.offset).to.be.undefined;
    });

    it("holds explicit factor components, including an offset", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const celsius = doc.createUnit("CELSIUS", "Units:TEMPERATURE", "Units:METRIC", "K", { offset: -273.15 });
      expect(celsius.offset).to.equal(-273.15);
      const mile = doc.createUnit("MILE", "LENGTH", "USCUSTOM", "YRD", { numerator: 1760.0 });
      expect(mile.numerator).to.equal(1760.0);
      expect(mile.denominator).to.be.undefined;
    });
  });

  describe("InvertedUnit", () => {
    it("references the unit it inverts and its system, nothing of its own", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const inv = doc.createInvertedUnit("HORIZONTAL_PER_VERTICAL", "Units:VERTICAL_PER_HORIZONTAL", "Units:INTERNATIONAL");
      expect(inv.schemaItemType).to.equal(SchemaItemType.InvertedUnit);
      expect(inv.invertsUnit).to.equal("Units:VERTICAL_PER_HORIZONTAL");
      expect(inv.unitSystem).to.equal("Units:INTERNATIONAL");
    });
  });

  describe("Constant", () => {
    it("has a phenomenon and definition but no unit system or offset", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const pi = doc.createConstant("PI", "Units:LENGTH_RATIO", "ONE", { numerator: 3.1415926535897932384626433832795 });
      expect(pi.schemaItemType).to.equal(SchemaItemType.Constant);
      expect(pi.phenomenon).to.equal("Units:LENGTH_RATIO");
      expect(pi.definition).to.equal("ONE");
      expect(pi.numerator).to.be.closeTo(3.14159265, 1e-8);
      expect(pi.denominator).to.be.undefined;
      expect("offset" in pi && (pi as any).offset !== undefined).to.be.false;
    });
  });

  describe("Format", () => {
    it("only the type is mandatory; everything else stays unset (reads as the spec default)", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const fmt = doc.createFormat("DefaultReal", FormatType.Decimal);
      expect(fmt.schemaItemType).to.equal(SchemaItemType.Format);
      expect(fmt.type).to.equal(FormatType.Decimal);
      expect(fmt.precision).to.be.undefined;
      expect(fmt.roundFactor).to.be.undefined;
      expect(fmt.showSignOption).to.be.undefined;
      expect(fmt.formatTraits).to.be.undefined;
      expect(fmt.decimalSeparator).to.be.undefined;
      expect(fmt.composite).to.be.undefined;
    });

    it("holds the full numeric configuration", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const fmt = doc.createFormat("Sci", FormatType.Scientific, {
        precision: 6,
        scientificType: ScientificType.Normalized,
        showSignOption: ShowSignOption.SignAlways,
        formatTraits: FormatTraits.ShowUnitLabel | FormatTraits.KeepSingleZero,
        decimalSeparator: ",",
        thousandSeparator: ".",
        uomSeparator: "",
      });
      expect(fmt.precision).to.equal(6);
      expect(fmt.scientificType).to.equal(ScientificType.Normalized);
      expect(fmt.showSignOption).to.equal(ShowSignOption.SignAlways);
      expect(fmt.hasFormatTrait(FormatTraits.ShowUnitLabel)).to.be.true;
      expect(fmt.hasFormatTrait(FormatTraits.KeepSingleZero)).to.be.true;
      expect(fmt.hasFormatTrait(FormatTraits.FractionDash)).to.be.false;
      expect(fmt.decimalSeparator).to.equal(",");
      expect(fmt.uomSeparator).to.equal(""); // empty string is an explicit value, distinct from unset
    });

    it("supports fractional precision and station fields", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const frac = doc.createFormat("Frac", FormatType.Fractional, { precision: FractionalPrecision.Eight });
      expect(frac.precision).to.equal(8);
      const station = doc.createFormat("Stat", FormatType.Station, { stationOffsetSize: 2, stationSeparator: "+" });
      expect(station.stationOffsetSize).to.equal(2);
      expect(station.stationSeparator).to.equal("+");
    });

    it("copies the composite into an owned object", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const init: Authoring.FormatComposite = {
        spacer: "-",
        includeZero: false,
        units: [
          { name: "Units:FT", label: "'" },
          { name: "Units:IN", label: "\"" },
        ],
      };
      const fmt = doc.createFormat("FtIn", FormatType.Fractional, { precision: FractionalPrecision.Eight, composite: init });
      expect(fmt.composite).to.not.equal(init); // copied, not aliased
      expect(fmt.composite).to.deep.equal(init);
      init.units.push({ name: "Units:MILE" }); // later edits to the source don't leak in
      expect(fmt.composite!.units).to.have.lengthOf(2);
    });
  });

  describe("integration with the item collection", () => {
    it("the units / formats kinds enumerate and narrow like any other item", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      doc.createUnitSystem("SI");
      doc.createPhenomenon("LENGTH", "LENGTH");
      doc.createUnit("M", "LENGTH", "SI", "M");
      doc.createUnit("MM", "LENGTH", "SI", "MILLI*M");
      doc.createFormat("DefaultReal", FormatType.Decimal);
      doc.createEntity("Pump");

      expect([...doc.getItemsOfType(SchemaItemType.Unit)].map((u) => u.name)).to.deep.equal(["M", "MM"]);
      expect([...doc.getItemsOfType(AbstractSchemaItemType.SchemaItem)]).to.have.lengthOf(6);
      expect([...doc.getItemsOfType(AbstractSchemaItemType.Class)]).to.have.lengthOf(1); // units/formats are not classes

      const unit = doc.getItem("m"); // case-insensitive, like every item lookup
      expect(unit).to.not.be.undefined;
      expect(unit!.isClass()).to.be.false;
      expect(doc.getItemOfType("M", SchemaItemType.Format)).to.be.undefined; // name of a different kind
      expect(doc.removeItem("MM")).to.not.be.undefined;
      expect([...doc.getItemsOfType(SchemaItemType.Unit)].map((u) => u.name)).to.deep.equal(["M"]);
    });
  });
});
