/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaItemReference } from "../../Authoring/SchemaItemReference";

describe("SchemaItemReference", () => {
  describe("parse", () => {
    it("parses a colon-separated qualified name", () => {
      const ref = SchemaItemReference.parse("BisCore:PhysicalElement");
      expect(ref.schemaNameOrAlias).to.equal("BisCore");
      expect(ref.name).to.equal("PhysicalElement");
      expect(ref.isLocal).to.be.false;
    });

    it("parses a dot-separated qualified name", () => {
      const ref = SchemaItemReference.parse("CoreCustomAttributes.DynamicSchema");
      expect(ref.schemaNameOrAlias).to.equal("CoreCustomAttributes");
      expect(ref.name).to.equal("DynamicSchema");
      expect(ref.isLocal).to.be.false;
    });

    it("treats a bare name as a local reference", () => {
      const ref = SchemaItemReference.parse("Pump");
      expect(ref.schemaNameOrAlias).to.be.undefined;
      expect(ref.name).to.equal("Pump");
      expect(ref.isLocal).to.be.true;
    });

    it("prefers ':' over '.' when both are present", () => {
      const ref = SchemaItemReference.parse("alias:Some.Name");
      expect(ref.schemaNameOrAlias).to.equal("alias");
      expect(ref.name).to.equal("Some.Name");
    });

    it("trims surrounding whitespace on each part", () => {
      const ref = SchemaItemReference.parse("  BisCore : PhysicalElement  ");
      expect(ref.schemaNameOrAlias).to.equal("BisCore");
      expect(ref.name).to.equal("PhysicalElement");
    });

    it("treats an empty schema part as local", () => {
      const ref = SchemaItemReference.parse(":Pump");
      expect(ref.isLocal).to.be.true;
      expect(ref.name).to.equal("Pump");
    });
  });

  describe("from", () => {
    it("parses a string", () => {
      expect(SchemaItemReference.from("BisCore:Element").name).to.equal("Element");
    });

    it("passes a SchemaItemReference through unchanged", () => {
      const ref = new SchemaItemReference("Element", "BisCore");
      expect(SchemaItemReference.from(ref)).to.equal(ref);
    });
  });

  describe("construction and normalization", () => {
    it("normalizes an empty schema part to undefined (local)", () => {
      expect(new SchemaItemReference("Pump", "").isLocal).to.be.true;
      expect(new SchemaItemReference("Pump", "   ").isLocal).to.be.true;
    });
  });

  describe("toString", () => {
    it("emits the ':' form for a qualified reference", () => {
      expect(new SchemaItemReference("PhysicalElement", "BisCore").toString()).to.equal("BisCore:PhysicalElement");
    });

    it("emits just the name for a local reference", () => {
      expect(new SchemaItemReference("Pump").toString()).to.equal("Pump");
    });

    it("round-trips a dot-separated name to the ':' form", () => {
      expect(SchemaItemReference.parse("CoreCustomAttributes.DynamicSchema").toString()).to.equal("CoreCustomAttributes:DynamicSchema");
    });
  });

  describe("equals", () => {
    it("is case-insensitive on both parts", () => {
      expect(new SchemaItemReference("PhysicalElement", "BisCore").equals(new SchemaItemReference("physicalelement", "biscore"))).to.be.true;
    });

    it("distinguishes local from qualified", () => {
      expect(new SchemaItemReference("Pump").equals(new SchemaItemReference("Pump", "MyDomain"))).to.be.false;
    });

    it("does not resolve aliases against schema names", () => {
      expect(new SchemaItemReference("Element", "BisCore").equals(new SchemaItemReference("Element", "bis"))).to.be.false;
    });

    it("matches two local references with equal names", () => {
      expect(new SchemaItemReference("Pump").equals(new SchemaItemReference("PUMP"))).to.be.true;
    });
  });
});
