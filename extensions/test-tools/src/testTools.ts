/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, Extension, Tool } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { AccessToken } from "@bentley/imodeljs-clients";

/** An Immediate Tool that adds the specified extension to the list to be started at runtime. */
class ExtensionSave extends Tool {
  public static toolId = "ExtensionSave";
  public static get maxArgs() { return undefined; }
  public static get minArgs() { return 1; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
  public run(args: any[]): boolean {
    // expect "add startup extension <extensionname> [allusers] [extensionargs...]"
    if (args.length < 1) {
      return false;
    }
    // const extensionName: string = args[0];

    // let allUsers: boolean = false;
    // let argsStart = 1;
    // if (args.length > 1) {
    //   const userOrApp = args[1].toLowerCase();
    //   if (userOrApp.startsWith("alluser")) {
    //     allUsers = true;
    //     argsStart = 2;
    //   }
    // }
    // let extensionArgs: string[] | undefined;
    // if (args.length > argsStart)
    //   extensionArgs = args.slice(argsStart);

    IModelApp.authorizationClient!.getAccessToken().then((_accessToken: AccessToken) => {
      // const requestContext = new AuthorizedClientRequestContext(accessToken, "saveStartupExtensions");
      // SavedExtensionClient.addSavedExtensions(requestContext, extensionName, extensionArgs, allUsers, "StartViewExtensions").catch((_err) => { });
    }).catch((_err: any) => { });
    return true;
  }
}

/** An Immediate Tool that deletes the specified extension from the list to be started at runtime. */
class ExtensionRemove extends Tool {
  public static toolId = "ExtensionRemove";
  public static get maxArgs() { return 2; }
  public static get minArgs() { return 1; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
  public run(args: any[]): boolean {
    // expect "remove startup extension <extensionname> [allusers]"
    if (args.length < 1) {
      return false;
    }
    // const extensionName: string = args[0];

    // let allUsers: boolean = false;
    // if (args.length > 1) {
    //   const userOrApp = args[1].toLowerCase();
    //   if (userOrApp.startsWith("alluser")) {
    //     allUsers = true;
    //   }
    // }

    IModelApp.authorizationClient!.getAccessToken().then((_accessToken: AccessToken) => {
      // const requestContext = new AuthorizedClientRequestContext(accessToken, "removeStartupExtensions");
      // SavedExtensionClient.removeSavedExtensions(requestContext, extensionName, allUsers, "StartViewExtensions").catch((_err) => { });
    }).catch((_err: any) => { });
    return true;
  }
}

class TestToolsExtension extends Extension {
  private _i18NNamespace?: I18NNamespace;

  public constructor(name: string) {
    super(name);
  }

  /** Invoked the first time this extension is loaded. */
  public onLoad(_args: string[]): void {
    this._i18NNamespace = this.i18n.registerNamespace("testTools");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(ExtensionSave, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ExtensionRemove, this._i18NNamespace, this.i18n);
    }).catch(() => { });
  }

  /** Invoked each time this extension is loaded. */
  public onExecute(_args: string[]): void {
    // currently, everything is done in onLoad.
  }
}

declare let PLUGIN_NAME: string;

IModelApp.extensionAdmin.register(new TestToolsExtension(PLUGIN_NAME));
