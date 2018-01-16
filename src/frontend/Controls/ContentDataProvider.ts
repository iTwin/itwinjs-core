/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { InstanceKeysList } from "../../common/EC";
import { ECPresentationManager, PageOptions } from "../../common/ECPresentationManager";
import * as content from "../../common/Content";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";

/** Base class for all data providers that are based on @ref PresentationManager. */
export default abstract class ContentDataProvider {
  private _manager: ECPresentationManager;
  private _rulesetId: string;
  private _displayType: string;
  private _configuredDescriptorPromise: Promise<content.Descriptor | null> | null;
  private _descriptorPromise: Promise<content.Descriptor | null> | null;
  private _descriptor: content.Descriptor | null;
  private _contentSetSizePromise: Promise<number> | null;
  private _contentPromise: Promise<content.Content> | null;
  private _imodelToken: IModelToken;

  /** Constructor.
   * @param displayType The content display type which this provider is going to
   * load data for. See @ref ContentDisplayType
   * @param imodelToken Token of the imodel to pull data from.
   */
  constructor(manager: ECPresentationManager, imodelToken: IModelToken, rulesetId: string, displayType: string) {
    this._manager = manager;
    this._rulesetId = rulesetId;
    this._displayType = displayType;
    this._imodelToken = imodelToken;
    this._descriptor = null;
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
    this._descriptorPromise = null;
    this._descriptor = null;
    this.invalidateContentCache(true);
  }

  /** Invalidates just the content but not the descriptor. Called after events like
   * sorting or filtering changes.
   * @param invalidateContentSetSize Should content set size also be invalidated.
   * The size invalidation can be skipped after operations like sorting, because the
   * amount of items in the content set doesn't change.
   */
  protected invalidateContentCache(invalidateContentSetSize: boolean): void {
    this._configuredDescriptorPromise = null;
    this._contentPromise = null;

    if (invalidateContentSetSize)
      this._contentSetSizePromise = null;
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
  public get descriptor(): content.Descriptor | null { return this._descriptor; }

  /** Get the content descriptor.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   */
  public async getContentDescriptor(keys: InstanceKeysList, selectionInfo: content.SelectionInfo | null = null): Promise<content.Descriptor | null> {
    if (null == this._configuredDescriptorPromise) {
      if (null == this._descriptorPromise) {
        this._descriptorPromise = this._manager.getContentDescriptor(this.imodelToken, this._displayType, keys,
          selectionInfo, this.createRequestOptions());
      }

      const self = this;
      const configureDescriptor = (descriptor: content.Descriptor | null): content.Descriptor | null => {
        if (descriptor)
          self.configureContentDescriptor(descriptor);
        return descriptor;
      };
      const setAndReturn = (descriptor: content.Descriptor | null): content.Descriptor | null => {
        self._descriptor = descriptor;
        return descriptor;
      };
      this._configuredDescriptorPromise = this._descriptorPromise.then(configureDescriptor).then(setAndReturn);
    }

    return this._configuredDescriptorPromise;
  }

  /** Called to configure the content descriptor. This is the place where concrete
   * provider implementations can control things like sorting, filtering, hiding fields, etc.
   * @warning The default method implementation takes care of hiding properties. Subclasses
   * should call the base class method to not lose this functionality.
   */
  protected configureContentDescriptor(descriptor: content.Descriptor): void {
    const fieldsCount = descriptor.fields.length;
    for (let i = fieldsCount - 1; i >= 0; --i) {
      const field = descriptor.fields[i];
      if (this.shouldExcludeFromDescriptor(field))
        descriptor.fields.splice(i, 1);
    }
  }

  /** Called to check whether the field should be excluded from the descriptor. */
  protected shouldExcludeFromDescriptor(field: content.Field): boolean { return this.isFieldHidden(field); }

  /** Called to check whether the field should be excluded from the descriptor. */
  protected isFieldHidden(_field: content.Field): boolean { return false; }

  /** Get the content.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   * @param pageStart Start index of the page to load.
   * @param pageSize The number of requested items in the page (0 means all items).
   */
  protected async getContent(keys: InstanceKeysList, selectionInfo: content.SelectionInfo | null = null, { pageStart = 0, pageSize = 0 }: PageOptions): Promise<content.Content> {
    if (!this._contentPromise) {
      const self = this;
      const getContent = (descriptor: content.Descriptor | null): Promise<content.Content> => {
        return self._manager.getContent(self.imodelToken, descriptor!, keys,
          {pageStart, pageSize}, self.createRequestOptions());
      };
      this._contentPromise = this.getContentDescriptor(keys, selectionInfo).then(getContent);
    }
    return this._contentPromise;
  }

  /** Get the number of content records.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   * @note The method returns the total number of records (without paging).
   */
  protected async getContentSetSize(keys: InstanceKeysList, selectionInfo: content.SelectionInfo | null = null): Promise<number> {
    if (!this._contentSetSizePromise) {
      const self = this;
      this._contentSetSizePromise = this.getContentDescriptor(keys, selectionInfo).then((descriptor: content.Descriptor | null) => {
        if (!descriptor)
          return 0;
        return self._manager.getContentSetSize(self.imodelToken, descriptor, keys, self.createRequestOptions());
      }).catch(() => 0);
    }
    return this._contentSetSizePromise!;
  }
}
