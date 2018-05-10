/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Core */

import * as path from "path";
import { IDisposable } from "@bentley/bentleyjs-core";
import { IModelToken, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { NativeECPresentationManager } from "@bentley/imodeljs-native-platform-api";
import { IModelDb, NativePlatformRegistry } from "@bentley/imodeljs-backend";
import { ECPresentationManager as ECPresentationManagerDefinition } from "@bentley/ecpresentation-common";
import { NodeKey, Node } from "@bentley/ecpresentation-common";
import { SelectionInfo, Content, Descriptor } from "@bentley/ecpresentation-common";
import { PageOptions, KeySet } from "@bentley/ecpresentation-common";

/**
 * Properties that can be used to configure [[ECPresentationManager]]
 */
export interface Props {
  /** @hidden */
  addon?: NodeAddonDefinition;

  /**
   * A list of directories containing presentation rulesets.
   */
  rulesetDirectories?: string[];

  /**
   * A list of directories containing locale-specific localized
   * string files (in simplified i18next v3 format)
   */
  localeDirectories?: string[];

  /**
   * Sets the active locale to use when localizing presentation-related
   * strings. It can later be changed through ECPresentationManager.
   */
  activeLocale?: string;
}

/**
 * Backend ECPresentation manager which pulls the presentation data from
 * an iModel.
 */
export default class ECPresentationManager implements ECPresentationManagerDefinition, IDisposable {

  private _addon?: NodeAddonDefinition;
  private _activeLocale?: string;
  private _isDisposed: boolean;

  /**
   * Creates an instance of ECPresentationManager.
   * @param props Optional configuration properties.
   */
  constructor(props?: Props) {
    this._isDisposed = false;
    if (props && props.addon)
      this._addon = props.addon;
    if (props && props.rulesetDirectories)
      this.getNativePlatform().setupRulesetDirectories(props.rulesetDirectories);
    if (props)
      this.activeLocale = props.activeLocale;
    this.setupLocaleDirectories(props);
  }

  /**
   * Dispose the presentation manager. Must be called to clean up native resources.
   */
  public dispose() {
    if (this._addon) {
      this.getNativePlatform().terminate();
      this._addon = undefined;
    }
    this._isDisposed = true;
  }

  /** @hidden */
  public getNativePlatform(): NodeAddonDefinition {
    if (this._isDisposed)
      throw new Error("Attempting to use ECPresentation manager after disposal");
    if (!this._addon) {
      const addonImpl = createAddonImpl();
      this._addon = new addonImpl();
    }
    return this._addon!;
  }

  private setupLocaleDirectories(props?: Props) {
    const localeDirectories = [path.join(__dirname, "assets", "locales")];
    if (props && props.localeDirectories) {
      props.localeDirectories.forEach((dir) => {
        if (-1 === localeDirectories.indexOf(dir))
          localeDirectories.push(dir);
      });
    }
    this.getNativePlatform().setupLocaleDirectories(localeDirectories);
  }

  /**
   * Get currently active locale
   */
  public get activeLocale(): string | undefined {
    return this._activeLocale;
  }

  /**
   * Set active locale
   */
  public set activeLocale(locale: string | undefined) {
    if (this.activeLocale !== locale) {
      this._activeLocale = locale;
      this.getNativePlatform().setActiveLocale(locale ? locale : "");
    }
  }

  public async getRootNodes(token: Readonly<IModelToken>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodes, {
      pageOptions,
      options,
    });
    return this.request(token, params);
  }

  public async getRootNodesCount(token: Readonly<IModelToken>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetRootNodesCount, {
      options,
    });
    return this.request(token, params);
  }

  public async getChildren(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<ReadonlyArray<Readonly<Node>>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildren, {
      nodeKey: parentKey,
      pageOptions,
      options,
    });
    return this.request(token, params);
  }

  public async getChildrenCount(token: Readonly<IModelToken>, parentKey: Readonly<NodeKey>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetChildrenCount, {
      nodeKey: parentKey,
      options,
    });
    return this.request(token, params);
  }

  public async getContentDescriptor(token: Readonly<IModelToken>, displayType: string, keys: Readonly<KeySet>, selection: Readonly<SelectionInfo> | undefined, options: object): Promise<Readonly<Descriptor>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentDescriptor, {
      displayType,
      keys,
      selection,
      options,
    });
    return this.request(token, params, Descriptor.reviver);
  }

  public async getContentSetSize(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, options: object): Promise<number> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContentSetSize, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      options,
    });
    return this.request(token, params);
  }

  public async getContent(token: Readonly<IModelToken>, descriptor: Readonly<Descriptor>, keys: Readonly<KeySet>, pageOptions: Readonly<PageOptions> | undefined, options: object): Promise<Readonly<Content>> {
    const params = this.createRequestParams(NodeAddonRequestTypes.GetContent, {
      keys,
      descriptorOverrides: descriptor.createDescriptorOverrides(),
      pageOptions,
      options,
    });
    return this.request(token, params, Content.reviver);
  }

  private request(token: Readonly<IModelToken>, params: string, reviver?: (key: string, value: any) => any) {
    const imodelAddon = this.getNativePlatform().getImodelAddon(token);
    const serializedResponse = this.getNativePlatform().handleRequest(imodelAddon, params);
    if (!serializedResponse)
      throw new Error("Received invalid response from the addon: " + serializedResponse);
    return JSON.parse(serializedResponse, reviver);
  }

  private createRequestParams(requestId: string, requestParams: object): string {
    const request = {
      requestId,
      params: requestParams,
    };
    return JSON.stringify(request);
  }
}

/** @hidden */
export interface NodeAddonDefinition {
  terminate(): void;
  handleRequest(db: any, options: string): string;
  setupRulesetDirectories(directories: string[]): void;
  setupLocaleDirectories(directories: string[]): void;
  setActiveLocale(locale: string): void;
  getImodelAddon(token: IModelToken): any;
}

const createAddonImpl = () => {
  // note the implementation is constructed here to make ECPresentationManager
  // usable without loading the actual addon (if addon is set to something other)
  return class implements NodeAddonDefinition {
    private _nativeAddon: NativeECPresentationManager = new (NativePlatformRegistry.getNativePlatform()).NativeECPresentationManager();
    public terminate() {
      this._nativeAddon.terminate();
    }
    public handleRequest(db: any, options: string): string {
      return this._nativeAddon.handleRequest(db, options);
    }
    public setupRulesetDirectories(directories: string[]): void {
      this._nativeAddon.setupRulesetDirectories(directories);
    }
    public setupLocaleDirectories(directories: string[]): void {
      this._nativeAddon.setupLocaleDirectories(directories);
    }
    public setActiveLocale(locale: string): void {
      this._nativeAddon.setActiveLocale(locale);
    }
    public getImodelAddon(token: IModelToken): any {
      const imodel = IModelDb.find(token);
      if (!imodel || !imodel.nativeDb)
        throw new IModelError(IModelStatus.NotOpen, "IModelDb not open");
      return imodel.nativeDb;
    }
  };
};

/** @hidden */
export enum NodeAddonRequestTypes {
  GetRootNodes = "GetRootNodes",
  GetRootNodesCount = "GetRootNodesCount",
  GetChildren = "GetChildren",
  GetChildrenCount = "GetChildrenCount",
  GetFilteredNodesPaths = "GetFilteredNodesPaths",
  GetNodePaths = "GetNodePaths",
  GetContentDescriptor = "GetContentDescriptor",
  GetContentSetSize = "GetContentSetSize",
  GetContent = "GetContent",
  GetDistinctValues = "GetDistinctValues",
}
