/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { StopWatch } from "@bentley/bentleyjs-core";
import { PluginUiProvider, UiItemNode, ToolSettingsPropertyItem, ToolSettingsValue } from "@bentley/imodeljs-frontend";
import { ActionItemInsertSpec, ToolbarItemInsertSpec, ToolbarItemType } from "@bentley/ui-abstract";
import { UiEvent } from "@bentley/ui-core";
import { ModelessDialogManager, UiDataProvider } from "@bentley/ui-framework";
import { ITreeDataProvider } from "@bentley/ui-components";

import { GeoPhotoDialog } from "./GPDialog";
import geoPhotoButtonSvg from "./geoPhoto-button.svg";
import { GeoPhotoPlugin, GeoPhotoSettings } from "../geoPhoto";
import { GPLoadTracker } from "../PhotoTree";

export interface SyncTreeDataEventArgs {
  treeData: ITreeDataProvider | undefined;
}

export interface SyncTitleEventArgs {
  title: string;
}

export class SyncDataTreeChangeEvent extends UiEvent<SyncTreeDataEventArgs> { }

export class SyncTitleEvent extends UiEvent<SyncTitleEventArgs> { }
export class SyncShowMarkersEvent extends UiEvent<boolean> {}
export class SyncSettingsEvent extends UiEvent<GeoPhotoSettings> {}

export class GPDialogUiProvider extends UiDataProvider implements PluginUiProvider, GPLoadTracker {
  // either 0 while finding the folder and file counts, or 1 if processing the folders/files.
  public loadPhase: number = 0;
  public readonly loadPhasePropertyName = "loadPhase";

  // the number of folders in ProjectShare that we are going to process.
  public folderCount: number = 0;
  public readonly folderCountPropertyName = "folderCount";

  public folderName: string = "";
  public readonly folderNamePropertyName = "folderName";

  // the number of files in ProjectShare that we are going to process.
  public fileCount: number = 0;
  public readonly fileCountPropertyName = "fileCount";

  // the folder we are currently working on.
  public currentFolder: number = 0;
  public readonly currentFolderPropertyName = "currentFolder";

  // the file that we are working on.
  public currentFile: number = 0;
  public readonly currentFilePropertyName = "currentFile";

  // the number of photos located so far.
  public photoCount: number = 0;
  public readonly photoCountPropertyName = "photoCount";

  // the number of panoramas that we have located so far.
  public panoramaCount: number = 0;
  public readonly panoramaCountPropertyName = "panoramaCount";

  public readonly id = "GPDialogUiProvider";

  public treeDataProvider: ITreeDataProvider | undefined = undefined;
  public onSyncDataTreeEvent = new SyncDataTreeChangeEvent();
  public onSyncShowMarkersEvent = new SyncShowMarkersEvent();
  public onSyncSettingsEvent = new SyncSettingsEvent();

  public title: string = this.plugin.i18n.translate("geoPhoto:LoadDialog.LoadTitle");
  public onSyncTitleEvent = new SyncTitleEvent();

  private _reportStopWatch: StopWatch | undefined = undefined;
  private _nextET: number = 0;

  public constructor(public plugin: GeoPhotoPlugin) {
    super();
  }

  public syncLoadPhaseInUi() {
    const properties = [new ToolSettingsPropertyItem(new ToolSettingsValue(this.loadPhase), this.loadPhasePropertyName)];
    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  private syncFolderCountInUi() {
    const properties = [new ToolSettingsPropertyItem(new ToolSettingsValue(this.folderCount), this.folderCountPropertyName)];
    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  private syncFolderNameInUi() {
    const properties = [new ToolSettingsPropertyItem(new ToolSettingsValue(this.folderName), this.folderNamePropertyName)];
    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  private syncFileCountInUi() {
    const properties = [new ToolSettingsPropertyItem(new ToolSettingsValue(this.fileCount), this.fileCountPropertyName)];
    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  // synch the Phase1 Counts (folders, files, photos, and panoramas) every .1 second.
  private syncPhase1Counts(final: boolean) {
    if (final) {
      // discard stopwatch and sync.
      this._reportStopWatch = undefined;
    } else {
      // start stopwatch if not already going.
      if (!this._reportStopWatch) {
        this._reportStopWatch = new StopWatch(undefined, true);
        this._nextET = 0;
      } else if (this._reportStopWatch.elapsed.milliseconds < this._nextET) {
        return;
      }
      this._nextET += 200;
    }
    const properties = [
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.currentFolder), this.currentFolderPropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.currentFile), this.currentFilePropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.photoCount), this.photoCountPropertyName),
      new ToolSettingsPropertyItem(new ToolSettingsValue(this.panoramaCount), this.panoramaCountPropertyName),
    ];
    this.onSyncPropertiesChangeEvent.emit({ properties });
  }

  public syncTitle(title: string) {
    this.title = title;
    this.onSyncTitleEvent.emit({ title });
  }

  public syncTreeData(treeData: ITreeDataProvider) {
    this.treeDataProvider = treeData;
    this.onSyncDataTreeEvent.emit({ treeData });
  }

  public syncShowMarkers() {
    this.onSyncShowMarkersEvent.emit(this.plugin.settings.showMarkers);
  }

  public syncSettings(newSettings: GeoPhotoSettings) {
    this.onSyncSettingsEvent.emit(newSettings);
  }

  public showGeoPhotoDialog = () => {
    if (!ModelessDialogManager.getDialogInfo(GeoPhotoDialog.id))
      ModelessDialogManager.openDialog(<GeoPhotoDialog dataProvider={this} />, GeoPhotoDialog.id);
  }

  // implementation of GPLoadTracker ---------
  // called when changing from one phase of loading to another.
  public setLoadPhase(loadPhase: number): void {
    this.loadPhase = loadPhase;
    this.syncLoadPhaseInUi();
  }

  // called when we start to process a folder in the ProjectShare repository
  public startFolder(folderName: string): void {
    this.folderName = folderName;
    this.syncFolderNameInUi();
  }

  // called when finished processing a folder in the ProjectShare repository
  public doneFolder(): void {
    this.folderCount++;
    this.syncFolderCountInUi();
  }

  // called when a jpeg file is found in the ProjectShare repository.
  public foundFile(final: boolean): void {
    if (!final)
      this.fileCount++;
    if (final || (0 === this.fileCount % 5)) {
      this.syncFileCountInUi();
    }
  }

  // called when a file has been discovered to be a geolocated jpeg file while processing the entries in the PhotoTree.
  public foundPhoto(final: boolean): void {
    if (!final)
      this.photoCount++;
    this.syncPhase1Counts(final);
  }

  // called when a file has been discovered to be a panorama while processing the entries in the PhotoTree.
  public foundPanorama(final: boolean): void {
    if (!final)
      this.panoramaCount++;
    this.syncPhase1Counts(final);
  }

  // called when moving to a new file while processing the entries in the PhotoTree.
  public nextFile(final: boolean): void {
    if (!final)
      this.currentFile++;
    this.syncPhase1Counts(final);
  }

  // called when moving to a new folder while processing the entries in the PhotoTree.
  public nextFolder(): void {
    this.currentFolder++;
    this.syncPhase1Counts(false);
  }
  // end of implementation of GPLoadTracker ---------

  // called when there has been a change to the selected folders in the dialog.
  public markerVisibilityChange(): void {
    this.plugin.visibilityChange().catch((_err) => { });
  }

  // called when the iModel is closed
  public removeUi() {
    if (ModelessDialogManager.getDialogInfo(GeoPhotoDialog.id))
      ModelessDialogManager.closeDialog(GeoPhotoDialog.id);
  }

  /** Method called by applications that support plugins provided tool buttons. All nine-zone based apps will supports PluginUiProviders */
  public provideToolbarItems(toolBarId: string, _itemIds: UiItemNode): ToolbarItemInsertSpec[] {
    // For 9-zone apps the toolbarId will be in form -[stageName]ToolWidget|NavigationWidget-horizontal|vertical
    // examples:"[ViewsFrontstage]ToolWidget-horizontal" "[ViewsFrontstage]NavigationWidget-vertical"
    if (toolBarId.includes("ToolWidget-horizontal")) {
      const lastActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "geoPhotoPlugin:openDialog",
        execute: this.showGeoPhotoDialog,
        icon: `svg:${geoPhotoButtonSvg}`,
        label: "Show GeoPhoto Markers",
      };
      return [lastActionSpec];
    }
    return [];
  }
}
