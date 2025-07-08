/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Viewport } from "@itwin/core-frontend";
import { RenderSchedule, RgbColor } from "@itwin/core-common";
import { Transform } from "@itwin/core-geometry";

// __PUBLISH_EXTRACT_START__ ScheduleScript_setEditingMode
/** Demonstrates applying schedule script using editing mode with color and visibility changes. */
export function setScheduleScriptEditingMode(vp: Viewport): void {
  const builder = new RenderSchedule.ScriptBuilder();
  const now = Date.now();

  const modelTimeline = builder.addModelTimeline("0x123"); // modelId
  const elementTimeline = modelTimeline.addElementTimeline(["0xabc"]); // elementId

  // Change color over time
  elementTimeline.addColor(now, new RgbColor(255, 0, 0));
  elementTimeline.addColor(now + 3000, new RgbColor(0, 255, 0));

  // Change visibility over time
  elementTimeline.addVisibility(now, 0);       // fully transparent
  elementTimeline.addVisibility(now + 3000, 100); // fully visible

  // Apply for preview — triggers dynamic tile update without full tree reload
  const scriptJson = builder.finish();
  const script = scriptJson ? RenderSchedule.Script.fromJSON(scriptJson) : undefined;
  if (script)
    vp.displayStyle.setScheduleEditing(script);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ ScheduleScript_commitEditing
/** Finalizes schedule edits with additional transform and clipping, committing them for full tile refresh. */
export function commitScheduleScriptEdits(vp: Viewport): void {
  const builder = new RenderSchedule.ScriptBuilder();
  const now = Date.now();

  const modelTimeline = builder.addModelTimeline("0x123");
  const elementTimeline = modelTimeline.addElementTimeline(["0xabc"]);

  // Apply transform animation
  elementTimeline.addTransform(now, Transform.createIdentity());
  elementTimeline.addTransform(now + 3000, Transform.createTranslationXYZ(5, 0, 0));

  // Apply cutting plane animation
  elementTimeline.addCuttingPlane(now, {
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
  });
  elementTimeline.addCuttingPlane(now + 3000, {
    position: { x: 0, y: 0, z: 2 },
    direction: { x: 0, y: 0, z: 1 },
  });

  // Commit changes — triggers full tile tree refresh to finalize edits
  vp.displayStyle.commitScheduleEditing();
}
// __PUBLISH_EXTRACT_END__
