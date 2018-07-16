/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaContext } from "../Context";
import { SchemaKey, relationshipEndToString, SchemaItemKey, SchemaItemType, parsePrimitiveType, parseSchemaItemType, ECVersion } from "../ECObjects";
import SchemaItem from "../Metadata/SchemaItem";
import Schema, { MutableSchema } from "../Metadata/Schema";
import EntityClass, { MutableEntityClass } from "../Metadata/EntityClass";
import Mixin from "../Metadata/Mixin";
import RelationshipClass, { RelationshipConstraint } from "../Metadata/RelationshipClass";
import { AnyClass, SchemaDeserializationVisitor, AnySchemaItem } from "../Interfaces";
import { Property } from "../Metadata/Property";
import { MutableClass } from "../Metadata/Class";
import KindOfQuantity from "../Metadata/KindOfQuantity";
import { formatStringRgx } from "../Metadata/KindOfQuantityEC32"; // should be in KoQ EC32
import Unit from "../Metadata/Unit";
import Constant from "../Metadata/Constant";
import InvertedUnit from "../Metadata/InvertedUnit";
import Format from "../Metadata/Format";

/**
 * The purpose of this class is to properly order the deserialization of ECSchemas and SchemaItems from the JSON formats.
 * For example, when deserializing an ECClass most times all base class should be de-serialized before the given class.
 */
export default class SchemaReadHelper {
  private _context: SchemaContext;
  private _visitor?: SchemaDeserializationVisitor;

  // This is a cache of the schema we are loading. The schema also exists within the _context but in order
  // to not have to go back to the context every time we use this cache.
  private _schema?: Schema;

  private _itemToRead: any; // This will be the json object of the Schema or SchemaItem to deserialize. Not sure if this is the best option.. Going to leave it for now.

  constructor(context?: SchemaContext, visitor?: SchemaDeserializationVisitor) {
    this._context = (undefined !== context) ? context : new SchemaContext();
    this._visitor = visitor;
  }

  /**
   * Populates the given Schema with the JSON.
   * @param schema The Schema to populate
   * @param schemaJson The JSON to use to populate the Schema.
   */
  public async readSchema<T extends Schema>(schema: T, schemaJson: object | string): Promise<T> {
    this._itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // Loads all of the properties on the Schema object
    await schema.fromJson(this._itemToRead);

    this._schema = schema;

    // Need to add this schema to the context to be able to locate schemaItems within the context.
    await this._context.addSchema(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (undefined !== this._itemToRead.references)
      await this.loadSchemaReferences(this._itemToRead.references);

    if (this._visitor && this._visitor.visitEmptySchema)
      await this._visitor.visitEmptySchema(schema);

    // Load all schema items
    if (undefined !== this._itemToRead.items) {
      if (typeof(this._itemToRead.items) !== "object" || Array.isArray(this._itemToRead.items))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'items' property. It should be of type 'object'.`);

      for (const itemName in this._itemToRead.items) {
        // Make sure the item has not already been read. No need to check the SchemaContext because all SchemaItems are added to a Schema,
        // which would be found when adding to the context.
        if (await schema.getItem(itemName, false) !== undefined)
          continue;

        const loadedItem = await this.loadSchemaItem(schema, this._itemToRead.items[itemName], itemName);
        if (loadedItem && this._visitor) {
          await loadedItem.accept(this._visitor);
        }
      }
    }

    if (this._itemToRead.customAttributes)
      await this.loadCustomAttributes(this._itemToRead.customAttributes);

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

    // Loads all of the properties on the Schema object
    schema.fromJsonSync(this._itemToRead);

    this._schema = schema;

    // Need to add this schema to the context to be able to locate schemaItems within the context.
    this._context.addSchemaSync(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (undefined !== this._itemToRead.references)
      this.loadSchemaReferencesSync(this._itemToRead.references);

    if (this._visitor && this._visitor.visitEmptySchema)
      this._visitor.visitEmptySchema(schema);

    // Load all schema items
    if (undefined !== this._itemToRead.items) {
      if (typeof(this._itemToRead.items) !== "object" || Array.isArray(this._itemToRead.items))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'items' property. It should be of type 'object'.`);

      for (const itemName in this._itemToRead.items) {
        // Make sure the item has not already been read. No need to check the SchemaContext because all SchemaItems are added to a Schema,
        // which would be found when adding to the context.
        if (schema.getItemSync(itemName, false) !== undefined)
          continue;

        const loadedItem = this.loadSchemaItemSync(schema, this._itemToRead.items[itemName], itemName);
        if (loadedItem && this._visitor) {
          loadedItem.accept(this._visitor);
        }
      }
    }

    if (this._itemToRead.customAttributes)
      this.loadCustomAttributesSync(this._itemToRead.customAttributes);

    if (this._visitor && this._visitor.visitFullSchema)
      this._visitor.visitFullSchema(schema);

    return schema;
  }

  private checkSchemaReference(ref: any): void {
    if (typeof(ref) !== "object")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. It should be of type 'object[]'.`);
    if (undefined === ref.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'name' property.`);
    if (typeof(ref.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. One of the references has an invalid 'name' property. It should be of type 'string'.`);
    if (undefined === ref.version)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'version' property.`);
    if (typeof(ref.version) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. One of the references has an invalid 'version' property. It should be of type 'string'.`);
  }

  /**
   * Ensures that the SchemaReferences can be located and then loads the references.
   * @param referencesJson The JSON to read the SchemaReference from.
   */
  private async loadSchemaReferences(referencesJson: any): Promise<void> {
    if (!Array.isArray(referencesJson))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. It should be of type 'object[]'.`);

    for (const ref of referencesJson) {
      this.checkSchemaReference(ref);
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
  private loadSchemaReferencesSync(referencesJson: any): void {
    if (!Array.isArray(referencesJson))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema!.schemaKey.name} has an invalid 'references' property. It should be of type 'object[]'.`);

    for (const ref of referencesJson) {
      this.checkSchemaReference(ref);
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
  private async loadSchemaItem(schema: Schema, schemaItemJson: any, name?: string): Promise<SchemaItem | undefined> {
    const itemName = (undefined === name) ? schemaItemJson.name : name;
    if (!itemName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `A SchemaItem in ${this._schema!.schemaKey.name} has an invalid name.`);

    if (undefined === schemaItemJson)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${itemName} does not exist.`);

    if (undefined === schemaItemJson.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${itemName} is missing the required schemaItemType property.`);

    if (typeof(schemaItemJson.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${itemName} has an invalid 'schemaItemType' property. It should be of type 'string'.`);

    let schemaItem: AnySchemaItem | undefined;

    switch (parseSchemaItemType(schemaItemJson.schemaItemType)) {
      case SchemaItemType.EntityClass:
        schemaItem = await (schema as MutableSchema).createEntityClass(itemName);
        await this.loadEntityClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.StructClass:
        schemaItem = await (schema as MutableSchema).createStructClass(itemName);
        await this.loadClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Mixin:
        schemaItem = await (schema as MutableSchema).createMixinClass(itemName);
        await this.loadMixin(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.CustomAttributeClass:
        schemaItem = await (schema as MutableSchema).createCustomAttributeClass(itemName);
        await this.loadClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.RelationshipClass:
        schemaItem = await (schema as MutableSchema).createRelationshipClass(itemName);
        await this.loadRelationshipClass(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.KindOfQuantity:
        schemaItem = await (schema as MutableSchema).createKindOfQuantity(itemName);
        if (Schema.ec32)
          await this.loadKindOfQuantity(schemaItem, schemaItemJson);
        else
          await schemaItem.fromJson(schemaItemJson);
        break;
      case SchemaItemType.Unit:
        schemaItem = await (schema as MutableSchema).createUnit(itemName);
        await this.loadUnit(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Constant:
        schemaItem = await (schema as MutableSchema).createConstant(itemName);
        await this.loadConstant(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.InvertedUnit:
        schemaItem = await (schema as MutableSchema).createInvertedUnit(itemName);
        await this.loadInvertedUnit(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Format:
        schemaItem = await (schema as MutableSchema).createFormat(itemName);
        await this.loadFormat(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Phenomenon:
        schemaItem = await (schema as MutableSchema).createPhenomenon(itemName);
        await schemaItem.fromJson(schemaItemJson);
        break;
      case SchemaItemType.UnitSystem:
        schemaItem = await (schema as MutableSchema).createUnitSystem(itemName);
        await schemaItem.fromJson(schemaItemJson);
        break;
      case SchemaItemType.PropertyCategory:
        schemaItem = await (schema as MutableSchema).createPropertyCategory(itemName);
        await schemaItem.fromJson(schemaItemJson);
        break;
      case SchemaItemType.Enumeration:
        schemaItem = await (schema as MutableSchema).createEnumeration(itemName);
        await schemaItem.fromJson(schemaItemJson);
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
  private loadSchemaItemSync(schema: Schema, schemaItemJson: any, name?: string): SchemaItem | undefined {
    const itemName = (undefined === name) ? schemaItemJson.name : name;
    if (!itemName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `A SchemaItem in ${this._schema!.schemaKey.name} has an invalid name.`);

    if (undefined === schemaItemJson)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${itemName} does not exist.`);

    if (undefined === schemaItemJson.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${itemName} is missing the required schemaItemType property.`);

    if (typeof(schemaItemJson.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${itemName} has an invalid 'schemaItemType' property. It should be of type 'string'.`);

    let schemaItem: AnySchemaItem | undefined;

    switch (parseSchemaItemType(schemaItemJson.schemaItemType)) {
       case SchemaItemType.EntityClass:
        schemaItem = (schema as MutableSchema).createEntityClassSync(itemName);
        this.loadEntityClassSync(schemaItem, schemaItemJson);
        break;
       case SchemaItemType.StructClass:
        schemaItem = (schema as MutableSchema).createStructClassSync(itemName);
        this.loadClassSync(schemaItem, schemaItemJson);
        break;
       case SchemaItemType.Mixin:
        schemaItem = (schema as MutableSchema).createMixinClassSync(itemName);
        this.loadMixinSync(schemaItem, schemaItemJson);
        break;
       case SchemaItemType.CustomAttributeClass:
        schemaItem = (schema as MutableSchema).createCustomAttributeClassSync(itemName);
        this.loadClassSync(schemaItem, schemaItemJson);
        break;
       case SchemaItemType.RelationshipClass:
        schemaItem = (schema as MutableSchema).createRelationshipClassSync(itemName);
        this.loadRelationshipClassSync(schemaItem, schemaItemJson);
        break;
       case SchemaItemType.PropertyCategory:
        schemaItem = (schema as MutableSchema).createPropertyCategorySync(itemName);
        schemaItem.fromJsonSync(schemaItemJson);
        break;
       case SchemaItemType.Enumeration:
        schemaItem = (schema as MutableSchema).createEnumerationSync(itemName);
        schemaItem.fromJsonSync(schemaItemJson);
        break;
      case SchemaItemType.KindOfQuantity:
        schemaItem = (schema as MutableSchema).createKindOfQuantitySync(itemName);
        this.loadKindOfQuantitySync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Unit:
        schemaItem = (schema as MutableSchema).createUnitSync(itemName);
        this.loadUnitSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Constant:
        schemaItem = (schema as MutableSchema).createConstantSync(itemName);
        this.loadConstantSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.InvertedUnit:
        schemaItem = (schema as MutableSchema).createInvertedUnitSync(itemName);
        this.loadInvertedUnitSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Format:
        schemaItem = (schema as MutableSchema).createFormatSync(itemName);
        this.loadFormatSync(schemaItem, schemaItemJson);
        break;
      case SchemaItemType.Phenomenon:
        schemaItem = (schema as MutableSchema).createPhenomenonSync(itemName);
        schemaItem.fromJsonSync(schemaItemJson);
        break;
      case SchemaItemType.UnitSystem:
        schemaItem = (schema as MutableSchema).createUnitSystemSync(itemName);
        schemaItem.fromJsonSync(schemaItemJson);
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

    if (isInThisSchema && undefined === await this._schema!.getItem(itemName, false)) {
      const schemaItem = await this.loadSchemaItem(this._schema!, this._itemToRead.items[itemName], itemName);
      if (!skipVisitor && schemaItem && this._visitor) {
        await schemaItem.accept(this._visitor);
      }
      return schemaItem;
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
    if (undefined !== unitJson.phenomenon) {
      if (typeof(unitJson.phenomenon) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${unit.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
      await this.findSchemaItem(unitJson.phenomenon, true);
    }
    if (undefined !== unitJson.unitSystem ) {
      if (typeof(unitJson.unitSystem ) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${unit.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
      await this.findSchemaItem(unitJson.unitSystem , true);
    }

    await unit.fromJson(unitJson);
  }

  private loadUnitSync(unit: Unit, unitJson: any) {
    if (undefined !== unitJson.phenomenon) {
      if (typeof(unitJson.phenomenon) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${unit.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
      this.findSchemaItemSync(unitJson.phenomenon, true);
    }
    if (undefined !== unitJson.unitSystem ) {
      if (typeof(unitJson.unitSystem ) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${unit.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
      this.findSchemaItemSync(unitJson.unitSystem , true);
    }

    unit.fromJsonSync(unitJson);
  }

  /**
   * Load the persistence unit and presentation unit dependencies for a KindOfQuantity object and load the KoQ from the json
   * @param koq the kind of quantity object that we are loading the persistence unit and presentation unit dependencies for
   * @param koqJson The JSON containing the kind of quantity to be added to the container
   */
  private async loadKindOfQuantity(koq: KindOfQuantity, koqJson: any): Promise<void> {
    let index = 4;
    if (undefined !== koqJson.persistenceUnit) {
      if (typeof(koqJson.persistenceUnit) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Kind Of Quantity ${koq.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);
      await this.findSchemaItem(koqJson.persistenceUnit, true);
    }
    if (undefined !== koqJson.presentationUnits) {
      if (!Array.isArray(koqJson.presentationUnits) && typeof(koqJson.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Kind Of Quantity ${koq.name} has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
      const presUnits = (Array.isArray(koqJson.presentationUnits)) ? koqJson.presentationUnits : (koqJson.presentationUnits).split(";");
      for (const formatString of presUnits) {
        const match = formatString.split(formatStringRgx);
        await this.findSchemaItem(match[1], true); // will throw ECObjectsError if it cant find the FormatName
        while ( index < match.length - 1 ) { // index 0 and 21 are empty strings
          if ( match[index] !== undefined) {
            await this.findSchemaItem(match[index + 1], true); // find unit by name
          } else
            break;
          index += 4;
        }
      }
    }
    await koq.fromJson(koqJson);
  }

  private loadKindOfQuantitySync(koq: KindOfQuantity, koqJson: any) {
    let index = 4;
    if (undefined !== koqJson.persistenceUnit) {
      if (typeof(koqJson.persistenceUnit) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Kind Of Quantity ${koq.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);
      this.findSchemaItemSync(koqJson.persistenceUnit, true);
    }
    if (undefined !== koqJson.presentationUnits) {
      if (!Array.isArray(koqJson.presentationUnits) && typeof(koqJson.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Kind Of Quantity ${koq.name} has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
      const presUnits = (Array.isArray(koqJson.presentationUnits)) ? koqJson.presentationUnits : (koqJson.presentationUnits).split(";");
      for (const formatString of presUnits) {
        const match = formatString.split(formatStringRgx);
        this.findSchemaItemSync(match[1], true); // will throw ECObjectsError if it cant find the FormatName
        while ( index < match.length - 1 ) { // index 0 and 21 are empty strings
          if ( match[index] !== undefined) {
            this.findSchemaItemSync(match[index + 1], true); // find unit by name
          } else
            break;
          index += 4;
        }
      }
    }
    koq.fromJsonSync(koqJson);
  }

  /**
   * Load the phenomenon dependency for a Constant object and load the Constant from the json
   * @param constant the Constant object that we are loading the phenomenon dependency for
   * @param constantJson The JSON containing the Constant to be added to the container
   */
  private async loadConstant(constant: Constant, constantJson: any): Promise<void> {
    if (undefined !== constantJson.phenomenon) {
      if (typeof(constantJson.phenomenon) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${constant.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
      await this.findSchemaItem(constantJson.phenomenon, true);
    }
    await constant.fromJson(constantJson);
  }

  private loadConstantSync(constant: Constant, constantJson: any) {
    if (undefined !== constantJson.phenomenon) {
      if (typeof(constantJson.phenomenon) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${constant.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
      this.findSchemaItemSync(constantJson.phenomenon, true);
    }
    constant.fromJsonSync(constantJson);
  }

  /**
   * Load the unit system and invertsUnit dependencies for an Inverted Unit object and load the Inverted Unit from the json
   * @param invertedUnit the inverted unit object that we are loading the unit system and invertsUnit dependencies for
   * @param invertedUnitJson The JSON containing the InvertedUnit to be added to the container
   */
  private async loadInvertedUnit(invertedUnit: InvertedUnit, invertedUnitJson: any): Promise<void> {
    if (undefined !== invertedUnitJson.invertsUnit) {
      if (typeof(invertedUnitJson.invertsUnit) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Inverted Unit ${invertedUnit.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
      await this.findSchemaItem(invertedUnitJson.invertsUnit, true);
    }
    if (undefined !== invertedUnitJson.unitSystem) {
      if (typeof(invertedUnitJson.unitSystem) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Inverted Unit ${invertedUnit.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
      await this.findSchemaItem(invertedUnitJson.unitSystem, true);
    }
    await invertedUnit.fromJson(invertedUnitJson);
  }

  private loadInvertedUnitSync(invertedUnit: InvertedUnit, invertedUnitJson: any) {
    if (undefined !== invertedUnitJson.invertsUnit) {
      if (typeof(invertedUnitJson.invertsUnit) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Inverted Unit ${invertedUnit.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
      this.findSchemaItemSync(invertedUnitJson.invertsUnit, true);
    }
    if (undefined !== invertedUnitJson.unitSystem) {
      if (typeof(invertedUnitJson.unitSystem) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Inverted Unit ${invertedUnit.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
      this.findSchemaItemSync(invertedUnitJson.unitSystem, true);
    }
    invertedUnit.fromJsonSync(invertedUnitJson);
  }

  /**
   * Load the unit dependencies for a Format object and load the Format from the json
   * @param format the format object that we are loading the unit dependencies for
   * @param formatJson The JSON containing the Format to be added to the container
   */
  private async loadFormat(format: Format, formatJson: any): Promise<void> {
    if (undefined !== formatJson.composite && undefined !== formatJson.composite.units) {
      if (!Array.isArray(formatJson.composite.units))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${format.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
      if (formatJson.composite.units.length > 0 && formatJson.composite.units.length <= 4) { // Composite requires 1-4 units
        const formatUnits = await formatJson.composite.units;
        for (const unit of formatUnits) {
          await this.findSchemaItem(unit.name, true);
        }
      } else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${format.name} has an invalid 'Composite' attribute. It must have 1-4 units.`);
    } else if ( undefined !== formatJson.composite && undefined === formatJson.composite.units ) // if you have a composite without any units that is an error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${format.name} has an invalid 'Composite' attribute. It must have 1-4 units.`);

    await format.fromJson(formatJson);
  }

  private loadFormatSync(format: Format, formatJson: any) {
    if (undefined !== formatJson.composite && undefined !== formatJson.composite.units) {
      if (!Array.isArray(formatJson.composite.units))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${format.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
      if (formatJson.composite.units.length > 0 && formatJson.composite.units.length <= 4) { // Composite requires 1-4 units
        const formatUnits = formatJson.composite.units;
        for (const unit of formatUnits) {
          this.findSchemaItemSync(unit.name, true);
        }
      } else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${format.name} has an invalid 'Composite' attribute. It must have 1-4 units.`);
    }

    format.fromJsonSync(formatJson);
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

    if (isInThisSchema && undefined === this._schema!.getItemSync(itemName, false)) {
      const schemaItem = this.loadSchemaItemSync(this._schema!, this._itemToRead.items[itemName], itemName);
      if (!skipVisitor && schemaItem && this._visitor) {
        schemaItem.accept(this._visitor);
      }
      return schemaItem;
    }

    if (undefined === schemaName || schemaName.length === 0)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${fullName} is invalid without a schema name`);

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
  private async loadCustomAttributes(customAttributesJson: any): Promise<void> {
    this.loadCustomAttributesSync(customAttributesJson);
  }

  /**
   * Given a CustomAttributeContainer and a CustomAttribute JSON it will make sure that all of the the CustomAttribute classes can be found within the context
   * of the Container.
   * @param caContainer The CustomAttribute Container to read the customAttributes within the context of.
   * @param customAttributesJson The JSON containing the customAttributes that are to be added to the container
   */
  private loadCustomAttributesSync(customAttributesJson: any): void {
    if (!customAttributesJson.customAttributes)
      return;

    if (!Array.isArray(customAttributesJson.customAttributes))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The `);

    customAttributesJson.customAttributes.forEach((caJson: any) => {
      if (caJson) {
        if (!caJson.className)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        if (typeof(caJson.className) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        this.findSchemaItem(caJson.className);
      }
    });
  }

  /**
   *
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   * @param schema The ECSchema this class exists in.
   */
  private async loadClass(classObj: AnyClass, classJson: any): Promise<void> {
    // Load base class first
    let baseClass: undefined | SchemaItem;
    if (undefined !== classJson.baseClass) {
      if (typeof(classJson.baseClass) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'baseClass' attribute. It should be of type 'string'.`);
      baseClass = await this.findSchemaItem(classJson.baseClass, true);
    }

    // Now deserialize the class itself, *before* any properties
    // (We need to do this to break Entity -navProp-> Relationship -constraint-> Entity cycle.)
    await classObj.fromJson(classJson);

    if (undefined !== classJson.properties) {
      if (!Array.isArray(classJson.properties))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);

      for (const property of classJson.properties) {
        if (typeof(property) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);

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
    let baseClass: undefined | SchemaItem;
    if (undefined !== classJson.baseClass) {
      if (typeof(classJson.baseClass) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'baseClass' attribute. It should be of type 'string'.`);
      baseClass = this.findSchemaItemSync(classJson.baseClass, true);
    }

    // Now deserialize the class itself, *before* any properties
    // (We need to do this to break Entity -navProp-> Relationship -constraint-> Entity cycle.)
    classObj.fromJsonSync(classJson);

    if (undefined !== classJson.properties) {
      if (!Array.isArray(classJson.properties))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);

      for (const property of classJson.properties) {
        if (typeof(property) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);

        this.loadPropertyTypesSync(classObj, property);
      }
    }

    if (baseClass && this._visitor)
      baseClass.accept(this._visitor);
  }

  private async loadEntityClass(entity: EntityClass, entityJson: any): Promise<void> {
    // Load Mixin classes first
    if (undefined !== entityJson.mixins) {
      if (!Array.isArray(entityJson.mixins))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${entity.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      for (const mixinName of entityJson.mixins) {
        if (typeof(mixinName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${entity.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
        await this.findSchemaItem(mixinName);
      }
    }

    await this.loadClass(entity, entityJson);
  }

  private loadEntityClassSync(entity: EntityClass, entityJson: any): void {
    // Load Mixin classes first
    if (undefined !== entityJson.mixins) {
      if (!Array.isArray(entityJson.mixins))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${entity.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      for (const mixinName of entityJson.mixins) {
        if (typeof(mixinName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${entity.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
        this.findSchemaItemSync(mixinName);
      }
    }

    this.loadClassSync(entity, entityJson);
  }

  private async loadMixin(mixin: Mixin, mixinJson: any): Promise<void> {
    let appliesToClass: undefined | SchemaItem;
    if (undefined !== mixinJson.appliesTo) {
      if (typeof(mixinJson.appliesTo) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${mixin.name} has an invalid 'appliesTo' property. It should be of type 'string'.`);

      appliesToClass = await this.findSchemaItem(mixinJson.appliesTo, true);
    }

    await this.loadClass(mixin, mixinJson);
    if (appliesToClass && this._visitor)
      await appliesToClass.accept(this._visitor);
  }

  private loadMixinSync(mixin: Mixin, mixinJson: any): void {
    let appliesToClass: undefined | SchemaItem;
    if (undefined !== mixinJson.appliesTo) {
      if (typeof(mixinJson.appliesTo) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${mixin.name} has an invalid 'appliesTo' property. It should be of type 'string'.`);

      appliesToClass = this.findSchemaItemSync(mixinJson.appliesTo, true);
    }

    this.loadClassSync(mixin, mixinJson);
    if (appliesToClass && this._visitor)
      appliesToClass.accept(this._visitor);
  }

  private async loadRelationshipClass(rel: RelationshipClass, relJson: any): Promise<void> {
    await this.loadClass(rel, relJson);

    if (undefined === relJson.source)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required source constraint.`);

    if (typeof(relJson.source) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} has an invalid source constraint. It should be of type 'object'.`);

    await this.loadRelationshipConstraint(rel.source, relJson.source);

    if (undefined === relJson.target)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required target constraint.`);

    if (typeof(relJson.target) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} has an invalid target constraint. It should be of type 'object'.`);

    await this.loadRelationshipConstraint(rel.target, relJson.target);
  }

  private loadRelationshipClassSync(rel: RelationshipClass, relJson: any): void {
    this.loadClassSync(rel, relJson);

    if (undefined === relJson.source)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required source constraint.`);

    if (typeof(relJson.source) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} has an invalid source constraint. It should be of type 'object'.`);

    this.loadRelationshipConstraintSync(rel.source, relJson.source);

    if (undefined === relJson.target)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required target constraint.`);

    if (typeof(relJson.target) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} has an invalid target constraint. It should be of type 'object'.`);

    this.loadRelationshipConstraintSync(rel.target, relJson.target);
  }

  private async loadRelationshipConstraint(relConstraint: RelationshipConstraint, relConstraintJson: any): Promise<void> {
    if (undefined !== relConstraintJson.abstractConstraint) {
      if (typeof(relConstraintJson.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relationshipClass!.name} has an invalid 'abstractConstraint' property. It should be of type 'string'.`);

      await this.findSchemaItem(relConstraintJson.abstractConstraint);
    }

    if (undefined !== relConstraintJson.constraintClasses) {
      if (!Array.isArray(relConstraintJson.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relationshipClass!.name} has an invalid 'constraintClasses' property. It should be of type 'array'.`);

      for (const constraintClass of relConstraintJson.constraintClasses) {
        await this.findSchemaItem(constraintClass);
      }
    }

    await relConstraint.fromJson(relConstraintJson);
  }

  private loadRelationshipConstraintSync(relConstraint: RelationshipConstraint, relConstraintJson: any): void {
    if (undefined !== relConstraintJson.abstractConstraint) {
      if (typeof(relConstraintJson.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relationshipClass!.name} has an invalid 'abstractConstraint' property. It should be of type 'string'.`);

      this.findSchemaItemSync(relConstraintJson.abstractConstraint);
    }

    if (undefined !== relConstraintJson.constraintClasses) {
      if (!Array.isArray(relConstraintJson.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relationshipClass!.name} has an invalid 'constraintClasses' property. It should be of type 'array'.`);

      for (const constraintClass of relConstraintJson.constraintClasses) {
        this.findSchemaItemSync(constraintClass);
      }
    }

    relConstraint.fromJsonSync(relConstraintJson);
  }

  /**
   * Creates the property defined in the JSON in the given class.
   * @param classObj
   * @param propertyJson
   */
  private async loadPropertyTypes(classObj: AnyClass, propertyJson: any): Promise<void> {
    if (undefined === propertyJson.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${classObj.key.schemaName}.${classObj.name} is missing the required 'name' property.`);
    if (typeof(propertyJson.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${classObj.key.schemaName}.${classObj.name} has an invalid 'name' property. It should be of type 'string'.`);

    const propName = propertyJson.name;

    if (undefined === propertyJson.propertyType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'propertyType' property.`);
    if (typeof(propertyJson.propertyType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'propertyType' property. It should be of type 'string'.`);

    const loadTypeName = async () => {
      if (undefined === propertyJson.typeName)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'typeName' property.`);

      if (typeof(propertyJson.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'typeName' property. It should be of type 'string'.`);

      if (undefined === parsePrimitiveType(propertyJson.typeName))
        await this.findSchemaItem(propertyJson.typeName);
    };

    switch (propertyJson.propertyType) {
      case "PrimitiveProperty":
        await loadTypeName();
        const primProp = await (classObj as MutableClass).createPrimitiveProperty(propName, propertyJson.typeName);
        return this.loadProperty(primProp, propertyJson);

      case "StructProperty":
        await loadTypeName();
        const structProp = await (classObj as MutableClass).createStructProperty(propName, propertyJson.typeName);
        return this.loadProperty(structProp, propertyJson);

      case "PrimitiveArrayProperty":
        await loadTypeName();
        const primArrProp = await (classObj as MutableClass).createPrimitiveArrayProperty(propName, propertyJson.typeName);
        return this.loadProperty(primArrProp, propertyJson);

      case "StructArrayProperty":
        await loadTypeName();
        const structArrProp = await (classObj as MutableClass).createStructArrayProperty(propName, propertyJson.typeName);
        return this.loadProperty(structArrProp, propertyJson);

      case "NavigationProperty":
        if (classObj.schemaItemType !== SchemaItemType.EntityClass && classObj.schemaItemType !== SchemaItemType.RelationshipClass && classObj.schemaItemType !== SchemaItemType.Mixin)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);

        if (undefined === propertyJson.relationshipName)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is missing the required 'relationshipName' property.`);

        if (typeof(propertyJson.relationshipName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} has an invalid 'relationshipName' property. It should be of type 'string'.`);

        await this.findSchemaItem(propertyJson.relationshipName);

        if (undefined === propertyJson.direction)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is missing the required 'direction' property.`);

        if (typeof(propertyJson.direction) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} has an invalid 'direction' property. It should be of type 'string'.`);

        const navProp = await (classObj as MutableEntityClass).createNavigationProperty(propName, propertyJson.relationshipName, propertyJson.direction);
        return this.loadProperty(navProp, propertyJson);
    }
  }

  /**
   * Creates the property defined in the JSON in the given class.
   * @param classObj
   * @param propertyJson
   */
  private loadPropertyTypesSync(classObj: AnyClass, propertyJson: any): void {
    if (undefined === propertyJson.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${classObj.key.schemaName}.${classObj.name} is missing the required 'name' property.`);
    if (typeof(propertyJson.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${classObj.key.schemaName}.${classObj.name} has an invalid 'name' property. It should be of type 'string'.`);

    const propName = propertyJson.name;

    if (undefined === propertyJson.propertyType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'propertyType' property.`);
    if (typeof(propertyJson.propertyType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'propertyType' property. It should be of type 'string'.`);

    const loadTypeName = () => {
      if (undefined === propertyJson.typeName)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'typeName' property.`);

      if (typeof(propertyJson.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'typeName' property. It should be of type 'string'.`);

      if (undefined === parsePrimitiveType(propertyJson.typeName))
        this.findSchemaItemSync(propertyJson.typeName);
    };

    switch (propertyJson.propertyType) {
      case "PrimitiveProperty":
        loadTypeName();
        const primProp = (classObj as MutableClass).createPrimitivePropertySync(propName, propertyJson.typeName);
        return this.loadPropertySync(primProp, propertyJson);

      case "StructProperty":
        loadTypeName();
        const structProp = (classObj as MutableClass).createStructPropertySync(propName, propertyJson.typeName);
        return this.loadPropertySync(structProp, propertyJson);

      case "PrimitiveArrayProperty":
        loadTypeName();
        const primArrProp = (classObj as MutableClass).createPrimitiveArrayPropertySync(propName, propertyJson.typeName);
        return this.loadPropertySync(primArrProp, propertyJson);

      case "StructArrayProperty":
        loadTypeName();
        const structArrProp = (classObj as MutableClass).createStructArrayPropertySync(propName, propertyJson.typeName);
        return this.loadPropertySync(structArrProp, propertyJson);

      case "NavigationProperty":
        if (classObj.schemaItemType !== SchemaItemType.EntityClass && classObj.schemaItemType !== SchemaItemType.RelationshipClass && classObj.schemaItemType !== SchemaItemType.Mixin)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is invalid, because only EntityClasses, Mixins, and RelationshipClasses can have NavigationProperties.`);

        if (undefined === propertyJson.relationshipName)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is missing the required 'relationshipName' property.`);

        if (typeof(propertyJson.relationshipName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} has an invalid 'relationshipName' property. It should be of type 'string'.`);

        this.findSchemaItemSync(propertyJson.relationshipName);

        if (undefined === propertyJson.direction)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is missing the required 'direction' property.`);

        if (typeof(propertyJson.direction) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} has an invalid 'direction' property. It should be of type 'string'.`);

        const navProp = (classObj as MutableEntityClass).createNavigationPropertySync(propName, propertyJson.relationshipName, propertyJson.direction);
        return this.loadPropertySync(navProp, propertyJson);
    }
  }

  private async loadProperty<T extends Property>(prop: T, propertyJson: any): Promise<void> {
    if (undefined !== propertyJson.category) {
      if (typeof(propertyJson.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'category' property. It should be of type 'string'.`);

      await this.findSchemaItem(propertyJson.category);
    }

    if (undefined !== propertyJson.kindOfQuantity) {
      if (typeof(propertyJson.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'kindOfQuantity' property. It should be of type 'string'.`);

      await this.findSchemaItem(propertyJson.kindOfQuantity);
    }

    // TODO Load CustomAttributeClasses

    await prop.fromJson(propertyJson);
  }

  private loadPropertySync<T extends Property>(prop: T, propertyJson: any): void {
    if (undefined !== propertyJson.category) {
      if (typeof(propertyJson.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'category' property. It should be of type 'string'.`);

      this.findSchemaItemSync(propertyJson.category);
    }

    if (undefined !== propertyJson.kindOfQuantity) {
      if (typeof(propertyJson.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'kindOfQuantity' property. It should be of type 'string'.`);

      this.findSchemaItemSync(propertyJson.kindOfQuantity);
    }

    // TODO Load CustomAttributeClasses

    prop.fromJsonSync(propertyJson);
  }
}
