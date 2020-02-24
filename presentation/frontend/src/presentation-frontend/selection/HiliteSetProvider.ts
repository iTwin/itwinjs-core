/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { once } from "lodash";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  DefaultContentDisplayTypes, KeySet, DEFAULT_KEYS_BATCH_SIZE, ContentFlags, Key, Item,
  Content, DescriptorOverrides, ContentRequestOptions, Ruleset,
} from "@bentley/presentation-common";
import { TRANSIENT_ELEMENT_CLASSNAME } from "./SelectionManager"; /* tslint:disable-line:no-direct-imports */
import { Presentation } from "../Presentation";

/** @internal */
// tslint:disable-next-line: no-var-requires
export const HILITE_RULESET: Ruleset = require("./HiliteRules.json");

/** The function registers `HILITE_RULESET` the first time it's called and does nothing on other calls */
const registerRuleset = once(async () => Presentation.presentation.rulesets().add(HILITE_RULESET));

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
  private _cached: undefined | { keysGuid: string, result: HiliteSet };

  private constructor(props: HiliteSetProviderProps) {
    this._imodel = props.imodel;
  }

  /**
   * Create a hilite set provider for the specified iModel.
   */
  public static create(props: HiliteSetProviderProps) { return new HiliteSetProvider(props); }

  private async getRecords(keys: KeySet): Promise<Item[]> {
    const options: ContentRequestOptions<IModelConnection> = {
      imodel: this._imodel,
      rulesetOrId: HILITE_RULESET.id,
    };
    const descriptor: DescriptorOverrides = {
      displayType: DefaultContentDisplayTypes.Viewport,
      contentFlags: ContentFlags.KeysOnly,
      hiddenFieldNames: [],
    };
    const contentPromises = new Array<Promise<Content | undefined>>();
    keys.forEachBatch(DEFAULT_KEYS_BATCH_SIZE, (batch: KeySet) => {
      contentPromises.push(Presentation.presentation.getContent(options, descriptor, batch));
    });
    return (await Promise.all(contentPromises)).reduce((items, content) => {
      if (content)
        items.push(...content.contentSet);
      return items;
    }, new Array<Item>());
  }

  private createHiliteSet(records: Item[], transientIds: Id64String[]) {
    if (!records.length)
      return { elements: transientIds };

    const modelIds = new Array<Id64String>();
    const subCategoryIds = new Array<Id64String>();
    const elementIds = transientIds; // note: not making a copy here since we're throwing away `transientIds` anyway
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

  /**
   * Get hilite set for instances and/or nodes whose keys are specified in the
   * given KeySet.
   *
   * Note: The provider caches result of the last request, so subsequent requests
   * for the same input doesn't cost.
   */
  public async getHiliteSet(selection: Readonly<KeySet>): Promise<HiliteSet> {
    await registerRuleset();
    if (!this._cached || this._cached.keysGuid !== selection.guid) {
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
      const records = await this.getRecords(keys);
      const result = this.createHiliteSet(records, transientIds);
      this._cached = { keysGuid: selection.guid, result };
    }
    return this._cached.result;
  }
}

const isModelRecord = (rec: Item) => (rec.extendedData && rec.extendedData.isModel);

const isSubCategoryRecord = (rec: Item) => (rec.extendedData && rec.extendedData.isSubCategory);
