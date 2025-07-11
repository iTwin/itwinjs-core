/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Viewport } from "@itwin/core-frontend";
import { RenderSchedule, RgbColor } from "@itwin/core-common";
import { assert, Id64String } from "@itwin/core-bentley";

// __PUBLISH_EXTRACT_START__ ScheduleScript_editingMode
/** Applies color and visibility changes to a specified element using interactive
 * schedule script editing.
 * Note that a real workflow would involve user interaction between each call to `setScheduleEditing`.
 */
export function editElementTimeline(vp: Viewport, elementId: Id64String, modelId: Id64String): void {
  const builder = new RenderSchedule.ScriptBuilder();
  const now = Date.now();

  const modelTimeline = builder.addModelTimeline(modelId);
  const elementTimeline = modelTimeline.addElementTimeline([elementId]);

  // Change color over time
  elementTimeline.addColor(now, new RgbColor(255, 0, 0));
  elementTimeline.addColor(now + 3000, new RgbColor(0, 255, 0));

  // Enter interactive script editing mode
  let script = RenderSchedule.Script.fromJSON(builder.finish());
  assert(script !== undefined);
  vp.displayStyle.setScheduleEditing(script);

  // Change visibility over time
  elementTimeline.addVisibility(now, 0);       // fully transparent
  elementTimeline.addVisibility(now + 3000, 100); // fully visible

  // Update the script under construction
  script = RenderSchedule.Script.fromJSON(builder.finish());
  assert(script !== undefined);
  vp.displayStyle.setScheduleEditing(script);
  // ...make some other changes to the script if desired...

  // Commit changes, triggering full graphical refresh.
  vp.displayStyle.commitScheduleEditing();
}
// __PUBLISH_EXTRACT_END__
