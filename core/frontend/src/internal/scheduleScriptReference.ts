/** @internal */
import { RenderSchedule } from "@itwin/core-common";
import { BeEvent } from "@itwin/core-bentley";

/** Type definition for internal schedule script reference */
export type InternalScriptReference = RenderSchedule.ScriptReference | undefined;

/** @internal */
export class InternalScheduleScriptEvents {
  /** Event raised just before the scheduleScriptReference property is changed. */
  public readonly onScheduleScriptReferenceChanged = new BeEvent<
    (newScriptReference: InternalScriptReference) => void
  >();
}
