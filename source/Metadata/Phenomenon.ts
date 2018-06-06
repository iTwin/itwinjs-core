/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { SchemaItemType, parseSchemaItemType, schemaItemTypeToString, ECName } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItem } from "..";

export default class Phenomenon extends SchemaItem {
  public readonly schema: Schema;
  protected _name: ECName;
  protected _label?: string;
  protected _description?: string;
  protected _definition: string; // Contains a combination of Phenomena names which form this Phenomenon. Each Phenomena name is separated by a * and may have an exponent, specified using parentheses 
  private readonly ec32Url: string = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.Phenomenon);
    this.schema = schema;
    this._name = new ECName(name);
    this._definition = "";
  }

  public get type(): SchemaItemType { return SchemaItemType.Phenomenon; }

  get ecname(): ECName { return this._name; }
  get label(): string | undefined { return this._label; }
  get description(): string | undefined { return this._description; }
  get definition(): string { return this._definition; }

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
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'name' attribute.`);
    } else // if name isn't defined, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${this.name} does not have the required 'name' attribute.`);

    if (undefined !== jsonObj.label) { // label is optional
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label; // if json label is defined, assign it to the label variable for this Phenomenon
    }

    if (undefined !== jsonObj.description) { // description is optional
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description; // if json description is defined, assign it to the description variable for this Phenomenon
    }

    if (undefined !== jsonObj.definition) { // definition is required
      if (typeof(jsonObj.definition) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'definition' attribute. It should be of type 'string'.`);
      if (this._definition !== "" && jsonObj.definition.toLowerCase() !== this._definition.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'definition' attribute.`);
      else if (this._definition === "") // this is the default value for the definition, which we assigned in the constructor
        this._definition = jsonObj.definition; // so, if we have yet to define the definition variable, assign it the json definition
    } else // if definition isn't defined, throw error
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} does not have the required 'definition' attribute.`);

    if (undefined !== jsonObj.$schema) {
      if (typeof(jsonObj.$schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.$schema.toLowerCase() !== this.ec32Url) // $schema value must be equal to the EC3.2 url
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} does not have the required schema URL.`);
    } else // $schema value must be equal to the EC3.2 url and not undefined
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} does not have the required schema URL.`);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitPhenomenon)
      await visitor.visitPhenomenon(this);
  }
}
