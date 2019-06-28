/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as _ from "lodash";
import { IDisposable, Logger } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  KeySet, DEFAULT_KEYS_BATCH_SIZE, PageOptions, SelectionInfo,
  ContentRequestOptions, Content, Descriptor, Field,
  Ruleset, RegisteredRuleset, DescriptorOverrides,
} from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { IPresentationDataProvider } from "./IPresentationDataProvider";

/**
 * Properties for invalidating content cache.
 * @public
 */
export interface CacheInvalidationProps {
  /**
   * Invalidate content descriptor. Should be set when invalidating
   * after changing anything that affects how the descriptor is built:
   * `keys`, `selectionInfo`, `imodel`, `rulesetId`.
   */
  descriptor?: boolean;

  /**
   * Invalidate configured content descriptor. Should be set when
   * invalidating something that affects how descriptor is configured
   * in the `configureContentDescriptor` callback, e.g. hidden fields,
   * sorting, filtering, etc.
   */
  descriptorConfiguration?: boolean;

  /**
   * Invalidate cached content size. Should be set after changing anything
   * that may affect content size. Generally, it should always be set when
   * the `descriptor` flag is set. Additionally, it should also be set after
   * setting `filterExpression` or similar descriptor properties.
   */
  size?: boolean;

  /**
   * Invalidate cached content. Should be set after changing anything that may
   * affect content. Generally, it should always be set when the `descriptor`
   * flag is set. Additionally, it should also be set after setting `sortingField`,
   * `sortDirection`, `filterExpression` and similar fields.
   */
  content?: boolean;
}
/** @public */
namespace CacheInvalidationProps {
  /**
   * Create CacheInvalidationProps to fully invalidate all caches.
   */
  export const full = (): CacheInvalidationProps => ({ descriptor: true, descriptorConfiguration: true, size: true, content: true });
}

/**
 * Interface for all presentation-driven content providers.
 * @public
 */
export interface IContentDataProvider extends IPresentationDataProvider, IDisposable {
  /** Display type used to format content */
  readonly displayType: string;
  /** Keys defining what to request content for */
  keys: KeySet;
  /** Information about selection event that results in content change */
  selectionInfo: SelectionInfo | undefined;

  /**
   * Get the content descriptor.
   */
  getContentDescriptor: () => Promise<Descriptor | undefined>;

  /**
   * Get the number of content records.
   */
  getContentSetSize: () => Promise<number>;

  /**
   * Get the content.
   * @param pageOptions Paging options.
   */
  getContent: (pageOptions?: PageOptions) => Promise<Content | undefined>;
}

/**
 * Base class for all presentation-driven content providers.
 * @public
 */
export class ContentDataProvider implements IContentDataProvider {
  private _imodel: IModelConnection;
  private _rulesetId: string;
  private _displayType: string;
  private _keys: KeySet;
  private _previousKeysGuid: string;
  private _selectionInfo?: SelectionInfo;
  private _registeredRuleset?: RegisteredRuleset;
  private _isDisposed?: boolean;
  private _pagingSize?: number;

  /**
   * Constructor.
   * @param imodel IModel to pull data from.
   * @param ruleset Id of the ruleset to use when requesting content or a ruleset itself.
   * @param displayType The content display type which this provider is going to
   * load data for.
   */
  constructor(imodel: IModelConnection, ruleset: string | Ruleset, displayType: string) {
    this._rulesetId = (typeof ruleset === "string") ? ruleset : ruleset.id;
    this._displayType = displayType;
    this._imodel = imodel;
    this._keys = new KeySet();
    this._previousKeysGuid = this._keys.guid;
    this.invalidateCache(CacheInvalidationProps.full());
    if (typeof ruleset === "object") {
      this.registerRuleset(ruleset); // tslint:disable-line: no-floating-promises
    }
  }

  /** Destructor. Must be called to clean up.  */
  public dispose() {
    this._isDisposed = true;
    this.disposeRegisteredRuleset();
  }

  private disposeRegisteredRuleset() {
    if (!this._registeredRuleset)
      return;

    this._registeredRuleset.dispose();
    this._registeredRuleset = undefined;
  }

  private async registerRuleset(ruleset: Ruleset) {
    this._registeredRuleset = await Presentation.presentation.rulesets().add(ruleset);
    if (this._isDisposed) {
      // ensure we don't keep a hanging registered ruleset if the data provider
      // gets destroyed before the ruleset finishes registration
      this.disposeRegisteredRuleset();
    }
  }

  /** Display type used to format content */
  public get displayType(): string { return this._displayType; }

  /**
   * Paging options for obtaining content.
   *
   * Presentation data providers, when used with paging, have ability to save one backend request for size / count. That
   * can only be achieved when `pagingSize` property is set on the data provider and it's value matches size which is used when
   * requesting content. To help developers notice this problem, data provider emits a warning similar to this:
   * ```
   * ContentDataProvider.pagingSize doesn't match pageOptions in ContentDataProvider.getContent call. Make sure you set provider's pagingSize to avoid excessive backend requests.
   * ```
   * To fix the issue, developers should make sure the page size used for requesting data is also set for the data provider:
   * ```TS
   * const pageSize = 10;
   * const provider = new ContentDataProvider(imodel, rulesetId, displayType);
   * provider.pagingSize = pageSize;
   * // only one backend request is made for the two following requests:
   * provider.getContentSetSize();
   * provider.getContent({ start: 0, size: pageSize });
   * ```
   */
  public get pagingSize(): number | undefined { return this._pagingSize; }
  public set pagingSize(value: number | undefined) { this._pagingSize = value; }

  /** IModel to pull data from */
  public get imodel(): IModelConnection { return this._imodel; }
  public set imodel(imodel: IModelConnection) {
    if (this._imodel === imodel)
      return;

    this._imodel = imodel;
    this.invalidateCache(CacheInvalidationProps.full());
  }

  /** Id of the ruleset to use when requesting content */
  public get rulesetId(): string { return this._rulesetId; }
  public set rulesetId(value: string) {
    if (this._rulesetId === value)
      return;

    this._rulesetId = value;
    this.invalidateCache(CacheInvalidationProps.full());
  }

  /** Keys defining what to request content for */
  public get keys() { return this._keys; }
  public set keys(keys: KeySet) {
    if (keys.guid === this._previousKeysGuid)
      return;

    this._keys = keys;
    this._previousKeysGuid = this._keys.guid;
    this.invalidateCache(CacheInvalidationProps.full());
  }

  /** Information about selection event that results in content change */
  public get selectionInfo() { return this._selectionInfo; }
  public set selectionInfo(info: SelectionInfo | undefined) {
    if (this._selectionInfo === info)
      return;

    this._selectionInfo = info;
    this.invalidateCache(CacheInvalidationProps.full());
  }

  /**
   * Invalidates cached content.
   */
  protected invalidateCache(props: CacheInvalidationProps): void {
    if (props.descriptor && this.getDefaultContentDescriptor)
      this.getDefaultContentDescriptor.cache.clear!();
    if (props.descriptorConfiguration && this.getContentDescriptor)
      this.getContentDescriptor.cache.clear!();
    if ((props.content || props.size) && this._getContentAndSize)
      this._getContentAndSize.cache.clear!();
  }

  private createRequestOptions(): ContentRequestOptions<IModelConnection> {
    return {
      imodel: this._imodel,
      rulesetId: this._rulesetId,
    };
  }

  /**
   * Called to configure the content descriptor. This is the place where concrete
   * provider implementations can control things like sorting, filtering, hiding fields, etc.
   *
   * The default method implementation takes care of hiding properties. Subclasses
   * should call the base class method to not lose this functionality.
   */
  protected configureContentDescriptor(descriptor: Readonly<Descriptor>): Descriptor {
    const fields = descriptor.fields.slice();
    const fieldsCount = fields.length;
    for (let i = fieldsCount - 1; i >= 0; --i) {
      const field = fields[i];
      if (this.shouldExcludeFromDescriptor(field))
        fields.splice(i, 1);
    }
    return new Descriptor({ ...descriptor, fields });
  }

  /**
   * Called to check whether the content descriptor needs advanced configuration. If yes,
   * descriptor is requested from the backend and `configureContentDescriptor()` is called
   * to configure it before requesting content. If not, the provider calls
   * `getDescriptorOverrides()` to get basic configuration and immediately requests
   * content - that saves a trip to the backend.
   */
  protected shouldConfigureContentDescriptor(): boolean { return true; }

  /**
   * Called to check if content should be requested even when `keys` is empty. If this
   * method returns `false`, then content is not requested and this saves a trip
   * to the backend.
   */
  protected shouldRequestContentForEmptyKeyset(): boolean { return false; }

  /** Called to check whether the field should be excluded from the descriptor. */
  protected shouldExcludeFromDescriptor(field: Field): boolean { return this.isFieldHidden(field); }

  /** Called to check whether the field should be hidden. */
  protected isFieldHidden(_field: Field): boolean { return false; }

  /**
   * Get the content descriptor overrides.
   *
   * **Note:** The method is only called if `shouldConfigureContentDescriptor()` returns `false` -
   * in that case when requesting content we skip requesting descriptor and instead just pass
   * overrides.
   */
  protected getDescriptorOverrides(): DescriptorOverrides {
    return {
      displayType: this.displayType,
      contentFlags: 0,
      hiddenFieldNames: [],
    };
  }

  // tslint:disable-next-line:naming-convention
  private getDefaultContentDescriptor = _.memoize(async (): Promise<Descriptor | undefined> => {
    // istanbul ignore if
    if (this.keys.size > DEFAULT_KEYS_BATCH_SIZE) {
      const msg = `ContentDataProvider.getContentDescriptor requesting descriptor with ${this.keys.size} keys which
        exceeds the suggested size of ${DEFAULT_KEYS_BATCH_SIZE}. Possible "HTTP 413 Payload Too Large" error.`;
      Logger.logWarning("Presentation.Components", msg);
    }
    return Presentation.presentation.getContentDescriptor(this.createRequestOptions(),
      this._displayType, this.keys, this.selectionInfo);
  });

  /**
   * Get the content descriptor.
   */
  public getContentDescriptor = _.memoize(async (): Promise<Descriptor | undefined> => {
    if (!this.shouldRequestContentForEmptyKeyset() && this.keys.isEmpty)
      return undefined;

    const descriptor = await this.getDefaultContentDescriptor();
    if (!descriptor)
      return undefined;

    return this.configureContentDescriptor(descriptor);
  });

  /**
   * Get the number of content records.
   */
  public async getContentSetSize(): Promise<number> {
    const paging = undefined !== this.pagingSize ? { start: 0, size: this.pagingSize } : undefined;
    const contentAndSize = await this._getContentAndSize(paging);
    if (undefined !== contentAndSize)
      return contentAndSize.size!;
    return 0;
  }

  /**
   * Get the content.
   * @param pageOptions Paging options.
   */
  public async getContent(pageOptions?: PageOptions): Promise<Content | undefined> {
    if (undefined !== pageOptions && pageOptions.size !== this.pagingSize) {
      const msg = `ContentDataProvider.pagingSize doesn't match pageOptions in ContentDataProvider.getContent call.
        Make sure you set provider's pagingSize to avoid excessive backend requests.`;
      Logger.logWarning("Presentation.Components", msg);
    }
    const contentAndSize = await this._getContentAndSize(pageOptions);
    if (undefined !== contentAndSize)
      return contentAndSize.content;
    return undefined;
  }

  private _getContentAndSize = _.memoize(async (pageOptions?: PageOptions) => {
    if (!this.shouldRequestContentForEmptyKeyset() && this.keys.isEmpty)
      return undefined;

    let descriptorOrOverrides;
    if (this.shouldConfigureContentDescriptor()) {
      descriptorOrOverrides = await this.getContentDescriptor();
      if (!descriptorOrOverrides)
        return undefined;
    } else {
      descriptorOrOverrides = this.getDescriptorOverrides();
    }

    // istanbul ignore if
    if (this.keys.size > DEFAULT_KEYS_BATCH_SIZE) {
      const msg = `ContentDataProvider.getContent requesting with ${this.keys.size} keys which
        exceeds the suggested size of ${DEFAULT_KEYS_BATCH_SIZE}. Possible "HTTP 413 Payload Too Large" error.`;
      Logger.logWarning("Presentation.Components", msg);
    }

    const requestSize = undefined !== pageOptions && 0 === pageOptions.start && undefined !== pageOptions.size;
    const options = { ...this.createRequestOptions(), paging: pageOptions };
    if (requestSize)
      return Presentation.presentation.getContentAndSize(options, descriptorOrOverrides, this.keys);

    const content = await Presentation.presentation.getContent(options, descriptorOrOverrides, this.keys);
    if (!content)
      return undefined;

    const size = (undefined === pageOptions || undefined === pageOptions.size) ? content.contentSet.length : undefined;
    return { content, size };
  }, createKeyForPageOptions);
}

const createKeyForPageOptions = (pageOptions?: PageOptions) => {
  if (!pageOptions)
    return "0/0";
  return `${(pageOptions.start) ? pageOptions.start : 0}/${(pageOptions.size) ? pageOptions.size : 0}`;
};
