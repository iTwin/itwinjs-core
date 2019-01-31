/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Plugin, PluginAdmin, IModelApp } from "@bentley/imodeljs-frontend";

export class MarkupPlugin extends Plugin {
  public get active(): boolean { return IModelApp.toolAdmin.markupView !== undefined; }

  public onExecute(_args: string[]): void {
    IModelApp.toolAdmin.markupView = this.active ? undefined : IModelApp.viewManager.selectedView;
  }
}

declare var IMODELJS_VERSIONS_REQUIRED: string;
declare var PLUGIN_NAME: string;
PluginAdmin.register(new MarkupPlugin(PLUGIN_NAME, IMODELJS_VERSIONS_REQUIRED));
