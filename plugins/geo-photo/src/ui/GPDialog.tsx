/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { I18N } from "@bentley/imodeljs-i18n";
import { Dialog, DialogButtonType, LabeledInput, LoadingBar, Spinner, Checkbox, CheckBoxState, SpinnerSize, DialogButtonDef } from "@bentley/ui-core";
import { ModelessDialogManager } from "@bentley/ui-framework";
import { SyncPropertiesChangeEventArgs } from "@bentley/ui-abstract";
import { GPDialogUiProvider, SyncTreeDataEventArgs, SyncTitleEventArgs } from "./GPDialogUiProvider";
import { ITreeDataProvider, Tree, TreeNodeItem } from "@bentley/ui-components";
import { PhotoFolder } from "../PhotoTree";
import { GeoPhotoPlugin, GeoPhotoSettings } from "../geoPhoto";

import "./GPDialog.scss";

interface TabProps {
  label?: string;
  icon?: string;
  isSeparator?: boolean;
  index?: number;
  selectedTabIndex?: number;
  onTabClicked?: () => any;
}

class Tab extends React.Component<TabProps> {
  constructor(props: TabProps, context?: any) {
    super(props, context);
  }

  public static defaultProps: Partial<TabProps> = {
    label: "",
    icon: "",
    selectedTabIndex: 0,
  };

  private _onClick = () => {
    if (this.props.onTabClicked) {
      this.props.onTabClicked();
    }
  }

  public render() {
    const isActive = this.props.index === this.props.selectedTabIndex!;
    const classes = isActive ? "tabs-style-linemove tab-active" : "tabs-style-linemove";
    return (
      <li className={classes} onClick={this._onClick}>
        <a>
          <span className="text">{this.props.label}</span>
        </a>
      </li>
    );
  }
}

interface TabsProps {
  onClick?: (tabIndex: number) => any;
  defaultTab: number;
}

interface TabsState {
  activeTab: number;
}

/* list of tabs */
class Tabs extends React.Component<TabsProps, TabsState> {
  constructor(props: TabsProps, context?: any) {
    super(props, context);
    this.state = { activeTab: this.props.defaultTab };
  }

  public componentDidUpdate() {
    if (this.props.defaultTab !== this.state.activeTab)
      this.setState((_, props) => ({ activeTab: props.defaultTab }));
  }

  // set active tab
  private _handleTabClick = (tabIndex: number, onTabClick: () => any) => {
    this.setState({ activeTab: tabIndex });

    // fire the tab onClick
    if (onTabClick) {
      onTabClick();
    }

    // fire the tabs onClick
    if (this.props.onClick)
      this.props.onClick(tabIndex);
  }

  private renderChildren() {
    return React.Children.map(this.props.children, (child: any, iTab) => {
      return React.cloneElement(child, {
        isActive: iTab === this.state.activeTab,
        index: iTab,
        selectedTabIndex: this.state.activeTab,
        onTabClicked: this._handleTabClick.bind(this, iTab, child.props.onTabClicked),
      });
    });
  }

  public render() {
    return (
      <div className="gp-load-tabstrip">
        <nav>
          <ul>
            {this.renderChildren()}
          </ul>
        </nav>
      </div>
    );
  }
}

/** Props for the [[GPDialog]] component */
interface GeoPhotoDialogProps {
  dataProvider: GPDialogUiProvider;
}

/** State for the [[GPDialog]] component */
interface GeoPhotoDialogState {
  dialogTitle: string;
  loadPhase: number; // 0 = gatheringFolderInfo, 1 = gatheringPhotoInfo.
  currentTab: number;
  folderCount: number;
  folderName: string;
  fileCount: number;
  currentFolder: number;
  currentFile: number;
  geoPanoramaCount: number;
  geoPhotoCount: number;
  showMarkers: boolean;
  maxDistanceVal: string;
  maxCrossDistanceVal: string;
  cameraHeightVal: string;
  treeDataProvider: ITreeDataProvider | undefined;
}

/**
 * A dialog showing the status of loading geolocated photos
 * @alpha
 */
export class GeoPhotoDialog extends React.Component<GeoPhotoDialogProps, GeoPhotoDialogState> {
  public readonly state: Readonly<GeoPhotoDialogState>;
  public static readonly id = "GPDialog";
  private _i18n: I18N;

  constructor(props: GeoPhotoDialogProps) {
    super(props);
    this._i18n = this.props.dataProvider.plugin.i18n;

    const settings = props.dataProvider.plugin.settings;

    this.state = {
      dialogTitle: props.dataProvider.title,
      loadPhase: props.dataProvider.loadPhase,
      currentTab: 0,
      folderCount: props.dataProvider.folderCount,
      folderName: " ",
      fileCount: props.dataProvider.fileCount,
      currentFolder: props.dataProvider.currentFolder,
      currentFile: props.dataProvider.currentFile,
      geoPanoramaCount: props.dataProvider.panoramaCount,
      geoPhotoCount: props.dataProvider.photoCount,
      treeDataProvider: props.dataProvider.treeDataProvider,
      showMarkers: settings.showMarkers,
      maxDistanceVal: `${settings.maxDistance}`,
      maxCrossDistanceVal: `${settings.maxCrossDistance}`,
      cameraHeightVal: `${settings.eyeHeight}`,
    };
  }

  private _handleSyncPropertiesChangeEvent = (args: SyncPropertiesChangeEventArgs) => {
    if (args.properties && args.properties.length) {
      for (const prop of args.properties) {
        if (prop.propertyName === this.props.dataProvider.loadPhasePropertyName) {
          this.setState((_, props) => ({ loadPhase: props.dataProvider.loadPhase }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.folderNamePropertyName) {
          this.setState((_, props) => ({ folderName: props.dataProvider.folderName }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.folderCountPropertyName) {
          this.setState((_, props) => ({ folderCount: props.dataProvider.folderCount }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.fileCountPropertyName) {
          this.setState((_, props) => ({ fileCount: props.dataProvider.fileCount }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.currentFolderPropertyName) {
          this.setState((_, props) => ({ currentFolder: props.dataProvider.currentFolder }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.currentFilePropertyName) {
          this.setState((_, props) => ({ currentFile: props.dataProvider.currentFile }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.panoramaCountPropertyName) {
          this.setState((_, props) => ({ geoPanoramaCount: props.dataProvider.panoramaCount }));
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.photoCountPropertyName) {
          this.setState((_, props) => ({ geoPhotoCount: props.dataProvider.photoCount }));
          continue;
        }
      }
    }
  }

  private _handleSyncDataTreeEvent = (args: SyncTreeDataEventArgs) => {
    this.setState({ treeDataProvider: args.treeData });
  }

  private _handleSyncTitleEvent = (args: SyncTitleEventArgs) => {
    this.setState({ dialogTitle: args.title });
  }

  private _handleSyncShowMarkersEvent = (arg: boolean) => {
    this.props.dataProvider.plugin.saveSettings().catch((_err) => { });
    this.setState({ showMarkers: arg });
  }

  private _handleSyncSettingsEvent = (newSettings: GeoPhotoSettings) => {
    this.setState({ showMarkers: newSettings.showMarkers, maxDistanceVal: `${newSettings.maxDistance}`, maxCrossDistanceVal: `${newSettings.maxCrossDistance}`, cameraHeightVal: `${newSettings.eyeHeight}` });
  }

  private _onTabChange = (tabIndex: number) => {
    this.setState({ currentTab: tabIndex });
  }

  public componentDidMount() {
    this.props.dataProvider.onSyncPropertiesChangeEvent.addListener(this._handleSyncPropertiesChangeEvent);
    this.props.dataProvider.onSyncDataTreeEvent.addListener(this._handleSyncDataTreeEvent);
    this.props.dataProvider.onSyncTitleEvent.addListener(this._handleSyncTitleEvent);
    this.props.dataProvider.onSyncShowMarkersEvent.addListener(this._handleSyncShowMarkersEvent);
    this.props.dataProvider.onSyncSettingsEvent.addListener(this._handleSyncSettingsEvent);
  }

  public componentWillUnmount() {
    this.props.dataProvider.onSyncPropertiesChangeEvent.removeListener(this._handleSyncPropertiesChangeEvent);
    this.props.dataProvider.onSyncDataTreeEvent.removeListener(this._handleSyncDataTreeEvent);
    this.props.dataProvider.onSyncTitleEvent.removeListener(this._handleSyncTitleEvent);
    this.props.dataProvider.onSyncShowMarkersEvent.removeListener(this._handleSyncShowMarkersEvent);
    this.props.dataProvider.onSyncSettingsEvent.removeListener(this._handleSyncSettingsEvent);
  }

  // user closed the modeless dialog
  private _onClose = () => {
    this._closeDialog();
  }

  private _closeDialog = () => {
    ModelessDialogManager.closeDialog(GeoPhotoDialog.id);
  }

  // renders the dialog content when gathering the files from the repository.
  private renderGathering() {
    // use a LoadSpinner();
    return (
      <div className="gp-load-div-phase0">
        <div className=" gp-banner">{this._i18n.translate("geoPhoto:LoadDialog.Finding")}</div>
        <div className="gp-spinner">
          <Spinner size={SpinnerSize.Large} />
        </div>
        <div className="gp-current-folder">{this._i18n.translate("geoPhoto:LoadDialog.FolderName", { folderName: this.state.folderName })}</div>
        <div className="gp-folder-count">{this._i18n.translate("geoPhoto:LoadDialog.FolderCount", { count: this.state.folderCount })}</div>
        <div className="gp-file-count">{this._i18n.translate("geoPhoto:LoadDialog.FileCount", { count: this.state.fileCount })}</div>
      </div>
    );
  }

  // renders the dialog content when processing the jpg files that we found in the repository.
  private renderProcessing() {
    return (
      <div className="gp-load-div-phase1">
        <span className="gp-phase1-message-top">{this._i18n.translate("geoPhoto:LoadDialog.Processing")}</span>
        <div>
          <span className="gp-phase1-fraction">{this._i18n.translate("geoPhoto:LoadDialog.FolderProgress", { folderNum: this.state.currentFolder, folderCount: this.state.folderCount })}</span>
          <LoadingBar showPercentage={true} barHeight={20} percent={Math.floor(0.5 + (100.0 * this.state.currentFolder / this.state.folderCount))} />
        </div>
        <div></div>
        <div>
          <span className="gp-phase1-fraction">{this._i18n.translate("geoPhoto:LoadDialog.FileProgress", { fileNum: this.state.currentFile, fileCount: this.state.fileCount })}</span>
          <LoadingBar showPercentage={this.state.fileCount > 0} barHeight={20} percent={Math.floor(0.5 + (100.0 * this.state.currentFile / this.state.fileCount))} />
        </div>
        <div className="gp-phase1-count">{this._i18n.translate("geoPhoto:LoadDialog.Panoramas", { panoramas: this.state.geoPanoramaCount })}</div>
        <div>{this._i18n.translate("geoPhoto:LoadDialog.Photos", { photos: this.state.geoPhotoCount })}</div>
      </div>
    );
  }

  // event triggered when a checkbox is clicked.
  private checkBoxClicked(stateChanges: Array<{ node: TreeNodeItem, newState: CheckBoxState }>) {
    const changedNodes: PhotoFolder[] = [];
    for (const stateChange of stateChanges) {
      if (!(stateChange.node instanceof PhotoFolder))
        continue;
      const photoFolder: PhotoFolder = stateChange.node as PhotoFolder;
      photoFolder.visible = (stateChange.newState === CheckBoxState.On);
      changedNodes.push(photoFolder);
      // need all the subnodes, too.
      const subNodes = photoFolder.getSubFolders();
      for (const subNode of subNodes) {
        changedNodes.push(subNode);
      }
    }

    // raise the changed event.
    if (changedNodes.length > 0) {
      changedNodes[0].photoTree.onTreeNodeChanged.raiseEvent(changedNodes);
      this.props.dataProvider.markerVisibilityChange();
    }
  }

  private renderFolderSettings() {
    if (!this.state.treeDataProvider)
      return;

    return (
      <div className="gp-load-div-phase2" >
        <Tree
          dataProvider={this.state.treeDataProvider}
          onCheckboxClick={this.checkBoxClicked.bind(this)}
        />
      </div>
    );
  }

  private _onMaxDistChanged(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ maxDistanceVal: e.target.value });
  }

  private _onMaxDistCommit(plugin: GeoPhotoPlugin) {
    const maxDistance = Number.parseFloat(this.state.maxDistanceVal);
    if (!Number.isNaN(maxDistance) && (maxDistance > 0.0) && (maxDistance < 2000.0)) {
      plugin.settings.maxDistance = maxDistance;
      plugin.saveSettings().catch((_err) => { });
    } else {
      // set it back to original value.
      this.setState({ maxDistanceVal: `${plugin.settings.maxDistance}` });
    }
  }

  private _onMaxXDistChanged(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ maxCrossDistanceVal: e.target.value });
  }

  private _onMaxXDistCommit(plugin: GeoPhotoPlugin) {
    const maxCrossDistance = Number.parseFloat(this.state.maxCrossDistanceVal);
    if (!Number.isNaN(maxCrossDistance) && (maxCrossDistance > 0.0) && (maxCrossDistance < 200.0)) {
      plugin.settings.maxCrossDistance = maxCrossDistance;
      plugin.saveSettings().catch((_err) => { });
    } else {
      // set it back to original value.
      this.setState({ maxCrossDistanceVal: `${plugin.settings.maxCrossDistance}` });
    }
  }

  private _onCameraHeightChanged(e: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ cameraHeightVal: e.target.value });
  }

  private _onCameraHeightCommit(plugin: GeoPhotoPlugin) {
    const cameraHeight = Number.parseFloat(this.state.cameraHeightVal);
    if (!Number.isNaN(cameraHeight) && (cameraHeight > 0.0) && (cameraHeight < 50.0)) {
      plugin.settings.eyeHeight = cameraHeight;
      plugin.saveSettings().catch((_err) => { });
    } else {
      // set it back to original value.
      this.setState({ cameraHeightVal: `${plugin.settings.eyeHeight}` });
    }
  }

  private _onShowMarkersClicked(plugin: GeoPhotoPlugin, _e: React.MouseEvent) {
    plugin.settings.showMarkers = !plugin.settings.showMarkers;
    this.setState({ showMarkers: plugin.settings.showMarkers });
    plugin.saveSettings().catch((_err) => { });
  }

  private renderViewerSettings() {
    return (
      <div className="gp-phase2-settings">
        <Checkbox labelStyle={{ fontWeight: "bold" }} checked={this.state.showMarkers} label={this._i18n.translate("geoPhoto:LoadDialog.ShowMarkers")} onClick={this._onShowMarkersClicked.bind(this, this.props.dataProvider.plugin)} />
        <div style={{ marginLeft: "30px", marginTop: "10px" }}>
          <LabeledInput type={"text"} inputStyle={{ width: "100px" }} value={this.state.maxDistanceVal} disabled={!this.state.showMarkers} onChange={this._onMaxDistChanged.bind(this)} onBlur={this._onMaxDistCommit.bind(this, this.props.dataProvider.plugin)} label={this._i18n.translate("geoPhoto:LoadDialog.MaxDistance")} />
          <LabeledInput type={"text"} inputStyle={{ width: "100px" }} value={this.state.maxCrossDistanceVal} disabled={!this.state.showMarkers} onChange={this._onMaxXDistChanged.bind(this)} onBlur={this._onMaxXDistCommit.bind(this, this.props.dataProvider.plugin)} label={this._i18n.translate("geoPhoto:LoadDialog.MaxCrossDistance")} />
          <LabeledInput type={"text"} inputStyle={{ width: "100px" }} value={this.state.cameraHeightVal} disabled={!this.state.showMarkers} onChange={this._onCameraHeightChanged.bind(this)} onBlur={this._onCameraHeightCommit.bind(this, this.props.dataProvider.plugin)} label={this._i18n.translate("geoPhoto:LoadDialog.CameraHeight")} />
        </div>
      </div>
    );
  }

  // shows the settings phase of the dialog
  private renderSettings() {
    return (
      <div className="gp-load-div-phase2" >
        <Tabs defaultTab={this.state.currentTab} onClick={this._onTabChange} >
          <Tab label={this._i18n.translate("geoPhoto:LoadDialog.Folders")} />
          <Tab label={this._i18n.translate("geoPhoto:LoadDialog.Settings")} />
        </Tabs>
        <div className="gp-phase2-div-tabcontents">
          {this.state.currentTab === 0 && this.renderFolderSettings()}
          {this.state.currentTab === 1 && this.renderViewerSettings()}
        </div>
      </div>
    );
  }

  // When there are no photos.
  private renderEmpty() {
    return (
      <div className="gp-load-div-phase2">
        {this._i18n.translate("geoPhoto:LoadDialog.EmptyPhotoSet")}
      </div>
    );
  }
  // renders the dialog content, according to the current phase.
  private renderContent() {
    const loadPhase = this.state.loadPhase;

    return (
      <div className="gp-load-dialog">
        {loadPhase === 0 && this.renderGathering()}
        {loadPhase === 1 && this.renderProcessing()}
        {loadPhase === 2 && this.renderSettings()}
        {loadPhase === 3 && this.renderEmpty()}
      </div>
    );
  }

  /** @hidden */
  public render(): JSX.Element {
    const buttonDef: DialogButtonDef = {
      type: DialogButtonType.Close,
      onClick: this._closeDialog,
    };
    return (
      <Dialog
        buttonCluster={[buttonDef]}
        title={this.state.dialogTitle}
        opened={true}
        resizable={true}
        movable={true}
        modal={false}
        onClose={this._onClose}
        onEscape={this._onClose}
        width={400}
        height={280}
        minHeight={280}
      >
        {this.renderContent()}
      </Dialog>
    );
  }
}
