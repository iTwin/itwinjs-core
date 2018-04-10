/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import * as content from "@bentley/ecpresentation-common/lib/content";

/** Base class for all data providers that are based on @ref PresentationManager. */
export default abstract class ContentDataProvider {
  private _rulesetId: string;
  private _displayType: string;
  private _descriptor: Readonly<content.Descriptor> | undefined;
  private _configuredDescriptor: Readonly<content.Descriptor> | undefined;
  private _contentSetSize: number | undefined;
  private _content: Readonly<content.Content> | undefined;
  private _imodelToken: Readonly<IModelToken>;

  /** Constructor.
   * @param displayType The content display type which this provider is going to
   * load data for. See @ref ContentDisplayType
   * @param imodelToken Token of the imodel to pull data from.
   */
  constructor(imodelToken: IModelToken, rulesetId: string, displayType: string) {
    this._rulesetId = rulesetId;
    this._displayType = displayType;
    this._imodelToken = imodelToken;
    this.invalidateCache();
  }

  public set imodelToken(token: IModelToken) {
    this._imodelToken = token;
    this.invalidateCache();
  }

  public get imodelToken(): IModelToken { return this._imodelToken; }

  /** Fully invalidates cached content including the descriptor. Called after events like
   * selection changes.
   */
  protected invalidateCache(): void {
    this._descriptor = undefined;
    this._configuredDescriptor = undefined;
    this.invalidateContentCache(true);
  }

  /** Invalidates just the content but not the descriptor. Called after events like
   * sorting or filtering changes.
   * @param invalidateContentSetSize Should content set size also be invalidated.
   * The size invalidation can be skipped after operations like sorting, because the
   * amount of items in the content set doesn't change.
   */
  protected invalidateContentCache(invalidateContentSetSize: boolean): void {
    this._configuredDescriptor = undefined;
    this._content = undefined;

    if (invalidateContentSetSize)
      this._contentSetSize = undefined;
  }

  /** Called to create extended options for content requests. The actual options depend on the
   * presentation manager implementation.
   */
  private createRequestOptions(): object {
    return {
      RulesetId: this._rulesetId,
    };
  }

  /** Get the content descriptor currently used by this data provider. */
  public get descriptor(): content.Descriptor | undefined { return this._descriptor; }

  /** Get the content descriptor.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   */
  public async getContentDescriptor(keys: KeySet, selectionInfo?: content.SelectionInfo): Promise<Readonly<content.Descriptor>> {
    if (!this._configuredDescriptor) {
      if (!this._descriptor) {
        this._descriptor = await ECPresentation.manager.getContentDescriptor(this.imodelToken, this._displayType, keys,
          selectionInfo, this.createRequestOptions());
      }
      this._configuredDescriptor = this.configureContentDescriptor(this._descriptor);
    }
    return this._configuredDescriptor;
  }

  /** Called to configure the content descriptor. This is the place where concrete
   * provider implementations can control things like sorting, filtering, hiding fields, etc.
   * @warning The default method implementation takes care of hiding properties. Subclasses
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
    return { ...descriptor, fields };
  }

  /** Called to check whether the field should be excluded from the descriptor. */
  protected shouldExcludeFromDescriptor(field: content.Field): boolean { return this.isFieldHidden(field); }

  /** Called to check whether the field should be hidden. */
  protected isFieldHidden(_field: content.Field): boolean { return false; }

  /** Get the content.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   * @param pageStart Start index of the page to load.
   * @param pageSize The number of requested items in the page (0 means all items).
   */
  protected async getContent(keys: KeySet, selectionInfo: content.SelectionInfo | undefined, { pageStart = 0, pageSize = 0 }: PageOptions): Promise<Readonly<content.Content>> {
    if (!this._content) {
      const descriptor = await this.getContentDescriptor(keys, selectionInfo);
      this._content = await ECPresentation.manager.getContent(this.imodelToken, descriptor, keys,
        { pageStart, pageSize }, this.createRequestOptions());
    }
    return this._content;
  }

  /** Get the number of content records.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   * @note The method returns the total number of records (without paging).
   */
  protected async getContentSetSize(keys: KeySet, selectionInfo?: content.SelectionInfo): Promise<number> {
    if (undefined === this._contentSetSize) {
      const descriptor = await this.getContentDescriptor(keys, selectionInfo);
      this._contentSetSize = await ECPresentation.manager.getContentSetSize(this.imodelToken, descriptor,
        keys, this.createRequestOptions());
    }
    return this._contentSetSize;
  }
}
