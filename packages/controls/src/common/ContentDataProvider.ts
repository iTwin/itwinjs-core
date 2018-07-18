/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, PageOptions, SelectionInfo, ContentRequestOptions } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import * as content from "@bentley/ecpresentation-common";

/**
 * Properties for invalidating content cache.
 */
export interface CacheInvalidationProps {
  /**
   * Invalidate content descriptor. Should be set when invalidating
   * after changing anything that affects how the descriptor is built:
   * `keys`, `selectionInfo`, `connection`, `rulesetId`.
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
namespace CacheInvalidationProps {
  /**
   * Create CacheInvalidationProps to fully invalidate all caches.
   */
  export const full = (): CacheInvalidationProps => ({ descriptor: true, descriptorConfiguration: true, size: true, content: true });
}

/**
 * Base class for all ecpresentation-driven content providers.
 */
export default abstract class ContentDataProvider {
  private _connection: IModelConnection;
  private _rulesetId: string;
  private _displayType: string;
  private _keys: Readonly<KeySet>;
  private _selectionInfo?: Readonly<SelectionInfo>;

  /**
   * Constructor.
   * @param connection IModel to pull data from.
   * @param rulesetId Id of the ruleset to use when requesting content.
   * @param displayType The content display type which this provider is going to
   * load data for.
   */
  constructor(connection: IModelConnection, rulesetId: string, displayType: string) {
    this._rulesetId = rulesetId;
    this._displayType = displayType;
    this._connection = connection;
    this._keys = new KeySet();
    this.invalidateCache(CacheInvalidationProps.full());
  }

  /** Display type used to format content */
  public get displayType(): string { return this._displayType; }

  /** IModel to pull data from */
  public get connection(): IModelConnection { return this._connection; }
  public set connection(connection: IModelConnection) {
    if (this._connection === connection)
      return;
    this._connection = connection;
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
  public set keys(keys: Readonly<KeySet>) {
    this._keys = keys;
    this.invalidateCache(CacheInvalidationProps.full());
  }

  /** Information about selection event that results in content change */
  public get selectionInfo() { return this._selectionInfo; }
  public set selectionInfo(info: Readonly<SelectionInfo> | undefined) {
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
      this.getDefaultContentDescriptor.cache.clear();
    if (props.descriptorConfiguration && this.getContentDescriptor)
      this.getContentDescriptor.cache.clear();
    if (props.size && this.getContentSetSize)
      this.getContentSetSize.cache.clear();
    if (props.content && this.getContent)
      this.getContent.cache.clear();
  }

  private createRequestOptions(): ContentRequestOptions<IModelConnection> {
    return {
      imodel: this._connection,
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
  protected configureContentDescriptor(descriptor: Readonly<content.Descriptor>): content.Descriptor {
    const fields = descriptor.fields.slice();
    const fieldsCount = fields.length;
    for (let i = fieldsCount - 1; i >= 0; --i) {
      const field = fields[i];
      if (this.shouldExcludeFromDescriptor(field))
        fields.splice(i, 1);
    }
    const customDescriptor = Object.create(content.Descriptor.prototype);
    return Object.assign(customDescriptor, descriptor, content.Descriptor, {
      fields,
    });
  }

  /** Called to check whether the field should be excluded from the descriptor. */
  protected shouldExcludeFromDescriptor(field: content.Field): boolean { return this.isFieldHidden(field); }

  /** Called to check whether the field should be hidden. */
  protected isFieldHidden(_field: content.Field): boolean { return false; }

  // tslint:disable-next-line:naming-convention
  private getDefaultContentDescriptor = _.memoize(async (): Promise<Readonly<content.Descriptor> | undefined> => {
    return await ECPresentation.presentation.getContentDescriptor(this.createRequestOptions(),
      this._displayType, this.keys, this.selectionInfo);
  });

  /**
   * Get the content descriptor.
   */
  protected getContentDescriptor = _.memoize(async (): Promise<Readonly<content.Descriptor> | undefined> => {
    const descriptor = await this.getDefaultContentDescriptor();
    if (!descriptor)
      return undefined;
    return this.configureContentDescriptor(descriptor);
  });

  /**
   * Get the number of content records.
   */
  protected getContentSetSize = _.memoize(async (): Promise<number> => {
    const descriptor = await this.getContentDescriptor();
    if (!descriptor)
      return 0;
    return await ECPresentation.presentation.getContentSetSize(this.createRequestOptions(),
      descriptor, this.keys);
  });

  /**
   * Get the content.
   * @param pageOptions Paging options.
   */
  protected getContent = _.memoize(async (pageOptions?: PageOptions): Promise<Readonly<content.Content> | undefined> => {
    const descriptor = await this.getContentDescriptor();
    if (!descriptor)
      return undefined;
    return await ECPresentation.presentation.getContent({ ...this.createRequestOptions(), paging: pageOptions },
      descriptor, this.keys);
  }, createKeyForPageOptions);
}

const createKeyForPageOptions = (pageOptions?: PageOptions) => {
  if (!pageOptions)
    return "0/0";
  return `${(pageOptions.start) ? pageOptions.start : 0}/${(pageOptions.size) ? pageOptions.size : 0}`;
};
