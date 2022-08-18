/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { ConcreteEntityTypes, Logger } from "@itwin/core-bentley";
import { ECClass, Mixin, Schema, SchemaKey } from "@itwin/ecschema-metadata";
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

/** @internal */
export interface RelTypeInfo {
  source: ConcreteEntityTypes;
  target: ConcreteEntityTypes;
}

/**
 * A cache of the entity type referenced by navprops in ec schemas.
 * The transformer needs the referenced type to determine how to resolve references.
 * @internal
 */
export class ECClassNavPropReferenceCache {
  /** singleton because using multiple of these is mostly reinitializing duplicated info expensively */
  public static globalCache = new ECClassNavPropReferenceCache();

  /** nesting based tuple map keyed by property qualifier [schemaName, className, propName] */
  private _propQualifierToRefType = new Map<string, Map<string, Map<string, RelTypeInfo>>>();
  private _initedSchemas = new Map<string, SchemaKey>();

  private static bisRootClassToRefType: Record<string, ConcreteEntityTypes | undefined> = {
    /* eslint-disable quote-props, @typescript-eslint/naming-convention */
    "Element": ConcreteEntityTypes.Element,
    "Model": ConcreteEntityTypes.Model,
    "ElementAspect": ConcreteEntityTypes.ElementAspect,
    "ElementRefersToElements": ConcreteEntityTypes.Relationship,
    "ElementDrivesElement": ConcreteEntityTypes.Relationship,
    // code spec is technically a potential root class but it is sealed and not treated
    // "CodeSpec": ConcreteEntityTypes.CodeSpec,
    /* eslint-enable quote-props, @typescript-eslint/naming-convention */
  };

  public async initSchema(schema: Schema): Promise<void> {
    if (this._initedSchemas.has(schema.name)) {
      const cachedSchemaKey = this._initedSchemas.get(schema.name);
      assert(cachedSchemaKey !== undefined);
      // FIXME: test this logic
      const incomingSchemaIsEqualOrOlder = schema.schemaKey.compareByVersion(cachedSchemaKey) <= 0;
      if (incomingSchemaIsEqualOrOlder) {
        logger.logInfo("schema was already inited");
        return;
      }
    }

    const classMap = new Map<string, Map<string, RelTypeInfo>>();
    this._propQualifierToRefType.set(schema.name.toLowerCase(), classMap);

    for (const ecclass of schema.getClasses()) {
      const propMap = new Map<string, RelTypeInfo>();
      classMap.set(ecclass.name.toLowerCase(), propMap);

      for (const prop of await ecclass.getProperties()) {
        if (!prop.isNavigation()) continue;
        const relClass = await prop.relationshipClass;

        async function getRootBisClass(constraints: typeof relClass.source.constraintClasses) {
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
          return bisRootForConstraint;
        }

        const sourceRootClass = await getRootBisClass(relClass.source.constraintClasses);
        const targetRootClass = await getRootBisClass(relClass.target.constraintClasses);
        if (sourceRootClass.name === "CodeSpec" || targetRootClass.name === "CodeSpec") continue;
        const sourceType = ECClassNavPropReferenceCache.bisRootClassToRefType[sourceRootClass.name];
        const targetType = ECClassNavPropReferenceCache.bisRootClassToRefType[targetRootClass.name];
        // FIXME: write a test on this assumption by iterating through biscore schema metadata and ensuring all classes have one of
        // the above bases
        const makeAssertMsg = (cls: typeof sourceRootClass) => `An unknown root class '${cls.name}' was encountered while populating the nav prop reference type cache. This is a bug.`;
        assert(sourceType !== undefined, makeAssertMsg(sourceRootClass));
        assert(targetType !== undefined, makeAssertMsg(targetRootClass));
        propMap.set(prop.name.toLowerCase(), { source: sourceType, target: targetType });
      }
    }

    this._initedSchemas.set(schema.name, schema.schemaKey);
  }

  public getNavPropRefType(schemaName: string, className: string, propName: string): undefined | RelTypeInfo {
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
