/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { ViewStateProps } from "@bentley/imodeljs-common";
import {
  EntityState, IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority, Tool, ViewState,
} from "@bentley/imodeljs-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";

/** Serialize a ViewState to JSON. The returned JSON can later be passed to [deserializeViewState] to reinstantiate the ViewState.
 * @beta
 */
export function serializeViewState(view: ViewState): ViewStateProps {
  return view.toProps();
}

/** Instantiate a ViewState serialized by [serializeViewState].
 * @beta
 */
export async function deserializeViewState(props: ViewStateProps, iModel: IModelConnection): Promise<ViewState> {
  const ctor = await iModel.findClassFor<typeof EntityState>(props.viewDefinitionProps.classFullName, undefined) as typeof ViewState | undefined;
  if (undefined === ctor)
    throw new Error("Class not found");

  const view = ctor.createFromProps(props, iModel);
  if (undefined === view)
    throw new Error("Failed to construct ViewState");

  await view.load();
  return view;
}

/** Copies a JSON representation of the active viewport's view to the clipboard.
 * @beta
 */
export class SaveViewTool extends Tool {
  public static toolId = "SaveView";

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "No viewport"));
      return true;
    }

    try {
      const json = serializeViewState(vp.view);
      copyStringToClipboard(JSON.stringify(json));
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "JSON copied to clipboard"));
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }

    return true;
  }
}

/** Given a string containing a JSON representation of a ViewState, applies that ViewState to the active viewport.
 * ###TODO The JSON string should be enclosed in double quotes. Currently parser does not handle quoted arguments at all.
 * @beta
 */
export class ApplyViewTool extends Tool {
  public static toolId = "ApplyView";
  public static get maxArgs() { return undefined; } // ###TODO Once quoted argument parsing is implemented, this should be 1.
  public static get minArgs() { return 1; }

  public run(view?: ViewState): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== view && undefined !== vp)
      vp.changeView(view);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || 0 === args.length)
      return true;

    try {
      const arg = args.join("");
      const json = JSON.parse(arg);

      // ###TODO: async...
      deserializeViewState(json, vp.iModel).then((view) => this.run(view)); // eslint-disable-line @typescript-eslint/no-floating-promises
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, err.toString()));
    }

    return true;
  }
}

/** Given the Id of a persistent ViewDefinition, applies that view to the active viewport.
 * @beta
 */
export class ApplyViewByIdTool extends Tool {
  public static toolId = "ApplyViewById";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }

  public run(viewId?: string): boolean {
    if (typeof viewId !== "string")
      return false;

    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    vp.iModel.views.load(viewId).then((view) => {
      vp.changeView(view);
    }).catch(() => { });

    return true;
  }
}
