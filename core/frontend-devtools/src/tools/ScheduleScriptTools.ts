/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { assert, CompressedId64Set } from "@itwin/core-bentley";
import {
  ElementLoadOptions, RenderSchedule, RenderTimelineProps,
} from "@itwin/core-common";
import { Viewport } from "@itwin/core-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { parseArgs } from "./parseArgs";
import { DisplayStyleTool } from "./DisplayStyleTools";

/** Query the schedule script JSON from an element.
 * @beta
 */
export class QueryScheduleScriptTool extends DisplayStyleTool {
  private _sourceId?: string;
  private _action: "copy" | "break" = "copy";
  private _includeElementIds = false;
  private _countElementIds = false;
  private _expandElementIds = false;

  public static override toolId = "QueryScheduleScript";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public async parse(input: string[], vp: Viewport) {
    const args = parseArgs(input);

    // eslint-disable-next-line deprecation/deprecation
    this._sourceId = args.get("i") ?? vp.displayStyle.scheduleScriptReference?.sourceId;
    if (!this._sourceId)
      return false;

    const action = args.get("a") ?? "";
    this._action = action.length > 0 && "b" === action[0].toLowerCase() ? "break" : "copy";

    this._includeElementIds = this._countElementIds = this._expandElementIds = false;
    const ids = args.get("e");
    if (ids && ids.length > 0) {
      switch (ids[0].toLowerCase()) {
        case "i":
          this._includeElementIds = true;
          break;
        case "c":
          this._includeElementIds = this._countElementIds = true;
          break;
        case "e":
          this._includeElementIds = this._expandElementIds = true;
          break;
      }
    }

    return true;
  }

  public async execute(vp: Viewport) {
    if (!this._sourceId || !this._action)
      return false;

    const opts: ElementLoadOptions = {
      displayStyle: { omitScheduleScriptElementIds: !this._includeElementIds },
      renderTimeline: { omitScriptElementIds: !this._includeElementIds },
    };

    let script;
    const props = await vp.iModel.elements.loadProps(this._sourceId, opts) as any;
    if (props.script)
      script = JSON.parse((props.script as RenderTimelineProps).script) as RenderSchedule.ScriptProps;
    else if (props.jsonProperties?.styles?.scheduleScript)
      script = props.jsonProperties.styles.scheduleScript as RenderSchedule.ScriptProps;

    if (!script)
      return false;

    if (this._countElementIds || this._expandElementIds) {
      for (const model of script) {
        for (const elem of model.elementTimelines) {
          const elemIds = typeof elem.elementIds === "string" ? CompressedId64Set.decompressArray(elem.elementIds) : elem.elementIds;
          if (this._countElementIds)
            elem.elementIds = elemIds.length as any;
          else
            elem.elementIds = elemIds;
        }
      }
    }

    if (this._action === "break")
      debugger; // eslint-disable-line no-debugger
    else
      copyStringToClipboard(JSON.stringify(script, null, 2));

    return true;
  }
}

interface Timeline<Entry extends RenderSchedule.TimelineEntry> {
  readonly length: number;
  getEntry(index: number): Entry | undefined;
}

function reverseTimeline<Entry extends RenderSchedule.TimelineEntry>(timeline: Timeline<Entry> | undefined, accept: (time: number, entry: Entry) => void): void {
  if (!timeline)
    return;

  const len = timeline.length;
  for (let i = 0; i < len; i++) {
    const timeEntry = timeline.getEntry(i);
    const valueEntry = timeline.getEntry(len - i - 1);
    assert(undefined !== timeEntry);
    assert(undefined !== valueEntry);
    accept(timeEntry.time, valueEntry);
  }
}

/** A tool that modifies the [RenderSchedule.Script]($common), if any, associated with the selected [Viewport]($frontend) such that the entries in each
 * of its [RenderSchedule.ElementTimeline]($common)s are reversed.
 * @beta
 */
export class ReverseScheduleScriptTool extends DisplayStyleTool {
  public static override toolId = "ReverseScheduleScript";

  public override async execute(vp: Viewport): Promise<boolean> {
    const script = vp?.displayStyle.scheduleScript;
    if (!script || script.modelTimelines.some((x) => x.omitsElementIds))
      return false;

    const builder = new RenderSchedule.ScriptBuilder();
    for (const modelTimeline of script.modelTimelines) {
      const modelBuilder = builder.addModelTimeline(modelTimeline.modelId);
      for (const elemTimeline of modelTimeline.elementTimelines) {
        const elemBuilder = modelBuilder.addElementTimeline(elemTimeline.elementIds);
        reverseTimeline(elemTimeline.visibility, (time, entry) => elemBuilder.addVisibility(time, entry.value, entry.interpolation));
        reverseTimeline(elemTimeline.color, (time, entry) => elemBuilder.addColor(time, entry.value, entry.interpolation));
        reverseTimeline(elemTimeline.transform, (time, entry) => elemBuilder.addTransform(time, entry.value, entry.components, entry.interpolation));
        reverseTimeline(elemTimeline.cuttingPlane, (time, entry) => elemBuilder.addCuttingPlane(time, entry.value, entry.interpolation));
      }
    }

    const scriptProps = builder.finish();
    const newScript = RenderSchedule.Script.fromJSON(scriptProps);
    assert(undefined !== newScript);

    vp.displayStyle.scheduleScript = newScript;
    return true;
  }

  public async parse() {
    return true;
  }
}

/** A tool that changes or removes the [RenderSchedule.Script]($common) associated with the selected [Viewport]($frontend).
 * @beta
 */
export class SetScheduleScriptTool extends DisplayStyleTool {
  public static override toolId = "SetScheduleScript";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  private _script?: RenderSchedule.Script;

  public override async parse(args: string[]): Promise<boolean> {
    if (args.length === 0)
      return true; // clear schedule script.

    try {
      this._script = RenderSchedule.Script.fromJSON(JSON.parse(args[0]));
    } catch (ex) {
      if (ex instanceof Error)
        alert(ex.toString());
    }

    return undefined !== this._script;
  }

  public override async execute(vp: Viewport): Promise<boolean> {
    vp.displayStyle.scheduleScript = this._script;
    return true;
  }
}
