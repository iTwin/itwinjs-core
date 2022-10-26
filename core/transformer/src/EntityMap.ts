/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */
import { EntityReference } from "@itwin/core-common";
import { ConcreteEntity, EntityReferences } from "@itwin/core-backend";

/** @internal */
export type EntityKey = EntityReference;

/** @internal */
export class EntityMap<V> {
  private _map = new Map<EntityKey, V>();

  public static makeKey(entity: ConcreteEntity): EntityKey {
    return EntityReferences.from(entity);
  }

  public clear(): void {
    return this._map.clear();
  }

  public has(entity: ConcreteEntity) {
    return this._map.has(EntityMap.makeKey(entity)
    );
  }

  public set(entity: ConcreteEntity, val: V): EntityMap<V> {
    return this.setByKey(EntityMap.makeKey(entity), val);
  }

  public setByKey(k: EntityKey, val: V): EntityMap<V> {
    this._map.set(k, val);
    return this;
  }

  public get(entity: ConcreteEntity): V | undefined {
    return this.getByKey(EntityMap.makeKey(entity));
  }

  public getByKey(k: EntityKey): V | undefined {
    return this._map.get(k);
  }

  public delete(entity: ConcreteEntity): boolean {
    return this.deleteByKey(EntityMap.makeKey(entity));
  }

  public deleteByKey(k: EntityKey): boolean {
    return this._map.delete(k);
  }

  public keys() {
    return this._map.keys();
  }

  public values() {
    return this._map.values();
  }

  public entries() {
    return this._map.entries();
  }

  public [Symbol.iterator]() {
    return this._map[Symbol.iterator]();
  }

  public get size() {
    return this._map.size;
  }
}

