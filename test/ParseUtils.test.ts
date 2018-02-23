/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ECClassModifier, CustomAttributeContainerType, parsePrimitiveType, parseClassModifier,
         PrimitiveType, tryParsePrimitiveType, parseCustomAttributeContainerType, containerTypeToString,
         RelationshipEnd, relationshipEndToString, StrengthType, parseStrength, RelatedInstanceDirection,
         parseStrengthDirection, SchemaChildType, schemaChildTypeToString, tryParseSchemaChildType } from "../source/ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../source/Exception";

describe("Parsing/ToString Functions", () => {
  it("parsePrimitiveType", () => {
    expect(parsePrimitiveType("binary")).equal(PrimitiveType.Binary);
    expect(parsePrimitiveType("bool")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("boolean")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("dateTime")).equal(PrimitiveType.DateTime);
    expect(parsePrimitiveType("double")).equal(PrimitiveType.Double);
    expect(parsePrimitiveType("Bentley.Geometry.Common.IGeometry")).equal(PrimitiveType.IGeometry);
    expect(parsePrimitiveType("int")).equal(PrimitiveType.Integer);
    expect(parsePrimitiveType("long")).equal(PrimitiveType.Long);
    expect(parsePrimitiveType("point2d")).equal(PrimitiveType.Point2d);
    expect(parsePrimitiveType("point3d")).equal(PrimitiveType.Point3d);
    expect(parsePrimitiveType("string")).equal(PrimitiveType.String);
    expect(() => parsePrimitiveType("invalid type")).to.throw(ECObjectsError, "The string 'invalid type' is not one of the 10 supported primitive types.");

    expect(tryParsePrimitiveType("BInaRy")).equal(PrimitiveType.Binary);
    expect(tryParsePrimitiveType("BoOL")).equal(PrimitiveType.Boolean);
    expect(tryParsePrimitiveType("boolean")).equal(PrimitiveType.Boolean);
    expect(tryParsePrimitiveType("DaTEtime")).equal(PrimitiveType.DateTime);
    expect(tryParsePrimitiveType("DouBlE")).equal(PrimitiveType.Double);
    expect(tryParsePrimitiveType("beNTlEY.gEoMeTrY.CoMmoN.igeOMeTRY")).equal(PrimitiveType.IGeometry);
    expect(tryParsePrimitiveType("INt")).equal(PrimitiveType.Integer);
    expect(tryParsePrimitiveType("loNG")).equal(PrimitiveType.Long);
    expect(tryParsePrimitiveType("PoInt2d")).equal(PrimitiveType.Point2d);
    expect(tryParsePrimitiveType("POinT3d")).equal(PrimitiveType.Point3d);
    expect(tryParsePrimitiveType("STrINg")).equal(PrimitiveType.String);
    expect(tryParsePrimitiveType("inVAlId")).equal(undefined);
  });

  it("parseClassModifier", () => {
    expect(parseClassModifier("Abstract")).to.equal(ECClassModifier.Abstract);
    expect(parseClassModifier("Sealed")).to.equal(ECClassModifier.Sealed);
    expect(parseClassModifier("None")).to.equal(ECClassModifier.None);

    expect(parseClassModifier("aBSTraCT")).to.equal(ECClassModifier.Abstract);
    expect(parseClassModifier("sEALEd")).to.equal(ECClassModifier.Sealed);
    expect(parseClassModifier("NoNE")).to.equal(ECClassModifier.None);
    expect(() => parseClassModifier("invalid modifier")).to.throw(ECObjectsError, "The string 'invalid modifier' is not a valid ECClassModifier.");
  });

  it("parseCustomAttributeContainerType", () => {
    expect(parseCustomAttributeContainerType("SChEma")).to.equal(CustomAttributeContainerType.Schema);
    expect(parseCustomAttributeContainerType("ENTiTycLAsS")).to.equal(CustomAttributeContainerType.EntityClass);
    expect(parseCustomAttributeContainerType("CUstOmAttRIBUteClASs")).to.equal(CustomAttributeContainerType.CustomAttributeClass);
    expect(parseCustomAttributeContainerType("StRuCTclAsS")).to.equal(CustomAttributeContainerType.StructClass);
    expect(parseCustomAttributeContainerType("rElATIonSHIPcLaSS")).to.equal(CustomAttributeContainerType.RelationshipClass);
    expect(parseCustomAttributeContainerType("anYCLaSS")).to.equal(CustomAttributeContainerType.AnyClass);
    expect(parseCustomAttributeContainerType("pRImiTIVeProPErtY")).to.equal(CustomAttributeContainerType.PrimitiveProperty);
    expect(parseCustomAttributeContainerType("StRuCTProperty")).to.equal(CustomAttributeContainerType.StructProperty);
    expect(parseCustomAttributeContainerType("priMitIveARRayPRoPertY")).to.equal(CustomAttributeContainerType.PrimitiveArrayProperty);
    expect(parseCustomAttributeContainerType("sTRUctArrayPrOPErTy")).to.equal(CustomAttributeContainerType.StructArrayProperty);
    expect(parseCustomAttributeContainerType("nAviGAtIoNProPerTY")).to.equal(CustomAttributeContainerType.NavigationProperty);
    expect(parseCustomAttributeContainerType("AnyProPErTy")).to.equal(CustomAttributeContainerType.AnyProperty);
    expect(parseCustomAttributeContainerType("SouRcEReLatIoNShiPCoNstRaInT")).to.equal(CustomAttributeContainerType.SourceRelationshipConstraint);
    expect(parseCustomAttributeContainerType("TarGETreLATIoNShIPCOnSTrAInT")).to.equal(CustomAttributeContainerType.TargetRelationshipConstraint);
    expect(parseCustomAttributeContainerType("AnyRELaTioNShiPCoNSTrAInt")).to.equal(CustomAttributeContainerType.AnyRelationshipConstraint);
    expect(parseCustomAttributeContainerType("aNy")).to.equal(CustomAttributeContainerType.Any);
    expect(() => parseCustomAttributeContainerType("invalid type")).to.throw(ECObjectsError, "invalid type is not a valid CustomAttributeContainerType value.");

    const combo = CustomAttributeContainerType.Schema
      | CustomAttributeContainerType.AnyClass
      | CustomAttributeContainerType.TargetRelationshipConstraint
      | CustomAttributeContainerType.StructProperty;
    expect(parseCustomAttributeContainerType(";Schema|AnyClass,TargetRelationshipConstraint;StructProperty")).to.equal(combo);
  });

  it("containerTypeToString", () => {
    expect(containerTypeToString(CustomAttributeContainerType.Schema)).to.equal("Schema");
    expect(containerTypeToString(CustomAttributeContainerType.EntityClass)).to.equal("EntityClass");
    expect(containerTypeToString(CustomAttributeContainerType.CustomAttributeClass)).to.equal("CustomAttributeClass");
    expect(containerTypeToString(CustomAttributeContainerType.StructClass)).to.equal("StructClass");
    expect(containerTypeToString(CustomAttributeContainerType.RelationshipClass)).to.equal("RelationshipClass");
    expect(containerTypeToString(CustomAttributeContainerType.AnyClass)).to.equal("AnyClass");
    expect(containerTypeToString(CustomAttributeContainerType.PrimitiveProperty)).to.equal("PrimitiveProperty");
    expect(containerTypeToString(CustomAttributeContainerType.StructProperty)).to.equal("StructProperty");
    expect(containerTypeToString(CustomAttributeContainerType.PrimitiveArrayProperty)).to.equal("PrimitiveArrayProperty");
    expect(containerTypeToString(CustomAttributeContainerType.StructArrayProperty)).to.equal("StructArrayProperty");
    expect(containerTypeToString(CustomAttributeContainerType.NavigationProperty)).to.equal("NavigationProperty");
    expect(containerTypeToString(CustomAttributeContainerType.AnyProperty)).to.equal("AnyProperty");
    expect(containerTypeToString(CustomAttributeContainerType.SourceRelationshipConstraint)).to.equal("SourceRelationshipConstraint");
    expect(containerTypeToString(CustomAttributeContainerType.TargetRelationshipConstraint)).to.equal("TargetRelationshipConstraint");
    expect(containerTypeToString(CustomAttributeContainerType.AnyRelationshipConstraint)).to.equal("AnyRelationshipConstraint");
    expect(containerTypeToString(CustomAttributeContainerType.Any)).to.equal("Any");

    const combo = CustomAttributeContainerType.Schema
      | CustomAttributeContainerType.AnyClass
      | CustomAttributeContainerType.TargetRelationshipConstraint
      | CustomAttributeContainerType.StructProperty;
    expect(containerTypeToString(combo)).to.equal("Schema,AnyClass,StructProperty,TargetRelationshipConstraint");
  });

  it("relationshipEndToString", () => {
    expect(relationshipEndToString(RelationshipEnd.Source)).to.equal("Source");
    expect(relationshipEndToString(RelationshipEnd.Target)).to.equal("Target");
  });

  it("parseStrength", () => {
    expect(parseStrength("ReFEReNcInG")).to.equal(StrengthType.Referencing);
    expect(parseStrength("HOLdIng")).to.equal(StrengthType.Holding);
    expect(parseStrength("EMBedDiNG")).to.equal(StrengthType.Embedding);
    expect(() => parseStrength("inVAlId")).to.throw(ECObjectsError, "inVAlId is not a valid StrengthType");
  });

  it("parseStrengthDirection", () => {
    expect(parseStrengthDirection("forward")).to.equal(RelatedInstanceDirection.Forward);
    expect(parseStrengthDirection("BACKWARD")).to.equal(RelatedInstanceDirection.Backward);
    expect(() => parseStrengthDirection("invalid")).to.throw(ECObjectsError, "invalid is not a valid StrengthDirection.");
  });

  it("tryParseSchemaChildType", () => {
    expect(tryParseSchemaChildType("eNtItyCLaSs")).to.equal(SchemaChildType.EntityClass);
    expect(tryParseSchemaChildType("mIXIn")).to.equal(SchemaChildType.Mixin);
    expect(tryParseSchemaChildType("sTRuCTcLaSS")).to.equal(SchemaChildType.StructClass);
    expect(tryParseSchemaChildType("cuSTomATTRIbuTEClaSs")).to.equal(SchemaChildType.CustomAttributeClass);
    expect(tryParseSchemaChildType("rELAtIONsHiPClaSs")).to.equal(SchemaChildType.RelationshipClass);
    expect(tryParseSchemaChildType("enUmERAtiON")).to.equal(SchemaChildType.Enumeration);
    expect(tryParseSchemaChildType("KiNDofQuaNTiTy")).to.equal(SchemaChildType.KindOfQuantity);
    expect(tryParseSchemaChildType("prOpeRtYcAteGoRy")).to.equal(SchemaChildType.PropertyCategory);
    expect(tryParseSchemaChildType("inVAlId")).to.not.exist;
  });

  it("schemaChildTypeToString", () => {
    expect(schemaChildTypeToString(SchemaChildType.EntityClass)).to.equal("EntityClass");
    expect(schemaChildTypeToString(SchemaChildType.Mixin)).to.equal("Mixin");
    expect(schemaChildTypeToString(SchemaChildType.StructClass)).to.equal("StructClass");
    expect(schemaChildTypeToString(SchemaChildType.CustomAttributeClass)).to.equal("CustomAttributeClass");
    expect(schemaChildTypeToString(SchemaChildType.RelationshipClass)).to.equal("RelationshipClass");
    expect(schemaChildTypeToString(SchemaChildType.Enumeration)).to.equal("Enumeration");
    expect(schemaChildTypeToString(SchemaChildType.KindOfQuantity)).to.equal("KindOfQuantity");
    expect(schemaChildTypeToString(SchemaChildType.PropertyCategory)).to.equal("PropertyCategory");
  });
});

describe("ECObjectsError ", () => {
  it("toDebugString", () => {
    expect(new ECObjectsError(ECObjectsStatus.DuplicateChild).toDebugString()).to.equal("ECObjectsStatus.DuplicateChild");
    expect(new ECObjectsError(ECObjectsStatus.DuplicateProperty, "msg").toDebugString()).to.equal("ECObjectsStatus.DuplicateProperty: msg");
    expect(new ECObjectsError(ECObjectsStatus.DuplicateSchema, "msg").toDebugString()).to.equal("ECObjectsStatus.DuplicateSchema: msg");
    expect(new ECObjectsError(ECObjectsStatus.ImmutableSchema, "msg").toDebugString()).to.equal("ECObjectsStatus.ImmutableSchema: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidContainerType, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidContainerType: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidECJson, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidECJson: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidECName, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidECName: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidECVersion, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidECVersion: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidEnumValue, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidEnumValue: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidModifier, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidModifier: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidMultiplicity, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidMultiplicity: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidPrimitiveType, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidPrimitiveType: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidStrength, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidStrength: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidStrengthDirection: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidType, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidType: msg");
    expect(new ECObjectsError(ECObjectsStatus.MissingSchemaUrl, "msg").toDebugString()).to.equal("ECObjectsStatus.MissingSchemaUrl: msg");
    expect(new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, "msg").toDebugString()).to.equal("ECObjectsStatus.UnableToLocateSchema: msg");
    expect(() => new ECObjectsError(-9999).toDebugString()).to.throw(Error);
  });
});
