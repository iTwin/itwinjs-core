/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  classModifierToString, containerTypeToString, CustomAttributeContainerType, ECClassModifier, parseClassModifier, parseCustomAttributeContainerType,
  parsePrimitiveType, parseRelationshipEnd, parseSchemaItemType, parseStrength, parseStrengthDirection, PrimitiveType, primitiveTypeToString,
  RelationshipEnd, relationshipEndToString, SchemaItemType, StrengthDirection, strengthDirectionToString, strengthToString,
  StrengthType,
} from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";

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
    expect(() => primitiveTypeToString(PrimitiveType.Uninitialized)).to.throw(ECSchemaError, "An invalid PrimitiveType has been provided.");
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
    expect(() => classModifierToString(5 as ECClassModifier)).to.throw(ECSchemaError, "An invalid ECClassModifier has been provided.");
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
    expect(() => parseCustomAttributeContainerType("invalid type")).to.throw(ECSchemaError, "invalid type is not a valid CustomAttributeContainerType value.");

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
    expect(containerTypeToString(combo)).to.equal("Schema, AnyClass, StructProperty, TargetRelationshipConstraint");
  });

  it("parseRelationshipEnd", () => {
    expect(parseRelationshipEnd("SoUrCE")).to.equal(RelationshipEnd.Source);
    expect(parseRelationshipEnd("TarGeT")).to.equal(RelationshipEnd.Target);
    expect(parseRelationshipEnd("inVAlId")).to.be.undefined;
  });

  it("relationshipEndToString", () => {
    expect(relationshipEndToString(RelationshipEnd.Source)).to.equal("Source");
    expect(relationshipEndToString(RelationshipEnd.Target)).to.equal("Target");
    expect(() => relationshipEndToString(5 as RelationshipEnd)).to.throw(ECSchemaError, "An invalid RelationshipEnd has been provided.");
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
    expect(() => strengthToString(5 as StrengthType)).to.throw(ECSchemaError, "An invalid Strength has been provided.");
  });

  it("parseStrengthDirection", () => {
    expect(parseStrengthDirection("forward")).to.equal(StrengthDirection.Forward);
    expect(parseStrengthDirection("BACKWARD")).to.equal(StrengthDirection.Backward);
    expect(parseStrengthDirection("invalid")).to.be.undefined;
  });

  it("strengthDirectionToString", () => {
    expect(strengthDirectionToString(StrengthDirection.Backward)).to.equal("Backward");
    expect(strengthDirectionToString(StrengthDirection.Forward)).to.equal("Forward");
    expect(() => strengthDirectionToString(5 as StrengthDirection)).to.throw(ECSchemaError, "An invalid StrengthDirection has been provided.");
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
    expect(SchemaItemType.EntityClass).to.equal("EntityClass");
    expect(SchemaItemType.Mixin).to.equal("Mixin");
    expect(SchemaItemType.StructClass).to.equal("StructClass");
    expect(SchemaItemType.CustomAttributeClass).to.equal("CustomAttributeClass");
    expect(SchemaItemType.RelationshipClass).to.equal("RelationshipClass");
    expect(SchemaItemType.Enumeration).to.equal("Enumeration");
    expect(SchemaItemType.KindOfQuantity).to.equal("KindOfQuantity");
    expect(SchemaItemType.PropertyCategory).to.equal("PropertyCategory");
  });
});

describe("ECSchemaError ", () => {
  it("toDebugString", () => {
    expect(new ECSchemaError(ECSchemaStatus.DuplicateItem).toDebugString()).to.equal("ECSchemaStatus.DuplicateItem");
    expect(new ECSchemaError(ECSchemaStatus.DuplicateProperty, "msg").toDebugString()).to.equal("ECSchemaStatus.DuplicateProperty: msg");
    expect(new ECSchemaError(ECSchemaStatus.DuplicateSchema, "msg").toDebugString()).to.equal("ECSchemaStatus.DuplicateSchema: msg");
    expect(new ECSchemaError(ECSchemaStatus.ImmutableSchema, "msg").toDebugString()).to.equal("ECSchemaStatus.ImmutableSchema: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidContainerType, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidContainerType: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidECJson, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidECJson: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidECName, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidECName: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidECVersion, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidECVersion: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidEnumValue, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidEnumValue: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidModifier, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidModifier: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidMultiplicity, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidMultiplicity: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidPrimitiveType, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidPrimitiveType: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidSchemaItemType: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidStrength, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidStrength: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidStrengthDirection, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidStrengthDirection: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidRelationshipEnd, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidRelationshipEnd: msg");
    expect(new ECSchemaError(ECSchemaStatus.InvalidType, "msg").toDebugString()).to.equal("ECSchemaStatus.InvalidType: msg");
    expect(new ECSchemaError(ECSchemaStatus.MissingSchemaUrl, "msg").toDebugString()).to.equal("ECSchemaStatus.MissingSchemaUrl: msg");
    expect(new ECSchemaError(ECSchemaStatus.UnableToLocateSchema, "msg").toDebugString()).to.equal("ECSchemaStatus.UnableToLocateSchema: msg");
    expect(new ECSchemaError(-9999).toDebugString()).to.equal("Error -9999");
  });
});
