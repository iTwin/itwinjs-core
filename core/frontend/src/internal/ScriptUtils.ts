import { Id64String } from "@itwin/core-bentley";
import { RenderSchedule } from "@itwin/core-common";

/** @internal */
export function getScriptDelta(prev: RenderSchedule.Script | undefined | null, next: RenderSchedule.Script): Set<Id64String> {
  if (!prev || !prev.modelTimelines || prev.modelTimelines.length === 0) {
    return getAllElementIdsFromScript(next);
  }

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

function collectTimelineEntryTimes(timeline: RenderSchedule.ElementTimeline): number[] {
  const result = new Set<number>();

  if (timeline.cuttingPlane) {
    for (const entry of timeline.cuttingPlane) {
      result.add(entry.time);
    }
  }
  if (timeline.visibility) {
    for (const entry of timeline.visibility) {
      result.add(entry.time);
    }
  }
  if (timeline.transform) {
    for (const entry of timeline.transform) {
      result.add(entry.time);
    }
  }
  if (timeline.color) {
    for (const entry of timeline.color) {
      result.add(entry.time);
    }
  }
  return Array.from(result);
}

function isTimelineEntryEqual(a: RenderSchedule.ElementTimeline, b: RenderSchedule.ElementTimeline): boolean {
  const timesSet = new Set<number>([
    ...collectTimelineEntryTimes(a),
    ...collectTimelineEntryTimes(b),
  ]);
  let times = Array.from(timesSet).sort((x, y) => x - y);
  if (times.length === 0) {
    times = [0, 0.25, 0.5, 0.75, 1];
  }

  for (const [] of a.elementIds) {
    for (const t of times) {
      // Check visibility
      const v1 = a.getVisibility(t);
      const v2 = b.getVisibility(t);
      if (Math.abs(v1 - v2) > 0.01) return false;

      // Check Transform
      const tf1 = a.getAnimationTransform(t);
      const tf2 = b.getAnimationTransform(t);
      if (!tf1.isAlmostEqual(tf2)) return false;

      // Check Color
      const c1 = a.getColor(t);
      const c2 = b.getColor(t);
      if ((c1 === undefined) !== (c2 === undefined))
        return false;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (c1 !== undefined && !c1.equals(c2!))
        return false;

      // Cutting Plane (CLIPPING)
      const clip1 = a.getCuttingPlane?.(t);
      const clip2 = b.getCuttingPlane?.(t);

      const oneUndefined = (clip1 === undefined) !== (clip2 === undefined);

      if (oneUndefined) return false;
      if (clip1 && clip2) {
        if (
          !clip1.getOriginRef().isAlmostEqual(clip2.getOriginRef(), 1e-6) ||
          !clip1.getNormalRef().isAlmostEqual(clip2.getNormalRef(), 1e-6)
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

function getAllElementIdsFromScript(script: RenderSchedule.Script): Set<Id64String> {
  const ids = new Set<Id64String>();
  for (const modelTimeline of script.modelTimelines) {
    for (const elementTimeline of modelTimeline.elementTimelines) {
      for (const id of elementTimeline.elementIds)
        ids.add(id);
    }
  }
  return ids;
}