/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

// Custom attribute property names are real ECSchema identifiers (PascalCase), so the EC naming is
// intentional here.
/* eslint-disable @typescript-eslint/naming-convention */

import { AbstractSchemaItemType, SchemaItemType } from "../ECObjects";
import { ECName } from "../ECName";
import { ecUnitNameFromLegacyName, legacyUnitNameFromECName } from "./LegacyUnitNames";
import * as Authoring from "./SchemaDocument";
import { SchemaIssueList } from "./SchemaIssues";

/**
 * Conversion between the legacy custom attributes ECXML 2.0 uses and the first-class constructs EC3
 * replaced them with.
 *
 * ECXML 2.0 has no enumerations, property categories, or property priorities; it expresses them as
 * custom attributes of the standard `EditorCustomAttributes` and `Bentley_Standard_CustomAttributes`
 * schemas. {@link convertEC2CustomAttributes} turns those into the items and fields the document
 * models directly, and {@link convertToEC2CustomAttributes} produces the ones a 2.0 file needs on
 * the way back out.
 *
 * **Both are opt-in passes over a document, not part of reading or writing.** Most of the mapping
 * has no exact inverse - a category's expand flag, a hide expression, and everything about the
 * legacy unit attributes are gone once converted - so baking it into a reader would mangle data
 * with no way to decline. Native draws the line in the same place: its `SchemaXmlReader2` does the
 * structural upgrade and the standalone converter does this.
 *
 * Both mutate the document in place. Copy it first ({@link copyDocumentInto}) to keep the original.
 */

/** Full names of the legacy custom attribute classes, as they are compared. */
const editorSchema = "EditorCustomAttributes";
const bentleyStandardSchema = "Bentley_Standard_CustomAttributes";
const unitAttributesSchema = "Unit_Attributes";
const coreCustomAttributesSchema = "CoreCustomAttributes";
const unitsSchema = "Units";
const formatsSchema = "Formats";

/** The format a converted display unit is presented with. Native picks the same one, and it is the
 * only format the legacy attributes can be mapped onto: they carry a unit and a printf-ish format
 * string that has no EC 3.2 equivalent. */
const defaultPresentationFormat = `${formatsSchema}:DefaultRealU`;

/** The relative error a converted kind of quantity gets. The legacy attributes carry none, and this
 * is what native assigns. */
const defaultRelativeError = 1e-4;

/** The unit-system marker attributes, which carry nothing and are dropped once the conversion has
 * consulted the schema-level defaults they sit alongside. */
const unitSystemMarkers = ["IsUnitSystemSchema", "Mixed_UnitSystem", "SI_UnitSystem", "US_UnitSystem"];

/** Where the four relocated attributes moved to, and which of their properties moved with them. A
 * dotted target names a member of a struct-valued property. A source property absent from the map
 * keeps its name; one mapped to `undefined` is dropped, because the target class has no home for
 * it. */
interface RelocationRule {
  target: string;
  properties?: Readonly<Record<string, string | undefined>>;
}

const relocations: ReadonlyMap<string, RelocationRule> = new Map([
  [`${bentleyStandardSchema}:DateTimeInfo`, { target: `${coreCustomAttributesSchema}:DateTimeInfo` }],
  [`${bentleyStandardSchema}:ClassHasCurrentTimeStampProperty`, { target: `${coreCustomAttributesSchema}:ClassHasCurrentTimeStampProperty` }],
  [`${bentleyStandardSchema}:DynamicSchema`, { target: `${coreCustomAttributesSchema}:DynamicSchema` }],
  [`${bentleyStandardSchema}:SupplementalSchemaMetaData`, {
    target: `${coreCustomAttributesSchema}:SupplementalSchema`,
    properties: {
      PrimarySchemaName: "PrimarySchemaReference.SchemaName",
      PrimarySchemaMajorVersion: "PrimarySchemaReference.MajorVersion",
      PrimarySchemaMinorVersion: "PrimarySchemaReference.MinorVersion",
      IsUserSpecific: undefined,
    },
  }],
]);

/** Turns the legacy custom attributes of an ECXML 2.0 document into the first-class constructs EC3
 * models directly, in place. Returns what was reported along the way; nothing here throws.
 *
 * What it converts:
 *
 * - `EditorCustomAttributes:StandardValues` on an integer property becomes an {@link Enumeration},
 *   shared between properties whose value maps agree.
 * - `Unit_Attributes:UnitSpecification` and `DisplayUnitSpecification` become a
 *   {@link KindOfQuantity}, with the legacy unit names mapped to EC 3.2 units.
 * - `EditorCustomAttributes:Category` becomes a {@link PropertyCategory} the property points at.
 * - `EditorCustomAttributes:PropertyPriority` becomes the property's `priority`.
 * - `EditorCustomAttributes:HideProperty` becomes `CoreCustomAttributes:HiddenProperty`.
 * - `Bentley_Standard_CustomAttributes:DisplayOptions` becomes `CoreCustomAttributes:HiddenSchema`
 *   or `HiddenClass`.
 * - `DateTimeInfo`, `ClassHasCurrentTimeStampProperty`, `SupplementalSchemaMetaData` and
 *   `DynamicSchema` move from `Bentley_Standard_CustomAttributes` to `CoreCustomAttributes`.
 *
 * Reading a legacy attribute needs its custom attribute class, and the two standard schemas are
 * built in ({@link getStandardSchemas}), so nothing has to be loaded for this to work. An attribute
 * of a schema-defined class the schema set does not hold is reported and left alone.
 * @alpha
 */
export function convertEC2CustomAttributes(document: Authoring.SchemaDocument): SchemaIssueList {
  return new EC2Upgrade(document).run();
}

/** Produces the legacy custom attributes an ECXML 2.0 file carries in place of constructs that spec
 * has no element for, in place. Run it over a copy of the document immediately before writing 2.0;
 * the writer never invents custom attributes on its own.
 *
 * Two conversions, both the ones native's down converter performs:
 *
 * - an integer enumeration becomes an `EditorCustomAttributes:StandardValues` on every property
 *   that uses it and declares its own type;
 * - a kind of quantity becomes a `Unit_Attributes:UnitSpecification` naming the legacy persistence
 *   unit, plus a `DisplayUnitSpecification` when the first presentation format names a different
 *   unit. The legacy `DisplayFormatString` has no EC 3.2 source, so a fixed `0.######` is written,
 *   as native does.
 * @alpha
 */
export function convertToEC2CustomAttributes(document: Authoring.SchemaDocument): SchemaIssueList {
  const issues = new SchemaIssueList("ec2-conversion");
  let addedEnumerations = false;
  let addedUnits = false;

  for (const ecClass of document.getItemsOfType(AbstractSchemaItemType.Class)) {
    for (const property of ecClass.properties) {
      if (!property.isPrimitive())
        continue;
      // A derived property inherits both from where the type was declared; a second copy on the
      // override would be a different, conflicting declaration.
      const overridesBase = declaringAncestor(ecClass, property.name) !== undefined;

      const enumeration = document.getItemOfType(property.typeName, SchemaItemType.Enumeration);
      if (!overridesBase && enumeration !== undefined && enumeration.backingType === "int") {
        property.customAttributes.add({
          className: `${editorSchema}:StandardValues`,
          values: {
            MustBeFromList: enumeration.isStrict ?? true,
            ValueMap: enumeration.enumerators.map((enumerator) => ({ Value: enumerator.value, DisplayString: enumerator.label ?? enumerator.name })),
          },
        });
        addedEnumerations = true;
      }

      if (!overridesBase && property.kindOfQuantity !== undefined && addUnitAttributes(document, property, issues))
        addedUnits = true;
    }
  }

  if (addedEnumerations && document.getSchemaReference(editorSchema) === undefined)
    document.setSchemaReference({ name: editorSchema, readVersion: 1, writeVersion: 0, minorVersion: 3, alias: "beca" });
  if (addedUnits && document.getSchemaReference(unitAttributesSchema) === undefined)
    document.setSchemaReference({ name: unitAttributesSchema, readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "units_attribs" });
  return issues;
}

/** The legacy display format string, which EC 3.2 has no source for. Native writes this fixed one. */
const legacyDisplayFormatString = "0.######";

/** Adds the legacy unit attributes for a property's kind of quantity, and says whether it did. */
function addUnitAttributes(document: Authoring.SchemaDocument, property: Authoring.AnyProperty, issues: SchemaIssueList): boolean {
  const location = `${property.declaringClass.name}.${property.name}`;
  const koq = property.getKindOfQuantity();
  if (koq === undefined)
    return false;

  const legacyUnit = legacyUnitNameFromECName(koq.persistenceUnit);
  if (legacyUnit === undefined) {
    issues.addWarning("unit-legacy-equivalent-missing",
      `The persistence unit "${koq.persistenceUnit}" of "${koq.name}" has no legacy equivalent, so "${location}" carries no unit attribute.`, location);
    return false;
  }
  property.customAttributes.add({
    className: `${unitAttributesSchema}:UnitSpecification`,
    // The kind of quantity's name goes out alongside the unit, which native's down converter omits.
    // It costs one element a legacy reader already understands, and it is what the name is rebuilt
    // from on the way back up - without it a converted schema comes back named after the property.
    values: { KindOfQuantityName: koq.name, UnitName: legacyUnit },
  });

  // Only the first presentation format converts, and only its leading unit - a legacy display
  // specification names one unit and nothing else.
  const displayUnit = firstPresentationUnit(koq.presentationFormats[0]);
  const legacyDisplayUnit = displayUnit === undefined ? undefined : legacyUnitNameFromECName(displayUnit);
  if (legacyDisplayUnit !== undefined && legacyDisplayUnit !== legacyUnit) {
    property.customAttributes.add({
      className: `${unitAttributesSchema}:DisplayUnitSpecification`,
      values: { DisplayUnitName: legacyDisplayUnit, DisplayFormatString: legacyDisplayFormatString },
    });
  }
  return true;
}

/** The first unit named inside a presentation format override string, e.g. `Units:FT` out of
 * `Formats:DefaultRealU[Units:FT]`. */
function firstPresentationUnit(formatString: string | undefined): string | undefined {
  if (formatString === undefined)
    return undefined;
  const match = /\[([^\]|]+)/.exec(formatString);
  return match === null ? undefined : match[1].trim();
}

/** One up-conversion run over one document. */
class EC2Upgrade {
  private readonly _issues = new SchemaIssueList("ec2-conversion");
  private _addedCoreReference = false;
  /** The schema-level legacy unit defaults, read once on first use. */
  private _unitSpecifications?: Authoring.CustomAttributeValues[];

  public constructor(private readonly _document: Authoring.SchemaDocument) { }

  public run(): SchemaIssueList {
    // Base classes first, so an enumeration or category is named after the class that introduced
    // the property and derived properties reuse it rather than creating a near-duplicate.
    for (const ecClass of this._classesBaseFirst()) {
      this._convertDisplayOptions(ecClass);
      this._relocate(ecClass.customAttributes);
      for (const property of ecClass.properties) {
        this._convertStandardValues(ecClass, property);
        this._convertUnitAttributes(ecClass, property);
        this._convertCategory(property);
        this._convertPropertyPriority(property);
        this._convertHideProperty(property);
        this._relocate(property.customAttributes);
      }
      if (ecClass.isRelationship()) {
        this._relocate(ecClass.source.customAttributes);
        this._relocate(ecClass.target.customAttributes);
      }
    }

    this._convertDisplayOptions(this._document);
    this._relocate(this._document.customAttributes);
    this._dropUnitVocabulary();
    this._reportUnconverted();
    this._dropSpentReferences();
    return this._issues;
  }

  /** Every class, ordered so a class comes after the base class it derives from. */
  private _classesBaseFirst(): Authoring.AnyClass[] {
    const classes = [...this._document.getItemsOfType(AbstractSchemaItemType.Class)];
    const depths = new Map<Authoring.AnyClass, number>();
    const depthOf = (ecClass: Authoring.AnyClass, seen: Set<Authoring.AnyClass>): number => {
      const known = depths.get(ecClass);
      if (known !== undefined)
        return known;
      const base = ecClass.getBaseClass();
      // A base-class cycle is invalid but permitted in a document; stopping at a revisit keeps the
      // ordering total instead of hanging.
      const depth = base === undefined || seen.has(base) ? 0 : depthOf(base, seen.add(ecClass)) + 1;
      depths.set(ecClass, depth);
      return depth;
    };
    return classes
      .map((ecClass, index) => ({ ecClass, index, depth: depthOf(ecClass, new Set()) }))
      .sort((left, right) => left.depth - right.depth || left.index - right.index)
      .map((entry) => entry.ecClass);
  }

  // ===== StandardValues -> Enumeration =====

  private _convertStandardValues(ecClass: Authoring.AnyClass, property: Authoring.AnyProperty): void {
    const values = this._readLegacyAttribute(property.customAttributes, `${editorSchema}:StandardValues`, `${ecClass.name}.${property.name}`);
    if (values === undefined)
      return;
    property.customAttributes.remove(`${editorSchema}:StandardValues`);

    // The attribute only ever meant anything on an integer property; native discards it elsewhere.
    if (!property.isPrimitive() || property.typeName !== "int")
      return;

    const entries = readValueMap(values.ValueMap);
    if (entries.size === 0)
      return;

    // A property that overrides a base property has to accept the base declaration's values, so its
    // own list cannot be closed. This is what lets the two share one enumeration.
    const overridesBase = declaringAncestor(ecClass, property.name) !== undefined;
    const isStrict = overridesBase ? false : values.MustBeFromList !== false;

    const enumeration = this._findOrCreateEnumeration(entries, isStrict, this._enumerationName(ecClass, property.name));
    property.typeName = enumeration.name;
  }

  /** Named for the class that introduced the property, so every class in a hierarchy lands on one
   * name rather than one per level. */
  private _enumerationName(ecClass: Authoring.AnyClass, propertyName: string): string {
    const root = declaringAncestor(ecClass, propertyName) ?? ecClass;
    return `${root.name}_${propertyName}`;
  }

  /** An existing integer enumeration these values fit into, or a new one. Fitting means: same
   * strictness, no value carrying a different label, and - when the existing one is closed - no
   * value it does not already list. A non-strict enumeration absorbs the values it is missing. */
  private _findOrCreateEnumeration(entries: ReadonlyMap<number, string>, isStrict: boolean, preferredName: string): Authoring.Enumeration {
    for (const candidate of this._document.getItemsOfType(SchemaItemType.Enumeration)) {
      if (candidate.backingType !== "int" || (candidate.isStrict ?? true) !== isStrict)
        continue;
      const existing = new Map(candidate.enumerators.map((enumerator) => [enumerator.value as number, enumerator.label ?? enumerator.name]));
      const missing = new Map<number, string>();
      let conflicts = false;
      for (const [value, label] of entries) {
        const known = existing.get(value);
        if (known === undefined)
          missing.set(value, label);
        else if (known !== label)
          conflicts = true;
      }
      if (conflicts || (missing.size > 0 && isStrict))
        continue;
      for (const [value, label] of missing)
        candidate.createEnumerator(enumeratorName(candidate.name, value), value, { label });
      return candidate;
    }

    const name = this._uniqueItemName(preferredName);
    const enumeration = this._document.createEnumeration(name, "int", { isStrict });
    for (const [value, label] of entries)
      enumeration.createEnumerator(enumeratorName(name, value), value, { label });
    return enumeration;
  }

  // ===== Category / PropertyPriority =====

  private _convertCategory(property: Authoring.AnyProperty): void {
    const location = `${property.declaringClass.name}.${property.name}`;
    const values = this._readLegacyAttribute(property.customAttributes, `${editorSchema}:Category`, location);
    if (values === undefined)
      return;
    property.customAttributes.remove(`${editorSchema}:Category`);

    const rawName = typeof values.Name === "string" ? values.Name.trim() : "";
    if (rawName.length === 0) {
      // A `Standard` id with no name names one of the host application's built-in categories, which
      // has no schema item to become. Native drops it too.
      this._issues.addWarning("category-standard-only-dropped", `The Category custom attribute on "${location}" names no category of its own, so no property category was created.`, location);
      return;
    }
    const requested = ECName.encode(rawName).name;

    // An existing category of that name is shared as-is. Its fields came from whichever property
    // was converted first, and overwriting them here would make the result depend on order.
    let category = this._document.getItemOfType(requested, SchemaItemType.PropertyCategory);
    if (category === undefined) {
      const name = this._document.getItem(requested) === undefined ? requested : this._uniqueItemName(`${requested}_Category`);
      category = this._document.createPropertyCategory(name, {
        label: typeof values.DisplayLabel === "string" ? values.DisplayLabel : undefined,
        description: typeof values.Description === "string" ? values.Description : undefined,
        priority: typeof values.Priority === "number" ? values.Priority : undefined,
      });
    }
    property.category = category.name;
  }

  private _convertPropertyPriority(property: Authoring.AnyProperty): void {
    const location = `${property.declaringClass.name}.${property.name}`;
    const values = this._readLegacyAttribute(property.customAttributes, `${editorSchema}:PropertyPriority`, location);
    if (values === undefined)
      return;
    property.customAttributes.remove(`${editorSchema}:PropertyPriority`);
    if (typeof values.Priority === "number")
      property.priority = values.Priority;
  }

  // ===== HideProperty / DisplayOptions =====

  private _convertHideProperty(property: Authoring.AnyProperty): void {
    const location = `${property.declaringClass.name}.${property.name}`;
    const values = this._readLegacyAttribute(property.customAttributes, `${editorSchema}:HideProperty`, location);
    if (values === undefined)
      return;
    property.customAttributes.remove(`${editorSchema}:HideProperty`);
    // Only the 3D flag carries over. `If2D` and the `If` expression have no equivalent, matching
    // what native's converter keeps.
    this._addCoreAttribute(property.customAttributes, "HiddenProperty", { Show: values.If3D !== true });
  }

  private _convertDisplayOptions(container: Authoring.SchemaDocument | Authoring.AnyClass): void {
    const location = container instanceof Authoring.SchemaDocument ? container.name : `${this._document.name}:${container.name}`;
    const values = this._readLegacyAttribute(container.customAttributes, `${bentleyStandardSchema}:DisplayOptions`, location);
    if (values === undefined)
      return;
    container.customAttributes.remove(`${bentleyStandardSchema}:DisplayOptions`);

    const hidden = typeof values.Hidden === "boolean" ? values.Hidden : undefined;
    const hideInstances = typeof values.HideInstances === "boolean" ? values.HideInstances : undefined;
    // `HideInstances` alone hides; `Hidden` hides only when instances are not explicitly shown.
    // The two defaults differ by position, which is what native's expression encodes.
    const hide = (hideInstances ?? false) || ((hidden ?? false) && (hideInstances ?? true));

    if (container instanceof Authoring.SchemaDocument) {
      if (hide)
        this._addCoreAttribute(container.customAttributes, "HiddenSchema", {});
      return;
    }
    this._addCoreAttribute(container.customAttributes, "HiddenClass", { Show: !hide });
  }

  // ===== Relocations to CoreCustomAttributes =====

  private _relocate(customAttributes: Authoring.CustomAttributeSet): void {
    for (const [source, rule] of relocations) {
      const location = containerLocation(this._document, customAttributes.container);
      const values = this._readLegacyAttribute(customAttributes, source, location);
      if (values === undefined)
        continue;
      customAttributes.remove(source);

      const moved: Authoring.CustomAttributeValues = {};
      for (const [name, value] of Object.entries(values)) {
        const target = rule.properties !== undefined && name in rule.properties ? rule.properties[name] : name;
        if (target === undefined)
          continue;
        assignByPath(moved, target, value);
      }
      this._addCoreAttribute(customAttributes, rule.target.substring(rule.target.indexOf(":") + 1), moved);
    }
  }

  // ===== Unit attributes -> KindOfQuantity =====

  /** `Unit_Attributes:UnitSpecification` on a property names the unit its values are stored in, and
   * `DisplayUnitSpecification` the one they are shown in. Together they are what EC 3.2 models as a
   * {@link KindOfQuantity}, so that is what they become.
   *
   * The persistence unit is the legacy name mapped straight through
   * ({@link ecUnitNameFromLegacyName}). Native additionally rewrites a non-SI unit to its
   * phenomenon's SI unit and records the original in a conversion custom attribute; this keeps the
   * unit the schema actually named, which needs no phenomenon lookup and loses nothing. */
  private _convertUnitAttributes(ecClass: Authoring.AnyClass, property: Authoring.AnyProperty): void {
    const location = `${ecClass.name}.${property.name}`;
    const unitSpecification = this._readLegacyAttribute(property.customAttributes, `${unitAttributesSchema}:UnitSpecification`, location);
    const displaySpecification = this._readLegacyAttribute(property.customAttributes, `${unitAttributesSchema}:DisplayUnitSpecification`, location);
    if (unitSpecification === undefined && displaySpecification === undefined)
      return;
    property.customAttributes.remove(`${unitAttributesSchema}:UnitSpecification`);
    property.customAttributes.remove(`${unitAttributesSchema}:DisplayUnitSpecification`);

    const legacyUnit = this._resolveLegacyUnit(unitSpecification);
    if (legacyUnit === undefined) {
      this._issues.addWarning("unit-unresolved",
        `The unit custom attribute on "${location}" names no unit that could be resolved, so no kind of quantity was created.`, location);
      return;
    }
    const persistenceUnit = ecUnitNameFromLegacyName(legacyUnit);
    if (persistenceUnit === undefined) {
      this._issues.addWarning("unit-ec3-equivalent-missing",
        `The legacy unit "${legacyUnit}" on "${location}" has no EC 3.2 equivalent, so no kind of quantity was created.`, location);
      return;
    }

    const presentationFormat = this._presentationFormat(displaySpecification, legacyUnit, location);
    const koq = this._findOrCreateKindOfQuantity(ecClass, property, unitSpecification, persistenceUnit, presentationFormat, location);
    if (koq !== undefined)
      property.kindOfQuantity = koq.name;
  }

  /** The legacy unit name a property's `UnitSpecification` means: the unit it names outright, or the
   * one the schema-level `UnitSpecifications` list gives for its kind of quantity or dimension. */
  private _resolveLegacyUnit(unitSpecification: Authoring.CustomAttributeValues | undefined): string | undefined {
    const direct = readText(unitSpecification?.UnitName);
    if (direct !== undefined)
      return direct;
    const byKindOfQuantity = this._schemaDefaultUnit(readText(unitSpecification?.KindOfQuantityName), "KindOfQuantityName");
    if (byKindOfQuantity !== undefined)
      return byKindOfQuantity;
    return this._schemaDefaultUnit(readText(unitSpecification?.DimensionName), "DimensionName");
  }

  /** The unit the schema-level `UnitSpecifications` list assigns to a kind of quantity or dimension
   * name. A legacy schema declares its defaults once and its properties name only the kind. */
  private _schemaDefaultUnit(key: string | undefined, keyField: "KindOfQuantityName" | "DimensionName"): string | undefined {
    if (key === undefined)
      return undefined;
    this._unitSpecifications ??= this._readUnitSpecifications();
    for (const entry of this._unitSpecifications) {
      if (readText(entry[keyField])?.toLowerCase() === key.toLowerCase())
        return readText(entry.UnitName);
    }
    return undefined;
  }

  private _readUnitSpecifications(): Authoring.CustomAttributeValues[] {
    const values = this._readLegacyAttribute(this._document.customAttributes, `${unitAttributesSchema}:UnitSpecifications`, this._document.name);
    const list = values?.UnitSpecificationList;
    if (!Array.isArray(list))
      return [];
    return list.filter((entry): entry is Authoring.CustomAttributeValues => typeof entry === "object" && entry !== null && !Array.isArray(entry));
  }

  /** The presentation format a `DisplayUnitSpecification` becomes, or `undefined` when it names the
   * persistence unit anyway. The legacy `DisplayFormatString` has no EC 3.2 equivalent and is lost. */
  private _presentationFormat(displaySpecification: Authoring.CustomAttributeValues | undefined, legacyUnit: string, location: string): string | undefined {
    const displayUnit = readText(displaySpecification?.DisplayUnitName);
    if (displayUnit === undefined || displayUnit.toLowerCase() === legacyUnit.toLowerCase())
      return undefined;
    const ecDisplayUnit = ecUnitNameFromLegacyName(displayUnit);
    if (ecDisplayUnit === undefined) {
      this._issues.addWarning("unit-ec3-equivalent-missing",
        `The legacy display unit "${displayUnit}" on "${location}" has no EC 3.2 equivalent, so no presentation format was created.`, location);
      return undefined;
    }
    return `${defaultPresentationFormat}[${ecDisplayUnit}]`;
  }

  /** An existing kind of quantity with the same persistence unit and presentation format, or a new
   * one. Legacy schemas name the same kind on many properties, so sharing is the normal outcome. */
  private _findOrCreateKindOfQuantity(ecClass: Authoring.AnyClass, property: Authoring.AnyProperty, unitSpecification: Authoring.CustomAttributeValues | undefined,
    persistenceUnit: string, presentationFormat: string | undefined, location: string): Authoring.KindOfQuantity | undefined {
    const presentationFormats = presentationFormat === undefined ? [] : [presentationFormat];
    for (const candidate of this._document.getItemsOfType(SchemaItemType.KindOfQuantity)) {
      if (candidate.persistenceUnit === persistenceUnit && candidate.presentationFormats.join(";") === presentationFormats.join(";"))
        return candidate;
    }

    // Native's naming: the kind of quantity the attribute names, else the dimension, else something
    // derived from the class and property. A collision falls back through the same three levels.
    const requested = readText(unitSpecification?.KindOfQuantityName)
      ?? readText(unitSpecification?.DimensionName)
      ?? `${ecClass.name}_${property.name}`;
    const name = this._uniqueItemName(ECName.encode(requested).name, [`${requested}_${ecClass.name}`, `${requested}_${ecClass.name}_${property.name}`]);

    this._addUnitReferences(presentationFormat !== undefined);
    void location;
    return this._document.createKindOfQuantity(name, persistenceUnit, defaultRelativeError, { presentationFormats });
  }

  private _addUnitReferences(withFormats: boolean): void {
    if (this._document.getSchemaReference(unitsSchema) === undefined)
      this._document.setSchemaReference({ name: unitsSchema, readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "u" });
    if (withFormats && this._document.getSchemaReference(formatsSchema) === undefined)
      this._document.setSchemaReference({ name: formatsSchema, readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "f" });
  }

  /** Drops the schema-level unit vocabulary once every property has been converted against it: the
   * defaults list and the unit-system markers, none of which has an EC 3.2 equivalent. */
  private _dropUnitVocabulary(): void {
    this._document.customAttributes.remove(`${unitAttributesSchema}:UnitSpecifications`);
    for (const marker of unitSystemMarkers)
      this._document.customAttributes.remove(`${unitAttributesSchema}:${marker}`);
  }

  // ===== Shared =====

  /** The values of a legacy attribute, or `undefined` when the container does not carry it. Reports
   * and returns `undefined` when it is there but cannot be read, which happens only when the class
   * was redefined by a schema the set does not hold - the built-in definitions cover the rest. */
  private _readLegacyAttribute(customAttributes: Authoring.CustomAttributeSet, className: string, location: string): Authoring.CustomAttributeValues | undefined {
    const customAttribute = customAttributes.get(className);
    if (customAttribute === undefined)
      return undefined;
    const values = customAttribute.tryGetValues();
    if (values === undefined) {
      this._issues.addWarning("custom-attribute-class-unresolved",
        `The custom attribute "${className}" on "${location}" could not be read because its custom attribute class is not in the schema set; it was left as it is.`,
        location);
    }
    return values;
  }

  private _addCoreAttribute(customAttributes: Authoring.CustomAttributeSet, className: string, values: Authoring.CustomAttributeValues): void {
    if (!this._addedCoreReference && this._document.getSchemaReference(coreCustomAttributesSchema) === undefined) {
      this._document.setSchemaReference({ name: coreCustomAttributesSchema, readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "CoreCA" });
      this._addedCoreReference = true;
    }
    customAttributes.add({ className: `${coreCustomAttributesSchema}:${className}`, values });
  }

  /** `preferred`, or the first alternative no item in the document already answers to, falling back
   * to a numeric suffix. */
  private _uniqueItemName(preferred: string, alternatives: ReadonlyArray<string> = []): string {
    for (const candidate of [preferred, ...alternatives.map((name) => ECName.encode(name).name)]) {
      if (this._document.getItem(candidate) === undefined)
        return candidate;
    }
    const last = alternatives.length > 0 ? ECName.encode(alternatives[alternatives.length - 1]).name : preferred;
    for (let suffix = 1; ; ++suffix) {
      const candidate = `${last}_${suffix}`;
      if (this._document.getItem(candidate) === undefined)
        return candidate;
    }
  }

  /** Reports every legacy attribute still standing after the pass, so nothing is quietly carried
   * over as-is. The unit family gets its own message because the reason is specific. */
  private _reportUnconverted(): void {
    for (const { customAttribute, location } of allCustomAttributes(this._document)) {
      const schemaName = this._document.resolveSchemaName(customAttribute.className).toLowerCase();
      if (schemaName === unitAttributesSchema.toLowerCase()) {
        this._issues.addWarning("unit-legacy-vocabulary-missing",
          `The legacy unit custom attribute "${customAttribute.className}" on "${location}" was left as it is; converting it to a kind of quantity needs the legacy unit vocabulary, which this conversion does not carry.`,
          location);
      } else if (schemaName === editorSchema.toLowerCase() || schemaName === bentleyStandardSchema.toLowerCase()) {
        this._issues.addInfo("custom-attribute-not-convertible",
          `The legacy custom attribute "${customAttribute.className}" on "${location}" has no first-class equivalent and was left as it is.`,
          location);
      }
    }
  }

  /** Drops references to the legacy standard schemas once nothing in the document names them.
   * They exist only to declare custom attribute classes, so a surviving custom attribute is the
   * only thing that can still need one. */
  private _dropSpentReferences(): void {
    for (const schemaName of [editorSchema, bentleyStandardSchema, unitAttributesSchema]) {
      if (this._document.getSchemaReference(schemaName) === undefined)
        continue;
      const stillUsed = [...allCustomAttributes(this._document)]
        .some(({ customAttribute }) => this._document.resolveSchemaName(customAttribute.className).toLowerCase() === schemaName.toLowerCase());
      if (stillUsed)
        continue;
      const index = this._document.references.findIndex((reference) => reference.name.toLowerCase() === schemaName.toLowerCase());
      if (index >= 0)
        this._document.references.splice(index, 1);
    }
  }
}

/** Every custom attribute in the document, with where it sits. */
function* allCustomAttributes(document: Authoring.SchemaDocument): IterableIterator<{ customAttribute: Authoring.CustomAttribute, location: string }> {
  const emit = function* (set: Authoring.CustomAttributeSet): IterableIterator<{ customAttribute: Authoring.CustomAttribute, location: string }> {
    const location = containerLocation(document, set.container);
    for (const customAttribute of set)
      yield { customAttribute, location };
  };
  yield* emit(document.customAttributes);
  for (const ecClass of document.getItemsOfType(AbstractSchemaItemType.Class)) {
    yield* emit(ecClass.customAttributes);
    for (const property of ecClass.properties)
      yield* emit(property.customAttributes);
    if (ecClass.isRelationship()) {
      yield* emit(ecClass.source.customAttributes);
      yield* emit(ecClass.target.customAttributes);
    }
  }
}

function containerLocation(document: Authoring.SchemaDocument, container: Authoring.CustomAttributeContainer): string {
  return "fullName" in container ? container.fullName : document.name;
}

/** The class an inherited property was declared on, walking the base chain then the mixins, or
 * `undefined` when the class declares it itself and nothing above does. */
function declaringAncestor(ecClass: Authoring.AnyClass, propertyName: string): Authoring.AnyClass | undefined {
  const visited = new Set<Authoring.AnyClass>([ecClass]);
  let deepest: Authoring.AnyClass | undefined;
  const walk = (candidate: Authoring.AnyClass | undefined): void => {
    if (candidate === undefined || visited.has(candidate))
      return;
    visited.add(candidate);
    if (candidate.getProperty(propertyName) !== undefined)
      deepest = candidate;
    walk(candidate.getBaseClass());
    if (candidate.isEntity()) {
      for (const mixin of candidate.getMixins())
        walk(mixin);
    }
  };
  walk(ecClass.getBaseClass());
  if (ecClass.isEntity()) {
    for (const mixin of ecClass.getMixins())
      walk(mixin);
  }
  return deepest;
}

/** A custom attribute value as trimmed non-empty text, or `undefined`. Legacy schemas write an
 * empty element where they mean "not set". */
function readText(value: Authoring.CustomAttributeValue | undefined): string | undefined {
  if (typeof value !== "string")
    return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** The `ValueMap` entries of a `StandardValues` attribute, as value to display string. A repeated
 * value keeps the last spelling, which is what native's map does. */
function readValueMap(valueMap: Authoring.CustomAttributeValue | undefined): Map<number, string> {
  const entries = new Map<number, string>();
  if (!Array.isArray(valueMap))
    return entries;
  for (const entry of valueMap) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      continue;
    const value = entry.Value;
    const displayString = entry.DisplayString;
    if (typeof value === "number" && typeof displayString === "string")
      entries.set(value, displayString);
  }
  return entries;
}

/** The name an enumerator of a synthesized enumeration gets: the enumeration's name followed by the
 * value, encoded to a valid EC name so a negative value still yields an identifier. Matches what
 * pre-3.2 ECXML reading derives, so the enumeration survives a downgrade and re-read. */
function enumeratorName(enumerationName: string, value: number): string {
  return ECName.encode(`${enumerationName}${value}`).name;
}

/** Writes `value` at a possibly dotted path, creating the struct levels it names. */
function assignByPath(target: Authoring.CustomAttributeValues, path: string, value: Authoring.CustomAttributeValue): void {
  const segments = path.split(".");
  let current = target;
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment];
    const next = typeof existing === "object" && existing !== null && !Array.isArray(existing) ? existing : {};
    current[segment] = next;
    current = next;
  }
  current[segments[segments.length - 1]] = value;
}
