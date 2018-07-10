/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { ECClassModifier, CustomAttributeContainerType, parseClassModifier,
         PrimitiveType, parsePrimitiveType, parseCustomAttributeContainerType, containerTypeToString,
         RelationshipEnd, relationshipEndToString, StrengthType, parseStrength, StrengthDirection,
         parseStrengthDirection, SchemaItemType, schemaItemTypeToString, parseSchemaItemType, classModifierToString, strengthToString,
         strengthDirectionToString, parseRelationshipEnd, primitiveTypeToString } from "../source/ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../source/Exception";

describe("Parsing/ToString Functions", () => {
  it("parsePrimitiveType", () => {
    expect(parsePrimitiveType("BInaRy")).equal(PrimitiveType.Binary);
    expect(parsePrimitiveType("boOL")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("boOLean")).equal(PrimitiveType.Boolean);
    expect(parsePrimitiveType("DaTEtime")).equal(PrimitiveType.DateTime);
    expect(parsePrimitiveType("DouBlE")).equal(PrimitiveType.Double);
    expect(parsePrimitiveType("beNTlEY.gEoMeTrY.CoMmoN.igeOMeTRY")).equal(PrimitiveType.IGeometry);
    expect(parsePrimitiveType("INt")).equal(PrimitiveType.Integer);
    expect(parsePrimitiveType("loNG")).equal(PrimitiveType.Long);
    expect(parsePrimitiveType("PoInt2d")).equal(PrimitiveType.Point2d);
    expect(parsePrimitiveType("POinT3d")).equal(PrimitiveType.Point3d);
    expect(parsePrimitiveType("STrINg")).equal(PrimitiveType.String);
    expect(parsePrimitiveType("invalid type")).to.be.undefined;
  });

  it("primitiveTypeToString", () => {
    expect(primitiveTypeToString(PrimitiveType.Binary)).to.equal("binary");
    expect(primitiveTypeToString(PrimitiveType.Boolean)).to.equal("boolean");
    expect(primitiveTypeToString(PrimitiveType.DateTime)).to.equal("dateTime");
    expect(primitiveTypeToString(PrimitiveType.Double)).to.equal("double");
    expect(primitiveTypeToString(PrimitiveType.IGeometry)).to.equal("Bentley.Geometry.Common.IGeometry");
    expect(primitiveTypeToString(PrimitiveType.Integer)).to.equal("int");
    expect(primitiveTypeToString(PrimitiveType.Long)).to.equal("long");
    expect(primitiveTypeToString(PrimitiveType.Point2d)).to.equal("point2d");
    expect(primitiveTypeToString(PrimitiveType.Point3d)).to.equal("point3d");
    expect(primitiveTypeToString(PrimitiveType.String)).to.equal("string");
    expect(() => primitiveTypeToString(PrimitiveType.Uninitialized)).to.throw(ECObjectsError, "An invalid PrimitiveType has been provided.");
  });

  it("parseClassModifier", () => {
    expect(parseClassModifier("Abstract")).to.equal(ECClassModifier.Abstract);
    expect(parseClassModifier("Sealed")).to.equal(ECClassModifier.Sealed);
    expect(parseClassModifier("None")).to.equal(ECClassModifier.None);

    expect(parseClassModifier("aBSTraCT")).to.equal(ECClassModifier.Abstract);
    expect(parseClassModifier("sEALEd")).to.equal(ECClassModifier.Sealed);
    expect(parseClassModifier("NoNE")).to.equal(ECClassModifier.None);
    expect(parseClassModifier("invalid modifier")).to.be.undefined;
  });

  it("classModiferToString", () => {
    expect(classModifierToString(ECClassModifier.Abstract)).to.equal("Abstract");
    expect(classModifierToString(ECClassModifier.Sealed)).to.equal("Sealed");
    expect(classModifierToString(ECClassModifier.None)).to.equal("None");
    expect(() => classModifierToString(5 as ECClassModifier)).to.throw(ECObjectsError, "An invalid ECClassModifier has been provided.");
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
    expect(parseCustomAttributeContainerType("ARRayPRoPertY")).to.equal(CustomAttributeContainerType.PrimitiveArrayProperty);
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
    expect(containerTypeToString(CustomAttributeContainerType.PrimitiveArrayProperty)).to.equal("ArrayProperty");
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

  it("parseRelationshipEnd", () => {
    expect(parseRelationshipEnd("SoUrCE")).to.equal(RelationshipEnd.Source);
    expect(parseRelationshipEnd("TarGeT")).to.equal(RelationshipEnd.Target);
    expect(parseRelationshipEnd("inVAlId")).to.be.undefined;
  });

  it("relationshipEndToString", () => {
    expect(relationshipEndToString(RelationshipEnd.Source)).to.equal("Source");
    expect(relationshipEndToString(RelationshipEnd.Target)).to.equal("Target");
    expect(() => relationshipEndToString(5 as RelationshipEnd)).to.throw(ECObjectsError, "An invalid RelationshipEnd has been provided.");
  });

  it("parseStrength", () => {
    expect(parseStrength("ReFEReNcInG")).to.equal(StrengthType.Referencing);
    expect(parseStrength("HOLdIng")).to.equal(StrengthType.Holding);
    expect(parseStrength("EMBedDiNG")).to.equal(StrengthType.Embedding);
    expect(parseStrength("inVAlId")).to.be.undefined;
  });

  it("strengthToString", () => {
    expect(strengthToString(StrengthType.Embedding)).to.equal("Embedding");
    expect(strengthToString(StrengthType.Referencing)).to.equal("Referencing");
    expect(strengthToString(StrengthType.Holding)).to.equal("Holding");
    expect(() => strengthToString(5 as StrengthType)).to.throw(ECObjectsError, "An invalid Strength has been provided.");
  });

  it("parseStrengthDirection", () => {
    expect(parseStrengthDirection("forward")).to.equal(StrengthDirection.Forward);
    expect(parseStrengthDirection("BACKWARD")).to.equal(StrengthDirection.Backward);
    expect(parseStrengthDirection("invalid")).to.be.undefined;
  });

  it("strengthDirectionToString", () => {
    expect(strengthDirectionToString(StrengthDirection.Backward)).to.equal("Backward");
    expect(strengthDirectionToString(StrengthDirection.Forward)).to.equal("Forward");
    expect(() => strengthDirectionToString(5 as StrengthDirection)).to.throw(ECObjectsError, "An invalid StrengthDirection has been provided.");
  });

  it("parseSchemaItemType", () => {
    expect(parseSchemaItemType("eNtItyCLaSs")).to.equal(SchemaItemType.EntityClass);
    expect(parseSchemaItemType("mIXIn")).to.equal(SchemaItemType.Mixin);
    expect(parseSchemaItemType("sTRuCTcLaSS")).to.equal(SchemaItemType.StructClass);
    expect(parseSchemaItemType("cuSTomATTRIbuTEClaSs")).to.equal(SchemaItemType.CustomAttributeClass);
    expect(parseSchemaItemType("rELAtIONsHiPClaSs")).to.equal(SchemaItemType.RelationshipClass);
    expect(parseSchemaItemType("enUmERAtiON")).to.equal(SchemaItemType.Enumeration);
    expect(parseSchemaItemType("KiNDofQuaNTiTy")).to.equal(SchemaItemType.KindOfQuantity);
    expect(parseSchemaItemType("prOpeRtYcAteGoRy")).to.equal(SchemaItemType.PropertyCategory);
    expect(parseSchemaItemType("inVAlId")).to.be.undefined;
  });

  it("schemaItemTypeToString", () => {
    expect(schemaItemTypeToString(SchemaItemType.EntityClass)).to.equal("EntityClass");
    expect(schemaItemTypeToString(SchemaItemType.Mixin)).to.equal("Mixin");
    expect(schemaItemTypeToString(SchemaItemType.StructClass)).to.equal("StructClass");
    expect(schemaItemTypeToString(SchemaItemType.CustomAttributeClass)).to.equal("CustomAttributeClass");
    expect(schemaItemTypeToString(SchemaItemType.RelationshipClass)).to.equal("RelationshipClass");
    expect(schemaItemTypeToString(SchemaItemType.Enumeration)).to.equal("Enumeration");
    expect(schemaItemTypeToString(SchemaItemType.KindOfQuantity)).to.equal("KindOfQuantity");
    expect(schemaItemTypeToString(SchemaItemType.PropertyCategory)).to.equal("PropertyCategory");
    expect(() => schemaItemTypeToString(50 as SchemaItemType)).to.throw(ECObjectsError, "An invalid SchemaItemType has been provided.");
  });
});

describe("ECObjectsError ", () => {
  it("toDebugString", () => {
    expect(new ECObjectsError(ECObjectsStatus.DuplicateItem).toDebugString()).to.equal("ECObjectsStatus.DuplicateItem");
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
    expect(new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidSchemaItemType: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidStrength, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidStrength: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidStrengthDirection: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidRelationshipEnd, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidRelationshipEnd: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidType, "msg").toDebugString()).to.equal("ECObjectsStatus.InvalidType: msg");
    expect(new ECObjectsError(ECObjectsStatus.MissingSchemaUrl, "msg").toDebugString()).to.equal("ECObjectsStatus.MissingSchemaUrl: msg");
    expect(new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, "msg").toDebugString()).to.equal("ECObjectsStatus.UnableToLocateSchema: msg");
    assert.throw(() => new ECObjectsError(-9999).toDebugString(), "Programmer Error");
  });
});
