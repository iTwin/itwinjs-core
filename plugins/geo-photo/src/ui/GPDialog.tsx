/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { I18N } from "@bentley/imodeljs-i18n";
import { Dialog, DialogButtonType, LoadingBar, Spinner, CheckBoxState, SpinnerSize, DialogButtonDef } from "@bentley/ui-core";
import { ModelessDialogManager, SyncPropertiesChangeEventArgs } from "@bentley/ui-framework";
import { GPDialogUiProvider, SyncTreeDataEventArgs, SyncTitleEventArgs } from "./GPDialogUiProvider";
import { ITreeDataProvider, Tree, TreeNodeItem } from "@bentley/ui-components";
import { PhotoFolder } from "../PhotoTree";

import "./GPDialog.scss";

/** Props for the [[GPDialog]] component */
interface GeoPhotoDialogProps {
  dataProvider: GPDialogUiProvider;
}

/** State for the [[GPDialog]] component */
interface GeoPhotoDialogState {
  dialogTitle: string;
  loadPhase: number; // 0 = gatheringFolderInfo, 1 = gatheringPhotoInfo.
  folderCount: number;
  folderName: string;
  fileCount: number;
  currentFolder: number;
  currentFile: number;
  geoPanoramaCount: number;
  geoPhotoCount: number;
  treeDataProvider: ITreeDataProvider | undefined;
}

/**
 * A dialog showing the status of loading geolocated photos
 * @alpha
 */
export class GeoPhotoDialog extends React.Component<GeoPhotoDialogProps, GeoPhotoDialogState> {
  public readonly state: Readonly<GeoPhotoDialogState>;
  public static readonly id = "GPDialog";
  private _initialDialogTitle: string;
  private _i18n: I18N;

  constructor(props: GeoPhotoDialogProps) {
    super(props);
    this._i18n = this.props.dataProvider.plugin.i18n;
    this._initialDialogTitle = this._i18n.translate("geoPhoto:LoadDialog.LoadTitle");

    this.state = {
      dialogTitle: this._initialDialogTitle,
      loadPhase: 0,
      folderCount: 0,
      folderName: "",
      fileCount: 0,
      currentFolder: 0,
      currentFile: 0,
      geoPanoramaCount: 0,
      geoPhotoCount: 0,
      treeDataProvider: undefined,
    };
  }

  private _handleSyncPropertiesChangeEvent = (args: SyncPropertiesChangeEventArgs) => {
    if (args.properties && args.properties.length) {
      for (const prop of args.properties) {
        if (prop.propertyName === this.props.dataProvider.loadPhasePropertyName) {
          this.setState({ loadPhase: this.props.dataProvider.loadPhase });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.folderNamePropertyName) {
          this.setState({ folderName: this.props.dataProvider.folderName });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.folderCountPropertyName) {
          this.setState({ folderCount: this.props.dataProvider.folderCount });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.fileCountPropertyName) {
          this.setState({ fileCount: this.props.dataProvider.fileCount });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.currentFolderPropertyName) {
          this.setState({ currentFolder: this.props.dataProvider.currentFolder });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.currentFilePropertyName) {
          this.setState({ currentFile: this.props.dataProvider.currentFile });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.panoramaCountPropertyName) {
          this.setState({ geoPanoramaCount: this.props.dataProvider.panoramaCount });
          continue;
        }
        if (prop.propertyName === this.props.dataProvider.photoCountPropertyName) {
          this.setState({ geoPhotoCount: this.props.dataProvider.photoCount });
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

  public componentDidMount() {
    this.props.dataProvider.onSyncPropertiesChangeEvent.addListener(this._handleSyncPropertiesChangeEvent);
    this.props.dataProvider.onSyncDataTreeEvent.addListener(this._handleSyncDataTreeEvent);
    this.props.dataProvider.onSyncTitleEvent.addListener(this._handleSyncTitleEvent);
  }

  public componentWillUnmount() {
    this.props.dataProvider.onSyncPropertiesChangeEvent.removeListener(this._handleSyncPropertiesChangeEvent);
    this.props.dataProvider.onSyncDataTreeEvent.removeListener(this._handleSyncDataTreeEvent);
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
          <Spinner size={SpinnerSize.Large}/>
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
          <LoadingBar showPercentage={true} barHeight={20} percent={Math.floor(0.5 + (100.0 * this.state.currentFile / this.state.fileCount))} />
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

  // shows the settings phase of the dialog
  private renderSettings() {
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

  // renders the dialog content, according to the current phase.
  private renderContent() {
    const loadPhase = this.state.loadPhase;

    return (
      <div className="gp-load-dialog">
          {loadPhase === 0 && this.renderGathering()}
          {loadPhase === 1 && this.renderProcessing()}
          {loadPhase === 2 && this.renderSettings()}
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
