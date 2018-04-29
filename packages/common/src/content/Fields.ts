/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import CategoryDescription from "./Category";
import EditorDescription from "./Editor";
import Property from "./Property";
import { TypeDescription } from "./TypeDescription";

export interface BaseFieldJSON {
  category: CategoryDescription;
  name: string;
  label: string;
  type: TypeDescription;
  isReadonly: boolean;
  priority: number;
  editor?: EditorDescription;
}

export interface PropertiesFieldJSON extends BaseFieldJSON {
  properties: Property[];
}

export interface NestedContentFieldJSON extends BaseFieldJSON {
  contentClassInfo: ec.ClassInfo;
  pathToPrimaryClass: ec.RelationshipPathInfo;
  nestedFields: FieldJSON[];
}

export type FieldJSON = BaseFieldJSON | PropertiesFieldJSON | NestedContentFieldJSON;

const isPropertiesField = (field: BaseFieldJSON | Field): field is PropertiesFieldJSON | PropertiesField => {
  return (field as any).properties;
};
const isNestedContentField = (field: BaseFieldJSON | Field): field is NestedContentFieldJSON | NestedContentField => {
  return (field as any).nestedFields;
};

/** Describes a single content field. A field is usually represented as a grid column
 * or a property pane row.
 */
export class Field {
  public readonly category: Readonly<CategoryDescription>;
  public readonly name: string;
  public readonly label: string;
  public readonly type: Readonly<TypeDescription>;
  public readonly isReadonly: boolean;
  public readonly priority: number;
  public readonly editor?: Readonly<EditorDescription>;
  private _parent?: Readonly<NestedContentField>;

  public constructor(category: CategoryDescription, name: string, label: string, type: TypeDescription,
    isReadonly: boolean, priority: number, editor?: EditorDescription) {
    this.category = category;
    this.name = name;
    this.label = label;
    this.type = type;
    this.isReadonly = isReadonly;
    this.priority = priority;
    this.editor = editor;
  }

  public isPropertiesField(): this is PropertiesField { return isPropertiesField(this); }
  public isNestedContentField(): this is NestedContentField { return isNestedContentField(this); }

  public get parent(): Readonly<NestedContentField> | undefined { return this._parent; }

  /*public toJSON(): BaseFieldJSON {
    return {
      category: this.category,
      name: this.name,
      label: this.label,
      type: this.type,
      isReadonly: this.isReadonly,
      priority: this.priority,
      editor: this.editor,
    };
  }*/

  public static fromJSON(json: FieldJSON | string | undefined): Field | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Field.reviver);
    if (isPropertiesField(json))
      return PropertiesField.fromJSON(json);
    if (isNestedContentField(json))
      return NestedContentField.fromJSON(json);
    const field = Object.create(Field.prototype);
    return Object.assign(field, json);
  }

  public static reviver(key: string, value: any): any {
    return key === "" ? Field.fromJSON(value) : value;
  }

  /** @hidden */
  public resetParentship(): void {
    this._parent = undefined;
  }

  /** @hidden */
  public rebuildParentship(parentField?: NestedContentField): void {
    this._parent = parentField;
  }
}

/** Describes a single content field that's based on one or more EC properties. */
export class PropertiesField extends Field {
  public readonly properties: Array<Readonly<Property>>;

  public constructor(category: CategoryDescription, name: string, label: string, description: TypeDescription,
    isReadonly: boolean, priority: number, properties: Property[], editor?: EditorDescription) {
    super(category, name, label, description, isReadonly, priority, editor);
    this.properties = properties;
  }

  /*public toJSON(): PropertiesFieldJSON {
    return {
      ...super.toJSON(),
      properties: this.properties,
    };
  }*/

  public static fromJSON(json: PropertiesFieldJSON | string | undefined): PropertiesField | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Field.reviver);
    const field = Object.create(PropertiesField.prototype);
    return Object.assign(field, json);
  }
}

/** Describes a single content field that contains nested content. */
export class NestedContentField extends Field {
  public readonly contentClassInfo: ec.ClassInfo;
  public readonly pathToPrimaryClass: ec.RelationshipPathInfo;
  public readonly nestedFields: Array<Readonly<Field>>;

  public constructor(category: CategoryDescription, name: string, label: string, description: TypeDescription,
    isReadonly: boolean, priority: number, contentClassInfo: ec.ClassInfo, pathToPrimaryClass: ec.RelationshipPathInfo,
    nestedFields: Field[], editor?: EditorDescription) {
    super(category, name, label, description, isReadonly, priority, editor);
    this.contentClassInfo = contentClassInfo;
    this.pathToPrimaryClass = pathToPrimaryClass;
    this.nestedFields = nestedFields;
  }

  /*public toJSON(): NestedContentFieldJSON {
    return {
      ...super.toJSON(),
      contentClassInfo: this.contentClassInfo,
      pathToPrimaryClass: this.pathToPrimaryClass,
      nestedFields: this.nestedFields.map((field: Field) => field.toJSON()),
    };
  }*/

  public static fromJSON(json: NestedContentFieldJSON | string | undefined): NestedContentField | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Field.reviver);
    const field = Object.create(NestedContentField.prototype);
    return Object.assign(field, json, {
      nestedFields: json.nestedFields.map((nestedFieldJson: FieldJSON) => Field.fromJSON(nestedFieldJson)),
    });
  }

  /** @hidden */
  public resetParentship(): void {
    super.resetParentship();
    for (const nestedField of this.nestedFields)
      nestedField.resetParentship();
  }

  /** @hidden */
  public rebuildParentship(parentField?: NestedContentField): void {
    super.rebuildParentship(parentField);
    for (const nestedField of this.nestedFields)
      nestedField.rebuildParentship(this);
  }
}

export interface NestedContent {
  primaryKeys: Array<Readonly<ec.InstanceKey>>;
  values: any;
  displayValues: any;
}
