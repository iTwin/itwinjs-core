/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { AbstractParser } from "./AbstractParser";
import { AnySchemaItemProps, SchemaReferenceProps } from "./JsonProps";
import SchemaContext from "./../Context";
import { parsePrimitiveType, parseSchemaItemType, SchemaItemType } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { AnyClass, AnySchemaItem, SchemaDeserializationVisitor } from "./../Interfaces";
import ECClass, { MutableClass } from "./../Metadata/Class";
import Constant from "./../Metadata/Constant";
import { CustomAttribute } from "./../Metadata/CustomAttribute";
import EntityClass, { MutableEntityClass } from "./../Metadata/EntityClass";
import Format from "./../Metadata/Format";
import InvertedUnit from "./../Metadata/InvertedUnit";
import KindOfQuantity from "./../Metadata/KindOfQuantity";
import Mixin from "./../Metadata/Mixin";
import { Property } from "./../Metadata/Property";
import RelationshipClass, { RelationshipConstraint } from "./../Metadata/RelationshipClass";
import Schema, { MutableSchema } from "./../Metadata/Schema";
import SchemaItem from "./../Metadata/SchemaItem";
import Unit from "./../Metadata/Unit";
import SchemaKey, { ECVersion, SchemaItemKey } from "./../SchemaKey";

/**
 * The purpose of this class is to properly order the deserialization of ECSchemas and SchemaItems from the JSON formats.
 * For example, when deserializing an ECClass most times all base class should be de-serialized before the given class.
 */
export default class SchemaReadHelper {
  private _context: SchemaContext;
  private _visitor?: SchemaDeserializationVisitor;
  private _parser: AbstractParser<unknown>;

  // This is a cache of the schema we are loading. The schema also exists within the _context but in order
  // to not have to go back to the context every time we use this cache.
  private _schema?: Schema;

  private _itemToRead: any; // This will be the json object of the Schema or SchemaItem to deserialize. Not sure if this is the best option.. Going to leave it for now.

  constructor(parser: AbstractParser<unknown>, context?: SchemaContext, visitor?: SchemaDeserializationVisitor) {
    this._context = (undefined !== context) ? context : new SchemaContext();
    this._visitor = visitor;
    this._parser = parser;
  }

  /**
   * Populates the given Schema with the JSON.
   * @param schema The Schema to populate
   * @param schemaJson The JSON to use to populate the Schema.
   */
  public async readSchema<T extends Schema>(schema: T, schemaJson: object | string): Promise<T> {
    this._itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;
    const parsedItem = this._parser.parseSchemaProps(this._itemToRead);

    // Loads all of the properties on the Schema object
    await schema.deserialize(parsedItem);

    this._schema = schema;

    // Need to add this schema to the context to be able to locate schemaItems within the context.
    await this._context.addSchema(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (undefined !== parsedItem.references)
      await this.loadSchemaReferences(parsedItem.references);

    if (this._visitor && this._visitor.visitEmptySchema)
      await this._visitor.visitEmptySchema(schema);

    // Load all schema items
    if (undefined !== parsedItem.items) {
      for (const itemName in parsedItem.items) {
        // Make sure the item has not already been read. No need to check the SchemaContext because all SchemaItems are added to a Schema,
        // which would be found when adding to the context.
        if (await schema.getItem(itemName) !== undefined)
          continue;

        const loadedItem = await this.loadSchemaItem(schema, parsedItem.items[itemName], itemName);
        if (loadedItem && this._visitor) {
          await loadedItem.accept(this._visitor);
        }
      }
    }

    if (undefined !== parsedItem.customAttributes)
      await this.loadCustomAttributes(parsedItem.customAttributes);

    if (this._visitor && this._visitor.visitFullSchema)
      await this._visitor.visitFullSchema(schema);

    return schema;
  }

  /**
   * Populates the given Schema with the JSON.
   * @param schema The Schema to populate
   * @param schemaJson The JSON to use to populate the Schema.
   */
  public readSchemaSync<T extends Schema>(schema: T, schemaJson: object | string): T {
    this._itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;
    const parsedItem = this._parser.parseSchemaProps(this._itemToRead);

    // Loads all of the properties on the Schema object
    schema.deserializeSync(parsedItem);

    this._schema = schema;

    // Need to add this schema to the context to be able to locate schemaItems within the context.
    this._context.addSchemaSync(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (undefined !== parsedItem.references)
      this.loadSchemaReferencesSync(parsedItem.references);

    if (this._visitor && this._visitor.visitEmptySchema)
      this._visitor.visitEmptySchema(schema);

    // Load all schema items
    if (undefined !== parsedItem.items) {
      for (const itemName in parsedItem.items) {
        // Make sure the item has not already been read. No need to check the SchemaContext because all SchemaItems are added to a Schema,
        // which would be found when adding to the context.
        if (schema.getItemSync(itemName) !== undefined)
          continue;

        const loadedItem = this.loadSchemaItemSync(schema, parsedItem.items[itemName], itemName);
        if (loadedItem && this._visitor) {
          loadedItem.accept(this._visitor);
        }
      }
    }

    if (undefined !== parsedItem.customAttributes)
      this.loadCustomAttributesSync(parsedItem.customAttributes);

    if (this._visitor && this._visitor.visitFullSchema)
      this._visitor.visitFullSchema(schema);

    return schema;
  }

  /**
   * Ensures that the SchemaReferences can be located and then loads the references.
   * @param referencesJson The JSON to read the SchemaReference from.
   */
  private async loadSchemaReferences(schemaRefProps: SchemaReferenceProps[]): Promise<void> {
    for (const ref of schemaRefProps) {
      const schemaKey = new SchemaKey(ref.name, ECVersion.fromString(ref.version));
      const refSchema = await this._context.getSchema(schemaKey);
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the referenced schema, ${ref.name}.${ref.version}, of ${this._schema!.schemaKey.name}`);

      await (this._schema as MutableSchema).addReference(refSchema);
    }
  }

  /**
   * Ensures that the SchemaReferences can be located and then loads the references.
   * @param referencesJson The JSON to read the SchemaReference from.
   */
  private loadSchemaReferencesSync(schemaRefProps: SchemaReferenceProps[]): void {
    for (const ref of schemaRefProps) {
      const schemaKey = new SchemaKey(ref.name, ECVersion.fromString(ref.version));
      const refSchema = this._context.getSchemaSync(schemaKey);
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the referenced schema, ${ref.name}.${ref.version}, of ${this._schema!.schemaKey.name}`);

      (this._schema as MutableSchema).addReferenceSync(refSchema);
    }
  }

  /**
   * Given
   * @param schema The Schema to add this SchemaItem to.
   * @param schemaItemJson The JSON to populate the SchemaItem with.
   * @param name The name of the SchemaItem, only needed if the SchemaItem is being loaded outside the context of a Schema.
   */
  private async loadSchemaItem(schema: Schema, schemaItemJson: AnySchemaItemProps, name: string): Promise<SchemaItem | undefined> {
    const parsedItem = this._parser.parseSchemaItemProps(schemaItemJson, schema.name, name);
    let schemaItem: AnySchemaItem | undefined;

    switch (parseSchemaItemType(parsedItem.schemaItemType)) {
      case SchemaItemType.EntityClass:
        schemaItem = await (schema as MutableSchema).createEntityClass(name);
        await this.loadEntityClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.StructClass:
        schemaItem = await (schema as MutableSchema).createStructClass(name);
        await this.loadClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Mixin:
        schemaItem = await (schema as MutableSchema).createMixinClass(name);
        await this.loadMixin(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.CustomAttributeClass:
        schemaItem = await (schema as MutableSchema).createCustomAttributeClass(name);
        await this.loadClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.RelationshipClass:
        schemaItem = await (schema as MutableSchema).createRelationshipClass(name);
        await this.loadRelationshipClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.KindOfQuantity:
        schemaItem = await (schema as MutableSchema).createKindOfQuantity(name);
        await this.loadKindOfQuantity(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Unit:
        schemaItem = await (schema as MutableSchema).createUnit(name);
        await this.loadUnit(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Constant:
        schemaItem = await (schema as MutableSchema).createConstant(name);
        await this.loadConstant(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.InvertedUnit:
        schemaItem = await (schema as MutableSchema).createInvertedUnit(name);
        await this.loadInvertedUnit(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Format:
        schemaItem = await (schema as MutableSchema).createFormat(name);
        await this.loadFormat(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Phenomenon:
        schemaItem = await (schema as MutableSchema).createPhenomenon(name);
        const phenomenonProps = this._parser.parsePhenomenonProps(schemaItemJson, name);
        await schemaItem.deserialize(phenomenonProps);
        break;
      case SchemaItemType.UnitSystem:
        schemaItem = await (schema as MutableSchema).createUnitSystem(name);
        await schemaItem.deserialize(parsedItem);
        break;
      case SchemaItemType.PropertyCategory:
        schemaItem = await (schema as MutableSchema).createPropertyCategory(name);
        const propertyCategoryProps = this._parser.parsePropertyCategoryProps(schemaItemJson, name);
        await schemaItem.deserialize(propertyCategoryProps);
        break;
      case SchemaItemType.Enumeration:
        schemaItem = await (schema as MutableSchema).createEnumeration(name);
        const enumerationProps = this._parser.parseEnumerationProps(schemaItemJson, name);
        await schemaItem.deserialize(enumerationProps);
        break;
      // NOTE: we are being permissive here and allowing unknown types to silently fail. Not sure if we want to hard fail or just do a basic deserialization
    }

    return schemaItem;
  }

  /**
   * Given
   * @param schema The Schema to add this SchemaItem to.
   * @param schemaItemJson The JSON to populate the SchemaItem with.
   * @param name The name of the SchemaItem, only needed if the SchemaItem is being loaded outside the context of a Schema.
   */
  private loadSchemaItemSync(schema: Schema, schemaItemJson: AnySchemaItemProps, name: string): SchemaItem | undefined {
    const parsedItem = this._parser.parseSchemaItemProps(schemaItemJson, schema.name, name);
    let schemaItem: AnySchemaItem | undefined;

    switch (parseSchemaItemType(parsedItem.schemaItemType)) {
      case SchemaItemType.EntityClass:
        schemaItem = (schema as MutableSchema).createEntityClassSync(name);
        this.loadEntityClassSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.StructClass:
        schemaItem = (schema as MutableSchema).createStructClassSync(name);
        this.loadClassSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Mixin:
        schemaItem = (schema as MutableSchema).createMixinClassSync(name);
        this.loadMixinSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.CustomAttributeClass:
        schemaItem = (schema as MutableSchema).createCustomAttributeClassSync(name);
        this.loadClassSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.RelationshipClass:
        schemaItem = (schema as MutableSchema).createRelationshipClassSync(name);
        this.loadRelationshipClassSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.KindOfQuantity:
        schemaItem = (schema as MutableSchema).createKindOfQuantitySync(name);
        this.loadKindOfQuantitySync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Unit:
        schemaItem = (schema as MutableSchema).createUnitSync(name);
        this.loadUnitSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Constant:
        schemaItem = (schema as MutableSchema).createConstantSync(name);
        this.loadConstantSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.InvertedUnit:
        schemaItem = (schema as MutableSchema).createInvertedUnitSync(name);
        this.loadInvertedUnitSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Format:
        schemaItem = (schema as MutableSchema).createFormatSync(name);
        this.loadFormatSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Phenomenon:
        schemaItem = (schema as MutableSchema).createPhenomenonSync(name);
        const phenomenonProps = this._parser.parsePhenomenonProps(schemaItemJson, name);
        schemaItem.deserializeSync(phenomenonProps);
        break;
      case SchemaItemType.UnitSystem:
        schemaItem = (schema as MutableSchema).createUnitSystemSync(name);
        schemaItem.deserializeSync(parsedItem);
        break;
      case SchemaItemType.PropertyCategory:
        schemaItem = (schema as MutableSchema).createPropertyCategorySync(name);
        const propertyCategoryProps = this._parser.parsePropertyCategoryProps(schemaItemJson, name);
        schemaItem.deserializeSync(propertyCategoryProps);
        break;
      case SchemaItemType.Enumeration:
        schemaItem = (schema as MutableSchema).createEnumerationSync(name);
        const enumerationProps = this._parser.parseEnumerationProps(schemaItemJson, name);
        schemaItem.deserializeSync(enumerationProps);
        break;
      // NOTE: we are being permissive here and allowing unknown types to silently fail. Not sure if we want to hard fail or just do a basic deserialization
    }
    return schemaItem;
  }

  /**
   * Finds the a SchemaItem matching the fullName first by checking the schema that is being deserialized. If it does
   * not exist within the schema the SchemaContext will be searched.
   * @param fullName The full name of the SchemaItem to search for.
   * @param skipVisitor Used to break Mixin -appliesTo-> Entity -extends-> Mixin cycle.
   * @return The SchemaItem if it had to be loaded, otherwise undefined.
   */
  private async findSchemaItem(fullName: string, skipVisitor = false): Promise<SchemaItem | undefined> {
    const [schemaName, itemName] = SchemaItem.parseFullName(fullName);
    const isInThisSchema = (this._schema && this._schema.name.toLowerCase() === schemaName.toLowerCase());

    if (undefined === schemaName || schemaName.length === 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${fullName} is invalid without a schema name`);

    if (isInThisSchema && undefined === await this._schema!.getItem(itemName)) {
      const itemJson: object | undefined = this._itemToRead.items[itemName];
      if (itemJson) {
        const schemaItem = await this.loadSchemaItem(this._schema!, this._itemToRead.items[itemName], itemName);
        if (!skipVisitor && schemaItem && this._visitor) {
          await schemaItem.accept(this._visitor);
        }
        return schemaItem;
      }
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${fullName}.`);
    }

    if (undefined === await this._context.getSchemaItem(new SchemaItemKey(itemName, new SchemaKey(schemaName))))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${fullName}.`);

    return undefined;
  }

  /**
   * Load dependencies on phenomenon and unitSystem for a Unit object and load the Unit from the json
   * @param unit the Unit object that we are loading dependencies for
   * @param unitJson The JSON containing the Unit to be added to the container
   */
  private async loadUnit(unit: Unit, unitJson: any): Promise<void> {
    const unitProps = this._parser.parseUnitProps(unitJson, unit.name);

    await this.findSchemaItem(unitProps.phenomenon, true);
    await this.findSchemaItem(unitProps.unitSystem, true);

    await unit.deserialize(unitProps);
  }

  private loadUnitSync(unit: Unit, unitJson: any) {
    const unitProps = this._parser.parseUnitProps(unitJson, unit.name);

    this.findSchemaItemSync(unitProps.phenomenon, true);
    this.findSchemaItemSync(unitProps.unitSystem, true);

    unit.deserializeSync(unitProps);
  }

  /**
   * Load the persistence unit and presentation unit dependencies for a KindOfQuantity object and load the KoQ from the json
   * @param koq the kind of quantity object that we are loading the persistence unit and presentation unit dependencies for
   * @param koqJson The JSON containing the kind of quantity to be added to the container
   */
  private async loadKindOfQuantity(koq: KindOfQuantity, koqJson: any): Promise<void> {
    const koqProps = this._parser.parseKindOfQuantityProps(koqJson, koq.name);
    await koq.deserialize(koqProps);
  }

  /**
   * Load the persistence unit and presentation unit dependencies for a KindOfQuantity object and load the KoQ from the json
   * @param koq the kind of quantity object that we are loading the persistence unit and presentation unit dependencies for
   * @param koqJson The JSON containing the kind of quantity to be added to the container
   */
  private loadKindOfQuantitySync(koq: KindOfQuantity, koqJson: any) {
    const koqProps = this._parser.parseKindOfQuantityProps(koqJson, koq.name);
    koq.deserializeSync(koqProps);
  }

  /**
   * Load the phenomenon dependency for a Constant object and load the Constant from the json
   * @param constant the Constant object that we are loading the phenomenon dependency for
   * @param constantJson The JSON containing the Constant to be added to the container
   */
  private async loadConstant(constant: Constant, constantJson: any): Promise<void> {
    const constantProps = this._parser.parseConstantProps(constantJson, constant.name);

    await this.findSchemaItem(constantProps.phenomenon, true);
    await constant.deserialize(constantProps);
  }

  private loadConstantSync(constant: Constant, constantJson: any) {
    const constantProps = this._parser.parseConstantProps(constantJson, constant.name);

    this.findSchemaItemSync(constantProps.phenomenon, true);
    constant.deserializeSync(constantProps);
  }

  /**
   * Load the unit system and invertsUnit dependencies for an Inverted Unit object and load the Inverted Unit from the json
   * @param invertedUnit the inverted unit object that we are loading the unit system and invertsUnit dependencies for
   * @param invertedUnitJson The JSON containing the InvertedUnit to be added to the container
   */
  private async loadInvertedUnit(invertedUnit: InvertedUnit, invertedUnitJson: any): Promise<void> {
    const invertedUnitProps = this._parser.parseInvertedUnitProps(invertedUnitJson, invertedUnit.name);

    await this.findSchemaItem(invertedUnitProps.invertsUnit, true);
    await this.findSchemaItem(invertedUnitProps.unitSystem, true);

    await invertedUnit.deserialize(invertedUnitProps);
  }

  private loadInvertedUnitSync(invertedUnit: InvertedUnit, invertedUnitJson: any) {
    const invertedUnitProps = this._parser.parseInvertedUnitProps(invertedUnitJson, invertedUnit.name);

    this.findSchemaItemSync(invertedUnitProps.invertsUnit, true);
    this.findSchemaItemSync(invertedUnitProps.unitSystem, true);

    invertedUnit.deserializeSync(invertedUnitProps);
  }

  /**
   * Load the unit dependencies for a Format object and load the Format from the json
   * @param format the format object that we are loading the unit dependencies for
   * @param formatJson The JSON containing the Format to be added to the container
   */
  private async loadFormat(format: Format, formatJson: any): Promise<void> {
    const formatProps = this._parser.parseFormatProps(formatJson, format.name);

    if (undefined !== formatProps.composite) {
      const formatUnits = await formatProps.composite.units!;
      for (const unit of formatUnits) {
        await this.findSchemaItem(unit.name, true);
      }
    }
    await format.deserialize(formatProps);
  }

  private loadFormatSync(format: Format, formatJson: any) {
    const formatProps = this._parser.parseFormatProps(formatJson, format.name);

    if (undefined !== formatProps.composite) {
      const formatUnits = formatProps.composite.units!;
      for (const unit of formatUnits) {
        this.findSchemaItemSync(unit.name, true);
      }
    }

    format.deserializeSync(formatProps);
  }

  /*
   * Finds the a SchemaItem matching the fullName first by checking the schema that is being deserialized. If it does
   * not exist within the schema the SchemaContext will be searched.
   * @param fullName The full name of the SchemaItem to search for.
   * @param skipVisitor Used to break Mixin -appliesTo-> Entity -extends-> Mixin cycle.
   * @return The SchemaItem if it had to be loaded, otherwise undefined.
   */
  private findSchemaItemSync(fullName: string, skipVisitor = false): SchemaItem | undefined {
    const [schemaName, itemName] = SchemaItem.parseFullName(fullName);
    const isInThisSchema = (this._schema && this._schema.name.toLowerCase() === schemaName.toLowerCase());

    if (undefined === schemaName || schemaName.length === 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${fullName} is invalid without a schema name`);

    if (isInThisSchema && undefined === this._schema!.getItemSync(itemName)) {
      const itemJson: object | undefined = this._itemToRead.items[itemName];
      if (itemJson) {
        const schemaItem = this.loadSchemaItemSync(this._schema!, this._itemToRead.items[itemName], itemName);
        if (!skipVisitor && schemaItem && this._visitor) {
          schemaItem.accept(this._visitor);
        }
        return schemaItem;
      }
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${fullName}.`);
    }

    if (undefined === this._context.getSchemaItemSync(new SchemaItemKey(itemName, new SchemaKey(schemaName))))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${fullName}.`);

    return undefined;
  }

  /**
   * Given a CustomAttributeContainer and a CustomAttribute JSON it will make sure that all of the the CustomAttribute classes can be found within the context
   * of the Container.
   * @param caContainer The CustomAttribute Container to read the customAttributes within the context of.
   * @param customAttributesJson The JSON containing the customAttributes that are to be added to the container
   */
  private async loadCustomAttributes(customAttributeProps: CustomAttribute[]): Promise<void> {
    this.loadCustomAttributesSync(customAttributeProps);
  }

  /**
   * Given a CustomAttributeContainer and a CustomAttribute JSON it will make sure that all of the the CustomAttribute classes can be found within the context
   * of the Container.
   * @param caContainer The CustomAttribute Container to read the customAttributes within the context of.
   * @param customAttributesJson The JSON containing the customAttributes that are to be added to the container
   */
  private loadCustomAttributesSync(customAttributeProps: CustomAttribute[]): void {
    for (const instance of customAttributeProps) {
      this.findSchemaItem(instance.className);
    }
  }

  /**
   *
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   * @param schema The ECSchema this class exists in.
   */
  private async loadClass(classObj: AnyClass, classJson: any): Promise<void> {
    // Load base class first
    const classProps = this._parser.parseClassProps(classJson, classObj.name);
    let baseClass: undefined | SchemaItem;
    if (undefined !== classProps.baseClass) {
      baseClass = await this.findSchemaItem(classProps.baseClass, true);
    }

    // Now deserialize the class itself, *before* any properties
    // (We need to do this to break Entity -navProp-> Relationship -constraint-> Entity cycle.)
    await (classObj as ECClass).deserialize(classProps);

    if (undefined !== classProps.properties) {
      for (const property of classProps.properties) {
        await this.loadPropertyTypes(classObj, property);
      }
    }

    if (baseClass && this._visitor)
      await baseClass.accept(this._visitor);
  }

  /**
   *
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   * @param schema The ECSchema this class exists in.
   */
  private loadClassSync(classObj: AnyClass, classJson: any): void {
    // Load base class first
    const classProps = this._parser.parseClassProps(classJson, classObj.name);
    let baseClass: undefined | SchemaItem;
    if (undefined !== classProps.baseClass) {
      baseClass = this.findSchemaItemSync(classProps.baseClass, true);
    }

    // Now deserialize the class itself, *before* any properties
    // (We need to do this to break Entity -navProp-> Relationship -constraint-> Entity cycle.)
    (classObj as ECClass).deserializeSync(classProps);

    if (undefined !== classProps.properties) {
      for (const property of classProps.properties) {
        this.loadPropertyTypesSync(classObj, property);
      }
    }

    if (baseClass && this._visitor)
      baseClass.accept(this._visitor);
  }

  private async loadEntityClass(entity: EntityClass, entityJson: any): Promise<void> {
    // Load Mixin classes first
    const entityClassProps = this._parser.parseEntityClassProps(entityJson, entity.name);
    if (undefined !== entityClassProps.mixins) {
      for (const mixinName of entityClassProps.mixins) {
        await this.findSchemaItem(mixinName);
      }
    }

    await this.loadClass(entity, entityJson);
  }

  private loadEntityClassSync(entity: EntityClass, entityJson: any): void {
    // Load Mixin classes first
    const entityClassProps = this._parser.parseEntityClassProps(entityJson, entity.name);
    if (undefined !== entityClassProps.mixins) {
      for (const mixinName of entityClassProps.mixins) {
        this.findSchemaItemSync(mixinName);
      }
    }

    this.loadClassSync(entity, entityJson);
  }

  private async loadMixin(mixin: Mixin, mixinJson: any): Promise<void> {
    const mixinProps = this._parser.parseMixinProps(mixinJson, mixin.name);
    let appliesToClass: undefined | SchemaItem;
    appliesToClass = await this.findSchemaItem(mixinProps.appliesTo, true);

    await this.loadClass(mixin, mixinJson);
    if (appliesToClass && this._visitor)
      await appliesToClass.accept(this._visitor);
  }

  private loadMixinSync(mixin: Mixin, mixinJson: any): void {
    const mixinProps = this._parser.parseMixinProps(mixinJson, mixin.name);
    let appliesToClass: undefined | SchemaItem;
    appliesToClass = this.findSchemaItemSync(mixinProps.appliesTo, true);

    this.loadClassSync(mixin, mixinJson);
    if (appliesToClass && this._visitor)
      appliesToClass.accept(this._visitor);
  }

  private async loadRelationshipClass(rel: RelationshipClass, relJson: any): Promise<void> {
    const relationshipClassProps = this._parser.parseRelationshipClassProps(relJson, rel.name);

    await this.loadClass(rel, relJson);

    await this.loadRelationshipConstraint(rel.name, rel.source.isSource, rel.source, relationshipClassProps.source);
    await this.loadRelationshipConstraint(rel.name, rel.source.isSource, rel.target, relationshipClassProps.target);
  }

  private loadRelationshipClassSync(rel: RelationshipClass, relJson: any): void {
    const relationshipClassProps = this._parser.parseRelationshipClassProps(relJson, rel.name);

    this.loadClassSync(rel, relJson);

    this.loadRelationshipConstraintSync(rel.name, rel.source.isSource, rel.source, relationshipClassProps.source);
    this.loadRelationshipConstraintSync(rel.name, rel.target.isSource, rel.target, relationshipClassProps.target);
  }

  private async loadRelationshipConstraint(relClassName: string, isSource: boolean, relConstraint: RelationshipConstraint, relConstraintJson: any): Promise<void> {
    const relationshipConstraintProps = this._parser.parseRelationshipConstraintProps(relClassName, relConstraintJson, isSource);

    if (undefined !== relationshipConstraintProps.abstractConstraint) {
      await this.findSchemaItem(relationshipConstraintProps.abstractConstraint);
    }
    if (undefined !== relationshipConstraintProps.constraintClasses) { // TODO: this should be required
      for (const constraintClass of relationshipConstraintProps.constraintClasses) {
        await this.findSchemaItem(constraintClass);
      }
    }
    await relConstraint.deserialize(relationshipConstraintProps);
  }

  private loadRelationshipConstraintSync(relClassName: string, isSource: boolean, relConstraint: RelationshipConstraint, relConstraintJson: any): void {
    const relationshipConstraintProps = this._parser.parseRelationshipConstraintProps(relClassName, relConstraintJson, isSource);

    if (undefined !== relationshipConstraintProps.abstractConstraint) {
      this.findSchemaItemSync(relationshipConstraintProps.abstractConstraint);
    }
    if (undefined !== relationshipConstraintProps.constraintClasses) {
      for (const constraintClass of relationshipConstraintProps.constraintClasses) {
        this.findSchemaItemSync(constraintClass);
      }
    }

    relConstraint.deserializeSync(relationshipConstraintProps);
  }

  /**
   * Creates the property defined in the JSON in the given class.
   * @param classObj
   * @param propertyJson
   */
  private async loadPropertyTypes(classObj: AnyClass, propertyJson: any): Promise<void> {
    const propertyProps = this._parser.parsePropertyTypes(propertyJson, classObj.schema.name, classObj.name);
    const propName = propertyProps.name;

    const loadTypeName = async () => {
      if (undefined === parsePrimitiveType(propertyJson.typeName))
        await this.findSchemaItem(propertyJson.typeName);
    };

    switch (propertyProps.type) {
      case "PrimitiveProperty":
        await loadTypeName();
        const primPropertyProps = this._parser.parsePrimitivePropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const primProp = await (classObj as MutableClass).createPrimitiveProperty(propName, primPropertyProps.typeName);
        return this.loadProperty(primProp, propertyJson, classObj.schema.name, classObj.name);

      case "StructProperty":
        await loadTypeName();
        const structPropertyProps = this._parser.parseStructPropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const structProp = await (classObj as MutableClass).createStructProperty(propName, structPropertyProps.typeName);
        return this.loadProperty(structProp, propertyJson, classObj.schema.name, classObj.name);

      case "PrimitiveArrayProperty":
        await loadTypeName();
        const primArrPropertyProps = this._parser.parsePrimitiveArrayPropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const primArrProp = await (classObj as MutableClass).createPrimitiveArrayProperty(propName, primArrPropertyProps.typeName);
        return this.loadProperty(primArrProp, propertyJson, classObj.schema.name, classObj.name);

      case "StructArrayProperty":
        await loadTypeName();
        const structArrPropertyProps = this._parser.parseStructArrayPropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const structArrProp = await (classObj as MutableClass).createStructArrayProperty(propName, structArrPropertyProps.typeName);
        return this.loadProperty(structArrProp, propertyJson, classObj.schema.name, classObj.name);

      case "NavigationProperty":
        const navPropertyProps = this._parser.parseNavigationPropertyProps(propertyJson, propName, classObj);
        await this.findSchemaItem(propertyJson.relationshipName);
        const navProp = await (classObj as MutableEntityClass).createNavigationProperty(propName, navPropertyProps.relationshipName, navPropertyProps.direction);
        return this.loadProperty(navProp, propertyJson, classObj.schema.name, classObj.name);
    }
  }

  /**
   * Creates the property defined in the JSON in the given class.
   * @param classObj
   * @param propertyJson
   */
  private loadPropertyTypesSync(classObj: AnyClass, propertyJson: any): void {
    const propertyProps = this._parser.parsePropertyTypes(propertyJson, classObj.schema.name, classObj.name);
    const propName = propertyJson.name;

    const loadTypeName = () => {
      if (undefined === parsePrimitiveType(propertyJson.typeName))
        this.findSchemaItemSync(propertyJson.typeName);
    };

    switch (propertyProps.type) {
      case "PrimitiveProperty":
        loadTypeName();
        const primPropertyProps = this._parser.parsePrimitivePropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const primProp = (classObj as MutableClass).createPrimitivePropertySync(propName, primPropertyProps.typeName);
        return this.loadPropertySync(primProp, propertyJson, classObj.schema.name, classObj.name);

      case "StructProperty":
        loadTypeName();
        const structPropertyProps = this._parser.parseStructPropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const structProp = (classObj as MutableClass).createStructPropertySync(propName, structPropertyProps.typeName);
        return this.loadPropertySync(structProp, propertyJson, classObj.schema.name, classObj.name);

      case "PrimitiveArrayProperty":
        loadTypeName();
        const primArrPropertyProps = this._parser.parsePrimitiveArrayPropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const primArrProp = (classObj as MutableClass).createPrimitiveArrayPropertySync(propName, primArrPropertyProps.typeName);
        return this.loadPropertySync(primArrProp, propertyJson, classObj.schema.name, classObj.name);

      case "StructArrayProperty":
        loadTypeName();
        const structArrPropertyProps = this._parser.parseStructArrayPropertyProps(propertyJson, classObj.schema.name, classObj.name);
        const structArrProp = (classObj as MutableClass).createStructArrayPropertySync(propName, structArrPropertyProps.typeName);
        return this.loadPropertySync(structArrProp, propertyJson, classObj.schema.name, classObj.name);

      case "NavigationProperty":
        const navPropertyProps = this._parser.parseNavigationPropertyProps(propertyJson, propName, classObj);
        this.findSchemaItemSync(propertyJson.relationshipName);
        const navProp = (classObj as MutableEntityClass).createNavigationPropertySync(propName, navPropertyProps.relationshipName, navPropertyProps.direction);
        return this.loadPropertySync(navProp, propertyJson, classObj.schema.name, classObj.name);
    }
  }

  private async loadProperty<T extends Property>(prop: T, propertyJson: any, schemaName: string, className: string): Promise<void> {
    const propertyProps = this._parser.parsePropertyProps(propertyJson, schemaName, className);
    if (undefined !== propertyProps.category) {
      await this.findSchemaItem(propertyProps.category);
    }

    if (undefined !== propertyProps.kindOfQuantity) {
      await this.findSchemaItem(propertyProps.kindOfQuantity);
    }

    // TODO Load CustomAttributeClasses

    await prop.deserialize(propertyProps);
  }

  private loadPropertySync<T extends Property>(prop: T, propertyJson: any, schemaName: string, className: string): void {
    const propertyProps = this._parser.parsePropertyProps(propertyJson, schemaName, className);
    if (undefined !== propertyProps.category) {
      this.findSchemaItemSync(propertyProps.category);
    }

    if (undefined !== propertyProps.kindOfQuantity) {
      this.findSchemaItemSync(propertyProps.kindOfQuantity);
    }

    // TODO Load CustomAttributeClasses

    prop.deserializeSync(propertyProps);
  }
}
