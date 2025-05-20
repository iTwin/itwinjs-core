import { Id64, Id64String } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";

/**
 * Returns a set of element IDs that are newly added or removed between two schedule scripts.
 */
export function getScriptDelta(prev: RenderSchedule.Script, next: RenderSchedule.Script): Set<Id64String> {
  const prevElements = new Set<Id64String>();
  const nextElements = new Set<Id64String>();

  for (const modelTimeline of prev.modelTimelines) {
    for (const elemTimeline of modelTimeline.elementTimelines) {
      for (const id of elemTimeline.elementIds) {
        if (Id64.isValid(id)) {
          prevElements.add(id);
        }
      }
    }
  }

  for (const modelTimeline of next.modelTimelines) {
    for (const elemTimeline of modelTimeline.elementTimelines) {
      for (const id of elemTimeline.elementIds) {
        if (Id64.isValid(id)) {
          nextElements.add(id);
        }
      }
    }
  }

  const changed = new Set<Id64String>();
  for (const id of nextElements)
    if (!prevElements.has(id))
      changed.add(id);

  for (const id of prevElements)
    if (!nextElements.has(id))
      changed.add(id);

  return changed;
}
