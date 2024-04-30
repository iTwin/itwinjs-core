/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { PrimitiveTypeCode, RelatedElement } from "@itwin/core-common";
import { Point2d, Point3d } from "@itwin/core-geometry";
 
export interface CustomAttribute {
   ecclass: string;
   properties: {
     [propName: string]: any,
   };
}

export interface PropertyMetadata {
  primitiveType?: PrimitiveTypeCode;
  structName?: string;
  extendedType?: string;
  description?: string;
  displayLabel?: string;
  minimumValue?: any;
  maximumValue?: any;
  minimumLength?: number;
  maximumLength?: number;
  readOnly?: boolean;
  kindOfQuantity?: string;
  isCustomHandled?: boolean;
  isCustomHandledOrphan?: boolean;
  minOccurs?: number;
  maxOccurs?: number;
  direction?: string;
  relationshipClass?: string;
  customAttributes?: CustomAttribute[];
}

export type PropertyCallback = (name: string, meta: PropertyMetadata) => void;

function createValueOrArray(meta: PropertyMetadata, func: (json: any) => any, json: any): any {
  if (undefined === meta.minOccurs) {
    return func(json); // not an array
  }

  const val: any[] = [];
  json.forEach((element: any) => val.push(func(element)));
  return val;
}

/** @internal */
export function createPropertyFromMetadata(meta: PropertyMetadata, json: any): any {
    if (json === undefined)
      return undefined;

    if (undefined !== meta.primitiveType) {
      switch (meta.primitiveType) {
        case PrimitiveTypeCode.Boolean:
        case PrimitiveTypeCode.Double:
        case PrimitiveTypeCode.Integer:
        case PrimitiveTypeCode.String:
          return json; // this works even for arrays or strings that are JSON because the parsed JSON is already the right type

        case PrimitiveTypeCode.Point2d:
          return createValueOrArray(meta, (obj) => Point2d.fromJSON(obj), json);

        case PrimitiveTypeCode.Point3d:
          return createValueOrArray(meta, (obj) => Point3d.fromJSON(obj), json);
      }
    }

    if (undefined !== meta.direction) {
      return json.id !== undefined ? new RelatedElement(json) : Id64.fromJSON(json);
    }

    return json;
  }

export interface EntityMetadata {
  classId: Id64String;
  ecclass: string;
  description?: string;
  modifier?: string;
  displayLabel?: string;
  /** The  base classes from which this class derives. If more than one, the first is the super class and the others are [mixins]($docs/bis/ec/ec-mixin-class). */
  baseClasses: string[];
  /** The Custom Attributes for this class */
  customAttributes?: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class. */
  properties: { [propName: string]: PropertyMetadata | undefined };
}

export class EntityMetadataRegistry {
  private _registry = new Map<string, EntityMetadata>();
  private _classIdToName = new Map<Id64String, string>();

  public find(classFullName: string): EntityMetadata | undefined {
    return this._registry.get(classFullName.toLowerCase());
  }

  public findClassId(classFullName: string): Id64String | undefined {
    return this.find(classFullName)?.classId;
  }

  public findById(classId: Id64String): EntityMetadata | undefined {
    const name = this._classIdToName.get(classId);
    return undefined !== name ? this.find(name) : undefined;
  }

  public add(classFullName: string, metadata: EntityMetadata): void {
    const name = classFullName.toLowerCase();
    this._registry.set(name, metadata);
    this._classIdToName.set(metadata.classId, name);
  }
}

/* @internal */
export function entityMetadataFromStringifiedJSON(jsonStr: string): EntityMetadata {
  const meta = JSON.parse(jsonStr) as EntityMetadata;
  if (undefined === meta.properties) {
    meta.properties = { };
  }

  return meta;
}
