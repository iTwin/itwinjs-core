/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Logger } from "@itwin/core-bentley";
import { ECClass, Schema } from "@itwin/ecschema-metadata";
import assert = require("assert");

const logger = Logger.makeCategorizedLogger("ECClassNavPropReferenceCache");

/** The context for transforming a *source* Element to a *target* Element and remapping internal identifiers to the target iModel.
 * @internal
 */
export class SchemaNotInCacheErr extends Error {
  public constructor() { super("Schema was not in cache, initialize that schema"); }
}

// TODO: try out an enum
/** @internal */
export type EntityRefType = "m" | "e" | "a" | "r";

/** The context for transforming a *source* Element to a *target* Element and remapping internal identifiers to the target iModel.
 * @internal
 */
export class ECClassNavPropReferenceCache {
  /** nesting based tuple map keyed by property qualifier [schemaName, className, propName] */
  private _propQualifierToRefType = new Map<string, Map<string, Map<string, EntityRefType>>>();
  private _initedSchemas = new Set<string>();

  private static bisRootClassToRefType: Record<string, EntityRefType | undefined> = {
    /* eslint-disable quote-props, @typescript-eslint/naming-convention */
    "Element": "e",
    "Model": "m",
    "ElementUniqueAspect": "a",
    "ElementMultiAspect": "a",
    "ElementRefersToElements": "r",
    "ElementDrivesElement": "r",
    /* eslint-enable quote-props, @typescript-eslint/naming-convention */
  };

  public async initSchema(schema: Schema): Promise<void> {
    if (this._initedSchemas.has(schema.name)) {
      logger.logInfo("schema was already inited");
      return;
    }

    this._initedSchemas.add(schema.name);

    const classMap = new Map<string, Map<string, EntityRefType>>();
    this._propQualifierToRefType.set(schema.name, classMap);

    for (const ecclass of schema.getClasses()) {
      const propMap = new Map<string, EntityRefType>();
      classMap.set(ecclass.name, propMap);

      for (const prop of ecclass.properties ?? []) {
        if (!prop.isNavigation()) return;
        const relClass = await prop.relationshipClass;
        const constraints = relClass.target.constraintClasses;
        assert(constraints !== undefined);
        const constraint = await constraints[0];
        let bisRootForConstraint: ECClass = constraint;
        await constraint.traverseBaseClasses((c) => { bisRootForConstraint = c; return false; });
        const refType = ECClassNavPropReferenceCache.bisRootClassToRefType[bisRootForConstraint.name];
        // FIXME: write a test on this assumption by iterating through biscore schema metadata and ensuring all classes have one of
        // the above bases
        assert(
          refType !== undefined,
          "This is a bug. An unknown root class was encountered while populating the nav prop reference type cache."
        );
        propMap.set(prop.name, refType);
      }
    }
  }

  public getNavPropRefType(schemaName: string, className: string, propName: string): undefined | EntityRefType {
    if (!this._initedSchemas.has(schemaName)) throw new SchemaNotInCacheErr();
    return this._propQualifierToRefType.get(schemaName)?.get(className)?.get(propName);
  }

  public clear() {
    this._initedSchemas.clear();
    this._propQualifierToRefType.clear();
  }
}
