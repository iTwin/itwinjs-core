import { Id64String, RequireAtLeastOne } from "@itwin/core-bentley";
import { assert, expect } from "chai";
import { Element } from "../Element";
import { CodeProps, ElementLoadOptions, ElementLoadProps } from "@itwin/core-common";

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

export interface ElementKey {
  id?: Id64String;
  federationGuid?: string;
  code?: CodeProps;
}

export interface CachedElement {
  args?: ElementLoadOptions
  element: Element;
}


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
  private findElement(key: RequireAtLeastOne<ElementKey>): CachedElement | undefined {
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
  public delete(key: RequireAtLeastOne<ElementKey>): boolean {
    const cachedElement = this.findElement(key);
    if (cachedElement) {
      this._elementCache.delete(cachedElement.element.id);
      this._cacheByCode.delete(ElementLRUCache.makeCodeKey(cachedElement.element.code));
      if (cachedElement.element.federationGuid)
        this._cacheByFederationGuid.delete(cachedElement.element.federationGuid);
      return true;
    }
    return false;
  }
  public get(key: RequireAtLeastOne<ElementKey>): CachedElement | undefined {
    const cachedElement = this.findElement(key);
    if (cachedElement) {
      // Move the accessed element to the end of the cache
      this._elementCache.delete(cachedElement.element.id);
      this._elementCache.set(cachedElement.element.id, cachedElement);
    }
    return cachedElement;
  }
  public set(el: CachedElement): this {
    if (this._elementCache.has(el.element.id)) {
      this._elementCache.delete(el.element.id);
      this._elementCache.set(el.element.id, el);
    } else {
      this._elementCache.set(el.element.id, el);
    }

    if (el.element.federationGuid) {
      this._cacheByFederationGuid.set(el.element.federationGuid, el.element.id);
    }

    this._cacheByCode.set(ElementLRUCache.makeCodeKey(el.element.code), el.element.id);
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



describe.only('LruCache', () => {
  it('should store and retrieve values', () => {
    const cache = new LruCache<string, string>(3);

    cache.set('a', '1').set('b', '2').set('c', '3');
    expect(Array.from(cache.keys())).deep.equal(['a', 'b', 'c']);

    assert.equal(cache.get('a'), '1');
    expect(Array.from(cache.keys())).deep.equal(['b', 'c', 'a']);

    assert.equal(cache.get('b'), '2');
    expect(Array.from(cache.keys())).deep.equal(['c', 'a', 'b']);

    assert.equal(cache.get('c'), '3');
    expect(Array.from(cache.keys())).deep.equal(['a', 'b', 'c']);

    cache.set('d', '4');
    expect(Array.from(cache.keys())).deep.equal(['b', 'c', 'd']);

    cache.set('e', '5');
    expect(Array.from(cache.keys())).deep.equal(['c', 'd', 'e']);

    cache.set('f', '6');
    expect(Array.from(cache.keys())).deep.equal(['d', 'e', 'f']);

    expect(cache.get('a')).to.be.undefined;
    expect(cache.get('b')).to.be.undefined;
    expect(cache.get('c')).to.be.undefined;
    expect(cache.get('d')).to.equal('4');
    expect(cache.get('e')).to.equal('5');
    expect(cache.get('f')).to.equal('6');
    expect(cache[Symbol.toStringTag]).to.equal("LruCache(this.size=3, capacity=3)");
    expect(cache.size).to.equal(3);
    cache.clear();
    expect(cache.size).to.equal(0);
    expect(cache.get('d')).to.be.undefined;
    expect(cache.get('e')).to.be.undefined;
    expect(cache.get('f')).to.be.undefined;
    expect(cache[Symbol.toStringTag]).to.equal("LruCache(this.size=0, capacity=3)");
  });
});
