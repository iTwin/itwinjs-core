/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Logger } from "@itwin/core-bentley";
import { ECClass, Mixin, Schema, StrengthDirection } from "@itwin/ecschema-metadata";
import * as assert from "assert";

const logger = Logger.makeCategorizedLogger("ECClassNavPropReferenceCache");

/** The context for transforming a *source* Element to a *target* Element and remapping internal identifiers to the target iModel.
 * @internal
 */
export class SchemaNotInCacheErr extends Error {
  public constructor() { super("Schema was not in cache, initialize that schema"); }
}

// FIXME: consolidate with ConcreteEntityId
/** @internal */
export enum EntityRefType {
  Model = "m",
  Element = "e",
  Aspect = "a",
  Relationship = "r",
  CodeSpec = "c",
}

const nameForEntityRefTypeMap = {
  [EntityRefType.Model]: "Model",
  [EntityRefType.Element]: "Element",
  [EntityRefType.Aspect]: "Aspect",
  [EntityRefType.Relationship]: "Relationship",
  [EntityRefType.CodeSpec]: "CodeSpec",
} as const;

export function nameForEntityRefType(entityRefType: EntityRefType) {
  return nameForEntityRefTypeMap[entityRefType];
}

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
    "Element": EntityRefType.Element,
    "Model": EntityRefType.Model,
    "ElementAspect": EntityRefType.Aspect,
    "ElementRefersToElements": EntityRefType.Relationship,
    "ElementDrivesElement": EntityRefType.Relationship,
    "CodeSpec": EntityRefType.CodeSpec,
    /* eslint-enable quote-props, @typescript-eslint/naming-convention */
  };

  public async initSchema(schema: Schema): Promise<void> {
    if (this._initedSchemas.has(schema.name)) {
      logger.logInfo("schema was already inited");
      return;
    }

    const classMap = new Map<string, Map<string, EntityRefType>>();
    this._propQualifierToRefType.set(schema.name.toLowerCase(), classMap);

    for (const ecclass of schema.getClasses()) {
      const propMap = new Map<string, EntityRefType>();
      classMap.set(ecclass.name.toLowerCase(), propMap);

      for (const prop of await ecclass.getProperties()) {
        if (!prop.isNavigation()) continue;
        const relClass = await prop.relationshipClass;
        // for nav props no need to check relClass.strengthDirection, it always points to the source class
        const constraints = relClass.source.constraintClasses;
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
          `An unknown root class '${bisRootForConstraint.name}' was encountered while populating the nav prop reference type cache. This is a bug.`
        );
        propMap.set(prop.name.toLowerCase(), refType);
      }
    }

    this._initedSchemas.add(schema.name);
  }

  public getNavPropRefType(schemaName: string, className: string, propName: string): undefined | EntityRefType {
    if (!this._initedSchemas.has(schemaName)) throw new SchemaNotInCacheErr();
    return this._propQualifierToRefType
      .get(schemaName.toLowerCase())
      ?.get(className.toLowerCase())
      ?.get(propName.toLowerCase());
  }

  public clear() {
    this._initedSchemas.clear();
    this._propQualifierToRefType.clear();
  }
}
