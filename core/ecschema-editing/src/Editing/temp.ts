/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import * as Rules from "../Validation/ECRules";

import {
  AnyEnumerator, ConstantProps, CustomAttribute, CustomAttributeClass, CustomAttributeClassProps, CustomAttributeContainerType,
  DelayedPromiseWithProps, ECClass, ECClassModifier, ECObjectsError, ECObjectsStatus, EntityClass, EntityClassProps, Enumeration,
  EnumerationPropertyProps, EnumerationProps, Format, FormatProps, FormatType, InvertedUnit, InvertedUnitProps, KindOfQuantityProps,
  Mixin, MixinProps, OverrideFormat, Phenomenon, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, PrimitiveType,
  PropertyCategoryProps, RelationshipClass, RelationshipClassProps, Schema, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey,
  SchemaMatchType, StrengthDirection, StructArrayPropertyProps, StructClass, StructClassProps, StructPropertyProps, Unit, UnitProps,
  UnitSystem, UnitSystemProps,
} from "@bentley/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableClass } from "./Mutable/MutableClass";
import { assert } from "@bentley/bentleyjs-core";

/**
 * @alpha
 */
export namespace Editors {
}
