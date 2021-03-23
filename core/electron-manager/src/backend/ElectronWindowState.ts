/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NativeAppStorage } from "@bentley/imodeljs-backend";
import { StorageValue } from "@bentley/imodeljs-common";
import { BrowserWindow } from "electron";

// cSpell:ignore unmaximize

/** Maintains main Electron window state for the application.
 * @beta
 */
export class ElectronWindowState {
  private static _xSettingName = "electron-window-x";
  private static _ySettingName = "electron-window-y";
  private static _widthSettingName = "electron-window-width";
  private static _heightSettingName = "electron-window-height";
  private static _maximizedSettingName = "electron-window-maximized";

  /** Constructor for ElectronWindowState.
   * @param storageName       Name used for NativeAppStorage when saving size, position and maximized state
   * @param defaultWidth      Default width of window
   * @param defaultHeight     Default height of window
   * @param defaultMaximized  Default maximized state of window
   */
  constructor(public storageName: string, public defaultWidth: number, public defaultHeight: number, public defaultMaximized: boolean = false) {
  }

  /** Gets the saved window size and position */
  public getPreviousSizeAndPosition = () => {
    let setting: StorageValue | undefined;
    let width = this.defaultWidth;
    let height = this.defaultHeight;
    let x: number | undefined;
    let y: number | undefined;

    const store = NativeAppStorage.open(this.storageName);

    setting = store.getData(ElectronWindowState._widthSettingName);
    if (setting !== undefined)
      width = setting as number;
    setting = store.getData(ElectronWindowState._heightSettingName);
    if (setting !== undefined)
      height = setting as number;

    setting = store.getData(ElectronWindowState._xSettingName);
    if (setting !== undefined)
      x = setting as number;
    setting = store.getData(ElectronWindowState._ySettingName);
    if (setting !== undefined)
      y = setting as number;

    const result: any = {width, height};
    if (x !== undefined && y !== undefined) {
      result.x = x;
      result.y = y;
    }

    store.close();
    return result;
  };

  /** Gets the saved window maximized state */
  public getPreviousMaximizedState = (): boolean => {
    let maximized = this.defaultMaximized;
    const store = NativeAppStorage.open(this.storageName);
    const setting = store.getData(ElectronWindowState._maximizedSettingName);
    if (setting !== undefined)
      maximized = setting as boolean;
    store.close();
    return maximized;
  };

  private saveWindowSize = (width: number, height: number) => {
    const store = NativeAppStorage.open(this.storageName);
    store.setData(ElectronWindowState._widthSettingName, width);
    store.setData(ElectronWindowState._heightSettingName, height);
    store.close();
  };

  private saveWindowPosition = (x: number, y: number) => {
    const store = NativeAppStorage.open(this.storageName);
    store.setData(ElectronWindowState._xSettingName, x);
    store.setData(ElectronWindowState._ySettingName, y);
    store.close();
  };

  private saveWindowMaximized = (maximized: boolean) => {
    const store = NativeAppStorage.open(this.storageName);
    store.setData(ElectronWindowState._maximizedSettingName, maximized);
    store.close();
  };

  /** Monitors state changes and saves window size, position and maximized state */
  public monitorWindowStateChanges = (mainWindow: BrowserWindow) => {
    mainWindow.on("resized", () => {
      const resolution = mainWindow.getSize();
      this.saveWindowSize(resolution[0], resolution[1]);
      const position = mainWindow.getPosition();
      this.saveWindowPosition(position[0], position[1]);
    });

    mainWindow.on("moved", () => {
      const position = mainWindow.getPosition();
      this.saveWindowPosition(position[0], position[1]);
    });

    mainWindow.on("maximize", () => {
      this.saveWindowMaximized(true);
    });

    mainWindow.on("unmaximize", () => {
      this.saveWindowMaximized(false);
    });
  };
}
