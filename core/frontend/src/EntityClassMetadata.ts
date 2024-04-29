/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { Id64, Id64Array, Id64String, Logger } from "@itwin/core-bentley";
import { EntityClassMetadataProps } from "@itwin/core-common";
import { FrontendLoggerCategory } from "./core-frontend";

export class EntityClassMetadata {
  public readonly name: string;
  public readonly id: Id64String;
  private readonly _baseClasses: EntityClassMetadata[] = [];
  private readonly _classes: EntityClassesMetadata;

  /** @internal */
  public constructor(props: { name: string, id: Id64String }, classes: EntityClassesMetadata) {
    this.name = props.name;
    this.id = props.id;
    this._classes = classes;
  }

  public get baseClasses(): ReadonlyArray<EntityClassMetadata> {
    return this._baseClasses;
  }

  public get isValid(): boolean {
    return this.name !== "";
  }

  public is(base: Id64String | string | EntityClassMetadata): boolean {
    if (!this.isValid) {
      return false;
    }

    const baseMeta = typeof base === "string" ? this._classes.find(base) : base;
    if (!baseMeta) {
      return false;
    }

    if (this.id === baseMeta.id) {
      return true;
    }

    for (const superMeta of this.baseClasses) {
      if (superMeta.is(baseMeta)) {
        return true;
      }
    }

    return false;
  }

  /** @internal */
  public addBaseClass(base: EntityClassMetadata): void {
    this._baseClasses.push(base);
  }
}

export interface LoadEntityClassMetadataArgs {
  classIdsToLoad: Id64Array;
  knownClassIds: Id64Array;
}

export type LoadEntityClassesMetadata = (args: LoadEntityClassMetadataArgs) => Promise<EntityClassMetadataProps[]>;

export interface LoadedEntityClassesMetadata {
  get(classNameOrId: string | Id64String): EntityClassMetadata;
}

export class EntityClassesMetadata implements Iterable<EntityClassMetadata> {
  private readonly _loaded = new Map<Id64String, EntityClassMetadata>();
  private readonly _load: LoadEntityClassesMetadata;

  public constructor(load: LoadEntityClassesMetadata) {
    this._load = load;
  }

  public async load(classIds: Iterable<Id64String>): Promise<LoadedEntityClassesMetadata> {
    const classIdsToLoad = [];
    for (const classId of classIds) {
      if (!this._loaded.has(classId)) {
        classIdsToLoad.push(classId);
      }
    }

    if (classIdsToLoad.length === 0) {
      return this;
    }

    let props: EntityClassMetadataProps[] = [];
    try {
      const knownClassIds = Array.from(this._loaded.keys());
      props = await this._load({ classIdsToLoad, knownClassIds });
    } catch (e) {
      Logger.logException(FrontendLoggerCategory.NativeApp, e);
    }

    // First, add entries for any classes not already present.
    const added: EntityClassMetadataProps[] = [];
    for (const prop of props) {
      if (!this._loaded.get(prop.id)) {
        added.push(prop);
        this.add(prop);
      }
    }

    // Now fill in the lists of baseClasses
    for (const prop of added) {
      const meta = this.get(prop.id);
      for (const baseId of prop.baseClasses) {
        meta.addBaseClass(this.get(baseId));
      }
    }

    // Handle any requested class Ids that were not included in the response.
    for (const id of classIdsToLoad) {
      if (!this.find(id)) {
        this.add({ id, name: "" });
      }
    }
    
    return this;
  }

  /** @internal */
  public get(classIdOrName: Id64String | string): EntityClassMetadata {
    const found = this.find(classIdOrName);
    if (!found) {
      throw new Error(`Class "${classIdOrName}" is not loaded`);
    }

    return found;
  }

  public find(classIdOrName: Id64String | string): EntityClassMetadata | undefined {
    if (Id64.isValidId64(classIdOrName)) {
      return this._loaded.get(classIdOrName);
    }

    classIdOrName = classIdOrName.toLowerCase();
    for (const entry of this._loaded.values()) {
      if (entry.name.localeCompare(classIdOrName) === 0) {
        return entry;
      }
    }

    return undefined;
  }

  public [Symbol.iterator](): Iterator<EntityClassMetadata> { return this._loaded.values(); }

  /** @internal Exposed strictly for tests. */
  public add(props: { id: Id64String, name: string }): EntityClassMetadata {
    const meta = new EntityClassMetadata(props, this);
    this._loaded.set(props.id, meta);
    return meta;
  }
}
