/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { from, Observable, shareReplay } from "rxjs";
import { eachValueFrom } from "rxjs-for-await";
import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import {
  ContentFlags, DEFAULT_KEYS_BATCH_SIZE, DefaultContentDisplayTypes, DescriptorOverrides, Item, Key, KeySet, Ruleset,
} from "@itwin/presentation-common";
import { Presentation } from "../Presentation";
import { TRANSIENT_ELEMENT_CLASSNAME } from "./SelectionManager";

/** @internal */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const HILITE_RULESET: Ruleset = require("./HiliteRules.json");

/**
 * A set of model, subcategory and element ids that can be used for specifying
 * viewport hilite.
 *
 * @public
 */
export interface HiliteSet {
  models?: Id64String[];
  subCategories?: Id64String[];
  elements?: Id64String[];
}

/**
 * Properties for creating a `HiliteSetProvider` instance.
 * @public
 */
export interface HiliteSetProviderProps {
  imodel: IModelConnection;
}

/**
 * Presentation-based provider which uses presentation ruleset to determine
 * what `HiliteSet` should be hilited in the graphics viewport based on the
 * supplied `KeySet`.
 *
 * @public
 */
export class HiliteSetProvider {
  private _imodel: IModelConnection;
  private _cache: undefined | { keysGuid: string, observable: Observable<HiliteSet> };

  private constructor(props: HiliteSetProviderProps) {
    this._imodel = props.imodel;
  }

  /**
   * Create a hilite set provider for the specified iModel.
   */
  public static create(props: HiliteSetProviderProps) { return new HiliteSetProvider(props); }

  /**
   * Get hilite set for instances and/or nodes whose keys are specified in the
   * given KeySet.
   *
   * Note: The provider caches result of the last request, so subsequent requests
   * for the same input doesn't cost.
   */
  public async getHiliteSet(selection: Readonly<KeySet>): Promise<HiliteSet> {
    const modelIds = new Array<Id64String>();
    const subCategoryIds = new Array<Id64String>();
    const elementIds = new Array<Id64String>();

    const iterator = this.getHiliteSetIterator(selection);
    for await (const set of iterator) {
      modelIds.push(...set.models ?? []);
      subCategoryIds.push(...set.subCategories ?? []);
      elementIds.push(...set.elements ?? []);
    }

    return {
      models: modelIds.length ? modelIds : undefined,
      subCategories: subCategoryIds.length ? subCategoryIds : undefined,
      elements: elementIds.length ? elementIds : undefined,
    };
  }

  /**
   * Get hilite set iterator for provided keys. It loads content in batches and
   * yields hilite set created from each batch after it is loaded.
   */
  public getHiliteSetIterator(selection: Readonly<KeySet>) {
    if (!this._cache || this._cache.keysGuid !== selection.guid) {
      this._cache = {
        keysGuid: selection.guid,
        observable: from(this.createHiliteSetIterator(selection)).pipe(shareReplay({ refCount: true })),
      };
    }

    return eachValueFrom(this._cache.observable);
  }

  private async * createHiliteSetIterator(selection: Readonly<KeySet>) {
    const {keys, transientIds} = this.handleTransientKeys(selection);
    const {options, keyBatches} = this.getContentOptions(keys);

    if (transientIds.length !== 0) {
      yield { elements: transientIds };
    }

    for (const batch of keyBatches) {
      let loadedItems = 0;
      while (true) {
        const content = await Presentation.presentation.getContentAndSize({...options, paging: {start: loadedItems, size: CONTENT_SET_PAGE_SIZE}, keys: batch});
        if (!content) {
          break;
        }

        const result = this.createHiliteSet(content.content.contentSet);
        yield result;

        loadedItems += content.content.contentSet.length;
        if (loadedItems >= content.size) {
          break;
        }
      }
    }
  }

  private createHiliteSet(records: Item[]): HiliteSet {
    const modelIds = new Array<Id64String>();
    const subCategoryIds = new Array<Id64String>();
    const elementIds = new Array<Id64String>();
    records.forEach((rec) => {
      const ids = isModelRecord(rec) ? modelIds : isSubCategoryRecord(rec) ? subCategoryIds : elementIds;
      rec.primaryKeys.forEach((pk) => ids.push(pk.id));
    });
    return {
      models: modelIds.length ? modelIds : undefined,
      subCategories: subCategoryIds.length ? subCategoryIds : undefined,
      elements: elementIds.length ? elementIds : undefined,
    };
  }

  private getContentOptions(keys: KeySet) {
    const descriptor: DescriptorOverrides = {
      displayType: DefaultContentDisplayTypes.Viewport,
      contentFlags: ContentFlags.KeysOnly,
    };
    const options = {
      imodel: this._imodel,
      rulesetOrId: HILITE_RULESET,
      descriptor,
    };
    const keyBatches = new Array<KeySet>();
    keys.forEachBatch(DEFAULT_KEYS_BATCH_SIZE, (batch: KeySet) => {
      keyBatches.push(batch);
    });
    return {
      options,
      keyBatches,
    };
  }

  private handleTransientKeys(selection: Readonly<KeySet>) {
    // need to create a new set without transients
    const transientIds = new Array<Id64String>();
    const keys = new KeySet();
    keys.add(selection, (key: Key) => {
      if (Key.isInstanceKey(key) && key.className === TRANSIENT_ELEMENT_CLASSNAME) {
        transientIds.push(key.id);
        return false;
      }
      return true;
    });
    return {
      transientIds,
      keys,
    };
  }
}

const CONTENT_SET_PAGE_SIZE = 1000;

const isModelRecord = (rec: Item) => (rec.extendedData && rec.extendedData.isModel);

const isSubCategoryRecord = (rec: Item) => (rec.extendedData && rec.extendedData.isSubCategory);
