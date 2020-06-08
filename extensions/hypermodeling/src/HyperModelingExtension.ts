/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { I18NNamespace } from "@bentley/imodeljs-i18n";
import {
  Extension,
  IModelApp,
} from "@bentley/imodeljs-frontend";
import { registerTools } from "./HyperModelingTools";
import { SectionMarkerSetDecorator } from "./SectionMarkerSetDecorator";

/** The extension class that is instantiated when the extension is loaded, and executes the operations */
class HyperModelingExtension extends Extension {
  protected _defaultNs = "HyperModeling";
  private _i18NNamespace?: I18NNamespace;

  /** Invoked the first time this extension is loaded. */
  public async onLoad(_args: string[]): Promise<void> {
    this._i18NNamespace = this.i18n.registerNamespace(this._defaultNs)!;
    await this._i18NNamespace.readFinished;
    registerTools(this._i18NNamespace!, this.i18n);
  }

  /** Invoked each time this extension is loaded. */
  public async onExecute(args: string[]): Promise<void> {
    const vp = IModelApp.viewManager.selectedView;
    if (args.length < 2 || undefined === vp)
      return; // if no "optional" args passed in, don't do anything. NOTE: args[0] is extension name...

    const enable = "on" === args[1].toLowerCase();
    await SectionMarkerSetDecorator.showOrHide(vp, this, enable);
  }
}

export const hyperModelingExtension = new HyperModelingExtension("hyperModeling");

// NOTE: The name used here is how the Extension is registered with the whatever Extension server it is hosted on.
IModelApp.extensionAdmin.register(hyperModelingExtension);
