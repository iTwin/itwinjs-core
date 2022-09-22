/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { CompressedId64Set, Id64Arg, OrderedId64Iterable } from "@itwin/core-bentley";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool } from "@itwin/core-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseArgs } from "./parseArgs";

/** Replaces the contents of the selection set with the set of element Ids specified.
 * Element Ids are separated by whitespace.
 * @beta
 */
export class SelectElementsByIdTool extends Tool {
  public static override toolId = "SelectElementsById";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return undefined; }

  public override async run(ids?: Id64Arg): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && undefined !== ids)
      vp.iModel.selectionSet.replace(ids);

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args);
  }
}

/** A tool that outputs the Ids of the elements in the [SelectionSet]($frontend) of the [IModelConnection]($frontend) associated with the selected [Viewport]($frontend).
 * @beta
 */
export class DumpSelectionSetTool extends Tool {
  public static override toolId = "DumpSelectionSet";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 2; }

  private _format: "json" | "compressed" | "list" = "list";
  private _copy?: boolean;

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    const elems = Array.from(vp.iModel.selectionSet.elements);
    OrderedId64Iterable.sortArray(elems);

    let output;
    switch (this._format) {
      case "compressed": output = CompressedId64Set.compressArray(elems); break;
      case "json": output = JSON.stringify(elems); break;
      default: output = elems.join(" "); break;
    }

    if (this._copy)
      copyStringToClipboard(output);

    const brief = `Selection set dumped${this._copy ? " to clipboard" : ""}.`;
    const details = new NotifyMessageDetails(OutputMessagePriority.Info, brief, output);
    IModelApp.notifications.outputMessage(details);
    return true;
  }

  public override async parseAndRun(...input: string[]): Promise<boolean> {
    const args = parseArgs(input);
    this._copy = args.getBoolean("c");
    const formatArg = args.get("f");
    if (formatArg) {
      switch (formatArg[0].toLowerCase()) {
        case "j": this._format = "json"; break;
        case "c": this._format = "compressed"; break;
      }
    }

    return this.run();
  }
}
