/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AbstractParser } from "./AbstractParser";
import {
  ConstantProps, CustomAttributeClassProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, FormatProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, NavigationPropertyProps, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitiveOrEnumPropertyBaseProps, PrimitivePropertyProps, PropertyCategoryProps,
  PropertyProps, RelationshipClassProps, SchemaProps, SchemaReferenceProps, StructArrayPropertyProps, StructPropertyProps, UnitProps, SchemaItemProps, ClassProps, StructClassProps, EnumeratorProps,
  UnitSystemProps,
  RelationshipConstraintProps,
} from "./JsonProps";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { ECName } from "../SchemaKey";
import { CustomAttribute } from "../Metadata/CustomAttribute";

const NON_ITEM_SCHEMA_ELEMENTS = ["ECSchemaReference", "ECCustomAttributes"];
const INT_MAX = 2147483647;

/** @internal */
export class XmlParser extends AbstractParser<Element> {
  private _rawSchema: Document;
  private _schemaName?: string;
  private _currentItemFullName?: string;
  private _schemaItems: Map<string, [string, Element]>;
  private _mapIsPopulated: boolean;

  constructor(rawSchema: Readonly<Document>) {
    super();

    this._rawSchema = rawSchema;
    const schemaInfo = rawSchema.documentElement;

    const schemaName = schemaInfo.getAttribute("schemaName");
    if (schemaName) this._schemaName = schemaName;

    this._schemaItems = new Map<string, [string, Element]>();
    this._mapIsPopulated = false;
  }

  public parseSchema(): SchemaProps {
    const schemaMetadata = this._rawSchema.documentElement;
    if ("ECSchema" !== schemaMetadata.nodeName)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, "An ECSchema is missing the required metadata.");

    const schemaDefDuplicates = this.getElementChildrenByTagName(schemaMetadata, "ECSchema");
    if (schemaDefDuplicates.length > 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, "An ECSchema has more than one ECSchema definition. Only one is allowed.");

    if (this._schemaName === undefined)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `An ECSchema is missing a required 'schemaName' attribute`);

    const xmlns = this.getRequiredAttribute(schemaMetadata, "xmlns",
      `The ECSchema ${this._schemaName} is missing a required 'xmlns' attribute`);
    const alias = this.getRequiredAttribute(schemaMetadata, "alias",
      `The ECSchema ${this._schemaName} is missing a required 'alias' attribute`);
    const version = this.getRequiredAttribute(schemaMetadata, "version",
      `The ECSchema ${this._schemaName} is missing a required 'version' attribute`);
    const description = this.getOptionalAttribute(schemaMetadata, "description");
    const displayLabel = this.getOptionalAttribute(schemaMetadata, "displayLabel");

    const schemaProps = {
      name: this._schemaName,
      $schema: xmlns,
      version,
      alias,
      label: displayLabel,
      description,
    };

    return schemaProps;
  }

  public *getReferences(): Iterable<SchemaReferenceProps> {
    const schemaReferences = this.getElementChildrenByTagName(this._rawSchema.documentElement, "ECSchemaReference");
    for (const ref of schemaReferences) {
      yield this.getSchemaReference(ref);
    }
  }

  public *getItems(): Iterable<[string, string, Element]> {
    if (!this._mapIsPopulated) {
      const schemaItems = this.getSchemaChildren();
      for (const item of schemaItems) {
        let rawItemType = item.nodeName;
        if (NON_ITEM_SCHEMA_ELEMENTS.includes(rawItemType)) continue;

        // Differentiate a Mixin from an EntityClass
        const customAttributesResult = this.getElementChildrenByTagName(item, "ECCustomAttributes");
        if (customAttributesResult.length > 0) {
          const customAttributes = customAttributesResult[0];
          const isMixinResult = this.getElementChildrenByTagName(customAttributes, "IsMixin");
          if (isMixinResult.length > 0)
            rawItemType = "Mixin";
        }

        const itemType = this.getSchemaItemType(rawItemType);
        if (itemType === undefined)
          throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `A SchemaItem in ${this._schemaName} has an invalid type. '${rawItemType}' is not a valid SchemaItem type.`);

        const itemName = this.getRequiredAttribute(item, "typeName",
          `A SchemaItem in ${this._schemaName} is missing the required 'typeName' attribute.`);
        if (!ECName.validate(itemName))
          throw new ECObjectsError(ECObjectsStatus.InvalidECName, `A SchemaItem in ${this._schemaName} has an invalid 'typeName' attribute. '${itemName}' is not a valid ECName.`);

        this._currentItemFullName = `${this._schemaName}.${itemName}`;
        this._schemaItems.set(itemName, [itemType, item]);
        yield [itemName, itemType, item];
      }
      this._mapIsPopulated = true;
    } else {
      for (const [itemName, [itemType, item]] of this._schemaItems) {
        this._currentItemFullName = `${this._schemaName}.${itemName}`;
        yield [itemName, itemType, item];
      }
    }
  }

  public findItem(itemName: string): [string, string, Element] | undefined {
    if (!this._mapIsPopulated) {
      for (const item of this.getItems()) {
        if (item[0] === itemName) {
          this._currentItemFullName = `${this._schemaName}.${itemName}`;
          return item;
        }
      }
    } else {
      const values = this._schemaItems.get(itemName);
      if (undefined !== values) {
        const [itemType, item] = values;
        this._currentItemFullName = `${this._schemaName}.${itemName}`;
        return [itemName, itemType, item];
      }
    }

    return undefined;
  }

  public parseEntityClass(xmlElement: Element): EntityClassProps {
    const classProps = this.getClassProps(xmlElement);
    const baseClasses = this.getElementChildrenByTagName(xmlElement, "BaseClass");
    let mixinElements: Element[];
    const mixins = new Array<string>();

    // if it has just one BaseClass we assume it is a 'true' base class not a mixin
    if (baseClasses.length > 1) {
      mixinElements = baseClasses.slice(1);
      for (const mixin of mixinElements) {
        if (mixin.textContent)
          mixins.push(mixin.textContent);
      }
    }

    const entityClassProps = {
      ...classProps,
      mixins,
    };

    return entityClassProps;
  }

  public parseMixin(xmlElement: Element): MixinProps {
    const classProps = this.getClassProps(xmlElement);
    const customAttributesResult = this.getElementChildrenByTagName(xmlElement, "ECCustomAttributes");
    const missingMixinAttributeError = `The Mixin ${this._currentItemFullName} is missing the required 'IsMixin' tag.`;
    const missingAppliesToError = `The Mixin ${this._currentItemFullName} is missing the required 'AppliesToEntityClass' tag.`;

    if (customAttributesResult.length < 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, missingMixinAttributeError);

    const customAttributes = customAttributesResult[0];
    const isMixinResult = this.getElementChildrenByTagName(customAttributes, "IsMixin");
    if (isMixinResult.length < 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, missingMixinAttributeError);

    const mixinAttributes = isMixinResult[0];
    const appliesToResult = this.getElementChildrenByTagName(mixinAttributes, "AppliesToEntityClass");

    if (appliesToResult.length < 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, missingAppliesToError);

    const appliesToElement = appliesToResult[0];
    const appliesTo = appliesToElement.textContent;
    if (appliesTo === null || appliesTo.length === 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, missingAppliesToError);

    const mixinProps = {
      ...classProps,
      appliesTo,
    };

    return mixinProps;
  }

  public parseStructClass(xmlElement: Element): StructClassProps {
    return this.getClassProps(xmlElement);
  }

  public parseCustomAttributeClass(xmlElement: Element): CustomAttributeClassProps {
    const classProps = this.getClassProps(xmlElement);
    const appliesTo = this.getRequiredAttribute(xmlElement, "appliesTo",
      `The CustomAttributeClass ${this._currentItemFullName} is missing the required 'appliesTo' attribute.`);

    const customAttributeClassProps = {
      ...classProps,
      appliesTo,
    };

    return customAttributeClassProps;
  }

  public parseRelationshipClass(xmlElement: Element): RelationshipClassProps {
    const classProps = this.getClassProps(xmlElement);
    const strength = this.getRequiredAttribute(xmlElement, "strength",
      `The RelationshipClass ${this._currentItemFullName} is missing the required 'strength' attribute.`);
    const strengthDirection = this.getRequiredAttribute(xmlElement, "strengthDirection",
      `The RelationshipClass ${this._currentItemFullName} is missing the required 'strengthDirection' attribute.`);

    const sourceResult = this.getElementChildrenByTagName(xmlElement, "Source");
    if (sourceResult.length !== 1) {
      if (sourceResult.length === 0)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The RelationshipClass ${this._currentItemFullName} is missing the required Source constraint tag.`);
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The RelationshipClass ${this._currentItemFullName} has more than one Source constraint tag. Only one is allowed.`);
    }
    const source = this.getRelationshipConstraintProps(sourceResult[0], true);

    const targetResult = this.getElementChildrenByTagName(xmlElement, "Target");
    if (targetResult.length !== 1) {
      if (targetResult.length === 0)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The RelationshipClass ${this._currentItemFullName} is missing the required Target constraint tag.`);
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The RelationshipClass ${this._currentItemFullName} has more than one Target constraint tag. Only one is allowed.`);
    }
    const target = this.getRelationshipConstraintProps(targetResult[0], false);

    const relationshipClassProps = {
      ...classProps,
      strength,
      strengthDirection,
      source,
      target,
    };

    return relationshipClassProps;
  }

  public parseEnumeration(xmlElement: Element): EnumerationProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    let enumType = this.getRequiredAttribute(xmlElement, "backingTypeName",
      `The Enumeration ${this._currentItemFullName} is missing the required 'backingTypeName' attribute.`);
    enumType = enumType.toLowerCase();
    if (enumType !== "int" && enumType !== "integer" && enumType !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The Enumeration ${this._currentItemFullName} has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);

    const _isStrict = this.getRequiredAttribute(xmlElement, "isStrict",
      `The Enumeration ${this._currentItemFullName} is missing the required 'isStrict' attribute.`);
    const isStrict = this.parseBoolean(_isStrict,
      `The Enumeration ${this._currentItemFullName} has an invalid 'isStrict' attribute. It should either be "true" or "false".`);

    const enumeratorElements = this.getElementChildrenByTagName(xmlElement, "ECEnumerator");
    const enumerators = new Array<EnumeratorProps>();

    for (const element of enumeratorElements) {
      const name = this.getRequiredAttribute(element, "name",
        `The Enumeration ${this._currentItemFullName} has an enumerator that is missing the required attribute 'name'.`);

      const _value = this.getRequiredAttribute(element, "value",
        `The Enumeration ${this._currentItemFullName} has an enumerator that is missing the required attribute 'value'.`);
      let value: string | number = _value;

      if (enumType === "int" || enumType === "integer") {
        const numericValue = parseInt(_value, 10);
        if (isNaN(numericValue))
          throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The Enumeration ${this._currentItemFullName} of type "int" has an enumerator with a non-integer value.`);
        value = numericValue;
      }

      const label = this.getOptionalAttribute(element, "displayLabel");
      const description = this.getOptionalAttribute(element, "description");

      const enumeratorProps = {
        name,
        value,
        label,
        description,
      };

      enumerators.push(enumeratorProps);
    }

    const enumerationProps = {
      ...itemProps,
      type: enumType,
      isStrict,
      enumerators,
    };

    return enumerationProps;
  }

  public parseKindOfQuantity(xmlElement: Element): KindOfQuantityProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const _relativeError = this.getRequiredAttribute(xmlElement, "relativeError",
      `The KindOfQuantity ${this._currentItemFullName} is missing the required 'relativeError' attribute.`);
    const relativeError = parseFloat(_relativeError);
    if (isNaN(relativeError))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The KindOfQuantity ${this._currentItemFullName} has an invalid 'relativeError' attribute. It should be a numeric value.`);

    const _presentationUnits = this.getOptionalAttribute(xmlElement, "presentationUnits");
    let presentationUnits: string[] | undefined;
    if (_presentationUnits)
      presentationUnits = _presentationUnits.split(";");

    const persistenceUnit = this.getRequiredAttribute(xmlElement, "persistenceUnit",
      `The KindOfQuantity ${this._currentItemFullName} is missing the required 'persistenceUnit' attribute.`);

    const kindOfQuantityProps = {
      ...itemProps,
      relativeError,
      presentationUnits,
      persistenceUnit,
    };

    return kindOfQuantityProps;
  }

  public parsePropertyCategory(xmlElement: Element): PropertyCategoryProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const _priority = this.getRequiredAttribute(xmlElement, "priority",
      `The PropertyCategory ${this._currentItemFullName} is missing the required 'priority' attribute.`);
    const priority = parseInt(_priority, 10);
    if (isNaN(priority))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The PropertyCategory ${this._currentItemFullName} has an invalid 'priority' attribute. It should be a numeric value.`);

    const propertyCategoryProps = {
      ...itemProps,
      priority,
    };

    return propertyCategoryProps;
  }

  public parseUnit(xmlElement: Element): UnitProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const phenomenon = this.getRequiredAttribute(xmlElement, "phenomenon",
      `The Unit ${this._currentItemFullName} is missing the required 'phenomenon' attribute.`);
    const unitSystem = this.getRequiredAttribute(xmlElement, "unitSystem",
      `The Unit ${this._currentItemFullName} is missing the required 'unitSystem' attribute.`);
    const definition = this.getRequiredAttribute(xmlElement, "definition",
      `The Unit ${this._currentItemFullName} is missing the required 'definition' attribute.`);
    const numerator = this.getOptionalFloatAttribute(xmlElement, "numerator",
      `The Unit ${this._currentItemFullName} has an invalid 'numerator' attribute. It should be a numeric value.`);
    const denominator = this.getOptionalFloatAttribute(xmlElement, "denominator",
      `The Unit ${this._currentItemFullName} has an invalid 'denominator' attribute. It should be a numeric value.`);
    const offset = this.getOptionalFloatAttribute(xmlElement, "offset",
      `The Unit ${this._currentItemFullName} has an invalid 'offset' attribute. It should be a numeric value.`);

    const unitProps = {
      ...itemProps,
      phenomenon,
      unitSystem,
      definition,
      numerator,
      denominator,
      offset,
    };

    return unitProps;
  }

  public parseInvertedUnit(xmlElement: Element): InvertedUnitProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const invertsUnit = this.getRequiredAttribute(xmlElement, "invertsUnit",
      `The InvertedUnit ${this._currentItemFullName} is missing the required 'invertsUnit' attribute.`);
    const unitSystem = this.getRequiredAttribute(xmlElement, "unitSystem",
      `The InvertedUnit ${this._currentItemFullName} is missing the required 'unitSystem' attribute.`);

    const invertedUnitProps = {
      ...itemProps,
      invertsUnit,
      unitSystem,
    };

    return invertedUnitProps;
  }

  public parseConstant(xmlElement: Element): ConstantProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const phenomenon = this.getRequiredAttribute(xmlElement, "phenomenon",
      `The Constant ${this._currentItemFullName} is missing the required 'phenomenon' attribute.`);
    const definition = this.getRequiredAttribute(xmlElement, "definition",
      `The Constant ${this._currentItemFullName} is missing the required 'definition' attribute.`);
    const numerator = this.getOptionalFloatAttribute(xmlElement, "numerator",
      `The Constant ${this._currentItemFullName} has an invalid 'numerator' attribute. It should be a numeric value.`);
    const denominator = this.getOptionalFloatAttribute(xmlElement, "denominator",
      `The Constant ${this._currentItemFullName} has an invalid 'denominator' attribute. It should be a numeric value.`);

    const constantProps = {
      ...itemProps,
      phenomenon,
      definition,
      numerator,
      denominator,
    };

    return constantProps;
  }

  public parsePhenomenon(xmlElement: Element): PhenomenonProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const definition = this.getRequiredAttribute(xmlElement, "definition",
      `The Phenomenon ${this._currentItemFullName} is missing the required 'definition' attribute.`);

    const phenomenonProps = {
      ...itemProps,
      definition,
    };

    return phenomenonProps;
  }

  public parseFormat(xmlElement: Element): FormatProps {
    const itemProps = this.getSchemaItemProps(xmlElement);

    const formatType = this.getRequiredAttribute(xmlElement, "type",
      `The Format ${this._currentItemFullName} is missing the required 'type' attribute.`);
    const precision = this.getOptionalIntAttribute(xmlElement, "precision",
      `The Format ${this._currentItemFullName} has an invalid 'precision' attribute. It should be a numeric value.`);
    const roundFactor = this.getOptionalFloatAttribute(xmlElement, "roundFactor",
      `The Format ${this._currentItemFullName} has an invalid 'roundFactor' attribute. It should be a numeric value.`);
    const minWidth = this.getOptionalIntAttribute(xmlElement, "minWidth",
      `The Format ${this._currentItemFullName} has an invalid 'minWidth' attribute. It should be a numeric value.`);
    const showSignOption = this.getOptionalAttribute(xmlElement, "showSignOption");

    const _formatTraits = this.getRequiredAttribute(xmlElement, "formatTraits",
      `The Format ${this._currentItemFullName} is missing the required 'formatTraits' attribute.`);
    const formatTraits = _formatTraits.split("|");

    const decimalSeparator = this.getOptionalAttribute(xmlElement, "decimalSeparator");
    const thousandSeparator = this.getOptionalAttribute(xmlElement, "thousandSeparator");
    const uomSeparator = this.getOptionalAttribute(xmlElement, "uomSeparator");
    const scientificType = this.getOptionalAttribute(xmlElement, "scientificType");

    const stationOffsetSize = this.getOptionalIntAttribute(xmlElement, "stationOffsetSize",
      `The Format ${this._currentItemFullName} has an invalid 'stationOffsetSize' attribute. It should be a numeric value.`);

    const stationSeparator = this.getOptionalAttribute(xmlElement, "stationSeparator");

    let composite: object | undefined;
    const compositeResult = this.getElementChildrenByTagName(xmlElement, "Composite");
    if (compositeResult.length > 0) {
      const compositeElement = compositeResult[0];

      const spacer = this.getOptionalAttribute(compositeElement, "spacer");

      const _includeZero = this.getOptionalAttribute(compositeElement, "includeZero");
      let includeZero: boolean | undefined;
      if (_includeZero) {
        includeZero = this.parseBoolean(_includeZero,
          `The Format ${this._currentItemFullName} has a Composite with an invalid 'includeZero' attribute. It should be either "true" or "false".`);
      }

      const units = new Array<{ name: string, label?: string }>();
      const unitsResult = this.getElementChildrenByTagName(compositeElement, "Unit");
      if (unitsResult.length < 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The Format ${this._currentItemFullName} has an invalid 'Composite' element. It should have 1-4 Unit elements.`);

      for (const unit of unitsResult) {
        const name = unit.textContent;
        if (name === null || name.length === 0)
          throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The Format ${this._currentItemFullName} has a Composite with an invalid Unit. One of the Units is missing the required 'name' attribute.`);

        const label = this.getOptionalAttribute(unit, "label");
        units.push({ name, label });
      }

      composite = {
        spacer,
        includeZero,
        units,
      };
    }

    const formatProps = {
      ...itemProps,
      type: formatType,
      precision,
      roundFactor,
      minWidth,
      showSignOption,
      formatTraits,
      decimalSeparator,
      thousandSeparator,
      uomSeparator,
      scientificType,
      stationOffsetSize,
      stationSeparator,
      composite,
    };

    return formatProps as FormatProps;
  }

  public parseUnitSystem(xmlElement: Element): UnitSystemProps {
    return this.getClassProps(xmlElement);
  }

  public *getProperties(xmlElement: Element): Iterable<[string, string, Element]> {
    const propertyTagRegex = /EC((Struct(Array)?)|Array|Navigation)?Property/;
    const children = this.getElementChildrenByTagName(xmlElement, propertyTagRegex);

    for (const child of children) {
      const childType = child.nodeName;
      const propertyName = this.getRequiredAttribute(child, "propertyName",
        `An ECProperty in ${this._currentItemFullName} is missing the required 'propertyName' attribute.`);
      const propertyType = this.getPropertyType(childType);
      // This may not be needed, just a failsafe if the regex is faulty
      if (propertyType === undefined)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The ECProperty ${this._currentItemFullName}.${propertyName} has an invalid type. ${childType} is not a valid ECProperty type.`);

      yield [propertyName, propertyType, child];
    }
  }

  public parsePrimitiveProperty(xmlElement: Element): PrimitivePropertyProps {
    const propertyProps = this.getPrimitiveOrEnumPropertyBaseProps(xmlElement);
    const typeName = this.getPropertyTypeName(xmlElement);
    const primitivePropertyProps = { ...propertyProps, typeName };
    return primitivePropertyProps;
  }

  public parseStructProperty(xmlElement: Element): StructPropertyProps {
    const propertyProps = this.getPropertyProps(xmlElement);
    const typeName = this.getPropertyTypeName(xmlElement);
    const structPropertyProps = { ...propertyProps, typeName };
    return structPropertyProps;
  }

  public parseEnumerationProperty(xmlElement: Element): EnumerationPropertyProps {
    const propertyProps = this.getPrimitiveOrEnumPropertyBaseProps(xmlElement);
    const typeName = this.getPropertyTypeName(xmlElement);
    const enumerationPropertyProps = { ...propertyProps, typeName };
    return enumerationPropertyProps;
  }

  public parsePrimitiveArrayProperty(xmlElement: Element): PrimitiveArrayPropertyProps {
    const typeName = this.getPropertyTypeName(xmlElement);
    const propertyProps = this.getPrimitiveOrEnumPropertyBaseProps(xmlElement);
    const minAndMaxOccurs = this.getPropertyMinAndMaxOccurs(xmlElement);

    const primitiveArrayProps = {
      ...propertyProps,
      ...minAndMaxOccurs,
      typeName,
    };

    return primitiveArrayProps;
  }

  public parseStructArrayProperty(xmlElement: Element): StructArrayPropertyProps {
    const propertyProps = this.getPropertyProps(xmlElement);
    const typeName = this.getPropertyTypeName(xmlElement);
    const structArrayPropertyProps = { ...propertyProps, typeName };
    return structArrayPropertyProps;
  }

  public parseNavigationProperty(xmlElement: Element): NavigationPropertyProps {
    const propName = this.getPropertyName(xmlElement);
    const propertyProps = this.getPropertyProps(xmlElement);
    const relationshipName = this.getRequiredAttribute(xmlElement, "relationshipName",
      `The ECNavigationProperty ${this._currentItemFullName}.${propName} is missing the required 'relationshipName' property.`);
    const direction = this.getRequiredAttribute(xmlElement, "direction",
      `The ECNavigationProperty ${this._currentItemFullName}.${propName} is missing the required 'direction' property.`);
    const navigationPropertyProps = {
      ...propertyProps,
      relationshipName,
      direction,
    };

    return navigationPropertyProps;
  }

  public getSchemaCustomAttributes(): Iterable<CustomAttribute> {
    return this.getCustomAttributes(this._rawSchema.documentElement, "Schema", this._schemaName);
  }

  public getClassCustomAttributes(xmlElement: Element): Iterable<CustomAttribute> {
    return this.getCustomAttributes(xmlElement, "ECClass", this._currentItemFullName);
  }

  public getPropertyCustomAttributes(xmlElement: Element): Iterable<CustomAttribute> {
    const propName = this.getPropertyName(xmlElement);
    return this.getCustomAttributes(xmlElement, "ECProperty", `${this._currentItemFullName}.${propName}`);
  }

  public getRelationshipConstraintCustomAttributes(xmlElement: Element): [Iterable<CustomAttribute> /* source */, Iterable<CustomAttribute> /* target */] {
    const sourceResult = this.getElementChildrenByTagName(xmlElement, "Source");
    if (sourceResult.length < 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The RelationshipClass ${this._currentItemFullName} is missing the required Source constraint tag.`);
    const sourceElement = sourceResult[0];
    const sourceCustomAttributes = this.getCustomAttributes(sourceElement, "Source Constraint of", this._currentItemFullName);

    const targetResult = this.getElementChildrenByTagName(xmlElement, "Target");
    if (targetResult.length < 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The RelationshipClass ${this._currentItemFullName} is missing the required Target constraint tag.`);
    const targetElement = targetResult[0];
    const targetCustomAttributes = this.getCustomAttributes(targetElement, "Source Constraint of", this._currentItemFullName);

    return [sourceCustomAttributes, targetCustomAttributes];
  }

  private getElementChildren(xmlElement: Element): Element[] {
    // NodeListOf<T> does not define [Symbol.iterator]
    const children = Array.from(xmlElement.childNodes).filter((child) => {
      // (node.nodeType === 1) implies instanceof Element
      // https://developer.mozilla.org/en-US/docs/Web/API/ParentNode/children#Polyfill
      return child.nodeType === 1;
    });
    return children as Element[];
  }

  private getElementChildrenByTagName(xmlElement: Element, tagName: string | RegExp): Element[] {
    const children = this.getElementChildren(xmlElement);
    if ("*" === tagName)
      return children;

    let result = new Array<Element>();
    if (typeof tagName === "string") {
      result = children.filter((child) => {
        return tagName.toLowerCase() === child.nodeName.toLowerCase();
      });
    } else {
      result = children.filter((child) => {
        return tagName.test(child.nodeName);
      });
    }

    return result;
  }

  private getOptionalAttribute(xmlElement: Element, attributeName: string): string | undefined {
    if (!xmlElement.hasAttribute(attributeName))
      return undefined;
    const result = xmlElement.getAttribute(attributeName);

    // The typings for the return value of getAttribute do not match that of xmldom
    // xmldom returns an empty string instead of null
    // However Typescript will still treat result as a union type without this check
    // Hence this is needed for tsc to compile
    if (result === null)
      return undefined;
    return result;
  }

  private getOptionalFloatAttribute(xmlElement: Element, attributeName: string, parseErrorMsg: string): number | undefined {
    const _result = this.getOptionalAttribute(xmlElement, attributeName);
    let result: number | undefined;
    if (_result) {
      result = parseFloat(_result);
      if (isNaN(result))
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, parseErrorMsg);
    }
    return result;
  }

  private getOptionalIntAttribute(xmlElement: Element, attributeName: string, parseErrorMsg: string): number | undefined {
    const _result = this.getOptionalAttribute(xmlElement, attributeName);
    let result: number | undefined;
    if (_result) {
      result = parseInt(_result, 10);
      if (isNaN(result))
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, parseErrorMsg);
    }
    return result;
  }

  private parseBoolean(text: string, parseErrorMsg: string): boolean {
    const _text = text.toLowerCase();
    if (_text === "true") return true;
    else if (_text === "false") return false;
    else throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, parseErrorMsg);
  }

  private getRequiredAttribute(xmlElement: Element, attributeName: string, errorMsg: string): string {
    if (!xmlElement.hasAttribute(attributeName))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, errorMsg);
    const result = xmlElement.getAttribute(attributeName);
    if (result === null)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, errorMsg);
    return result;
  }

  private getSchemaReference(xmlElement: Element): SchemaReferenceProps {
    const name = this.getRequiredAttribute(xmlElement, "name",
      `The schema ${this._schemaName} has an invalid ECSchemaReference attribute. One of the references is missing the required 'name' attribute.`);
    const version = this.getRequiredAttribute(xmlElement, "version",
      `The schema ${this._schemaName} has an invalid ECSchemaReference attribute. One of the references is missing the required 'version' attribute.`);

    const schemaRef = {
      name,
      version,
    };

    return schemaRef;
  }

  private getSchemaItemType(rawType: string): string | undefined {
    switch (rawType.toLowerCase()) {
      case "ecentityclass": return "EntityClass";
      case "mixin": return "Mixin";
      case "structclass": return "StructClass";
      case "eccustomattributeclass": return "CustomAttributeClass";
      case "ecrelationshipclass": return "RelationshipClass";
      case "ecenumeration": return "Enumeration";
      case "kindofquantity": return "KindOfQuantity";
      case "propertycategory": return "PropertyCategory";
      case "unit": return "Unit";
      case "invertedunit": return "InvertedUnit";
      case "constant": return "Constant";
      case "phenomenon": return "Phenomenon";
      case "unitsystem": return "UnitSystem";
      case "format": return "Format";
    }
    return undefined;
  }

  private getSchemaChildren(): Element[] {
    const schemaMetadata = this._rawSchema.documentElement;
    const schemaItems = this.getElementChildren(schemaMetadata);
    return schemaItems;
  }

  private getSchemaItemProps(xmlElement: Element): SchemaItemProps {
    const displayLabel = this.getOptionalAttribute(xmlElement, "displayLabel");
    const description = this.getOptionalAttribute(xmlElement, "description");

    const schemaItemProps = {
      description,
      label: displayLabel,
    };

    return schemaItemProps;
  }

  private getClassProps(xmlElement: Element): ClassProps {
    const itemProps = this.getSchemaItemProps(xmlElement);
    const modifier = this.getOptionalAttribute(xmlElement, "modifier");

    let _baseClass: string | null = null;
    const baseClasses = this.getElementChildrenByTagName(xmlElement, "BaseClass");
    if (baseClasses.length > 0) {
      // We are assuming here that the first BaseClass is the 'real' one - the rest are mixins
      // This is not a finalized approach as this could lead to unsupported schemas
      _baseClass = baseClasses[0].textContent;
    }

    const baseClass = _baseClass ? _baseClass : undefined;

    const schemaClassProps = {
      ...itemProps,
      modifier,
      baseClass,
    };

    return schemaClassProps;
  }

  private getRelationshipConstraintProps(xmlElement: Element, isSource: boolean): RelationshipConstraintProps {
    const constraintName = `${(isSource) ? "Source" : "Target"} Constraint of ${this._currentItemFullName}`;

    const multiplicity = this.getRequiredAttribute(xmlElement, "multiplicity",
      `The ${constraintName} is missing the required 'multiplicity' attribute.`);
    const roleLabel = this.getRequiredAttribute(xmlElement, "roleLabel",
      `The ${constraintName} is missing the required 'roleLabel' attribute.`);

    const _polymorphic = this.getRequiredAttribute(xmlElement, "polymorphic",
      `The ${constraintName} is missing the required 'polymorphic' attribute.`);
    const polymorphic = this.parseBoolean(_polymorphic,
      `The ${constraintName} has an invalid 'polymorphic' attribute. It should either be "true" or "false".`);

    const abstractConstraint = this.getOptionalAttribute(xmlElement, "abstractConstraint");

    const constraintClasses = new Array<string>();
    const constraintClassesResult = this.getElementChildrenByTagName(xmlElement, "Class");
    if (constraintClassesResult.length < 1)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The ${constraintName} is missing the required Class tags.`);

    for (const constraintClass of constraintClassesResult) {
      const constraintClassId = constraintClass.getAttribute("class");
      if (constraintClassId === null || constraintClassId.length === 0)
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The ${constraintName} has a Class that is missing the required 'class' attribute.`);
      constraintClasses.push(constraintClassId);
    }

    const relationshipConstraintProps = {
      multiplicity,
      roleLabel,
      polymorphic,
      abstractConstraint,
      constraintClasses,
    };

    return relationshipConstraintProps;
  }

  private getPropertyType(propType: string): string | undefined {
    switch (propType) {
      case "ECNavigationProperty": return "navigationproperty";
      case "ECStructProperty": return "structproperty";
      case "ECArrayProperty": return "primitivearrayproperty";
      case "ECStructArrayProperty": return "structarrayproperty";
      case "ECProperty": return "primitiveproperty";
      default: return undefined;
    }
  }

  private getPropertyName(xmlElement: Element): string {
    return this.getRequiredAttribute(xmlElement, "propertyName",
      `An ECProperty in ${this._currentItemFullName} is missing the required 'propertyName' attribute.`);
  }

  private getPropertyProps(xmlElement: Element): PropertyProps {
    const propName = this.getPropertyName(xmlElement);

    const propType = this.getPropertyType(xmlElement.nodeName);
    if (propType === undefined)
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The ECProperty ${this._currentItemFullName}.${propName} has an invalid type. ${propType} is not a valid ECProperty type.`);

    const label = this.getOptionalAttribute(xmlElement, "displayLabel");
    const description = this.getOptionalAttribute(xmlElement, "description");

    const _isReadOnly = this.getOptionalAttribute(xmlElement, "isReadOnly");
    let isReadOnly: boolean | undefined;
    if (_isReadOnly) {
      isReadOnly = this.parseBoolean(_isReadOnly,
        `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'isReadOnly' attribute. It should be either "true" or "false".`);
    }

    const category = this.getOptionalAttribute(xmlElement, "category");

    const priority = this.getOptionalIntAttribute(xmlElement, "priority",
      `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'priority' attribute. It should be a numeric value.`);

    const _inherited = this.getOptionalAttribute(xmlElement, "inherited");
    let inherited: boolean | undefined;
    if (_inherited) {
      inherited = this.parseBoolean(_inherited,
        `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'inherited' attribute. It should be either "true" or "false".`);
    }

    const kindOfQuantity = this.getOptionalAttribute(xmlElement, "kindOfQuantity");

    const propertyProps = {
      name: propName,
      type: propType,
      description,
      label,
      isReadOnly,
      category,
      priority,
      inherited,
      kindOfQuantity,
    };

    return propertyProps;
  }

  private getPropertyTypeName(xmlElement: Element): string {
    const propName = this.getPropertyName(xmlElement);
    return this.getRequiredAttribute(xmlElement, "typeName",
      `The ECProperty ${this._currentItemFullName}.${propName} is missing the required 'typeName' attribute.`);
  }

  private getPrimitiveOrEnumPropertyBaseProps(xmlElement: Element): PrimitiveOrEnumPropertyBaseProps {
    const propertyProps = this.getPropertyProps(xmlElement);
    const propName = propertyProps.name;
    const extendedTypeName = this.getOptionalAttribute(xmlElement, "extendedTypeName");
    const minLength = this.getOptionalIntAttribute(xmlElement, "minimumLength",
      `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'minimumLength' attribute. It should be a numeric value.`);
    const maxLength = this.getOptionalIntAttribute(xmlElement, "maximumLength",
      `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'maximumLength' attribute. It should be a numeric value.`);
    const minValue = this.getOptionalIntAttribute(xmlElement, "minimumValue",
      `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'minimumValue' attribute. It should be a numeric value.`);
    const maxValue = this.getOptionalIntAttribute(xmlElement, "maximumValue",
      `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'maximumValue' attribute. It should be a numeric value.`);

    const primitiveOrEnumPropertyBaseProps = {
      ...propertyProps,
      extendedTypeName,
      minLength,
      maxLength,
      minValue,
      maxValue,
    };

    return primitiveOrEnumPropertyBaseProps;
  }

  private getPropertyMinAndMaxOccurs(xmlElement: Element): { minOccurs: number | undefined; maxOccurs: number | undefined; } {
    const propName = this.getPropertyName(xmlElement);
    const minOccurs = this.getOptionalIntAttribute(xmlElement, "minOccurs",
      `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'minOccurs' attribute. It should be a numeric value.`);

    const maxOccursStr = this.getOptionalAttribute(xmlElement, "maxOccurs");
    let maxOccurs: number | undefined;
    if ("unbounded" === maxOccursStr)
      maxOccurs = INT_MAX;
    else if (undefined !== maxOccursStr) {
      maxOccurs = parseInt(maxOccursStr, 10);
      if (isNaN(maxOccurs))
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaXML, `The ECProperty ${this._currentItemFullName}.${propName} has an invalid 'maxOccurs' attribute. It should be a numeric value.`);
    }

    const requestedProps = { minOccurs, maxOccurs };
    return requestedProps;
  }

  // Unsupported in this stage of deserialization
  private *getCustomAttributes(_xmlElement: Element, _type: string, _name?: string): Iterable<CustomAttribute> {

  }
}
