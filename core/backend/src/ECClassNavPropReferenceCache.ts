/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Logger } from "@itwin/core-bentley";
import { ECClass, Mixin, Schema } from "@itwin/ecschema-metadata";
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

/**
 * A cache of the entity type referenced by navprops in ec schemas.
 * The transformer needs the referenced type to determine how to resolve references.
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
    "ElementAspect": "a",
    "ElementRefersToElements": "r",
    "ElementDrivesElement": "r",
    /* eslint-enable quote-props, @typescript-eslint/naming-convention */
  };

  public async initSchema(schema: Schema): Promise<void> {
    if (this._initedSchemas.has(schema.name)) {
      logger.logInfo("schema was already inited");
      return;
    }

    const classMap = new Map<string, Map<string, EntityRefType>>();
    this._propQualifierToRefType.set(schema.name, classMap);

    for (const ecclass of schema.getClasses()) {
      const propMap = new Map<string, EntityRefType>();
      classMap.set(ecclass.name, propMap);

      for (const prop of ecclass.properties ?? []) {
        if (!prop.isNavigation()) continue;
        const relClass = await prop.relationshipClass;
        const constraints = relClass.target.constraintClasses;
        assert(constraints !== undefined);
        const constraint = await constraints[0];
        let bisRootForConstraint: ECClass = constraint;
        await constraint.traverseBaseClasses((baseClass) => {
          // The depth first traversal will descend all the way to the root class before making any lateral traversal
          // of mixin hierarchies, (or if the constraint is a mixin, it will traverse to the root of the mixin hierarch)
          // Once we see that we've moved laterally, we can terminate early
          const isFirstTest = bisRootForConstraint === constraint;
          const traversalSwitchedRootPath = baseClass.name !== bisRootForConstraint.baseClass?.name;
          const stillTraversingRootPath = isFirstTest || !traversalSwitchedRootPath;
          if (!stillTraversingRootPath)
            return true; // stop traversal early
          bisRootForConstraint = baseClass;
          return false;
        });
        // if the root class of the constraint was a mixin, use its AppliesToEntityClass
        if (bisRootForConstraint instanceof Mixin) {
          assert(bisRootForConstraint.appliesTo !== undefined, "The referenced AppliesToEntityClass could not be found, how did it pass schema validation?");
          bisRootForConstraint = await bisRootForConstraint.appliesTo;
        }
        const refType = ECClassNavPropReferenceCache.bisRootClassToRefType[bisRootForConstraint.name];
        // FIXME: write a test on this assumption by iterating through biscore schema metadata and ensuring all classes have one of
        // the above bases
        assert(
          refType !== undefined,
          `This is a bug. An unknown root class '${bisRootForConstraint.name}' was encountered while populating the nav prop reference type cache.`
        );
        propMap.set(prop.name, refType);
      }
    }

    this._initedSchemas.add(schema.name);
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
