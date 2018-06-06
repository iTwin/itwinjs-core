/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { SchemaItemType, parseSchemaItemType, schemaItemTypeToString, ECName } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItem } from "..";

export default class UnitSystem extends SchemaItem {
  public readonly schema: Schema;
  protected _name: ECName;
  protected _label?: string;
  protected _description?: string;
  private readonly ec32Url: string = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.UnitSystem);
    this.schema = schema;
    this._name = new ECName(name);
  }

  public get type(): SchemaItemType { return SchemaItemType.UnitSystem; }

  get ecname(): ECName { return this._name; }
  get label(): string | undefined { return this._label; }
  get description(): string | undefined { return this._description; }

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
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${jsonObj.name} has an invalid 'name' attribute.`);
    } else // if name isn't defined, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${this.name} does not have the required 'name' attribute.`);

    if (undefined !== jsonObj.label) { // label is optional
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${jsonObj.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label; // if json label is defined, assign it to the label variable for this UnitSystem
    }

    if (undefined !== jsonObj.description) { // description is optional
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${jsonObj.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description; // if json description is defined, assign it to the description variable for this UnitSystem
    }

    if (undefined !== jsonObj.$schema) {
      if (typeof(jsonObj.$schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${jsonObj.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.$schema.toLowerCase() !== this.ec32Url) // $schema value must be equal to the EC3.2 url
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${jsonObj.name} does not have the required schema URL.`);
    } else // $schema value must be equal to the EC3.2 url and not undefined
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The UnitSystem ${jsonObj.name} does not have the required schema URL.`);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitUnitSystem)
      await visitor.visitUnitSystem(this);
  }
}
