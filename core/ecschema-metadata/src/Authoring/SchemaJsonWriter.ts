/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { formatTraitsToArray } from "@itwin/core-quantity";
import { classModifierToString, containerTypeToString, parsePrimitiveType, SchemaItemType, strengthDirectionToString, strengthToString } from "../ECObjects";
import { Authoring, SchemaDocument } from "./SchemaDocument";
import { ECSpec, mapFormatStringReferences, SchemaWriteOptions, SchemaWriteResult } from "./SchemaDocumentIO";
import { SchemaIssueList } from "./SchemaIssues";

/** The `$schema` URL of the ECJSON 3.2 spec. */
const ECJSON_3_2_SCHEMA_URL = "https://dev.bentley.com/json_schemas/ec/32/ecschema";

/** A JSON object under construction; values are inserted in emit order and `undefined` is skipped. */
interface JsonObject {
  [name: string]: unknown;
}

/** Serializes a {@link SchemaDocument} to ECJSON text. The document always models the latest spec;
 * the writer converts to the requested spec version at this boundary (currently only
 * {@link ECSpec.V3_2}). Unlike ECXML, ECJSON 3.2 carries mixins first-class and schema references
 * without aliases, so this writer has less conversion to do than its XML sibling - but the same
 * stance: problems that do not prevent producing output are reported as issues alongside
 * best-effort text; only an unsupported target spec yields no text at all.
 * @alpha
 */
export class SchemaJsonWriter {
  /** Writes the document to ECJSON text in the requested spec version (default {@link ECSpec.Latest}). */
  public writeDocument(document: SchemaDocument, options?: SchemaWriteOptions): SchemaWriteResult {
    const result = this.writeDocumentTree(document, options);
    if (result.tree === undefined)
      return { issues: result.issues };
    return { text: `${JSON.stringify(result.tree, undefined, 2)}\n`, issues: result.issues };
  }

  /** Writes the document as a plain ECJSON object tree instead of text - for consumers that want
   * the props shape directly (feeding APIs that take parsed JSON, comparison) without a
   * stringify/parse round trip. Same conversion and issue reporting as {@link writeDocument}. */
  public writeDocumentTree(document: SchemaDocument, options?: SchemaWriteOptions): { tree?: Record<string, unknown>, issues: SchemaIssueList } {
    const issues = new SchemaIssueList();
    const spec = options?.spec ?? ECSpec.Latest;
    if (spec !== ECSpec.V3_2) {
      issues.addError("SchemaJson-0001", `Unsupported target spec version "${spec as string}" - the JSON writer currently supports only 3.2.`);
      return { issues };
    }
    const emitter = new EcJson32Emitter(document, issues);
    return { tree: emitter.emit(), issues };
  }
}

/** Zero-pads a version component to two digits, the conventional ECJSON formatting. */
function padVersionComponent(component: number): string {
  return component < 10 ? `0${component}` : `${component}`;
}

function formatVersion(read: number, write: number, minor: number): string {
  return `${padVersionComponent(read)}.${padVersionComponent(write)}.${padVersionComponent(minor)}`;
}

/** Emits one document as an ECJSON 3.2 object tree. Created per write. */
class EcJson32Emitter {
  private readonly _document: SchemaDocument;
  private readonly _issues: SchemaIssueList;

  public constructor(document: SchemaDocument, issues: SchemaIssueList) {
    this._document = document;
    this._issues = issues;
  }

  public emit(): JsonObject {
    const doc = this._document;
    const json: JsonObject = {
      $schema: ECJSON_3_2_SCHEMA_URL,
      name: doc.name,
      version: formatVersion(doc.readVersion, doc.writeVersion, doc.minorVersion),
      alias: doc.alias,
      label: doc.label,
      description: doc.description,
    };
    if (doc.references.length > 0) {
      // ECJSON references carry no alias - it is an ECXML-only concept; JSON qualifies by schema name.
      json.references = doc.references.map((reference) => ({
        name: reference.name,
        version: formatVersion(reference.readVersion, reference.writeVersion, reference.minorVersion),
      }));
    }
    this._attachCustomAttributes(json, doc.customAttributes, doc.name);
    if (doc.items.length > 0) {
      const items: JsonObject = {};
      for (const item of doc.items) {
        if (item.name in items)
          this._issues.addWarning("SchemaJson-0002", `Two items share the name "${item.name}"; JSON items are name-keyed, so the later one overwrote the earlier.`, { location: item.name });
        items[item.name] = this._emitItem(item);
      }
      json.items = items;
    }
    return prune(json);
  }

  /** Converts a stored item reference (local name or `Schema:Item` full name, either separator,
   * alias-qualified tolerated) to the schema-qualified dot form ECJSON uses. Local names are
   * qualified with this schema's name; alias qualifiers are resolved through the reference list. */
  private _toJsonItemReference(reference: Authoring.LocalOrFullName, location: string): string {
    const separatorIndex = reference.search(/[.:]/);
    if (separatorIndex < 0)
      return `${this._document.name}.${reference}`;
    const qualifier = reference.substring(0, separatorIndex);
    const itemName = reference.substring(separatorIndex + 1);
    const qualifierLower = qualifier.toLowerCase();

    if (qualifierLower === this._document.name.toLowerCase() || qualifierLower === this._document.alias.toLowerCase())
      return `${this._document.name}.${itemName}`;

    for (const schemaReference of this._document.references) {
      if (schemaReference.name.toLowerCase() === qualifierLower)
        return `${schemaReference.name}.${itemName}`;
      if (schemaReference.alias !== null && schemaReference.alias.toLowerCase() === qualifierLower)
        return `${schemaReference.name}.${itemName}`;
    }

    this._issues.addWarning("SchemaJson-0003",
      `The item reference "${reference}" does not match this schema or any schema in the reference list; emitting it unchanged.`, { location });
    return `${qualifier}.${itemName}`;
  }

  /** Attaches a `customAttributes` array: each instance is the flattened ECJSON form - the
   * `className` key plus the property values inline. The document's untyped values are already
   * JSON-shaped, so they pass through. */
  private _attachCustomAttributes(json: JsonObject, customAttributes: Authoring.CustomAttributeSet, location: string): void {
    if (customAttributes.size === 0)
      return;
    const entries: JsonObject[] = [];
    for (const ca of customAttributes) {
      if (ca.properties !== undefined && "className" in ca.properties) {
        this._issues.addWarning("SchemaJson-0004",
          `The custom attribute "${ca.className}" has a property named "className", which collides with the ECJSON discriminator; the property was skipped.`, { location });
      }
      entries.push({ ...ca.properties, className: this._toJsonItemReference(ca.className, location) });
    }
    json.customAttributes = entries;
  }

  private _emitItem(item: Authoring.AnySchemaItem): JsonObject {
    if (item.isEntity())
      return this._emitEntityClass(item);
    if (item.isMixin())
      return this._emitMixin(item);
    if (item.isStruct())
      return this._emitClass(item, {});
    if (item.isCustomAttribute())
      return this._emitClass(item, { appliesTo: containerTypeToString(item.appliesTo) });
    if (item.isRelationship())
      return this._emitRelationshipClass(item);
    switch (item.schemaItemType) {
      case SchemaItemType.Enumeration: return this._emitEnumeration(item);
      case SchemaItemType.KindOfQuantity: return this._emitKindOfQuantity(item);
      case SchemaItemType.PropertyCategory: return this._emitItemEnvelope(item, { priority: item.priority });
      case SchemaItemType.UnitSystem: return this._emitItemEnvelope(item, {});
      case SchemaItemType.Phenomenon: return this._emitItemEnvelope(item, { definition: item.definition });
      case SchemaItemType.Unit: return this._emitUnit(item);
      case SchemaItemType.InvertedUnit: return this._emitInvertedUnit(item);
      case SchemaItemType.Constant: return this._emitConstant(item);
      case SchemaItemType.Format: return this._emitFormat(item);
    }
  }

  /** The fields every item kind shares, with the kind-specific ones spliced after the envelope. */
  private _emitItemEnvelope(item: Authoring.SchemaItem, specific: JsonObject): JsonObject {
    return prune({
      schemaItemType: item.schemaItemType,
      label: item.label,
      description: item.description,
      ...specific,
    });
  }

  private _emitClass(item: Authoring.AnyClass, specific: JsonObject): JsonObject {
    const json = this._emitItemEnvelope(item, {
      ...specific,
      modifier: item.modifier === undefined ? undefined : classModifierToString(item.modifier),
      baseClass: item.baseClass !== undefined ? this._toJsonItemReference(item.baseClass, item.name) : undefined,
    });
    this._attachCustomAttributes(json, item.customAttributes, item.name);
    if (item.properties.length > 0)
      json.properties = item.properties.map((property) => this._emitProperty(property, item.name));
    return json;
  }

  private _emitEntityClass(item: Authoring.EntityClass): JsonObject {
    const json = this._emitClass(item, {
      mixins: item.mixins.length > 0 ? item.mixins.map((mixin) => this._toJsonItemReference(mixin, item.name)) : undefined,
    });
    return json;
  }

  private _emitMixin(item: Authoring.Mixin): JsonObject {
    // ECJSON 3.2 carries mixins first-class - no IsMixin custom attribute, unlike ECXML.
    return this._emitClass(item, {
      appliesTo: this._toJsonItemReference(item.appliesTo, item.name),
    });
  }

  private _emitRelationshipClass(item: Authoring.RelationshipClass): JsonObject {
    const json = this._emitClass(item, {
      strength: item.strength === undefined ? undefined : strengthToString(item.strength),
      strengthDirection: item.strengthDirection === undefined ? undefined : strengthDirectionToString(item.strengthDirection),
    });
    json.source = this._emitRelationshipConstraint(item.source, item.name);
    json.target = this._emitRelationshipConstraint(item.target, item.name);
    return json;
  }

  private _emitRelationshipConstraint(constraint: Authoring.RelationshipConstraint, className: string): JsonObject {
    const location = `${this._document.name}:${className}`;
    const json: JsonObject = prune({
      multiplicity: constraint.multiplicity,
      roleLabel: constraint.roleLabel,
      polymorphic: constraint.polymorphic,
      abstractConstraint: constraint.abstractConstraint !== undefined ? this._toJsonItemReference(constraint.abstractConstraint, location) : undefined,
      constraintClasses: constraint.constraintClasses.map((constraintClass) => this._toJsonItemReference(constraintClass, location)),
    });
    this._attachCustomAttributes(json, constraint.customAttributes, location);
    return json;
  }

  /** A property's `typeName` is a primitive keyword (emitted as-is) or an item reference (converted
   * to the schema-qualified JSON form). The primitive keywords are a closed set, so the distinction
   * is a lexical check. */
  private _propertyTypeName(typeName: string, location: string): string {
    return parsePrimitiveType(typeName) !== undefined ? typeName : this._toJsonItemReference(typeName, location);
  }

  private _emitProperty(property: Authoring.AnyProperty, className: string): JsonObject {
    const location = `${this._document.name}:${className}.${property.name}`;

    let specific: JsonObject;
    if (property.isNavigation()) {
      specific = {
        type: "NavigationProperty",
        relationshipName: this._toJsonItemReference(property.relationshipName, location),
        direction: strengthDirectionToString(property.direction),
      };
    } else if (property.isStruct()) {
      specific = {
        type: property.isArray() ? "StructArrayProperty" : "StructProperty",
        typeName: this._toJsonItemReference(property.typeName, location),
        ...this._occursFields(property),
      };
    } else {
      specific = {
        type: property.isArray() ? "PrimitiveArrayProperty" : "PrimitiveProperty",
        typeName: this._propertyTypeName(property.typeName, location),
        extendedTypeName: property.extendedTypeName,
        minValue: property.minValue,
        maxValue: property.maxValue,
        minLength: property.minLength,
        maxLength: property.maxLength,
        ...this._occursFields(property),
      };
    }

    const json = prune({
      name: property.name,
      ...specific,
      label: property.label,
      description: property.description,
      isReadOnly: property.isReadOnly,
      priority: property.priority,
      category: property.category !== undefined ? this._toJsonItemReference(property.category, location) : undefined,
      kindOfQuantity: property.kindOfQuantity !== undefined ? this._toJsonItemReference(property.kindOfQuantity, location) : undefined,
    });
    this._attachCustomAttributes(json, property.customAttributes, location);
    return json;
  }

  private _occursFields(property: Authoring.AnyProperty): JsonObject {
    if (!property.isArray())
      return {};
    // `maxOccurs` left out means unbounded (ECXML spells that "unbounded"; ECJSON omits the field).
    return { minOccurs: property.minOccurs, maxOccurs: property.maxOccurs };
  }

  private _emitEnumeration(item: Authoring.Enumeration): JsonObject {
    return this._emitItemEnvelope(item, {
      type: item.backingType,
      isStrict: item.isStrict,
      enumerators: item.enumerators.map((enumerator) => prune({
        name: enumerator.name,
        value: enumerator.value,
        label: enumerator.label,
        description: enumerator.description,
      })),
    });
  }

  private _emitKindOfQuantity(item: Authoring.KindOfQuantity): JsonObject {
    // The references embedded in the override grammar are schema-qualified like any other item
    // reference in ECJSON.
    const presentationUnits = item.presentationFormats
      .map((entry) => mapFormatStringReferences(entry, (reference) => this._toJsonItemReference(reference, item.name)));
    return this._emitItemEnvelope(item, {
      persistenceUnit: this._toJsonItemReference(item.persistenceUnit, item.name),
      relativeError: item.relativeError,
      presentationUnits: presentationUnits.length > 0 ? presentationUnits : undefined,
    });
  }

  private _emitUnit(item: Authoring.Unit): JsonObject {
    return this._emitItemEnvelope(item, {
      phenomenon: this._toJsonItemReference(item.phenomenon, item.name),
      unitSystem: this._toJsonItemReference(item.unitSystem, item.name),
      definition: item.definition,
      numerator: item.numerator,
      denominator: item.denominator,
      offset: item.offset,
    });
  }

  private _emitInvertedUnit(item: Authoring.InvertedUnit): JsonObject {
    return this._emitItemEnvelope(item, {
      invertsUnit: this._toJsonItemReference(item.invertsUnit, item.name),
      unitSystem: this._toJsonItemReference(item.unitSystem, item.name),
    });
  }

  private _emitConstant(item: Authoring.Constant): JsonObject {
    return this._emitItemEnvelope(item, {
      phenomenon: this._toJsonItemReference(item.phenomenon, item.name),
      definition: item.definition,
      numerator: item.numerator,
      denominator: item.denominator,
    });
  }

  private _emitFormat(item: Authoring.Format): JsonObject {
    const json = this._emitItemEnvelope(item, {
      type: item.type,
      precision: item.precision,
      roundFactor: item.roundFactor,
      minWidth: item.minWidth,
      showSignOption: item.showSignOption,
      formatTraits: item.formatTraits !== undefined ? formatTraitsToArray(item.formatTraits) : undefined,
      decimalSeparator: item.decimalSeparator,
      thousandSeparator: item.thousandSeparator,
      uomSeparator: item.uomSeparator,
      scientificType: item.scientificType,
      stationOffsetSize: item.stationOffsetSize,
      stationSeparator: item.stationSeparator,
    });
    if (item.composite !== undefined) {
      json.composite = prune({
        spacer: item.composite.spacer,
        includeZero: item.composite.includeZero,
        units: item.composite.units.map((unit) => prune({
          name: this._toJsonItemReference(unit.name, item.name),
          label: unit.label,
        })),
      });
    }
    return json;
  }
}

/** Drops `undefined`-valued keys so `JSON.stringify` output stays stable regardless of which
 * optional fields were touched. Shallow - nested objects prune themselves on construction. */
function prune(json: JsonObject): JsonObject {
  for (const key of Object.keys(json)) {
    if (json[key] === undefined)
      delete json[key];
  }
  return json;
}
