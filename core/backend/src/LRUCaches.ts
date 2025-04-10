import { Id64String } from "@itwin/core-bentley";
import { CodeProps, ElementLoadOptions, ElementLoadProps, ElementProps } from "@itwin/core-common";

/* @internal */
export class LruCache<K, V>{
  private _cache = new Map<K, V>();
  public constructor(public readonly capacity: number) { }
  public get [Symbol.toStringTag](): string {
    return `LruCache(this.size=${this.size}, capacity=${this.capacity})`;
  }
  public clear(): void {
    this._cache.clear();
  }
  public delete(key: K): boolean {
    if (!this._cache.has(key)) {
      return false;
    }
    return this._cache.delete(key);
  }
  public get(key: K): V | undefined {
    const value = this._cache.get(key);
    if (value !== undefined) {
      this._cache.delete(key); // Remove the key from its current position
      this._cache.set(key, value); // Reinsert it at the end
    }
    return value;
  }
  public set(key: K, value: V): this {
    if (this._cache.has(key)) {
      this._cache.delete(key); // Remove the key from its current position
    }

    this._cache.set(key, value); // Insert it at the end

    if (this._cache.size > this.capacity) {
      const oldestKey = this._cache.keys().next().value as K; // Get the first key (oldest)

      this._cache.delete(oldestKey); // Remove the oldest key
    }
    return this;
  }
  public has(key: K): boolean {
    return this._cache.has(key);
  }
  public get size(): number {
    return this._cache.size;
  }
  public keys() {
    return this._cache.keys();
  }
  public values() {
    return this._cache.values();
  }
}



/* @internal */
export interface CachedElement {
  loadOptions: ElementLoadOptions
  elProps: ElementProps;
}

/* @internal */
export class ElementLRUCache {
  public static readonly DefaultCapacity = 2000;
  private _elementCache = new Map<Id64String, CachedElement>();
  private _cacheByCode = new Map<Id64String, Id64String>();
  private _cacheByFederationGuid = new Map<string, Id64String>();

  private static makeCodeKey(code: CodeProps): string {
    if (code.value)
      return `${code.scope}:${code.value}:${code.value}`;
    return `${code.scope}:${code.value}`;
  }
  private findElement(key: ElementLoadProps): CachedElement | undefined {
    if (key.id) {
      return this._elementCache.get(key.id);
    } else if (key.federationGuid) {
      const id = this._cacheByFederationGuid.get(key.federationGuid);
      if (id)
        return this._elementCache.get(id);
    } else if (key.code) {
      const id = this._cacheByCode.get(ElementLRUCache.makeCodeKey(key.code));
      if (id)
        return this._elementCache.get(id);
    } else {
      throw new Error("No key provided");
    }
    return undefined;
  }
  public constructor(public readonly capacity = ElementLRUCache.DefaultCapacity) { }
  public clear(): void {
    this._elementCache.clear();
    this._cacheByCode.clear();
    this._cacheByFederationGuid.clear();
  }
  public get size(): number {
    return this._elementCache.size;
  }
  public deleteWithModel(modelId: Id64String): void {
    this._elementCache.forEach((cachedVal, elementId) => {
      if (cachedVal.elProps.model === modelId)
        this.delete({ id: elementId });
    });
  }
  public delete(key: ElementLoadProps): boolean {
    const cachedElement = this.findElement(key);
    if (cachedElement) {
      this._elementCache.delete(cachedElement.elProps.id!);
      this._cacheByCode.delete(ElementLRUCache.makeCodeKey(cachedElement.elProps.code));
      if (cachedElement.elProps.federationGuid)
        this._cacheByFederationGuid.delete(cachedElement.elProps.federationGuid);
      return true;
    }
    return false;
  }
  public get(key: ElementLoadProps): CachedElement | undefined {
    const cachedElement = this.findElement(key);
    if (cachedElement) {
      // Move the accessed element to the end of the cache
      this._elementCache.delete(cachedElement.elProps.id!);
      this._elementCache.set(cachedElement.elProps.id!, cachedElement);
    }

    if (cachedElement) {
      if (key.displayStyle !== cachedElement.loadOptions.displayStyle ||
        key.onlyBaseProperties !== cachedElement.loadOptions.onlyBaseProperties ||
        key.renderTimeline !== cachedElement.loadOptions.renderTimeline ||
        key.wantBRepData !== cachedElement.loadOptions.wantBRepData ||
        key.wantGeometry !== cachedElement.loadOptions.wantGeometry) {
        return undefined
      }
    }
    return cachedElement;
  }
  public set(el: CachedElement): this {
    if (!el.elProps.id)
      throw new Error("Element must have an id");

    // WIP do not cache this as geom need to be rerender into geom props if any part changes
    if (el.loadOptions.wantGeometry) {
      return this;
    }

    if (this._elementCache.has(el.elProps.id)) {
      this._elementCache.delete(el.elProps.id);
      this._elementCache.set(el.elProps.id, el);
    } else {
      this._elementCache.set(el.elProps.id, el);
    }

    if (el.elProps.federationGuid) {
      this._cacheByFederationGuid.set(el.elProps.federationGuid, el.elProps.id);
    }

    this._cacheByCode.set(ElementLRUCache.makeCodeKey(el.elProps.code), el.elProps.id);
    if (this._elementCache.size > this.capacity) {
      const oldestKey = this._elementCache.keys().next().value as Id64String;
      this.delete({ id: oldestKey });
    }
    return this;
  }
  public get [Symbol.toStringTag](): string {
    return `EntityCache(this.size=${this.size}, capacity=${this.capacity})`;
  }
};
