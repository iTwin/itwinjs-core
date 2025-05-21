import { Id64String } from "@itwin/core-bentley";
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

      if (!isTimelineEntryEqual(prevTimeline, nextTimeline)) {
        for (const id of nextTimeline.elementIds)
          changed.add(id);
      }
    }
  }

  return changed;
}

function isTimelineEntryEqual(a: RenderSchedule.ElementTimeline, b: RenderSchedule.ElementTimeline): boolean {
  const sampleTimes = [0, 0.25, 0.5, 0.75, 1];

  for (const {} of a.elementIds) {
    for (const t of sampleTimes) {
      // check visibility
      const v1 = a.getVisibility(t);
      const v2 = b.getVisibility(t);
      if (Math.abs(v1 - v2) > 0.01) return false;

      // check Transform
      const tf1 = a.getAnimationTransform(t);
      const tf2 = b.getAnimationTransform(t);
      if (!tf1.isAlmostEqual(tf2)) return false;

      // check Color
      const c1 = a.getColor(t);
      const c2 = b.getColor(t);
      if ((c1 && !c2) || (!c1 && c2) || (c1 && c2 && !c1.equals(c2))) return false;
    }
  }

  return true;
}
