/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { parseFormatTrait, parseFormatType, parsePrecision, parseScientificType, parseShowSignOption } from "@itwin/core-quantity";
import { parseClassModifier, parseCustomAttributeContainerType, parsePrimitiveType, parseStrength, parseStrengthDirection, PrimitiveType } from "../ECObjects";
import { Authoring, SchemaDocument } from "./SchemaDocument";
import {
  decodeSchemaText, mapFormatStringReferences, parseVersionString, SchemaDocumentHeader, SchemaDocumentReadResult, SchemaDocumentTextReader, SchemaHeaderReadResult, SchemaText, SchemaTextReadOptions,
} from "./SchemaDocumentIO";
import { SchemaIssueList } from "./SchemaIssues";

/** The `$schema` URL pattern of ECJSON; the captured digits carry the spec version (`32` = 3.2). */
const ECJSON_SCHEMA_URL_PATTERN = /\/json_schemas\/ec\/(\d)(\d)\/ecschema$/i;

/** A parsed JSON object of unknown shape. */
interface JsonObject {
  [name: string]: unknown;
}

/** Reads {@link SchemaDocument}s from ECJSON text - the format `JSON.stringify` of a schema's
 * props produces, and what iModel APIs like `getSchemaProps` deliver. Accepts any ECJSON 3.x
 * `$schema` and records the source spec version on the document
 * ({@link SchemaDocument.originalECXmlVersionMajor}).
 *
 * The reader is as lenient as the validity-free document allows: it reports problems as issues and
 * keeps whatever it could extract, leaving semantic judgment to the compiler. Custom attribute
 * values are kept untyped; ECJSON's values are already plain JSON shapes, so they pass through
 * unchanged (no struct-array ambiguity, unlike the XML reader).
 *
 * Unlike XML, JSON cannot be partially parsed with the standard tooling, so
 * {@link SchemaJsonReader.readHeader} parses the whole input and extracts the header - cheaper
 * than full hydration, but not the leading-kilobytes peek the XML reader manages. Acceptable
 * because the very large inputs discovery walks are schema *files*, which are XML; revisit with an
 * incremental scanner if a JSON source ever carries them.
 * @alpha
 */
export class SchemaJsonReader implements SchemaDocumentTextReader {
  /** Reads a full document. The result carries no document only when the input is unusable
   * (malformed JSON, not an ECSchema, an unsupported spec). */
  public async readDocument(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaDocumentReadResult> {
    const issues = new SchemaIssueList();
    const parsed = await parseRoot(text, issues, options?.source);
    if (parsed === undefined)
      return { issues };
    return { document: this._readDocument(parsed, issues, options?.source), issues };
  }

  /** Reads a full document from an already-parsed ECJSON object, skipping the text decode and
   * `JSON.parse` that {@link readDocument} performs. This is the entry for a JSON source that hands
   * over a live object rather than text - notably an iModel's `getSchemaProps`, which crosses the
   * native boundary as a JS object (never a string). Going through {@link readDocument} would force
   * that object back through `JSON.stringify`/`JSON.parse`, two needless full-graph passes that also
   * reintroduce the platform string-length ceiling on the one source most likely to hold a very large
   * schema; this avoids both. The object is read, not retained. */
  public readObject(props: object, options?: SchemaTextReadOptions): SchemaDocumentReadResult {
    const issues = new SchemaIssueList();
    const parsed = validateRoot(props, issues, options?.source);
    if (parsed === undefined)
      return { issues };
    return { document: this._readDocument(parsed, issues, options?.source), issues };
  }

  /** Reads only the schema's identity and reference list. Parses the whole input (see the class
   * note), then extracts just the header fields. */
  public async readHeader(text: SchemaText, options?: SchemaTextReadOptions): Promise<SchemaHeaderReadResult> {
    const issues = new SchemaIssueList();
    const parsed = await parseRoot(text, issues, options?.source);
    if (parsed === undefined)
      return { issues };
    return this._readHeader(parsed.root, issues, options?.source);
  }

  /** Reads the header from an already-parsed ECJSON object, the {@link readHeader} counterpart to
   * {@link readObject}; see that method for why an object entry exists. */
  public readHeaderObject(props: object, options?: SchemaTextReadOptions): SchemaHeaderReadResult {
    const issues = new SchemaIssueList();
    const parsed = validateRoot(props, issues, options?.source);
    if (parsed === undefined)
      return { issues };
    return this._readHeader(parsed.root, issues, options?.source);
  }

  /** Hydrates the document from a validated root. Shared by the text and object entries. */
  private _readDocument(parsed: { root: JsonObject, specMajor: number, specMinor: number }, issues: SchemaIssueList, source: string | undefined): SchemaDocument | undefined {
    const walker = new ECJson32Walker(issues, source);
    return walker.readSchema(parsed.root, parsed.specMajor, parsed.specMinor);
  }

  /** Extracts the header fields from a validated root. Shared by the text and object entries. */
  private _readHeader(root: JsonObject, issues: SchemaIssueList, source: string | undefined): SchemaHeaderReadResult {
    const name = asString(root.name);
    const version = parseVersionString(asString(root.version));
    if (name === undefined || version === undefined) {
      issues.addError("SchemaJson-0012", "The schema object is missing its name or a parseable version.", { source });
      return { issues };
    }

    const references: Authoring.SchemaReference[] = [];
    if (Array.isArray(root.references)) {
      for (const entry of root.references) {
        const reference = readSchemaReference(entry, issues, source);
        if (reference !== undefined)
          references.push(reference);
      }
    }

    const header: SchemaDocumentHeader = {
      name,
      readVersion: version.read,
      writeVersion: version.write,
      minorVersion: version.minor,
      alias: asString(root.alias),
      references,
    };
    return { header, issues };
  }
}

/** Collects and parses text input into the root schema object, validating that it is an ECJSON 3.x
 * schema. Returns `undefined` (after reporting) when the input is unusable. */
async function parseRoot(text: SchemaText, issues: SchemaIssueList, source: string | undefined): Promise<{ root: JsonObject, specMajor: number, specMinor: number } | undefined> {
  let collected = "";
  for await (const chunk of decodeSchemaText(text))
    collected += chunk;

  let parsed: unknown;
  try {
    parsed = JSON.parse(collected);
  } catch (error) {
    issues.addError("SchemaJson-0010", `Malformed JSON: ${error instanceof Error ? error.message : String(error)}`, { source });
    return undefined;
  }
  return validateRoot(parsed, issues, source);
}

/** Validates an already-parsed value as an ECJSON 3.x schema root: it must be a plain object with a
 * recognized `$schema` of a supported spec. Returns `undefined` (after reporting) when it is not.
 * Shared by {@link parseRoot} (text path) and the reader's object entries. */
function validateRoot(parsed: unknown, issues: SchemaIssueList, source: string | undefined): { root: JsonObject, specMajor: number, specMinor: number } | undefined {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    issues.addError("SchemaJson-0011", "The input is not a JSON object.", { source });
    return undefined;
  }
  const root = parsed as JsonObject;

  const schemaUrl = asString(root.$schema);
  const urlMatch = schemaUrl !== undefined ? ECJSON_SCHEMA_URL_PATTERN.exec(schemaUrl) : null;
  if (urlMatch === null) {
    issues.addError("SchemaJson-0014", `The schema object has a missing or unrecognized $schema ("${schemaUrl ?? ""}").`, { source });
    return undefined;
  }
  const specMajor = parseInt(urlMatch[1], 10);
  const specMinor = parseInt(urlMatch[2], 10);
  if (specMajor !== 3) {
    issues.addError("SchemaJson-0015", `Unsupported ECJSON spec version ${specMajor}.${specMinor} - this reader handles 3.x.`, { source });
    return undefined;
  }
  return { root, specMajor, specMinor };
}

function readSchemaReference(entry: unknown, issues: SchemaIssueList, source: string | undefined): Authoring.SchemaReference | undefined {
  const reference = asObject(entry);
  const name = reference !== undefined ? asString(reference.name) : undefined;
  const version = reference !== undefined ? parseVersionString(asString(reference.version)) : undefined;
  if (name === undefined || version === undefined) {
    issues.addError("SchemaJson-0013", "A schema reference is missing its name or a parseable version.", { source });
    return undefined;
  }
  // ECJSON references carry no alias; null records that as an explicit absence.
  return { name, readVersion: version.read, writeVersion: version.write, minorVersion: version.minor, alias: null };
}

// ===== Loose-shape accessors: ECJSON values arrive untyped, and the reader is lenient =====

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

/** Walks a parsed ECJSON object tree into a SchemaDocument. Created per read. */
class ECJson32Walker {
  private readonly _issues: SchemaIssueList;
  private readonly _source: string | undefined;
  private _documentInProgress?: SchemaDocument;

  public constructor(issues: SchemaIssueList, source: string | undefined) {
    this._issues = issues;
    this._source = source;
  }

  /** The document under construction. Set at the start of {@link readSchema}; every item/property
   * reader runs within that call, so accessing it earlier is a programming error. */
  private get _document(): SchemaDocument {
    if (this._documentInProgress === undefined)
      throw new Error("SchemaJsonReader: the document is accessed before readSchema initialized it.");
    return this._documentInProgress;
  }

  public readSchema(root: JsonObject, specMajor: number, specMinor: number): SchemaDocument | undefined {
    const name = asString(root.name);
    const alias = asString(root.alias);
    const version = parseVersionString(asString(root.version));
    if (name === undefined || version === undefined) {
      this._error("SchemaJson-0012", "The schema object is missing its name or a parseable version.");
      return undefined;
    }
    if (alias === undefined)
      this._error("SchemaJson-0016", `The schema "${name}" is missing the required alias field.`);

    const document = new SchemaDocument(name, alias ?? "", version.read, version.write, version.minor, {
      label: asString(root.label),
      description: asString(root.description),
      originalECXmlVersionMajor: specMajor,
      originalECXmlVersionMinor: specMinor,
      source: this._source,
    });
    this._documentInProgress = document;

    const references = asArray(root.references);
    if (references !== undefined) {
      for (const entry of references) {
        const reference = readSchemaReference(entry, this._issues, this._source);
        if (reference !== undefined)
          document.setSchemaReference(reference);
      }
    }

    this.readCustomAttributes(root.customAttributes, document.customAttributes, document.name);

    const items = asObject(root.items);
    if (items !== undefined) {
      for (const [itemName, itemValue] of Object.entries(items)) {
        const item = asObject(itemValue);
        if (item === undefined) {
          this._error("SchemaJson-0017", `The item "${itemName}" is not a JSON object; it was skipped.`);
          continue;
        }
        this.readItem(itemName, item);
      }
    }

    return document;
  }

  // ===== Item dispatch =====

  private readItem(name: string, item: JsonObject): void {
    const itemType = asString(item.schemaItemType);
    switch (itemType?.toLowerCase()) {
      case "entityclass": return this.readEntityClass(name, item);
      case "mixin": return this.readMixin(name, item);
      case "structclass": return this.readClassContent(name, this._document.createStructClass(name, this.classInit(item)), item);
      case "customattributeclass": return this.readCustomAttributeClass(name, item);
      case "relationshipclass": return this.readRelationshipClass(name, item);
      case "enumeration": return this.readEnumeration(name, item);
      case "kindofquantity": return this.readKindOfQuantity(name, item);
      case "propertycategory": return void this._document.createPropertyCategory(name, { ...this.itemInit(item), priority: asNumber(item.priority) });
      case "unitsystem": return void this._document.createUnitSystem(name, this.itemInit(item));
      case "phenomenon": return this.readPhenomenon(name, item);
      case "unit": return this.readUnit(name, item);
      case "invertedunit": return this.readInvertedUnit(name, item);
      case "constant": return this.readConstant(name, item);
      case "format": return this.readFormat(name, item);
      default:
        this._error("SchemaJson-0018", `The item "${name}" has a missing or unrecognized schemaItemType ("${itemType ?? ""}"); it was skipped.`);
        return;
    }
  }

  private itemInit(item: JsonObject): Authoring.SchemaItemInit {
    return { label: asString(item.label), description: asString(item.description) };
  }

  private classInit(item: JsonObject): Authoring.ClassInit {
    const init: Authoring.ClassInit = this.itemInit(item);
    const modifierText = asString(item.modifier);
    if (modifierText !== undefined) {
      const modifier = parseClassModifier(modifierText);
      if (modifier === undefined)
        this._warning("SchemaJson-0019", `Unrecognized class modifier "${modifierText}" was ignored.`);
      else
        init.modifier = modifier;
    }
    const baseClass = asString(item.baseClass);
    if (baseClass !== undefined)
      init.baseClass = this.normalizeItemReference(baseClass);
    return init;
  }

  private readEntityClass(name: string, item: JsonObject): void {
    const init: Authoring.EntityClassInit = this.classInit(item);
    const mixins = asArray(item.mixins);
    if (mixins !== undefined)
      init.mixins = mixins.flatMap((mixin) => typeof mixin === "string" ? [this.normalizeItemReference(mixin)] : []);
    this.readClassContent(name, this._document.createEntity(name, init), item);
  }

  private readMixin(name: string, item: JsonObject): void {
    // ECJSON 3.2 carries mixins first-class, so this maps directly - no IsMixin custom attribute
    // promotion, unlike the XML reader.
    const appliesToText = asString(item.appliesTo);
    if (appliesToText === undefined)
      this._error("SchemaJson-0020", `The mixin "${name}" is missing the required appliesTo field.`);
    const appliesTo = appliesToText !== undefined ? this.normalizeItemReference(appliesToText) : "";
    this.readClassContent(name, this._document.createMixin(name, appliesTo, this.classInit(item)), item);
  }

  private readCustomAttributeClass(name: string, item: JsonObject): void {
    let appliesTo = 0;
    const appliesToText = asString(item.appliesTo);
    if (appliesToText === undefined) {
      this._error("SchemaJson-0022", `The custom attribute class "${name}" is missing the required appliesTo field.`);
    } else {
      try {
        appliesTo = parseCustomAttributeContainerType(appliesToText) ?? 0;
      } catch {
        this._error("SchemaJson-0023", `The custom attribute class "${name}" has an unparseable appliesTo ("${appliesToText}").`);
      }
    }
    this.readClassContent(name, this._document.createCustomAttributeClass(name, appliesTo, this.classInit(item)), item);
  }

  private readRelationshipClass(name: string, item: JsonObject): void {
    const init: Authoring.RelationshipClassInit = this.classInit(item);
    const strengthText = asString(item.strength);
    if (strengthText !== undefined) {
      init.strength = parseStrength(strengthText);
      if (init.strength === undefined)
        this._warning("SchemaJson-0024", `Unrecognized relationship strength "${strengthText}" was ignored.`);
    }
    const directionText = asString(item.strengthDirection);
    if (directionText !== undefined) {
      init.strengthDirection = parseStrengthDirection(directionText);
      if (init.strengthDirection === undefined)
        this._warning("SchemaJson-0025", `Unrecognized strengthDirection "${directionText}" was ignored.`);
    }
    const relationship = this._document.createRelationship(name, init);
    this.readClassContent(name, relationship, item);

    const sourceObject = asObject(item.source);
    const targetObject = asObject(item.target);
    if (sourceObject !== undefined)
      this.readRelationshipConstraint(sourceObject, relationship.source, name);
    else
      this._error("SchemaJson-0026", `The relationship class "${name}" is missing its source constraint.`);
    if (targetObject !== undefined)
      this.readRelationshipConstraint(targetObject, relationship.target, name);
    else
      this._error("SchemaJson-0026", `The relationship class "${name}" is missing its target constraint.`);
  }

  private readRelationshipConstraint(constraintObject: JsonObject, constraint: Authoring.RelationshipConstraint, className: string): void {
    const multiplicity = asString(constraintObject.multiplicity);
    if (multiplicity !== undefined)
      constraint.multiplicity = multiplicity;
    constraint.roleLabel = asString(constraintObject.roleLabel);
    constraint.polymorphic = asBoolean(constraintObject.polymorphic) ?? constraint.polymorphic;
    const abstractConstraint = asString(constraintObject.abstractConstraint);
    if (abstractConstraint !== undefined)
      constraint.abstractConstraint = this.normalizeItemReference(abstractConstraint);
    const constraintClasses = asArray(constraintObject.constraintClasses);
    if (constraintClasses !== undefined) {
      for (const entry of constraintClasses) {
        if (typeof entry === "string")
          constraint.constraintClasses.push(this.normalizeItemReference(entry));
        else
          this._error("SchemaJson-0027", `A constraint class entry of "${className}" is not a string; it was skipped.`);
      }
    }
    this.readCustomAttributes(constraintObject.customAttributes, constraint.customAttributes, className);
  }

  /** Reads the content shared by every class kind: properties and custom attributes. */
  private readClassContent(name: string, item: Authoring.AnyClass, json: JsonObject): void {
    this.readCustomAttributes(json.customAttributes, item.customAttributes, name);
    const properties = asArray(json.properties);
    if (properties === undefined)
      return;
    for (const entry of properties) {
      const propertyObject = asObject(entry);
      if (propertyObject === undefined) {
        this._error("SchemaJson-0028", `A property entry of class "${name}" is not a JSON object; it was skipped.`);
        continue;
      }
      this.readProperty(propertyObject, item);
    }
  }

  // ===== Properties =====

  private readProperty(propertyObject: JsonObject, item: Authoring.AnyClass): void {
    const name = asString(propertyObject.name);
    const typeText = asString(propertyObject.type);
    if (name === undefined || typeText === undefined) {
      this._error("SchemaJson-0029", `A property of class "${item.name}" is missing its name or type; the property was skipped.`);
      return;
    }

    let property: Authoring.AnyProperty | undefined;
    switch (typeText.toLowerCase()) {
      case "primitiveproperty": {
        const type = this.resolvePrimitivePropertyType(propertyObject, name, item.name);
        if (type === undefined)
          return;
        const init = this.primitivePropertyInit(propertyObject);
        property = "primitiveType" in type
          ? item.createPrimitive(name, type.primitiveType, init)
          : item.createEnumeration(name, type.enumeration, init);
        break;
      }
      case "primitivearrayproperty": {
        const type = this.resolvePrimitivePropertyType(propertyObject, name, item.name);
        if (type === undefined)
          return;
        const init = { ...this.primitivePropertyInit(propertyObject), ...this.occursInit(propertyObject) };
        property = "primitiveType" in type
          ? item.createPrimitiveArray(name, type.primitiveType, init)
          : item.createEnumerationArray(name, type.enumeration, init);
        break;
      }
      case "structproperty": {
        const typeName = this.propertyTypeName(propertyObject, name, item.name);
        if (typeName === undefined)
          return;
        property = item.createStruct(name, typeName, this.propertyInit(propertyObject));
        break;
      }
      case "structarrayproperty": {
        const typeName = this.propertyTypeName(propertyObject, name, item.name);
        if (typeName === undefined)
          return;
        property = item.createStructArray(name, typeName, { ...this.propertyInit(propertyObject), ...this.occursInit(propertyObject) });
        break;
      }
      case "navigationproperty": {
        const relationshipName = asString(propertyObject.relationshipName);
        const directionText = asString(propertyObject.direction);
        const direction = directionText !== undefined ? parseStrengthDirection(directionText) : undefined;
        if (relationshipName === undefined || direction === undefined) {
          this._error("SchemaJson-0030", `The navigation property "${item.name}.${name}" is missing relationshipName or a parseable direction; the property was skipped.`);
          return;
        }
        property = item.createNavigation(name, this.normalizeItemReference(relationshipName), direction, this.propertyInit(propertyObject));
        break;
      }
      default:
        this._error("SchemaJson-0031", `The property "${item.name}.${name}" has an unrecognized type ("${typeText}"); the property was skipped.`);
        return;
    }

    this.readCustomAttributes(propertyObject.customAttributes, property.customAttributes, `${item.name}.${name}`);
  }

  private propertyTypeName(propertyObject: JsonObject, propertyName: string, className: string): string | undefined {
    const typeName = asString(propertyObject.typeName);
    if (typeName === undefined) {
      this._error("SchemaJson-0032", `The property "${className}.${propertyName}" is missing the required typeName field; the property was skipped.`);
      return undefined;
    }
    return this.normalizeItemReference(typeName);
  }

  /** Resolves a primitive/array property's `typeName`: a primitive keyword parses to a
   * {@link PrimitiveType}, anything else is an enumeration reference and is normalized. */
  private resolvePrimitivePropertyType(propertyObject: JsonObject, propertyName: string, className: string):
    { primitiveType: PrimitiveType } | { enumeration: string } | undefined {
    const typeName = asString(propertyObject.typeName);
    if (typeName === undefined) {
      this._error("SchemaJson-0032", `The property "${className}.${propertyName}" is missing the required typeName field; the property was skipped.`);
      return undefined;
    }
    const primitiveType = parsePrimitiveType(typeName);
    return primitiveType !== undefined ? { primitiveType } : { enumeration: this.normalizeItemReference(typeName) };
  }

  private propertyInit(propertyObject: JsonObject): Authoring.PropertyInit {
    const category = asString(propertyObject.category);
    const kindOfQuantity = asString(propertyObject.kindOfQuantity);
    return {
      label: asString(propertyObject.label),
      description: asString(propertyObject.description),
      isReadOnly: asBoolean(propertyObject.isReadOnly),
      priority: asNumber(propertyObject.priority),
      category: category !== undefined ? this.normalizeItemReference(category) : undefined,
      kindOfQuantity: kindOfQuantity !== undefined ? this.normalizeItemReference(kindOfQuantity) : undefined,
    };
  }

  private primitivePropertyInit(propertyObject: JsonObject): Authoring.PrimitivePropertyInit {
    return {
      ...this.propertyInit(propertyObject),
      extendedTypeName: asString(propertyObject.extendedTypeName),
      minValue: asNumber(propertyObject.minValue),
      maxValue: asNumber(propertyObject.maxValue),
      minLength: asNumber(propertyObject.minLength),
      maxLength: asNumber(propertyObject.maxLength),
    };
  }

  private occursInit(propertyObject: JsonObject): { minOccurs?: number, maxOccurs?: number } {
    // An absent maxOccurs means unbounded; ECJSON also spells unbounded as INT32_MAX, which
    // normalizes to the document's single representation (undefined).
    const maxOccurs = asNumber(propertyObject.maxOccurs);
    return { minOccurs: asNumber(propertyObject.minOccurs), maxOccurs: maxOccurs === 2147483647 ? undefined : maxOccurs };
  }

  // ===== Non-class items =====

  private readEnumeration(name: string, item: JsonObject): void {
    const backingTypeText = (asString(item.type) ?? "").toLowerCase();
    let backingType: Authoring.EnumerationBackingType;
    if (backingTypeText === "int" || backingTypeText === "integer")
      backingType = "int";
    else if (backingTypeText === "string")
      backingType = "string";
    else {
      this._error("SchemaJson-0033", `The enumeration "${name}" has a missing or unsupported type ("${asString(item.type) ?? ""}"); the item was skipped.`);
      return;
    }
    const enumeration = this._document.createEnumeration(name, backingType, {
      ...this.itemInit(item),
      isStrict: asBoolean(item.isStrict),
    });
    const enumerators = asArray(item.enumerators);
    if (enumerators === undefined)
      return;
    for (const entry of enumerators) {
      const enumeratorObject = asObject(entry);
      const enumeratorName = enumeratorObject !== undefined ? asString(enumeratorObject.name) : undefined;
      const value = enumeratorObject !== undefined && (typeof enumeratorObject.value === "number" || typeof enumeratorObject.value === "string")
        ? enumeratorObject.value : undefined;
      if (enumeratorObject === undefined || enumeratorName === undefined || value === undefined) {
        this._error("SchemaJson-0034", `An enumerator of "${name}" is missing its name or value; it was skipped.`);
        continue;
      }
      enumeration.createEnumerator(enumeratorName, value, {
        label: asString(enumeratorObject.label),
        description: asString(enumeratorObject.description),
      });
    }
  }

  private readKindOfQuantity(name: string, item: JsonObject): void {
    const persistenceUnit = asString(item.persistenceUnit);
    const relativeError = asNumber(item.relativeError);
    if (persistenceUnit === undefined || relativeError === undefined) {
      this._error("SchemaJson-0035", `The kind of quantity "${name}" is missing persistenceUnit or a numeric relativeError; the item was skipped.`);
      return;
    }
    // Presentation format strings stay as strings; the override grammar is parsed at compile.
    // The references embedded in them are normalized like any other item reference.
    // ECJSON allows a single string or an array; both normalize to the document's array.
    let presentationFormats: string[] | undefined;
    if (typeof item.presentationUnits === "string")
      presentationFormats = item.presentationUnits.split(";").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
    else if (Array.isArray(item.presentationUnits))
      presentationFormats = item.presentationUnits.flatMap((entry) => typeof entry === "string" ? [entry] : []);
    presentationFormats = presentationFormats?.map((entry) => mapFormatStringReferences(entry, (reference) => this.normalizeItemReference(reference)));
    this._document.createKindOfQuantity(name, this.normalizeItemReference(persistenceUnit), relativeError, {
      ...this.itemInit(item),
      presentationFormats,
    });
  }

  private readPhenomenon(name: string, item: JsonObject): void {
    const definition = asString(item.definition);
    if (definition === undefined) {
      this._error("SchemaJson-0036", `The phenomenon "${name}" is missing the required definition field; the item was skipped.`);
      return;
    }
    this._document.createPhenomenon(name, definition, this.itemInit(item));
  }

  private readUnit(name: string, item: JsonObject): void {
    const phenomenon = asString(item.phenomenon);
    const unitSystem = asString(item.unitSystem);
    const definition = asString(item.definition);
    if (phenomenon === undefined || unitSystem === undefined || definition === undefined) {
      this._error("SchemaJson-0037", `The unit "${name}" is missing phenomenon, unitSystem, or definition; the item was skipped.`);
      return;
    }
    this._document.createUnit(name, this.normalizeItemReference(phenomenon), this.normalizeItemReference(unitSystem), definition, {
      ...this.itemInit(item),
      numerator: asNumber(item.numerator),
      denominator: asNumber(item.denominator),
      offset: asNumber(item.offset),
    });
  }

  private readInvertedUnit(name: string, item: JsonObject): void {
    const invertsUnit = asString(item.invertsUnit);
    const unitSystem = asString(item.unitSystem);
    if (invertsUnit === undefined || unitSystem === undefined) {
      this._error("SchemaJson-0038", `The inverted unit "${name}" is missing invertsUnit or unitSystem; the item was skipped.`);
      return;
    }
    this._document.createInvertedUnit(name, this.normalizeItemReference(invertsUnit), this.normalizeItemReference(unitSystem), this.itemInit(item));
  }

  private readConstant(name: string, item: JsonObject): void {
    const phenomenon = asString(item.phenomenon);
    const definition = asString(item.definition);
    if (phenomenon === undefined || definition === undefined) {
      this._error("SchemaJson-0039", `The constant "${name}" is missing phenomenon or definition; the item was skipped.`);
      return;
    }
    this._document.createConstant(name, this.normalizeItemReference(phenomenon), definition, {
      ...this.itemInit(item),
      numerator: asNumber(item.numerator),
      denominator: asNumber(item.denominator),
    });
  }

  private readFormat(name: string, item: JsonObject): void {
    const typeText = asString(item.type);
    if (typeText === undefined) {
      this._error("SchemaJson-0040", `The format "${name}" is missing the required type field; the item was skipped.`);
      return;
    }
    const init: Authoring.FormatInit = this.itemInit(item);
    try {
      const type = parseFormatType(typeText, name);
      const precision = asNumber(item.precision);
      if (precision !== undefined)
        init.precision = parsePrecision(precision, type, name);
      const showSignOption = asString(item.showSignOption);
      if (showSignOption !== undefined)
        init.showSignOption = parseShowSignOption(showSignOption, name);
      const scientificType = asString(item.scientificType);
      if (scientificType !== undefined)
        init.scientificType = parseScientificType(scientificType, name);
      // formatTraits may be an array of trait names or a single delimited string.
      const traitTexts = typeof item.formatTraits === "string"
        ? item.formatTraits.split(/[|,;]/)
        : asArray(item.formatTraits)?.flatMap((entry) => typeof entry === "string" ? [entry] : []);
      if (traitTexts !== undefined) {
        let traits = 0;
        for (const trait of traitTexts) {
          if (trait.trim().length > 0)
            traits |= parseFormatTrait(trait.trim(), name);
        }
        init.formatTraits = traits;
      }
      init.roundFactor = asNumber(item.roundFactor);
      init.minWidth = asNumber(item.minWidth);
      init.decimalSeparator = asString(item.decimalSeparator);
      init.thousandSeparator = asString(item.thousandSeparator);
      init.uomSeparator = asString(item.uomSeparator);
      init.stationOffsetSize = asNumber(item.stationOffsetSize);
      init.stationSeparator = asString(item.stationSeparator);

      const composite = asObject(item.composite);
      if (composite !== undefined) {
        const units: Authoring.FormatCompositeUnit[] = [];
        for (const entry of asArray(composite.units) ?? []) {
          const unitObject = asObject(entry);
          const unitName = unitObject !== undefined ? asString(unitObject.name) : undefined;
          if (unitObject === undefined || unitName === undefined) {
            this._error("SchemaJson-0041", `A composite unit of format "${name}" is missing its name; it was skipped.`);
            continue;
          }
          units.push({ name: this.normalizeItemReference(unitName), label: asString(unitObject.label) });
        }
        init.composite = {
          spacer: asString(composite.spacer),
          includeZero: asBoolean(composite.includeZero),
          units,
        };
      }

      this._document.createFormat(name, type, init);
    } catch (error) {
      this._error("SchemaJson-0042", `The format "${name}" could not be read: ${error instanceof Error ? error.message : String(error)}; the item was skipped.`);
    }
  }

  // ===== Custom attributes =====

  /** Reads a `customAttributes` array into a set. Each entry is the flattened ECJSON form: the
   * `className` key plus the property values inline. Values stay untyped and pass through as the
   * plain JSON shapes they already are; typing them against the CA class happens at compile. */
  private readCustomAttributes(value: unknown, target: Authoring.CustomAttributeSet, location: string): void {
    const entries = asArray(value);
    if (entries === undefined)
      return;
    for (const entry of entries) {
      const caObject = asObject(entry);
      const className = caObject !== undefined ? asString(caObject.className) : undefined;
      if (caObject === undefined || className === undefined) {
        this._error("SchemaJson-0043", `A custom attribute on "${location}" is missing its className; it was skipped.`);
        continue;
      }
      // The remaining keys are the CA's property values, already in canonical ECJSON shape - exactly
      // the document's untyped JSON representation - so they carry over as the value directly.
      const { className: _discriminator, ...properties } = caObject;
      target.add(Object.keys(properties).length > 0
        ? { className: this.normalizeItemReference(className), json: properties }
        : { className: this.normalizeItemReference(className) });
    }
  }

  // ===== Shared helpers =====

  /** Normalizes an item reference read from JSON, mirroring the XML reader: a reference into this
   * schema becomes a bare local name; other schema-name qualifiers keep the full-name form. ECJSON
   * does not use alias qualifiers, but one is resolved through the reference list when it appears.
   * Unknown qualifiers are left as written for the compiler to diagnose. */
  private normalizeItemReference(reference: string): Authoring.LocalOrFullName {
    const separatorIndex = reference.search(/[.:]/);
    if (separatorIndex < 0)
      return reference;
    const qualifier = reference.substring(0, separatorIndex);
    const itemName = reference.substring(separatorIndex + 1);
    const qualifierLower = qualifier.toLowerCase();
    const document = this._document;
    if (qualifierLower === document.name.toLowerCase() || qualifierLower === document.alias.toLowerCase())
      return itemName;
    for (const schemaReference of document.references) {
      if (schemaReference.name.toLowerCase() === qualifierLower)
        return `${schemaReference.name}:${itemName}`;
      if (schemaReference.alias !== null && schemaReference.alias.toLowerCase() === qualifierLower)
        return `${schemaReference.name}:${itemName}`;
    }
    return reference;
  }

  private _error(code: string, message: string): void {
    this._issues.addError(code, message, { source: this._source });
  }

  private _warning(code: string, message: string): void {
    this._issues.addWarning(code, message, { source: this._source });
  }
}
