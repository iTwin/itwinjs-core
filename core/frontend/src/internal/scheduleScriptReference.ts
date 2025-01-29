/** @internal */
import { RenderSchedule } from "@itwin/core-frontend";

/** Type definition for internal schedule script reference */
export type InternalScriptReference = RenderSchedule.ScriptReference | undefined;

/** Unique symbol for accessing internal schedule script reference */
export const scheduleScriptSymbol = Symbol("scheduleScriptReference");