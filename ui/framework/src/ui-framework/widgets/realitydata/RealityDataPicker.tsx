/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import * as classnames from "classnames";
import * as _ from "lodash";
import { IModelConnection, findAvailableUnattachedRealityModels, IModelApp, Viewport, ContextRealityModelState, SpatialViewState, ScreenViewport, SpatialModelState } from "@bentley/imodeljs-frontend";
import { ContextRealityModelProps, BackgroundMapSettings, BackgroundMapType, CartographicRange } from "@bentley/imodeljs-common";
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { LoadingSpinner, SpinnerSize, SearchBox, ContextMenu, ContextMenuItem, ContextMenuDirection } from "@bentley/ui-core";
import { RealityDataEntry, AttachedRealityModel } from "./RealityData";
import { RealityDataItem } from "./RealityDataItem";
import { SettingsModalDialog } from "./SettingsModalDialog";
import "./RealityDataPicker.scss";
import "./RealityDataItem.scss";

import { RealityDataServicesClient, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { ConfigurableCreateInfo } from "../../configurableui/ConfigurableUiControl";
import { ConfigurableUiManager } from "../../configurableui/ConfigurableUiManager";
import { ModalDialogManager } from "../../dialog/ModalDialogManager";
import { WidgetControl } from "../../widgets/WidgetControl";
import { UiFramework } from "../../UiFramework";

import widgetIconSvg from "@bentley/icons-generic/icons/network.svg";

/** Properties for the [[RealityDataPickerControl]] component */
interface RealityDataPickerProps {
  iModelConnection: IModelConnection;
}

/** State for the [[RealityDataPickerControl]] component */
interface RealityDataPickerState {
  items: RealityDataEntry[]; /** Items displayed in picker */
  filter: string;
  isMapEnabled: boolean;
  isOptionsOpened: boolean;
  showMapTypes: boolean;
  bingMapType: BackgroundMapType;
  showSearchBox: boolean;
  initialized: boolean;
}

/**
 * Model Selector [[RealityDataPickerControl]]
 * @alpha @deprecated use control from imodeljs-ui-snippet repo
 */
// istanbul ignore next
export class RealityDataPickerControl extends WidgetControl {
  public static get iconSpec() {
    return IconSpecUtilities.createSvgIconSpec(widgetIconSvg);
  }

  public static get label() {
    return UiFramework.translate("realityData.title");
  }

  /** Creates a ModelSelectorDemoWidget */
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = (
      <div style={{ padding: "2px 4px 0px 4px", width: "100%", height: "100%", boxSizing: "border-box" }}>
        <RealityDataPicker iModelConnection={options.iModelConnection} />;
    </div>
    );
  }
}

/**
 * Reality Data React component
 * @alpha
 */
// istanbul ignore next
export class RealityDataPicker extends React.Component<RealityDataPickerProps, RealityDataPickerState> {
  private _availableModels: ContextRealityModelProps[] = [];
  private _attachedModels: AttachedRealityModel[] = [];
  private _searchBox: SearchBox | null = null;
  private _removeListener: () => void;
  private _vp: ScreenViewport | undefined;
  private _bingMapTitle = UiFramework.i18n.translate("UiFramework:realityData.bingMap");
  private _isMounted = false;

  /** Creates a ModelSelectorWidget */
  constructor(props: RealityDataPickerProps) {
    super(props);
    this._removeListener = () => { };
    this.state = {
      items: [],
      filter: "",
      isMapEnabled: false,
      isOptionsOpened: false,
      showMapTypes: false,
      bingMapType: BackgroundMapType.Hybrid,
      initialized: false,
      showSearchBox: false,
    };
  }

  public get attachedModels(): AttachedRealityModel[] {
    return this._attachedModels;
  }

  /** Initialize listeners and category/model rulesets */
  public async componentDidMount() {
    this._isMounted = true;

    // get selected viewport
    const vp = IModelApp.viewManager.selectedView;

    // if view exists bind update routine to onRender loop, otherwise do so once the onViewOpen event runs
    if (vp) {
      await this._onViewOpen(vp);
    } else {
      IModelApp.viewManager.onViewOpen.addListener(this._onViewOpen, this);
    }
  }

  private async _onViewOpen(vp: Viewport) {
    if (IModelApp.viewManager.onViewOpen.has(this._onViewOpen, this))
      IModelApp.viewManager.onViewOpen.removeListener(this._onViewOpen, this);

    this._vp = vp as ScreenViewport;

    await this._initializeRealityModels();

    this._removeListener = vp.onDisplayStyleChanged.addListener(this._refreshFromView, this);

    const view = vp.view as SpatialViewState;

    if (this._isMounted)
      this.setState({
        isMapEnabled: view.viewFlags.backgroundMap,
        bingMapType: view.getDisplayStyle3d().settings.backgroundMap.mapType,
      });
  }

  /** Get rid of listeners */
  public componentWillUnmount() {
    this._isMounted = false;

    if (this._removeListener)
      this._removeListener();
  }

  /** Initializes reality model data. */
  private _initializeRealityModels = async () => {
    this._availableModels = [];
    if (!this.props.iModelConnection.iModelToken.contextId)
      throw new Error("Invalid iModelToken/Context Id");

    if (this.props.iModelConnection && this.props.iModelConnection.ecefLocation) {
      // Should query online
      const projectCartographicRange = new CartographicRange(this.props.iModelConnection.projectExtents, this.props.iModelConnection.ecefLocation!.getTransform());
      this._availableModels = await findAvailableUnattachedRealityModels(this.props.iModelConnection.iModelToken.contextId, this.props.iModelConnection, projectCartographicRange);
    } else if (this.props.iModelConnection.isGeoLocated) {
      this._availableModels = await findAvailableUnattachedRealityModels(this.props.iModelConnection.iModelToken.contextId, this.props.iModelConnection);
    }

    const query = { from: SpatialModelState.classFullName, wantPrivate: false };
    const props = await this.props.iModelConnection.models.queryProps(query);
    for (const prop of props)
      if (prop.jsonProperties !== undefined && prop.jsonProperties.tilesetUrl !== undefined && prop.id !== undefined && prop.name !== undefined) {
        this._attachedModels.push(new AttachedRealityModel(prop.id!, prop.name, prop.jsonProperties.tilesetUrl));
      }
    this._setRealityDataEntries(); // tslint:disable-line:no-floating-promises
  }

  private _refreshFromView = async () => {
    if (!this._isMounted)
      return;

    const items = await this._loadAvailableItems();
    this.setState({
      items,
      isMapEnabled: this._vp!.view.viewFlags.backgroundMap,
      initialized: true,
    });
  }

  private _setRealityDataEntries = async () => {
    if (!this._isMounted)
      return;

    const items = await this._loadAvailableItems();
    this.setState({
      items,
      initialized: true,
    });
  }

  private _loadAvailableItems = async () => {
    const _items: RealityDataEntry[] = [];
    const view = this._vp!.view as SpatialViewState;

    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel((modelState: ContextRealityModelState) => models.push(modelState));

    for (const modelState of models) {
      let group = "";
      let size = "";
      const tilesetUrl = modelState.toJSON().tilesetUrl || modelState.url;
      const realityData = await this._fetchRealityData(tilesetUrl);
      if (realityData) {
        group = realityData.group || "";
        size = realityData.size || "";
      }

      _items.push({
        model: modelState,
        url: modelState.url,
        name: modelState.name,
        description: "",
        enabled: true,
        group,
        size,
      });

    }

    for (const props of this._availableModels) {
      if (this._isUniqueUrl(props.tilesetUrl, _items)) {
        let group = "";
        let size = "";
        const realityData = await this._fetchRealityData(props.tilesetUrl);
        if (realityData) {
          group = realityData.group || "";
          size = realityData.size || "";
        }

        _items.push({
          model: new ContextRealityModelState(props, this._vp!.iModel, this._vp!.displayStyle),
          url: props.tilesetUrl,
          name: props.name || "",
          description: props.description || "",
          enabled: false,
          group,
          size,
        });
      }
    }
    const modelSelector = (this._vp!.view as SpatialViewState).modelSelector;
    for (const attachedModel of this._attachedModels) {
      _items.push({
        model: attachedModel,
        url: attachedModel.url,
        name: attachedModel.name + " " + IModelApp.i18n.translate("UiFramework:realityData.attached"),
        description: "",
        enabled: modelSelector.has(attachedModel.id),
        group: "",
        size: "",
      });
    }

    _items.sort((a: RealityDataEntry, b: RealityDataEntry) => {
      if (a.name.toLowerCase() < b.name.toLowerCase())
        return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase())
        return 1;
      return 0;
    });

    return _items;
  }

  private _fetchRealityData = async (titlesetUrl: string) => {
    const accessToken = await IModelApp.authorizationClient!.getAccessToken();
    if (!accessToken)
      return null;
    const requestContext = new AuthorizedClientRequestContext(accessToken); // might want to pass in as prop
    const client = new RealityDataServicesClient();
    const realityDataId = client.getRealityDataIdFromUrl(titlesetUrl);
    if (realityDataId) {
      const realityData = await client.getRealityData(requestContext, this.props.iModelConnection.iModelToken.contextId!, this.props.iModelConnection.iModelToken.iModelId!);
      return realityData;
    }
    return null;
  }

  private _isUniqueUrl = (url: string, items: RealityDataEntry[]) => {
    for (const item of items) {
      if (url === item.url)
        return false;
    }

    const view = this._vp!.view as SpatialViewState;

    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel((modelState: ContextRealityModelState) => models.push(modelState));

    for (const model of models) {
      if (url === model.url)
        return false;
    }

    return true;
  }

  /**
   * Toggles tree item and display of selected item.
   * @param item  RealityDataEntry selected in picker.
   */
  private _onVisibilityChange(item: RealityDataEntry) {
    item.enabled ? this._disableItem(item) : this._enableItem(item);
  }

  /**
   * Enable tree item and display of selected item.
   * @param item  RealityDataEntry to enable.
   */
  private _enableItem = (item: RealityDataEntry) => {
    this._enableTreeItems([item]);
    this._enableDisplayItems([item]);
  }

  /**
   * Disable tree item and display of selected item.
   * @param item  RealityDataEntry to disable.
   */
  private _disableItem = (item: RealityDataEntry) => {
    this._disableTreeItems([item]);
    this._disableDisplayItems([item]);
  }

  /**
   * Enable item in tree.
   * @param item  RealityDataEntry to enable tree item for.
   */
  private _enableTreeItems = (entries: RealityDataEntry[]) => {
    if (!this._isMounted)
      return;

    const items = this.state.items;
    entries.forEach((entry) => {
      entry.enabled = true;
      const index = items.indexOf(entry);
      items.splice(index, 1, entry);
    });

    this.setState({ items });
  }

  /**
   * Enable display item in viewport.
   * @param item  RealityDataEntry to enable display for.
   */
  private _enableDisplayItems = (entries: RealityDataEntry[]) => {
    const view = this._vp!.view as SpatialViewState;

    for (const entry of entries) {
      if (entry.model instanceof AttachedRealityModel) {
        this._vp!.addViewedModels((entry.model as AttachedRealityModel).id); // tslint:disable-line:no-floating-promises
        return;
      }
      const props = {
        tilesetUrl: entry.model.url,
        name: entry.model.name,
        description: entry.description,
        // classifiers: entry. SpatialClassificationProps.PropertiesProps[], // TODO?
      };

      const existingRealityModels: ContextRealityModelState[] = [];
      view.displayStyle.forEachRealityModel((modelState: ContextRealityModelState) => existingRealityModels.push(modelState));

      const found = existingRealityModels.find((model) => {
        if (model.url === props.tilesetUrl)
          return true;
        return false;
      });

      if (!found)
        view.displayStyle.attachRealityModel(props);
    }

    this._vp!.invalidateScene();
  }

  /**
   * Disable tree item and display of selected item.
   * @param item  RealityDataEntry to disable.
   */
  private _disableTreeItems = (entries: RealityDataEntry[]) => {
    if (!this._isMounted)
      return;

    const items = this.state.items;
    for (const entry of entries) {
      entry.enabled = false;
      if (entry.model instanceof AttachedRealityModel) {
        this._vp!.changeModelDisplay((entry.model as AttachedRealityModel).id, false);
        return;
      }

      const index = items.indexOf(entry);
      items.splice(index, 1, entry);
    }

    this.setState({ items });
  }

  /**
   * Disable display item in viewport.
   * @param item  RealityDataEntry to disable display for.
   */
  private _disableDisplayItems = (entries: RealityDataEntry[]) => {
    if (!this._vp)
      return;

    const view = this._vp!.view as SpatialViewState;
    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel((modelState: ContextRealityModelState) => models.push(modelState));

    entries.forEach((entry) => {
      if (entry.model) {
        const index = models.findIndex((state: ContextRealityModelState) => {
          return entry.model.url.includes(state.url);
        });
        if (-1 !== index)
          view.displayStyle.detachRealityModelByIndex(index);
      }
    });

    this._vp!.invalidateScene();
  }

  /**
   * Enable all tree items and corresponding display items.
   */
  private _showAllRealityData = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    this._setEnableMap(true);
    this._enableTreeItems(this.state.items);
    this._enableDisplayItems(this.state.items);

    if (this._isMounted)
      this.setState({ isOptionsOpened: false });
  }

  /**
   * Disable all tree items and corresponding display items.
   */
  private _hideAllRealityData = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    this._setEnableMap(false);
    this._disableTreeItems(this.state.items);
    this._disableAllDisplayItems();

    if (this._isMounted)
      this.setState({ isOptionsOpened: false });
  }

  /**
   * Enable or disable map.
   * @param isEnabled specifies wether to enable or disable map.
   */
  private _setEnableMap = (isEnabled: boolean) => {
    if (!this._isMounted)
      return;

    const view = this._vp!.view as SpatialViewState;
    const newFlags = view.viewFlags.clone();
    newFlags.backgroundMap = isEnabled;
    this._vp!.viewFlags = newFlags;

    if (isEnabled) {
      (this._vp!.view as SpatialViewState).getDisplayStyle3d().changeBackgroundMapProps(BackgroundMapSettings.fromJSON({
        groundBias: view.getDisplayStyle3d().settings.backgroundMap.groundBias,
        providerName: "BingProvider",
        providerData: {
          mapType: this.state.bingMapType,
        },
      }));
      this._vp!.synchWithView();
    }

    this.setState({
      isMapEnabled: isEnabled,
    });
    this._vp!.invalidateScene();
  }

  /** Disable all display items. */
  private _disableAllDisplayItems = () => {
    if (!this._vp)
      return;

    const view = this._vp!.view as SpatialViewState;

    const models: ContextRealityModelState[] = [];
    view.displayStyle.forEachRealityModel((modelState: ContextRealityModelState) => models.push(modelState));

    for (const model of models)
      view.displayStyle.detachRealityModelByNameAndUrl(model.name, model.url);
  }

  /**
   * Invert all tree items and corresponding display items.
   */
  private _invertAllRealityData = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    const items = this.state.items;
    const enabledItems: RealityDataEntry[] = [];
    const disabledItems: RealityDataEntry[] = [];
    items.forEach((item) => {
      item.enabled ? enabledItems.push(item) : disabledItems.push(item);
    });

    this._toggleBingMap();

    this._enableTreeItems(disabledItems);
    this._enableDisplayItems(disabledItems);

    this._disableTreeItems(enabledItems);
    this._disableDisplayItems(enabledItems);

    if (this._isMounted)
      this.setState({ isOptionsOpened: false });
  }

  /** @hidden */
  public render() {
    const headerClassName = classnames("reality-data-viewer", this.state.showSearchBox && "show-search");
    return (
      <div className="reality-data-widget">
        {!this.state.initialized &&
          <LoadingSpinner size={SpinnerSize.Medium} />
        }
        {(this.state.initialized && this.state.items.length === 0 && !this.props.iModelConnection.isGeoLocated) &&
          <div className="reality-data-empty-msg">
            {UiFramework.i18n.translate("UiFramework:realityData.noneAvailable")}
          </div>
        }
        {(this.state.initialized && this.state.items.length === 0 && this.props.iModelConnection.isGeoLocated) &&
          <div className={headerClassName}>
            {this._getHeader()}
            {this._getSearch()}
            {this._getMapOnly()}
          </div>
        }
        {(this.state.initialized && this.state.items.length !== 0) &&
          <div className={headerClassName}>
            {this._getHeader()}
            {this._getSearch()}
            {this._getContent()}
          </div>
        }
      </div>
    );
  }

  private _onShowOptions(event: any) {
    event.stopPropagation();

    if (this._isMounted)
      this.setState((prevState) => ({ isOptionsOpened: !prevState.isOptionsOpened }));
  }

  private _onCloseContextMenu() {
    if (this._isMounted)
      this.setState({ isOptionsOpened: false });
  }

  private _onToggleSearchBox = () => {
    if (this._isMounted)
      this.setState(
        (prevState) => ({ showSearchBox: !prevState.showSearchBox }),
        () => { this._searchBox!.focus(); });
  }

  private _getMapOnly = () => {
    return (
      <div className="reality-data-content">
        <ul className="reality-data-list">
          {this._isMapVisible() ?
            <li className="reality-data-item" key={"bingMap"} onClick={this._toggleBingMap}>
              <span className={this.state.isMapEnabled ? "icon icon-visibility" : "icon icon-visibility-hide-2"} />
              <a><span className="reality-data-name">{this._bingMapTitle}</span></a>
              <span className="icon icon-more-2" onClick={this._onShowMapTypes} />
              <ContextMenu opened={this.state.showMapTypes} onOutsideClick={this._onCloseMapTypesMenu.bind(this)} direction={ContextMenuDirection.BottomRight} >
                <ContextMenuItem checked={this.state.bingMapType === BackgroundMapType.Hybrid} onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => this._onChanged.bind(this, BackgroundMapType.Hybrid, event)}>{IModelApp.i18n.translate("UiFramework:realityData.hybrid")}</ContextMenuItem>
                <ContextMenuItem checked={this.state.bingMapType === BackgroundMapType.Aerial} onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => this._onChanged.bind(this, BackgroundMapType.Aerial, event)}>{IModelApp.i18n.translate("UiFramework:realityData.aerial")}</ContextMenuItem>
                <ContextMenuItem checked={this.state.bingMapType === BackgroundMapType.Street} onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => this._onChanged.bind(this, BackgroundMapType.Street, event)}>{IModelApp.i18n.translate("UiFramework:realityData.street")} </ContextMenuItem>
                <ContextMenuItem onClick={this._onSettingsOpened}>{IModelApp.i18n.translate("UiFramework:realityData.settings")}</ContextMenuItem>
              </ContextMenu>
            </li> :
            undefined}
        </ul>
      </div>
    );
  }

  private _getHeader = () => {
    return (
      <div className={"reality-data-header"}>
        <span>{UiFramework.i18n.translate("UiFramework:realityData.title")}</span>
        <span className="icon icon-search" onClick={this._onToggleSearchBox} />
        <span className="options icon icon-more-2" title={IModelApp.i18n.translate("UiFramework:realityData.options")}
          onClick={this._onShowOptions.bind(this)}></span>
        <ContextMenu opened={this.state.isOptionsOpened} onOutsideClick={this._onCloseContextMenu.bind(this)} direction={ContextMenuDirection.BottomRight}>
          <ContextMenuItem key={0} icon="icon-visibility" onClick={this._showAllRealityData}>{IModelApp.i18n.translate("UiFramework:realityData.showAll")}</ContextMenuItem>
          <ContextMenuItem key={1} icon="icon-visibility-hide-2" onClick={this._hideAllRealityData}>{IModelApp.i18n.translate("UiFramework:realityData.hideAll")}</ContextMenuItem>
          <ContextMenuItem key={2} icon="icon-visibility-invert" onClick={this._invertAllRealityData}>{IModelApp.i18n.translate("UiFramework:realityData.invertDisplay")}</ContextMenuItem>
        </ContextMenu>
      </div>
    );
  }

  private _getSearch = () => {
    return (
      <SearchBox placeholder={UiFramework.i18n.translate("UiCore:general.search")} onValueChanged={this._handleSearchValueChanged} valueChangedDelay={250}
        ref={(searchBox) => { this._searchBox = searchBox; }} />
    );
  }

  private _handleSearchValueChanged = (value: string): void => {
    if (this._isMounted)
      this.setState({ filter: value });
  }

  private _onShowMapTypes = (event: any) => {
    if (!this._isMounted)
      return;

    event.preventDefault();
    event.stopPropagation();
    const view = this._vp!.view as SpatialViewState;
    const mapType = view.getDisplayStyle3d().settings.backgroundMap.mapType;
    this.setState({ showMapTypes: true, bingMapType: mapType });
  }

  private _onChanged = (mapType: BackgroundMapType, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!this._vp || !this._isMounted)
      return;

    this._vp!.changeBackgroundMapProps({ providerData: { mapType } });
    this._vp!.synchWithView();

    this._vp!.invalidateScene();
    this.setState({ showMapTypes: false, bingMapType: mapType });
  }

  private _onSettingsOpened = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!this._isMounted)
      return;

    ModalDialogManager.openDialog(this._getSettingsDialog());
    this.setState({ showMapTypes: false });
  }

  private _getSettingsDialog = () => {
    return (
      <SettingsModalDialog
        iModelConnection={this.props.iModelConnection}
        opened={true}
      />
    );
  }

  private _onCloseMapTypesMenu = () => {
    if (this._isMounted)
      this.setState({ showMapTypes: false });
  }

  private _getContent = () => {
    const filteredRealityData = this._getFilteredRealityData();
    return (
      <div className="reality-data-content">
        <ul className="reality-data-list">
          {this._isMapVisible() ?
            <li className="reality-data-item" key={"bingMap"} onClick={this._toggleBingMap}>
              <span className={this.state.isMapEnabled ? "icon icon-visibility" : "icon icon-visibility-hide-2"} />
              <a><span className="reality-data-name">{this._bingMapTitle}</span></a>
              <span className="icon icon-more-2" onClick={this._onShowMapTypes} />
              <ContextMenu opened={this.state.showMapTypes} onOutsideClick={this._onCloseMapTypesMenu.bind(this)} direction={ContextMenuDirection.BottomRight}>
                <ContextMenuItem checked={this.state.bingMapType === BackgroundMapType.Hybrid} onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => this._onChanged.bind(this, BackgroundMapType.Hybrid, event)}>{IModelApp.i18n.translate("UiFramework:realityData.hybrid")}</ContextMenuItem>
                <ContextMenuItem checked={this.state.bingMapType === BackgroundMapType.Aerial} onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => this._onChanged.bind(this, BackgroundMapType.Aerial, event)}>{IModelApp.i18n.translate("UiFramework:realityData.aerial")}</ContextMenuItem>
                <ContextMenuItem checked={this.state.bingMapType === BackgroundMapType.Street} onClick={(event: React.MouseEvent<HTMLDivElement, MouseEvent>) => this._onChanged.bind(this, BackgroundMapType.Street, event)}>{IModelApp.i18n.translate("UiFramework:realityData.street")}</ContextMenuItem>
                <ContextMenuItem onClick={this._onSettingsOpened}>{IModelApp.i18n.translate("UiFramework:realityData.settings")}</ContextMenuItem>
              </ContextMenu>
            </li> :
            null
          }
          {
            filteredRealityData.map((_item: RealityDataEntry) =>
              (
                <RealityDataItem key={_item.url} item={_item} onVisibilityChange={this._onVisibilityChange.bind(this, _item)} />
              ))
          }
        </ul>
      </div>
    );
  }

  private _isMapVisible = () => {
    return this._bingMapTitle.toLowerCase().includes(this.state.filter.toLowerCase());
  }

  private _toggleBingMap = () => {

    if (!this._isMounted)
      return;

    const view = this._vp!.view as SpatialViewState;
    const newFlags = view.viewFlags.clone();
    newFlags.backgroundMap = !view.viewFlags.backgroundMap;
    this._vp!.viewFlags = newFlags;
    const isMapEnabled = this._vp!.viewFlags.backgroundMap;

    if (isMapEnabled) {
      (this._vp!.view as SpatialViewState).getDisplayStyle3d().changeBackgroundMapProps(BackgroundMapSettings.fromJSON({
        groundBias: view.getDisplayStyle3d().settings.backgroundMap.groundBias,
        providerName: "BingProvider",
        providerData: {
          mapType: this.state.bingMapType,
        },
      }));
      this._vp!.synchWithView();
    }

    this.setState({
      isMapEnabled,
    });
    this._vp!.invalidateScene();
  }

  private _getFilteredRealityData = (): RealityDataEntry[] => {
    if (!this.state.filter || this.state.filter === "")
      return this.state.items;

    let filteredData: RealityDataEntry[] = [];
    if (this.state.items) {
      filteredData = this.state.items!.filter((item) => {
        return item.name.toLowerCase().includes(this.state.filter.toLowerCase()) ||
          item.description.toLowerCase().includes(this.state.filter.toLowerCase());
      });
    }
    return filteredData;
  }
}

export default RealityDataPicker;

ConfigurableUiManager.registerControl("RealityDataPicker", RealityDataPickerControl); // tslint:disable-line:deprecation
