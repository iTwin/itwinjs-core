import { Id64String } from "@itwin/core-bentley";
import { CodeProps, ElementLoadOptions, ElementLoadProps, ElementProps } from "@itwin/core-common";

/* @internal */
export interface CachedElement {
  loadOptions: ElementLoadOptions
  elProps: ElementProps;
}

/**
 * A LRU cache for entities. Cache contains the ElementProps and the load options used to load it.
 * Cache can be searched by id, code or federationGuid.
 */
export class ElementLRUCache {
  public static readonly DEFAULT_CAPACITY = 2000;
  private _elementCache = new Map<Id64String, CachedElement>();
  private _cacheByCode = new Map<Id64String, Id64String>();
  private _cacheByFederationGuid = new Map<string, Id64String>();

  private static makeCodeKey(code: CodeProps): string {
    const keys = [code.scope, code.spec];
    if (code.value !== undefined) {
      keys.push(code.value);
    }
    return JSON.stringify(keys);
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
  public constructor(public readonly capacity = ElementLRUCache.DEFAULT_CAPACITY) { }
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
      if (cachedElement.elProps.id)
        this._elementCache.delete(cachedElement.elProps.id);
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
      if (cachedElement.elProps.id) {
        this._elementCache.delete(cachedElement.elProps.id);
        this._elementCache.set(cachedElement.elProps.id, cachedElement);
      }
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

    // do not cache this element as geom need to be rerender into geom props if any part changes
    // TODO: find a way to handle caching geometry
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
      const oldestElement = this._elementCache.get(oldestKey);
      this.delete({ id: oldestKey, federationGuid: oldestElement?.elProps.federationGuid, code: oldestElement?.elProps.code });
    }
    return this;
  }
  public get [Symbol.toStringTag](): string {
    return `EntityCache(this.size=${this.size}, capacity=${this.capacity})`;
  }
};
