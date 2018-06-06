/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaItemType, parseSchemaItemType, schemaItemTypeToString, ECName } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItem } from "..";

/**
 * An InvertedUnit is a a specific type of Unit that describes the inverse of a single Unit whose dimensional derivation is unit-less.
 */
export default class InvertedUnit extends SchemaItem {
  public readonly schema: Schema;
  protected _name: ECName;
  protected _label?: string; // optional
  protected _description?: string; // optional
  protected _invertsUnit: string; // required
  protected _unitSystem?: string; // required
  private readonly ec32Url: string = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.InvertedUnit);
    this.schema = schema;
    this._name = new ECName(name);
    this._invertsUnit = "";
  }

  public get type(): SchemaItemType { return SchemaItemType.InvertedUnit; }

  get ecname(): ECName { return this._name; }
  get label(): string | undefined { return this._label; }
  get description(): string | undefined { return this._description; }
  get invertsUnit(): string | undefined { return this._invertsUnit; }
  get unitSystem(): string | undefined {return this._unitSystem; }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    if (undefined === jsonObj.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} is missing the required schemaItemType property.`);

    if (typeof(jsonObj.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);

    if (parseSchemaItemType(jsonObj.schemaItemType) !== this.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an incompatible schemaItemType. It must be "${schemaItemTypeToString(this.type)}", not "${jsonObj.schemaItemType}".`);

    if (undefined !== jsonObj.name) {  // name is required
      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${jsonObj.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'name' attribute.`);
    } else // if name isn't defined, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'name' attribute.`);

    if (undefined !== jsonObj.label) { // label is optional
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label; // if json label is defined, assign it to the label variable for this InvertedUnit
    }

    if (undefined !== jsonObj.description) { // description is optional
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description; // if json description is defined, assign it to the description variable for this InvertedUnit
    }

    if (undefined !== jsonObj.invertsUnit) { // InvertsUnit is required
      if (typeof(jsonObj.invertsUnit) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
      if (this._invertsUnit !== "" && jsonObj.invertsUnit.toLowerCase() !== this._invertsUnit.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      else if (this._invertsUnit === "") // this is the default value for the invertsUnit, which we assigned in the constructor
        this._invertsUnit = jsonObj.invertsUnit; // so, if we have yet to define the invertsUnit variable, assign it the json invertsUnit
    } else // if invertsUnit isn't defined, throw error
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} does not have the required 'invertsUnit' attribute.`);

    if (undefined !== jsonObj.unitSystem) { // unitSystem is required
      if (typeof(jsonObj.unitSystem) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
      if (this._unitSystem !== undefined && jsonObj.unitSystem.toLowerCase() !== this._unitSystem.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      else if (this._unitSystem === undefined) // if we have yet to define the unitSystem variable, assign it the json unitSystem
        this._unitSystem = jsonObj.unitSystem;
    } else // if unitSystem isn't defined, throw error
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} does not have the required 'unitSystem' attribute.`);

    if (undefined !== jsonObj.$schema) {
      if (typeof(jsonObj.$schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.$schema.toLowerCase() !== this.ec32Url) // $schema value must be equal to the EC3.2 url
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} does not have the required schema URL.`);
    } else // $schema value must be equal to the EC3.2 url and not undefined
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} does not have the required schema URL.`);
  }
  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitInvertedUnit)
      await visitor.visitInvertedUnit(this);
  }
}
