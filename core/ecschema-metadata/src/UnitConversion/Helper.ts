/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItemType } from "../ECObjects";
import { SchemaItem } from "../ecschema-metadata";
import { Constant } from "../Metadata/Constant";
import { Unit } from "../Metadata/Unit";

export function isUnit(unit: SchemaItem): unit is Unit {
  return unit.schemaItemType == SchemaItemType.Unit;
}

export function isConstant(unit: SchemaItem): unit is Constant {
  return unit.schemaItemType == SchemaItemType.Constant;
}
