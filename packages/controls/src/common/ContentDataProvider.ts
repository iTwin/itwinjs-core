/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

import * as _ from "lodash";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet, PageOptions, SelectionInfo } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import * as content from "@bentley/ecpresentation-common";

export interface CacheInvalidationProps {
  descriptor?: boolean;
  size?: boolean;
  content?: boolean;
}
namespace CacheInvalidationProps {
  export const full = () => ({ descriptor: true, size: true, content: true });
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
    if (props.descriptor && this.getContentDescriptor)
      this.getContentDescriptor.cache.clear();
    if (props.size && this.getContentSetSize)
      this.getContentSetSize.cache.clear();
    if (props.content && this.getContent)
      this.getContent.cache.clear();
  }

  /**
   * Called to create extended options for content requests. The actual options depend on the
   * presentation manager implementation.
   */
  private createRequestOptions(): object {
    return {
      RulesetId: this._rulesetId,
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

  /**
   * Get the content descriptor.
   */
  protected getContentDescriptor = _.memoize(async (): Promise<Readonly<content.Descriptor> | undefined> => {
    const descriptor = await ECPresentation.presentation.getContentDescriptor(this._connection.iModelToken,
      this._displayType, this.keys, this.selectionInfo, this.createRequestOptions());
    if (!descriptor)
      return undefined;
    return this.configureContentDescriptor(descriptor);
  });

  /**
   * Get the number of content records.
   * @returns The total number of records (without paging).
   */
  protected getContentSetSize = _.memoize(async (): Promise<number> => {
    const descriptor = await this.getContentDescriptor();
    if (!descriptor)
      return 0;
    return await ECPresentation.presentation.getContentSetSize(this._connection.iModelToken,
      descriptor, this.keys, this.createRequestOptions());
  });

  /**
   * Get the content.
   * @param pageOptions Paging options.
   */
  protected getContent = _.memoize(async (pageOptions?: PageOptions): Promise<Readonly<content.Content> | undefined> => {
    const descriptor = await this.getContentDescriptor();
    if (!descriptor)
      return undefined;
    return await ECPresentation.presentation.getContent(this._connection.iModelToken,
      descriptor, this.keys, pageOptions, this.createRequestOptions());
  }, createKeyForPageOptions);
}

const createKeyForPageOptions = (pageOptions?: PageOptions) => {
  if (!pageOptions)
    return "0/0";
  return `${(pageOptions.pageStart) ? pageOptions.pageStart : 0}/${(pageOptions.pageSize) ? pageOptions.pageSize : 0}`;
};
