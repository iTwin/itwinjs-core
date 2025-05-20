import { Id64, Id64String } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";

export function getScriptDelta(prev: RenderSchedule.Script, next: RenderSchedule.Script): Set<Id64String> {
  const changed = new Set<Id64String>();

  const prevModels = new Map(prev.modelTimelines.map(m => [m.modelId, m]));
  const nextModels = new Map(next.modelTimelines.map(m => [m.modelId, m]));

  for (const modelId of new Set([...prevModels.keys(), ...nextModels.keys()])) {
    const prevModel = prevModels.get(modelId);
    const nextModel = nextModels.get(modelId);

    if (!prevModel || !nextModel) {
      const timelines = (prevModel ?? nextModel)?.elementTimelines ?? [];
      for (const timeline of timelines)
        for (const id of timeline.elementIds)
          changed.add(id);
      continue;
    }

    const prevTimelineMap = new Map(prevModel.elementTimelines.map(et => [et.batchId, et]));
    const nextTimelineMap = new Map(nextModel.elementTimelines.map(et => [et.batchId, et]));

    const allBatchIds = new Set([...prevTimelineMap.keys(), ...nextTimelineMap.keys()]);
    for (const batchId of allBatchIds) {
      const prevTimeline = prevTimelineMap.get(batchId);
      const nextTimeline = nextTimelineMap.get(batchId);

      if (!prevTimeline || !nextTimeline) {
        const ids = (prevTimeline ?? nextTimeline)?.elementIds ?? [];
        for (const id of ids)
          changed.add(id);
        continue;
      }

      if (prevTimeline.compareTo(nextTimeline) !== 0) {
        for (const id of nextTimeline.elementIds)
          changed.add(id);
      }
    }
  }

  return changed;
}