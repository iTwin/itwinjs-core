/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, Plugin, Tool } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { AuthorizedClientRequestContext, AccessToken } from "@bentley/imodeljs-clients";

/** An Immediate Tool that adds the specified plugin to the list to be started at runtime. */
export class PluginSave extends Tool {
  public static toolId = "PluginSave";
  public static get maxArgs() { return undefined; }
  public static get minArgs() { return 1; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
  public run(args: any[]): boolean {
    // expect "add startup plugin <pluginname> [allusers] [pluginargs...]"
    if (args.length < 1) {
      return false;
    }
    const pluginName: string = args[0];

    let allUsers: boolean = false;
    let argsStart = 1;
    if (args.length > 1) {
      const userOrApp = args[1].toLowerCase();
      if (userOrApp.startsWith("alluser")) {
        allUsers = true;
        argsStart = 2;
      }
    }
    let pluginArgs: string[] | undefined;
    if (args.length > argsStart)
      pluginArgs = args.slice(argsStart);

    IModelApp.authorizationClient!.getAccessToken().then((accessToken: AccessToken) => {
      const requestContext = new AuthorizedClientRequestContext(accessToken, "saveStartupPlugins");
      IModelApp.pluginAdmin.addSavedPlugins(requestContext, pluginName, pluginArgs, allUsers, "StartViewPlugins").catch((_err) => { });
    }).catch((_err: any) => { });
    return true;
  }
}

/** An Immediate Tool that deletes the specified plugin from the list to be started at runtime. */
export class PluginRemove extends Tool {
  public static toolId = "PluginRemove";
  public static get maxArgs() { return 2; }
  public static get minArgs() { return 1; }
  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
  public run(args: any[]): boolean {
    // expect "remove startup plugin <pluginname> [allusers]"
    if (args.length < 1) {
      return false;
    }
    const pluginName: string = args[0];

    let allUsers: boolean = false;
    if (args.length > 1) {
      const userOrApp = args[1].toLowerCase();
      if (userOrApp.startsWith("alluser")) {
        allUsers = true;
      }
    }

    IModelApp.authorizationClient!.getAccessToken().then((accessToken: AccessToken) => {
      const requestContext = new AuthorizedClientRequestContext(accessToken, "removeStartupPlugins");
      IModelApp.pluginAdmin.removeSavedPlugins(requestContext, pluginName, allUsers, "StartViewPlugins").catch((_err) => { });
    }).catch((_err: any) => { });
    return true;
  }
}

export class TestToolsPlugin extends Plugin {
  private _i18NNamespace?: I18NNamespace;

  public constructor(name: string) {
    super(name);
  }

  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    this._i18NNamespace = this.i18n.registerNamespace("testTools");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(PluginSave, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(PluginRemove, this._i18NNamespace, this.i18n);
    }).catch(() => { });
  }

  /** Invoked each time this plugin is loaded. */
  public async onExecute(_args: string[]): Promise<void> {
    // currently, everything is done in onLoad.
  }
}

declare var PLUGIN_NAME: string;

IModelApp.pluginAdmin.register(new TestToolsPlugin(PLUGIN_NAME));
