import { IModelJsNative } from "@bentley/imodeljs-native";
import { Id64, Id64String, ITwinError } from "@itwin/core-bentley";
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
      ITwinError.throwError<ITwinError>({ message: "No key provided", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });
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
      ITwinError.throwError<ITwinError>({ message: "Element must have an id", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

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

/* @internal */
interface CachedArgs {
  id?: Id64String;
  code?: string;
  federationGuid?: Id64String;
}

/**
 * A map to store instance keys based on different optional arguments like id, code, or federationGuid.
 * This allows the cache to be searched by any combination of arguments.
 */
class ArgumentsToResultMap {
  private _idToResult = new Map<Id64String, IModelJsNative.ResolveInstanceKeyResult>();
  private _codeToResult = new Map<string, IModelJsNative.ResolveInstanceKeyResult>();
  private _federationGuidToResult = new Map<Id64String, IModelJsNative.ResolveInstanceKeyResult>();

  public constructor() { }

  public set(args: CachedArgs, result: IModelJsNative.ResolveInstanceKeyResult): void {
    if (!args.id && !args.code && !args.federationGuid)
      ITwinError.throwError<ITwinError>({ message: "At least one id, code, or federationGuid must be provided", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    if (args.id)
      this._idToResult.set(args.id, result);
    else
      this._idToResult.set(result.id, result);

    if (args.code)
      this._codeToResult.set(args.code, result);
    if (args.federationGuid)
      this._federationGuidToResult.set(args.federationGuid, result);
  }
  public get(args: CachedArgs): IModelJsNative.ResolveInstanceKeyResult | undefined {
    if (!args.id && !args.code && !args.federationGuid)
      ITwinError.throwError<ITwinError>({ message: "At least one id, code, or federationGuid must be provided", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    if (args.id)
      return this._idToResult.get(args.id);
    else if (args.code)
      return this._codeToResult.get(args.code);
    else if (args.federationGuid)
      return this._federationGuidToResult.get(args.federationGuid);
    return undefined;
  }
  public delete(args: CachedArgs): boolean {
    if (!args.id && !args.code && !args.federationGuid)
      ITwinError.throwError<ITwinError>({ message: "At least one id, code, or federationGuid must be provided", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    let deleted = false;
    if (args.id)
      deleted = this._idToResult.delete(args.id) ? true : deleted;
    if (args.code)
      deleted = this._codeToResult.delete(args.code) ? true : deleted;
    if (args.federationGuid)
      deleted = this._federationGuidToResult.delete(args.federationGuid) ? true : deleted;
    return deleted;
  }
  public clear(): void {
    this._idToResult.clear();
    this._codeToResult.clear();
    this._federationGuidToResult.clear();
  }
  public get size(): number {
    return this._idToResult.size; // Id to key will always be stored even if code or federationGuid are not provided.
  }
  public get [Symbol.toStringTag](): string {
    return `idCacheSize=${this._idToResult.size}, codeCacheSize=${this._codeToResult.size}, federationGuidCacheSize=${this._federationGuidToResult.size}`;
  }
}

/**
 * A LRU cache for entities. Cache contains the ElementProps and the load options used to load it.
 * Cache can be searched by id, code or federationGuid.
 */
export class InstanceKeyLRUCache {
  public static readonly DEFAULT_CAPACITY = 2000;
  private _argsToResultCache = new ArgumentsToResultMap();
  private _resultToArgsCache = new Map<Id64String, CachedArgs>();

  public constructor(public readonly capacity = ElementLRUCache.DEFAULT_CAPACITY) { }

  public set(key: IModelJsNative.ResolveInstanceKeyArgs, result: IModelJsNative.ResolveInstanceKeyResult): this {
    if (!result.id || !Id64.isValidId64(result.id))
      ITwinError.throwError<ITwinError>({ message: "Invalid InstanceKey result", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    const cacheArgs: CachedArgs = InstanceKeyLRUCache.makeCachedArgs(key);
    cacheArgs.id = cacheArgs.id ? cacheArgs.id : result.id;
    const existingArgs = this._resultToArgsCache.get(result.id);
    if (existingArgs) {
      // Combine existing args with new args for more complete key
      this._argsToResultCache.delete(existingArgs);
      const combinedArgs: CachedArgs = InstanceKeyLRUCache.combineCachedArgs(existingArgs, cacheArgs);
      this._argsToResultCache.set(combinedArgs, result);
      this._resultToArgsCache.set(result.id, combinedArgs);
    } else {
      this._argsToResultCache.set(cacheArgs, result);
      this._resultToArgsCache.set(result.id, cacheArgs);
    }

    if (this._resultToArgsCache.size > this.capacity) {
      const oldestKey = this._resultToArgsCache.keys().next().value as Id64String;
      const oldestArgs = this._resultToArgsCache.get(oldestKey);
      this.deleteCachedArgs({id: oldestArgs?.id,code: oldestArgs?.code, federationGuid: oldestArgs?.federationGuid});
    }
    return this;
  }
  public get(key: IModelJsNative.ResolveInstanceKeyArgs): IModelJsNative.ResolveInstanceKeyResult | undefined {
    const args = InstanceKeyLRUCache.makeCachedArgs(key);
    const cachedResult = this._argsToResultCache.get(args);
    if (cachedResult) {
      // Pop the cached result to the end of the cache to mark it as recently used
      const cachedArgs = this._resultToArgsCache.get(cachedResult.id);
      if (cachedArgs) {
        this._resultToArgsCache.delete(cachedResult.id);
        this._resultToArgsCache.set(cachedResult.id, cachedArgs);
      }
    }
    return cachedResult;
  }
  public deleteById(id: string): boolean {
    if (!Id64.isValidId64(id))
      ITwinError.throwError<ITwinError>({ message: "Invalid id provided", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    const cacheArgs = {
      id: Id64.fromString(id),
    }
    return this.deleteCachedArgs(cacheArgs);
  }
  public delete(key: IModelJsNative.ResolveInstanceKeyArgs): boolean {
    const cacheArgs = InstanceKeyLRUCache.makeCachedArgs(key);
    return this.deleteCachedArgs(cacheArgs);
  }
  private deleteCachedArgs(key: CachedArgs): boolean {
    const result = this._argsToResultCache.get(key);
    if (result) {
      const argsToDelete = this._resultToArgsCache.get(result.id);
      this._argsToResultCache.delete({id: argsToDelete?.id, code: argsToDelete?.code, federationGuid: argsToDelete?.federationGuid});
      this._resultToArgsCache.delete(result.id);
      return true;
    }
    return false;
  }
  private static makeCachedArgs(args: IModelJsNative.ResolveInstanceKeyArgs): CachedArgs {
    if (!args.partialKey && !args.code && !args.federationGuid)
      ITwinError.throwError<ITwinError>({ message: "ResolveInstanceKeyArgs must have a partialKey, code, or federationGuid", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    return {
      id: args.partialKey?.id,
      code: args.code ? InstanceKeyLRUCache.makeCodeKey(args.code) : undefined,
      federationGuid: args.federationGuid,
    };
  }
  private static combineCachedArgs(originalArgs: CachedArgs, newArgs: CachedArgs): CachedArgs {
    if (!originalArgs.id && !originalArgs.code && !originalArgs.federationGuid && !newArgs.id && !newArgs.code && !newArgs.federationGuid)
      ITwinError.throwError<ITwinError>({ message: "ResolveInstanceKeyArgs must have a partialKey, code, or federationGuid", iTwinErrorId: { scope: "imodel-cache", key: "invalid-arguments" } });

    return {
      id: newArgs.id ? newArgs.id : originalArgs.id,
      code: newArgs.code ? newArgs.code : originalArgs.code,
      federationGuid: newArgs.federationGuid ? newArgs.federationGuid : originalArgs.federationGuid,
    };
  }
  private static makeCodeKey(code: CodeProps): string {
    const keys = [code.scope, code.spec];
    if (code.value !== undefined) {
      keys.push(code.value);
    }
    return JSON.stringify(keys);
  }
  public clear(): void {
    this._argsToResultCache.clear();
    this._resultToArgsCache.clear();
  }
  public get size(): number {
    return this._resultToArgsCache.size;
  }
  public get [Symbol.toStringTag](): string {
    return `InstanceKeyCache(size=${this.size}, capacity=${this.capacity})`;
  }
};