/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */
import { Element, Entity } from "@itwin/core-backend";
import { ConcreteEntityId } from "./EntityUnifier";

// possible table types in current BisCore
// TODO: verify that it is impossible to have an id collision between two non-element entity tables (check preserveElementIdsForFiltering)
// TODO: verify the BisCore schema has no other real tables in an iModel before proceeding here
/** @internal */
export type EntityKey = ConcreteEntityId;

/** @internal */
export class EntityMap<V> {
  private _map = new Map<EntityKey, V>();

  public static makeKey(entity: Entity): EntityKey {
    return ConcreteEntityId.from(entity);
  }

  public has(entity: Entity) {
    return this._map.has(EntityMap.makeKey(entity)
    );
  }

  public set(entity: Entity, val: V): EntityMap<V> {
    this._map.set(EntityMap.makeKey(entity), val);
    return this;
  }

  public get(entity: Entity): V | undefined {
    return this._map.get(EntityMap.makeKey(entity));
  }

  public delete(entity: Entity): boolean {
    return this._map.delete(EntityMap.makeKey(entity));
  }

  public keys() {
    return this._map.keys();
  }

  public values() {
    return this._map.values();
  }

  public get size() {
    return this._map.size;
  }
}

