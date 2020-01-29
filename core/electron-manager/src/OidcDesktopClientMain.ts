/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, AuthStatus, Logger, ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcFrontendClientConfiguration, AccessToken } from "@bentley/imodeljs-clients";
import { OidcDesktopClient, IModelHost } from "@bentley/imodeljs-backend";
import * as electron from "electron";
import { ElectronManagerLoggerCategory } from "./ElectronManagerLoggerCategory";
const { ipcMain: ipc } = electron;

const loggerCategory: string = ElectronManagerLoggerCategory.Authorization;

/**
 * Utility to handle IPC calls for authorization in desktop applications
 * @internal
 */
export class OidcDesktopClientMain {
  private static _oidcDesktopClient?: OidcDesktopClient;
  private static _removeUserStateListener: () => void;

  /** Wrapper around event.sender.send to add log traces */
  private static ipcReply(event: electron.IpcMainEvent, message: string, err: Error | null, ...args: any[]) {
    if (err)
      Logger.logTrace(loggerCategory, "OidcDesktopClientMain replies with error message", () => (err));
    else
      Logger.logTrace(loggerCategory, "OidcDesktopClientMain replies with success message", () => ({ message }));

    event.sender.send(message, err, ...args);
  }

  /** Wrapper around mainWindow.webContents.send to add log traces */
  private static ipcSend(mainWindow: electron.BrowserWindow, message: string, ...args: any[]) {
    Logger.logTrace(loggerCategory, "OidcDesktopClientMain sends message", () => ({ message }));
    mainWindow.webContents.send(message, ...args);
  }

  /** Wrapper around ipc.on to add log traces */
  private static ipcOn(message: string, fn: any) {
    Logger.logTrace(loggerCategory, "OidcDesktopClientMain receives message", () => ({ message }));
    ipc.on(message, fn);
  }

  /** Get the desktop client */
  public static get oidcDesktopClient(): OidcDesktopClient | undefined {
    return this.oidcDesktopClient;
  }

  private static createRequestContext(requestContext: ClientRequestContext): ClientRequestContext {
    return new ClientRequestContext(requestContext.activityId, requestContext.applicationId, requestContext.applicationVersion, requestContext.sessionId);
  }

  /** Initialize the IPC communication for OidcDesktopClient */
  public static initializeIpc(mainWindow: electron.BrowserWindow) {
    this.ipcOn("OidcDesktopClient.initialize", async (event: electron.IpcMainEvent, requestContextObj: ClientRequestContext, configuration: OidcFrontendClientConfiguration) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      try {
        this._oidcDesktopClient = new OidcDesktopClient(configuration);
        this._removeUserStateListener = this._oidcDesktopClient.onUserStateChanged.addListener((token: AccessToken | undefined) => {
          this.ipcSend(mainWindow, "OidcDesktopClient.onUserStateChanged", token);
        });
        await this._oidcDesktopClient.initialize(requestContext);

        /*
         * Set up the authorizationClient at the backend so that code at the backend can use it to fetch the access token, or construct the required
         * RequestContext (AuthorizedBackendRequestContext). Note that this would have the side effect of backend code using this to retrieve tokens, rather than use
         * the tokens passed in from the frontend, but that should not matter since the clients at the frontend and backend in the electron case is exactly the same.
         */
        IModelHost.authorizationClient = this._oidcDesktopClient;

        this.ipcReply(event, "OidcDesktopClient.initialize:complete", null);
      } catch (err) {
        this.ipcReply(event, "OidcDesktopClient.initialize:complete", err);
      }
    });

    this.ipcOn("OidcDesktopClient.signIn", async (event: electron.IpcMainEvent, requestContextObj: ClientRequestContext) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      if (!this._oidcDesktopClient) {
        this.ipcReply(event, "OidcDesktopClient.signIn:complete", new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        await this._oidcDesktopClient.signIn(requestContext);
        this.ipcReply(event, "OidcDesktopClient.signIn:complete", null);
      } catch (err) {
        this.ipcReply(event, "OidcDesktopClient.signIn:complete", err);
      }
    });

    this.ipcOn("OidcDesktopClient.signOut", async (event: electron.IpcMainEvent, requestContextObj: ClientRequestContext) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      if (!this._oidcDesktopClient) {
        this.ipcReply(event, "OidcDesktopClient.signOut:complete", new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        await this._oidcDesktopClient.signOut(requestContext);
        this.ipcReply(event, "OidcDesktopClient.signOut:complete", null);
      } catch (err) {
        this.ipcReply(event, "OidcDesktopClient.signOut:complete", err);
      }
    });

    this.ipcOn("OidcDesktopClient.dispose", (event: electron.IpcMainEvent) => {
      if (!this._oidcDesktopClient) {
        this.ipcReply(event, "OidcDesktopClient.dispose:complete", new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        this._removeUserStateListener();
        this._oidcDesktopClient.dispose();
        this.ipcReply(event, "OidcDesktopClient.dispose:complete", null);
      } catch (err) {
        this.ipcReply(event, "OidcDesktopClient.dispose:complete", err);
      }
    });

    this.ipcOn("OidcDesktopClient.getAccessToken", async (event: electron.IpcMainEvent, requestContextObj: ClientRequestContext) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      if (!this._oidcDesktopClient) {
        this.ipcReply(event, "OidcDesktopClient.getAccessToken:complete", new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        const token = await this._oidcDesktopClient.getAccessToken(requestContext);
        this.ipcReply(event, "OidcDesktopClient.getAccessToken:complete", null, token);
      } catch (err) {
        this.ipcReply(event, "OidcDesktopClient.getAccessToken:complete", err);
      }
    });
  }
}
