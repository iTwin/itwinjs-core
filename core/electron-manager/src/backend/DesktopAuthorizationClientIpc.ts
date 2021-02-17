/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthStatus, BentleyError, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { DesktopAuthorizationClient, IModelHost, IpcHost } from "@bentley/imodeljs-backend";
import { DesktopAuthorizationClientConfiguration, DesktopAuthorizationClientMessages } from "@bentley/imodeljs-common";
import { AccessToken } from "@bentley/itwin-client";
import { ElectronManagerLoggerCategory } from "../common/ElectronManagerLoggerCategory";

const loggerCategory: string = ElectronManagerLoggerCategory.Authorization;

/**
 * Utility to handle IPC calls for authorization in desktop applications
 * @internal
 */
export class DesktopAuthorizationClientIpc {
  private static _desktopAuthorizationClient?: DesktopAuthorizationClient;

  /** Wrapper around event.sender.send to add log traces */
  private static ipcReply(channel: string, err: Error | null, ...args: any[]) {
    if (err)
      Logger.logTrace(loggerCategory, "DesktopAuthorizationClientIpc replies with error message", () => (err));
    else
      Logger.logTrace(loggerCategory, "DesktopAuthorizationClientIpc replies with success message", () => ({ channel }));

    IpcHost.send(channel, err, ...args);
  }

  /** Wrapper around IpcHost.send to add log traces */
  private static ipcSend(channel: string, ...args: any[]) {
    Logger.logTrace(loggerCategory, "DesktopAuthorizationClientIpc sends", () => ({ channel }));
    IpcHost.send(channel, ...args);
  }

  /** Get the desktop client */
  public static get desktopAuthorizationClient(): DesktopAuthorizationClient | undefined {
    return this._desktopAuthorizationClient;
  }

  private static createRequestContext(requestContext: ClientRequestContext): ClientRequestContext {
    return new ClientRequestContext(requestContext.activityId, requestContext.applicationId, requestContext.applicationVersion, requestContext.sessionId);
  }

  /** Initialize the IPC communication for DesktopAuthorizationClient */
  public static initializeIpc() {
    IpcHost.addListener(DesktopAuthorizationClientMessages.initialize, async (_event: Event, requestContextObj: ClientRequestContext, configuration: DesktopAuthorizationClientConfiguration) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      try {
        this._desktopAuthorizationClient = new DesktopAuthorizationClient(configuration);
        this._desktopAuthorizationClient.onUserStateChanged.addListener((token: AccessToken | undefined) => {
          this.ipcSend(DesktopAuthorizationClientMessages.onUserStateChanged, token);
        });
        await this._desktopAuthorizationClient.initialize(requestContext);

        /*
         * Set up the authorizationClient at the backend so that code at the backend can use it to fetch the access token, or construct the required
         * RequestContext (AuthorizedBackendRequestContext). Note that this would have the side effect of backend code using this to retrieve tokens, rather than use
         * the tokens passed in from the frontend, but that should not matter since the clients at the frontend and backend in the electron case is exactly the same.
         */
        IModelHost.authorizationClient = this._desktopAuthorizationClient;

        this.ipcReply(DesktopAuthorizationClientMessages.initializeComplete, null);
      } catch (err) {
        this.ipcReply(DesktopAuthorizationClientMessages.initializeComplete, err);
      }
    });

    IpcHost.addListener(DesktopAuthorizationClientMessages.signIn, async (_event: Event, requestContextObj: ClientRequestContext) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      if (!this._desktopAuthorizationClient) {
        this.ipcReply(DesktopAuthorizationClientMessages.signInComplete, new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        await this._desktopAuthorizationClient.signIn(requestContext);
        this.ipcReply(DesktopAuthorizationClientMessages.signInComplete, null);
      } catch (err) {
        this.ipcReply(DesktopAuthorizationClientMessages.signInComplete, err);
      }
    });

    IpcHost.addListener(DesktopAuthorizationClientMessages.signOut, async (_event: Event, requestContextObj: ClientRequestContext) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      if (!this._desktopAuthorizationClient) {
        this.ipcReply(DesktopAuthorizationClientMessages.signOutComplete, new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        await this._desktopAuthorizationClient.signOut(requestContext);
        this.ipcReply(DesktopAuthorizationClientMessages.signOutComplete, null);
      } catch (err) {
        this.ipcReply(DesktopAuthorizationClientMessages.signOutComplete, err);
      }
    });

    IpcHost.addListener(DesktopAuthorizationClientMessages.getAccessToken, async (_event: Event, requestContextObj: ClientRequestContext) => {
      const requestContext = this.createRequestContext(requestContextObj);
      requestContext.enter();
      if (!this._desktopAuthorizationClient) {
        this.ipcReply(DesktopAuthorizationClientMessages.getAccessTokenComplete, new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory));
        return;
      }

      try {
        const token = await this._desktopAuthorizationClient.getAccessToken(requestContext);
        this.ipcReply(DesktopAuthorizationClientMessages.getAccessTokenComplete, null, token);
      } catch (err) {
        this.ipcReply(DesktopAuthorizationClientMessages.getAccessTokenComplete, err);
      }
    });
  }
}
