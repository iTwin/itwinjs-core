/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import { once } from "lodash";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  DefaultContentDisplayTypes, KeySet, ContentFlags, Key, Item,
  Content, DescriptorOverrides, ContentRequestOptions, Paged, Ruleset,
} from "@bentley/presentation-common";
import { TRANSIENT_ELEMENT_CLASSNAME } from "./SelectionManager"; /* tslint:disable-line:no-direct-imports */
import { Presentation } from "../Presentation";

/** @internal */
// tslint:disable-next-line: no-var-requires
export const HILITE_RULESET: Ruleset = require("./HiliteRules.json");

/** The function registers HILITE_RULESET the first time it's called and does nothing on other calls */
const registerRuleset = once(async () => Presentation.presentation.rulesets().add(HILITE_RULESET));

/**
 * A set of model, subcategory and element ids that can be used for specifying
 * viewport hilite.
 *
 * @alpha
 */
export interface HiliteSet {
  models?: Id64String[];
  subCategories?: Id64String[];
  elements?: Id64String[];
}

/**
 * Presentation-based provider which uses presentation ruleset to determine
 * what `HiliteSet` should be hilited in the graphics viewport based on the
 * supplied `KeySet`.
 *
 * @internal
 */
export class HiliteSetProvider {
  private _imodel: IModelConnection;
  private _pageSize = 1000;
  private _cached: undefined | { keysGuid: string, result: HiliteSet };

  private constructor(imodel: IModelConnection) {
    this._imodel = imodel;
  }

  public static create(imodel: IModelConnection) { return new HiliteSetProvider(imodel); }

  private async getPage(descriptor: DescriptorOverrides, keys: KeySet, pageIndex: number): Promise<Content | undefined> {
    const options: Paged<ContentRequestOptions<IModelConnection>> = {
      imodel: this._imodel,
      rulesetId: HILITE_RULESET.id,
      paging: {
        start: pageIndex * this._pageSize,
        size: this._pageSize,
      },
    };
    return Presentation.presentation.getContent(options, descriptor, keys);
  }

  private async getRecords(keys: KeySet): Promise<Item[]> {
    const descriptor: DescriptorOverrides = {
      displayType: DefaultContentDisplayTypes.Viewport,
      contentFlags: ContentFlags.KeysOnly,
      hiddenFieldNames: [],
    };
    let pageIndex = 0;
    let content = await this.getPage(descriptor, keys, pageIndex++);
    const result = new Array<Item>();
    while (content && content.contentSet.length) {
      content.contentSet.forEach((rec) => result.push(rec));
      content = await this.getPage(descriptor, keys, pageIndex++);
    }
    return result;
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
