/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaItemType, parseSchemaItemType, schemaItemTypeToString, ECName } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItem } from "..";

/**
 * An abstract class that adds the ability to define Units and everything that goes with them, within an ECSchema as a
 * first-class concept is to allow the iModel to not be dependent on any hard-coded Units
 */
export default class Unit extends SchemaItem {
  public readonly schema: Schema;
  protected _name: ECName;
  protected _label?: string;
  protected _description?: string;
  protected _phenomenon?: string;
  protected _unitSystem?: string;
  protected _definition: string;
  protected _numerator = 1.0;
  protected _denominator = 1.0;
  protected _offset = 0.0;
  private readonly ec32Url: string = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.Unit);
    this.schema = schema;
    this._name = new ECName(name);
    this._definition = "";
  }

  public get type(): SchemaItemType { return SchemaItemType.Unit; }

  get ecname(): ECName { return this._name; }
  get label(): string | undefined { return this._label; }
  get description(): string | undefined { return this._description; }
  get phenomenon(): string | undefined { return this._phenomenon; }
  get unitSystem(): string | undefined {return this._unitSystem; }
  get definition(): string { return this._definition; }
  get numerator(): number { return this._numerator; }
  get offset(): number { return this._offset; }
  get denominator(): number { return this._denominator; }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    if (undefined === jsonObj.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} is missing the required schemaItemType property.`);

    if (typeof(jsonObj.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);

    if (parseSchemaItemType(jsonObj.schemaItemType) !== this.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an incompatible schemaItemType. It must be "${schemaItemTypeToString(this.type)}", not "${jsonObj.schemaItemType}".`);

    if (undefined !== jsonObj.name) { // name is required
      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${jsonObj.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'name' attribute.`);
    } else // if name isn't defined, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} does not have the required 'name' attribute.`);

    if (undefined !== jsonObj.label) { // label is optional
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label; // if json label is defined, assign it to the label variable for this Unit
    }

    if (undefined !== jsonObj.description) { // description is optional
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description; // if json description is defined, assign it to the description variable for this Unit
    }

    if (undefined !== jsonObj.phenomenon) { // phenomenon is required
      if (typeof(jsonObj.phenomenon) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
      if (this._phenomenon !== undefined &&  jsonObj.phenomenon.toLowerCase() !== this._phenomenon.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'phenomenon' attribute.`);
      else if (this._phenomenon === undefined) // if we have yet to define the phenomenon variable, assign it the json phenomenon
        this._phenomenon = jsonObj.phenomenon;
    } else // if phenomenon isn't defined, throw error
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} does not have the required 'phenomenon' attribute.`);

    if (undefined !== jsonObj.unitSystem) { // unit system is required
      if (typeof(jsonObj.unitSystem) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
      if (this._unitSystem !== undefined && jsonObj.unitSystem.toLowerCase() !== this._unitSystem.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'unitSystem' attribute.`);
      else if (this._unitSystem === undefined) // if we have yet to define the unitSystem variable, assign it the json unitSystem
        this._unitSystem = jsonObj.unitSystem;
    } else // if unitSystem isn't defined, throw error
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} does not have the required 'unitSystem' attribute.`);

    if (undefined !== jsonObj.definition) { // definition is required
      if (typeof(jsonObj.definition) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'definition' attribute. It should be of type 'string'.`);
      if (this._definition !== "" && jsonObj.definition.toLowerCase() !== this._definition.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'definition' attribute.`);
      else if (this._definition === "") // this is the default value for the definition, which we assigned in the constructor
        this._definition = jsonObj.definition; // so, if we have yet to define the definition variable, assign it the json definition
    } else // if definition isn't defined, throw error
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} does not have the required 'definition' attribute.`);

    if (undefined !== jsonObj.numerator) { // optional; default is 1.0
      if (typeof(jsonObj.numerator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'numerator' attribute. It should be of type 'number'.`);
      if (jsonObj.numerator !== this._numerator) // if numerator isnt default value of 1.0, reassign numerator variable
        this._numerator = jsonObj.numerator;
    }

    if (undefined !== jsonObj.denominator) { // optional; default is 1.0
      if (typeof(jsonObj.denominator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'denominator' attribute. It should be of type 'number'.`);
      if (jsonObj.denominator !== this._denominator) // if denominator isnt default value of 1.0, reassign denominator variable
        this._denominator = jsonObj.denominator;
    }

    if (undefined !== jsonObj.offset) { // optional; default is 0.0
      if (typeof(jsonObj.offset) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'offset' attribute. It should be of type 'number'.`);
      if (jsonObj.offset !== this._offset) // if offset isnt default value of 1.0, reassign offset variable
        this._offset = jsonObj.offset;
    }

    if (undefined !== jsonObj.$schema) {
      if (typeof(jsonObj.$schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.$schema.toLowerCase() !== this.ec32Url) // $schema value must be equal to the EC3.2 url
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} does not have the required schema URL.`);
    } else // $schema value must be equal to the EC3.2 url and not undefined
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${jsonObj.name} does not have the required schema URL.`);
  }
  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitUnit)
      await visitor.visitUnit(this);
  }
}
