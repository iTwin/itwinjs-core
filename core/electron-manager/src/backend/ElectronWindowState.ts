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
  private static _storageName = "electron-window-state";
  private static _xSettingName = "window-x";
  private static _ySettingName = "window-y";
  private static _widthSettingName = "window-width";
  private static _heightSettingName = "window-height";
  private static _maximizedSettingName = "window-maximized";

  /** Constructor for ElectronWindowState.
   * @param settingNamespace  Unique setting namespace used when saving size, position and maximized state
   * @param defaultWidth      Default width of window
   * @param defaultHeight     Default height of window
   * @param defaultMaximized  Default maximized state of window
   */
  constructor(public settingNamespace: string, public defaultWidth: number, public defaultHeight: number, public defaultMaximized: boolean = false) {
  }

  /** Gets the saved window size and position */
  public getPreviousSizeAndPosition = () => {
    let setting: StorageValue | undefined;
    let width = this.defaultWidth;
    let height = this.defaultHeight;
    let x: number | undefined;
    let y: number | undefined;

    const store = NativeAppStorage.open(ElectronWindowState._storageName);

    setting = store.getData(`${this.settingNamespace}-${ElectronWindowState._widthSettingName}`);
    if (store.isValueNumber(setting))
      width = setting;
    setting = store.getData(`${this.settingNamespace}-${ElectronWindowState._heightSettingName}`);
    if (store.isValueNumber(setting))
      height = setting;

    setting = store.getData(`${this.settingNamespace}-${ElectronWindowState._xSettingName}`);
    if (store.isValueNumber(setting))
      x = setting;
    setting = store.getData(`${this.settingNamespace}-${ElectronWindowState._ySettingName}`);
    if (store.isValueNumber(setting))
      y = setting;

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
    const store = NativeAppStorage.open(ElectronWindowState._storageName);
    const setting = store.getData(`${this.settingNamespace}-${ElectronWindowState._maximizedSettingName}`);
    if (store.isValueBoolean(setting))
      maximized = setting;
    store.close();
    return maximized;
  };

  private saveWindowSize = (width: number, height: number) => {
    const store = NativeAppStorage.open(ElectronWindowState._storageName);
    store.setData(`${this.settingNamespace}-${ElectronWindowState._widthSettingName}`, width);
    store.setData(`${this.settingNamespace}-${ElectronWindowState._heightSettingName}`, height);
    store.close();
  };

  private saveWindowPosition = (x: number, y: number) => {
    const store = NativeAppStorage.open(ElectronWindowState._storageName);
    store.setData(`${this.settingNamespace}-${ElectronWindowState._xSettingName}`, x);
    store.setData(`${this.settingNamespace}-${ElectronWindowState._ySettingName}`, y);
    store.close();
  };

  private saveWindowMaximized = (maximized: boolean) => {
    const store = NativeAppStorage.open(ElectronWindowState._storageName);
    store.setData(`${this.settingNamespace}-${ElectronWindowState._maximizedSettingName}`, maximized);
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
