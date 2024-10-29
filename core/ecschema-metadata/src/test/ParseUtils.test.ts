/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import {
  classModifierToString, containerTypeToString, CustomAttributeContainerType, ECClassModifier, parseClassModifier, parseCustomAttributeContainerType,
  parsePrimitiveType, parseRelationshipEnd, parseSchemaItemType, parseStrength, parseStrengthDirection, PrimitiveType, primitiveTypeToString,
  RelationshipEnd, relationshipEndToString, SchemaItemType, StrengthDirection, strengthDirectionToString, strengthToString,
  StrengthType,
} from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

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
    expect(parsePrimitiveType("invalid type")).toBeUndefined();
  });

  it("primitiveTypeToString", () => {
    expect(primitiveTypeToString(PrimitiveType.Binary)).toEqual("binary");
    expect(primitiveTypeToString(PrimitiveType.Boolean)).toEqual("boolean");
    expect(primitiveTypeToString(PrimitiveType.DateTime)).toEqual("dateTime");
    expect(primitiveTypeToString(PrimitiveType.Double)).toEqual("double");
    expect(primitiveTypeToString(PrimitiveType.IGeometry)).toEqual("Bentley.Geometry.Common.IGeometry");
    expect(primitiveTypeToString(PrimitiveType.Integer)).toEqual("int");
    expect(primitiveTypeToString(PrimitiveType.Long)).toEqual("long");
    expect(primitiveTypeToString(PrimitiveType.Point2d)).toEqual("point2d");
    expect(primitiveTypeToString(PrimitiveType.Point3d)).toEqual("point3d");
    expect(primitiveTypeToString(PrimitiveType.String)).toEqual("string");
    expect(() => primitiveTypeToString(PrimitiveType.Uninitialized)).toThrowError(ECObjectsError, "An invalid PrimitiveType has been provided.");
  });

  it("parseClassModifier", () => {
    expect(parseClassModifier("Abstract")).toEqual(ECClassModifier.Abstract);
    expect(parseClassModifier("Sealed")).toEqual(ECClassModifier.Sealed);
    expect(parseClassModifier("None")).toEqual(ECClassModifier.None);

    expect(parseClassModifier("aBSTraCT")).toEqual(ECClassModifier.Abstract);
    expect(parseClassModifier("sEALEd")).toEqual(ECClassModifier.Sealed);
    expect(parseClassModifier("NoNE")).toEqual(ECClassModifier.None);
    expect(parseClassModifier("invalid modifier")).toBeUndefined();
  });

  it("classModiferToString", () => {
    expect(classModifierToString(ECClassModifier.Abstract)).toEqual("Abstract");
    expect(classModifierToString(ECClassModifier.Sealed)).toEqual("Sealed");
    expect(classModifierToString(ECClassModifier.None)).toEqual("None");
    expect(() => classModifierToString(5 as ECClassModifier)).toThrowError(ECObjectsError, "An invalid ECClassModifier has been provided.");
  });

  it("parseCustomAttributeContainerType", () => {
    expect(parseCustomAttributeContainerType("SChEma")).toEqual(CustomAttributeContainerType.Schema);
    expect(parseCustomAttributeContainerType("ENTiTycLAsS")).toEqual(CustomAttributeContainerType.EntityClass);
    expect(parseCustomAttributeContainerType("CUstOmAttRIBUteClASs")).toEqual(CustomAttributeContainerType.CustomAttributeClass);
    expect(parseCustomAttributeContainerType("StRuCTclAsS")).toEqual(CustomAttributeContainerType.StructClass);
    expect(parseCustomAttributeContainerType("rElATIonSHIPcLaSS")).toEqual(CustomAttributeContainerType.RelationshipClass);
    expect(parseCustomAttributeContainerType("anYCLaSS")).toEqual(CustomAttributeContainerType.AnyClass);
    expect(parseCustomAttributeContainerType("pRImiTIVeProPErtY")).toEqual(CustomAttributeContainerType.PrimitiveProperty);
    expect(parseCustomAttributeContainerType("StRuCTProperty")).toEqual(CustomAttributeContainerType.StructProperty);
    expect(parseCustomAttributeContainerType("ARRayPRoPertY")).toEqual(CustomAttributeContainerType.PrimitiveArrayProperty);
    expect(parseCustomAttributeContainerType("sTRUctArrayPrOPErTy")).toEqual(CustomAttributeContainerType.StructArrayProperty);
    expect(parseCustomAttributeContainerType("nAviGAtIoNProPerTY")).toEqual(CustomAttributeContainerType.NavigationProperty);
    expect(parseCustomAttributeContainerType("AnyProPErTy")).toEqual(CustomAttributeContainerType.AnyProperty);
    expect(parseCustomAttributeContainerType("SouRcEReLatIoNShiPCoNstRaInT")).toEqual(CustomAttributeContainerType.SourceRelationshipConstraint);
    expect(parseCustomAttributeContainerType("TarGETreLATIoNShIPCOnSTrAInT")).toEqual(CustomAttributeContainerType.TargetRelationshipConstraint);
    expect(parseCustomAttributeContainerType("AnyRELaTioNShiPCoNSTrAInt")).toEqual(CustomAttributeContainerType.AnyRelationshipConstraint);
    expect(parseCustomAttributeContainerType("aNy")).toEqual(CustomAttributeContainerType.Any);
    expect(() => parseCustomAttributeContainerType("invalid type")).toThrowError(ECObjectsError, "invalid type is not a valid CustomAttributeContainerType value.");

    const combo = CustomAttributeContainerType.Schema
      | CustomAttributeContainerType.AnyClass
      | CustomAttributeContainerType.TargetRelationshipConstraint
      | CustomAttributeContainerType.StructProperty;
    expect(parseCustomAttributeContainerType(";Schema|AnyClass,TargetRelationshipConstraint;StructProperty")).toEqual(combo);
  });

  it("containerTypeToString", () => {
    expect(containerTypeToString(CustomAttributeContainerType.Schema)).toEqual("Schema");
    expect(containerTypeToString(CustomAttributeContainerType.EntityClass)).toEqual("EntityClass");
    expect(containerTypeToString(CustomAttributeContainerType.CustomAttributeClass)).toEqual("CustomAttributeClass");
    expect(containerTypeToString(CustomAttributeContainerType.StructClass)).toEqual("StructClass");
    expect(containerTypeToString(CustomAttributeContainerType.RelationshipClass)).toEqual("RelationshipClass");
    expect(containerTypeToString(CustomAttributeContainerType.AnyClass)).toEqual("AnyClass");
    expect(containerTypeToString(CustomAttributeContainerType.PrimitiveProperty)).toEqual("PrimitiveProperty");
    expect(containerTypeToString(CustomAttributeContainerType.StructProperty)).toEqual("StructProperty");
    expect(containerTypeToString(CustomAttributeContainerType.PrimitiveArrayProperty)).toEqual("ArrayProperty");
    expect(containerTypeToString(CustomAttributeContainerType.StructArrayProperty)).toEqual("StructArrayProperty");
    expect(containerTypeToString(CustomAttributeContainerType.NavigationProperty)).toEqual("NavigationProperty");
    expect(containerTypeToString(CustomAttributeContainerType.AnyProperty)).toEqual("AnyProperty");
    expect(containerTypeToString(CustomAttributeContainerType.SourceRelationshipConstraint)).toEqual("SourceRelationshipConstraint");
    expect(containerTypeToString(CustomAttributeContainerType.TargetRelationshipConstraint)).toEqual("TargetRelationshipConstraint");
    expect(containerTypeToString(CustomAttributeContainerType.AnyRelationshipConstraint)).toEqual("AnyRelationshipConstraint");
    expect(containerTypeToString(CustomAttributeContainerType.Any)).toEqual("Any");

    const combo = CustomAttributeContainerType.Schema
      | CustomAttributeContainerType.AnyClass
      | CustomAttributeContainerType.TargetRelationshipConstraint
      | CustomAttributeContainerType.StructProperty;
    expect(containerTypeToString(combo)).toEqual("Schema, AnyClass, StructProperty, TargetRelationshipConstraint");
  });

  it("parseRelationshipEnd", () => {
    expect(parseRelationshipEnd("SoUrCE")).toEqual(RelationshipEnd.Source);
    expect(parseRelationshipEnd("TarGeT")).toEqual(RelationshipEnd.Target);
    expect(parseRelationshipEnd("inVAlId")).toBeUndefined();
  });

  it("relationshipEndToString", () => {
    expect(relationshipEndToString(RelationshipEnd.Source)).toEqual("Source");
    expect(relationshipEndToString(RelationshipEnd.Target)).toEqual("Target");
    expect(() => relationshipEndToString(5 as RelationshipEnd)).toThrowError(ECObjectsError, "An invalid RelationshipEnd has been provided.");
  });

  it("parseStrength", () => {
    expect(parseStrength("ReFEReNcInG")).toEqual(StrengthType.Referencing);
    expect(parseStrength("HOLdIng")).toEqual(StrengthType.Holding);
    expect(parseStrength("EMBedDiNG")).toEqual(StrengthType.Embedding);
    expect(parseStrength("inVAlId")).toBeUndefined();
  });

  it("strengthToString", () => {
    expect(strengthToString(StrengthType.Embedding)).toEqual("Embedding");
    expect(strengthToString(StrengthType.Referencing)).toEqual("Referencing");
    expect(strengthToString(StrengthType.Holding)).toEqual("Holding");
    expect(() => strengthToString(5 as StrengthType)).toThrowError(ECObjectsError, "An invalid Strength has been provided.");
  });

  it("parseStrengthDirection", () => {
    expect(parseStrengthDirection("forward")).toEqual(StrengthDirection.Forward);
    expect(parseStrengthDirection("BACKWARD")).toEqual(StrengthDirection.Backward);
    expect(parseStrengthDirection("invalid")).toBeUndefined();
  });

  it("strengthDirectionToString", () => {
    expect(strengthDirectionToString(StrengthDirection.Backward)).toEqual("Backward");
    expect(strengthDirectionToString(StrengthDirection.Forward)).toEqual("Forward");
    expect(() => strengthDirectionToString(5 as StrengthDirection)).toThrowError(ECObjectsError, "An invalid StrengthDirection has been provided.");
  });

  it("parseSchemaItemType", () => {
    expect(parseSchemaItemType("eNtItyCLaSs")).toEqual(SchemaItemType.EntityClass);
    expect(parseSchemaItemType("mIXIn")).toEqual(SchemaItemType.Mixin);
    expect(parseSchemaItemType("sTRuCTcLaSS")).toEqual(SchemaItemType.StructClass);
    expect(parseSchemaItemType("cuSTomATTRIbuTEClaSs")).toEqual(SchemaItemType.CustomAttributeClass);
    expect(parseSchemaItemType("rELAtIONsHiPClaSs")).toEqual(SchemaItemType.RelationshipClass);
    expect(parseSchemaItemType("enUmERAtiON")).toEqual(SchemaItemType.Enumeration);
    expect(parseSchemaItemType("KiNDofQuaNTiTy")).toEqual(SchemaItemType.KindOfQuantity);
    expect(parseSchemaItemType("prOpeRtYcAteGoRy")).toEqual(SchemaItemType.PropertyCategory);
    expect(parseSchemaItemType("inVAlId")).toBeUndefined();
  });

  it("schemaItemTypeToString", () => {
    expect(SchemaItemType.EntityClass).toEqual("EntityClass");
    expect(SchemaItemType.Mixin).toEqual("Mixin");
    expect(SchemaItemType.StructClass).toEqual("StructClass");
    expect(SchemaItemType.CustomAttributeClass).toEqual("CustomAttributeClass");
    expect(SchemaItemType.RelationshipClass).toEqual("RelationshipClass");
    expect(SchemaItemType.Enumeration).toEqual("Enumeration");
    expect(SchemaItemType.KindOfQuantity).toEqual("KindOfQuantity");
    expect(SchemaItemType.PropertyCategory).toEqual("PropertyCategory");
  });
});

describe("ECObjectsError ", () => {
  it("toDebugString", () => {
    expect(new ECObjectsError(ECObjectsStatus.DuplicateItem).toDebugString()).toEqual("ECObjectsStatus.DuplicateItem");
    expect(new ECObjectsError(ECObjectsStatus.DuplicateProperty, "msg").toDebugString()).toEqual("ECObjectsStatus.DuplicateProperty: msg");
    expect(new ECObjectsError(ECObjectsStatus.DuplicateSchema, "msg").toDebugString()).toEqual("ECObjectsStatus.DuplicateSchema: msg");
    expect(new ECObjectsError(ECObjectsStatus.ImmutableSchema, "msg").toDebugString()).toEqual("ECObjectsStatus.ImmutableSchema: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidContainerType, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidContainerType: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidECJson, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidECJson: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidECName, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidECName: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidECVersion, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidECVersion: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidEnumValue, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidEnumValue: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidModifier, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidModifier: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidMultiplicity, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidMultiplicity: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidPrimitiveType, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidPrimitiveType: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidSchemaItemType: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidStrength, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidStrength: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidStrengthDirection: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidRelationshipEnd, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidRelationshipEnd: msg");
    expect(new ECObjectsError(ECObjectsStatus.InvalidType, "msg").toDebugString()).toEqual("ECObjectsStatus.InvalidType: msg");
    expect(new ECObjectsError(ECObjectsStatus.MissingSchemaUrl, "msg").toDebugString()).toEqual("ECObjectsStatus.MissingSchemaUrl: msg");
    expect(new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, "msg").toDebugString()).toEqual("ECObjectsStatus.UnableToLocateSchema: msg");
    expect(new ECObjectsError(-9999).toDebugString()).toEqual("Error -9999");
  });
});
