/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { PropertyInterface, ECClassInterface, PrimitivePropertyInterface, StructPropertyInterface,
  NavigationPropertyInterface, PrimitiveArrayPropertyInterface, StructArrayPropertyInterface, LazyLoadedPropertyCategory, LazyLoadedKindOfQuantity, LazyLoadedEnumeration, LazyLoadedStructClass, LazyLoadedRelationshipClass } from "Interfaces";
import { ECName, PrimitiveType, RelatedInstanceDirection } from "ECObjects";
import { ECObjectsError, ECObjectsStatus } from "Exception";

/**
 * A common abstract class for all ECProperty types.
 */
export abstract class ECProperty implements PropertyInterface {
  private _name: ECName;
  public class: ECClassInterface;
  public description: string;
  public label: string;
  public isReadOnly: boolean;
  public priority: number;
  public inherited?: boolean;
  public category?: LazyLoadedPropertyCategory;

  constructor(name: string) {
    this.name = name;
  }

  get name() { return this._name.name; }
  set name(name: string) {
    this._name = new ECName(name);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    if (!jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this.name = jsonObj.name;

    if (jsonObj.label) this.label = jsonObj.label;
    if (jsonObj.description) this.description = jsonObj.description;
    if (jsonObj.priority) this.priority = jsonObj.priority;

    // TODO category

    // TODO CustomAttributes
  }
}

/**
 *
 */
export class PrimitiveProperty extends ECProperty implements PrimitivePropertyInterface {
  public kindOfQuantity?: LazyLoadedKindOfQuantity;
  public type: PrimitiveType | LazyLoadedEnumeration;
  public minLength: number;
  public maxLength: number;
  public minValue: number;
  public maxValue: number;

  constructor(name: string, type?: PrimitiveType | LazyLoadedEnumeration) {
    super(name);

    if (type)
      this.type = type;
    else
      this.type = PrimitiveType.Integer;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (jsonObj.minLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.minLength = jsonObj.minLength;
    }

    if (jsonObj.maxLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.maxLength = jsonObj.maxLength;
    }

    if (jsonObj.minValue) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.minValue = jsonObj.minValue;
    }

    if (jsonObj.maxValue) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.maxValue = jsonObj.maxValue;
    }

    // TODO: KoQ
  }
}

/**
 *
 */
export class PrimitiveArrayProperty extends PrimitiveProperty implements PrimitiveArrayPropertyInterface {
  public minOccurs: number = 0;
  public maxOccurs: number;
}

/**
 *
 */
export class StructProperty extends ECProperty implements StructPropertyInterface {
  public type: LazyLoadedStructClass;

  constructor(name: string, type: LazyLoadedStructClass) {
    super(name);

    this.type = type; // TODO: See how this error is handled.
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    // TODO: typeName
  }
}

/**
 *
 */
export class StructArrayProperty extends StructProperty implements StructArrayPropertyInterface {
  public minOccurs: number = 0;
  public maxOccurs: number;
}

/**
 *
 */
export class NavigationProperty extends ECProperty implements NavigationPropertyInterface {
  public relationship: LazyLoadedRelationshipClass;
  public direction: RelatedInstanceDirection;

  constructor(name: string, relationship: LazyLoadedRelationshipClass, direction?: RelatedInstanceDirection) {
    super(name);

    this.relationship = relationship;

    if (direction)
      this.direction = direction;
    else
      this.direction = RelatedInstanceDirection.Forward;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
  }
}

/**
 * Copied from the Typescript Handbook and tweaked to fit our tslint guidelines, https://www.typescriptlang.org/docs/handbook/mixins.html.
 */
function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach((baseCtor) => {
      Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
          derivedCtor.prototype[name] = baseCtor.prototype[name];
      });
  });
}

class ArrayProperty {
  public minOccurs: number;
  public maxOccurs: number;
}

applyMixins(PrimitiveArrayProperty, [ArrayProperty]);
applyMixins(StructArrayProperty, [ArrayProperty]);
