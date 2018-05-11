/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelToken } from "@bentley/imodeljs-common";
import { KeySet, PageOptions } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import * as content from "@bentley/ecpresentation-common/lib/content";

export interface CacheInvalidationProps {
  descriptor?: boolean;
  size?: boolean;
  content?: boolean;
}

/** Base class for all ecpresentation-driven data providers. */
export default abstract class ContentDataProvider {
  private _rulesetId: string;
  private _displayType: string;
  private _descriptor: Readonly<content.Descriptor> | undefined;
  private _contentSetSize: number | undefined;
  private _content: Readonly<content.Content> | undefined;
  private _imodelToken: Readonly<IModelToken>;

  /** Constructor.
   * @param displayType The content display type which this provider is going to
   * load data for.
   * @param imodelToken Token of the imodel to pull data from.
   */
  constructor(imodelToken: IModelToken, rulesetId: string, displayType: string) {
    this._rulesetId = rulesetId;
    this._displayType = displayType;
    this._imodelToken = imodelToken;
    this.invalidateCache({ descriptor: true, size: true, content: true });
  }

  public get imodelToken(): IModelToken { return this._imodelToken; }

  public set imodelToken(token: IModelToken) {
    this._imodelToken = token;
    this.invalidateCache({ descriptor: true, size: true, content: true });
  }

  /** Fully invalidates cached content including the descriptor. Called after events like
   * selection changes.
   */
  protected invalidateCache(props: CacheInvalidationProps): void {
    if (props.descriptor)
      this._descriptor = undefined;
    if (props.size)
      this._contentSetSize = undefined;
    if (props.content)
      this._content = undefined;
  }

  /** Called to create extended options for content requests. The actual options depend on the
   * presentation manager implementation.
   */
  private createRequestOptions(): object {
    return {
      RulesetId: this._rulesetId,
    };
  }

  /** Get the content descriptor.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   */
  protected async getContentDescriptor(keys: Readonly<KeySet>, selectionInfo?: content.SelectionInfo): Promise<Readonly<content.Descriptor>> {
    if (!this._descriptor) {
      this._descriptor = await ECPresentation.presentation.getContentDescriptor(this.imodelToken, this._displayType, keys,
        selectionInfo, this.createRequestOptions());
    }
    return this.configureContentDescriptor(this._descriptor);
  }

  /** Called to configure the content descriptor. This is the place where concrete
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

  /** Get the content.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   * @param pageOptions Paging options.
   */
  protected async getContent(keys: Readonly<KeySet>, selectionInfo?: content.SelectionInfo, pageOptions?: PageOptions): Promise<Readonly<content.Content>> {
    if (!this._content) {
      const descriptor = await this.getContentDescriptor(keys, selectionInfo);
      this._content = await ECPresentation.presentation.getContent(this.imodelToken, descriptor, keys,
        pageOptions, this.createRequestOptions());
    }
    return this._content;
  }

  /** Get the number of content records.
   * @param keys Keys of ECInstances to get content for.
   * @param selectionInfo Info about selection in case the content is requested due to selection change.
   * @returns The total number of records (without paging).
   */
  protected async getContentSetSize(keys: Readonly<KeySet>, selectionInfo?: content.SelectionInfo): Promise<number> {
    if (undefined === this._contentSetSize) {
      const descriptor = await this.getContentDescriptor(keys, selectionInfo);
      this._contentSetSize = await ECPresentation.presentation.getContentSetSize(this.imodelToken, descriptor,
        keys, this.createRequestOptions());
    }
    return this._contentSetSize;
  }
}
