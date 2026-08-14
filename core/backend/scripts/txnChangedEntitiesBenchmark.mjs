/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { performance } from "node:perf_hooks";

/**
 * Stress-tests the in-process TxnChangedEntities representation using the element-operation
 * distributions from imodel-transformer's quick performance fixtures and a fixed-volume synthetic
 * class-breadth/class-hierarchy-depth matrix.
 *
 * The balanced fixture's calibrated scale is 25. The update-heavy scan fixture's calibrated scale
 * is 16 with 20 source changesets. Larger runs multiply those fixture scales; they do not claim to
 * be observed production distributions.
 *
 * The benchmark models onElementsChanged. It therefore models changed elements, including the
 * owner element for an aspect change, rather than treating every aspect or relationship operation
 * as a separate TxnChangedEntity. Models are not the volume driver for these workloads and are not
 * included in the stress totals.
 */

const MAX_ENTITIES_PER_EVENT = 1000;
const SAMPLES = 5;
const VARIANTS = ["current", "class-name-per-entity", "shared-metadata"];

class Metadata {
  constructor(classFullName) {
    this.classFullName = classFullName;
    this.baseClasses = [];
  }

  is(baseClassFullName) {
    return this.classFullName === baseClassFullName || this.baseClasses.some((baseClass) => baseClass.is(baseClassFullName));
  }
}

const CLASS_DEFINITIONS = new Map([
  ["Generic:PhysicalObject", { classId: "0x100", baseClasses: ["BisCore:PhysicalElement"] }],
  ["BisCore:PhysicalElement", { classId: "0x101", baseClasses: ["BisCore:SpatialElement"] }],
  ["BisCore:SpatialElement", { classId: "0x102", baseClasses: ["BisCore:GeometricElement3d"] }],
  ["BisCore:GeometricElement3d", { classId: "0x103", baseClasses: ["BisCore:GeometricElement"] }],
  ["BisCore:GeometricElement", { classId: "0x104", baseClasses: ["BisCore:Element"] }],
  ["BisCore:Element", { classId: "0x105", baseClasses: [] }],
]);

function classDefinition(classFullName) {
  const definition = CLASS_DEFINITIONS.get(classFullName);
  if (!definition)
    throw new Error(`Missing benchmark class definition for ${classFullName}`);
  return { classFullName, ...definition };
}

const PHYSICAL_OBJECT = classDefinition("Generic:PhysicalObject");
let nextSyntheticClassId = 0x200;

function registerClassDefinition(classFullName, baseClasses) {
  if (!CLASS_DEFINITIONS.has(classFullName)) {
    CLASS_DEFINITIONS.set(classFullName, {
      classId: `0x${(nextSyntheticClassId++).toString(16)}`,
      baseClasses,
    });
  }
  return classDefinition(classFullName);
}

function group(kind, classFullName, count) {
  return { kind, classInfo: classDefinition(classFullName), count };
}

function balancedIncrementalWorkload(scale) {
  if (!Number.isInteger(scale) || scale < 1)
    throw new Error("Balanced scale must be a positive integer");

  const physicalCount = 12 * scale;
  const deleteCount = 24 * scale;
  return {
    id: `balanced-incremental-scale-${scale}`,
    fixture: "balanced-incremental",
    calibratedScale: 25,
    sourceChangesets: 8,
    changesets: [
      [group("inserts", PHYSICAL_OBJECT.classFullName, physicalCount)],
      [group("inserts", PHYSICAL_OBJECT.classFullName, physicalCount)],
      [group("updates", PHYSICAL_OBJECT.classFullName, physicalCount)],
      [group("updates", PHYSICAL_OBJECT.classFullName, physicalCount)],
      // The quick fixture's remaining changesets modify relationships only.
      [group("deletes", PHYSICAL_OBJECT.classFullName, deleteCount)],
    ],
  };
}

function updateHeavyScanWorkload(scale, sourceChangesets = 20) {
  if (!Number.isInteger(scale) || scale < 1)
    throw new Error("Update-heavy scan scale must be a positive integer");
  if (!Number.isInteger(sourceChangesets) || sourceChangesets < 4)
    throw new Error("Update-heavy scan needs at least four source changesets");

  const updated = 200 * scale;
  const deletedLate = 20 * scale;
  const insertedThenUpdated = 20 * scale;
  const insertedThenDeleted = 10 * scale;
  const changesets = [];

  for (let changeset = 1; changeset <= sourceChangesets; changeset++) {
    const isFirst = changeset === 1;
    const isLast = changeset === sourceChangesets;
    const changes = [];

    if (isFirst) {
      changes.push(group("inserts", PHYSICAL_OBJECT.classFullName, insertedThenUpdated));
      changes.push(group("inserts", PHYSICAL_OBJECT.classFullName, insertedThenDeleted));
    }

    changes.push(group("updates", PHYSICAL_OBJECT.classFullName, updated));
    if (!isLast)
      changes.push(group("updates", PHYSICAL_OBJECT.classFullName, deletedLate));
    if (!isFirst)
      changes.push(group("updates", PHYSICAL_OBJECT.classFullName, insertedThenUpdated));

    if (isLast) {
      changes.push(group("deletes", PHYSICAL_OBJECT.classFullName, deletedLate));
      changes.push(group("deletes", PHYSICAL_OBJECT.classFullName, insertedThenDeleted));
    }

    changesets.push(changes);
  }

  return {
    id: `update-heavy-scan-scale-${scale}`,
    fixture: "update-heavy-scan",
    calibratedScale: 16,
    sourceChangesets,
    changesets,
  };
}

function makeClassMixEvents(classInfos, totalEntities) {
  const events = [];
  let remaining = totalEntities;
  while (remaining > 0) {
    const eventSize = Math.min(remaining, MAX_ENTITIES_PER_EVENT);
    const perClass = Math.floor(eventSize / classInfos.length);
    const remainder = eventSize % classInfos.length;
    const updates = classInfos
      .map((classInfo, index) => ({ classInfo, count: perClass + (index < remainder ? 1 : 0) }))
      .filter((entry) => entry.count > 0);
    events.push({ inserts: [], deletes: [], updates, total: eventSize });
    remaining -= eventSize;
  }
  return events;
}

function classBreadthDepthWorkload(totalEntities, breadth, hierarchyDepth) {
  if (!Number.isInteger(totalEntities) || totalEntities < 1)
    throw new Error("Class-mix total entities must be a positive integer");
  if (![1, 10, 100].includes(breadth))
    throw new Error("Class-mix breadth must be 1, 10, or 100");
  if (![1, 3, 5].includes(hierarchyDepth))
    throw new Error("Class-mix hierarchy depth must be 1, 3, or 5");

  for (let level = 0; level < hierarchyDepth; level++) {
    const baseClass = `Benchmark:Base${level}`;
    const parent = level === 0 ? [] : [`Benchmark:Base${level - 1}`];
    registerClassDefinition(baseClass, parent);
  }

  const classInfos = Array.from({ length: breadth }, (_, index) =>
    registerClassDefinition(
      `Benchmark:D${hierarchyDepth}Leaf${index.toString().padStart(3, "0")}`,
      [`Benchmark:Base${hierarchyDepth - 1}`],
    ));

  return {
    id: `class-mix-${totalEntities}-entities-${breadth}-classes-depth-${hierarchyDepth}`,
    fixture: "synthetic-class-mix",
    calibratedScale: totalEntities,
    sourceChangesets: 1,
    hierarchyDepth,
    subclassFilterTarget: "Benchmark:Base0",
    events: makeClassMixEvents(classInfos, totalEntities),
  };
}

function chunkChangeset(groups) {
  const events = [];
  let current = { inserts: [], deletes: [], updates: [], total: 0 };

  const flush = () => {
    if (current.total === 0)
      return;
    events.push(current);
    current = { inserts: [], deletes: [], updates: [], total: 0 };
  };

  for (const entry of groups) {
    let remaining = entry.count;
    while (remaining > 0) {
      const count = Math.min(remaining, MAX_ENTITIES_PER_EVENT - current.total);
      current[entry.kind].push({ classInfo: entry.classInfo, count });
      current.total += count;
      remaining -= count;
      if (current.total === MAX_ENTITIES_PER_EVENT)
        flush();
    }
  }

  flush();
  return events;
}

function metadataClassCount(event) {
  const classNames = new Set();
  const add = (classInfo) => {
    if (classNames.has(classInfo.classFullName))
      return;
    classNames.add(classInfo.classFullName);
    for (const baseClassFullName of classInfo.baseClasses)
      add(classDefinition(baseClassFullName));
  };

  for (const kind of ["inserts", "deletes", "updates"]) {
    for (const entry of event[kind])
      add(entry.classInfo);
  }
  return classNames.size;
}

function expandWorkload(workload) {
  const events = workload.events ?? workload.changesets.flatMap(chunkChangeset);
  const totalEntities = events.reduce((sum, event) => sum + event.total, 0);
  const classNames = new Set();
  const classesPerEvent = [];
  const metadataClassesPerEvent = [];
  for (const event of events) {
    const eventClassNames = new Set();
    for (const kind of ["inserts", "deletes", "updates"]) {
      for (const entry of event[kind]) {
        classNames.add(entry.classInfo.classFullName);
        eventClassNames.add(entry.classInfo.classFullName);
      }
    }
    classesPerEvent.push(eventClassNames.size);
    metadataClassesPerEvent.push(metadataClassCount(event));
  }

  return { ...workload, events, totalEntities, classNames, classesPerEvent, metadataClassesPerEvent };
}

function createMetadata(event) {
  const metadata = new Map();

  function add(classInfo) {
    const existing = metadata.get(classInfo.classFullName);
    if (existing)
      return existing;

    const value = new Metadata(classInfo.classFullName);
    metadata.set(classInfo.classFullName, value);
    for (const baseClassFullName of classInfo.baseClasses)
      value.baseClasses.push(add(classDefinition(baseClassFullName)));
    return value;
  }

  for (const kind of ["inserts", "deletes", "updates"]) {
    for (const entry of event[kind])
      add(entry.classInfo);
  }

  return metadata;
}

function makeIterable(entries, variant, metadata) {
  return {
    [Symbol.iterator]: function* () {
      const entity = { id: "", classId: "" };
      if (variant === "class-name-per-entity")
        entity.classFullName = "";
      else if (variant === "shared-metadata")
        entity.metadata = undefined;

      let id = 1;
      for (const entry of entries) {
        for (let index = 0; index < entry.count; index++) {
          entity.id = `0x${(id++).toString(16)}`;
          entity.classId = entry.classInfo.classId;
          if (variant === "class-name-per-entity")
            entity.classFullName = entry.classInfo.classFullName;
          else if (variant === "shared-metadata")
            entity.metadata = metadata.get(entry.classInfo.classFullName);
          yield entity;
        }
      }
    },
  };
}

function makeChanges(workload, variant) {
  return workload.events.map((event) => {
    const metadata = variant === "shared-metadata" ? createMetadata(event) : undefined;
    return {
      inserts: makeIterable(event.inserts, variant, metadata),
      deletes: makeIterable(event.deletes, variant, metadata),
      updates: makeIterable(event.updates, variant, metadata),
    };
  });
}

function consume(changes, variant) {
  let checksum = 0;
  for (const event of changes) {
    for (const kind of ["inserts", "deletes", "updates"]) {
      for (const entity of event[kind]) {
        checksum += entity.id.length + entity.classId.length;
        if (variant === "class-name-per-entity")
          checksum += entity.classFullName.length;
        else if (variant === "shared-metadata")
          checksum += entity.metadata.classFullName.length;
      }
    }
  }
  return checksum;
}

function consumeWithSubclassFilter(changes, baseClassFullName) {
  let matchingEntities = 0;
  for (const event of changes) {
    for (const kind of ["inserts", "deletes", "updates"]) {
      for (const entity of event[kind]) {
        if (entity.metadata.is(baseClassFullName))
          matchingEntities++;
      }
    }
  }
  return matchingEntities;
}

let blackHole = 0;

function measure(fn, iterations) {
  for (let i = 0; i < 2; i++)
    blackHole += fn();

  const samples = [];
  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();
    for (let iteration = 0; iteration < iterations; iteration++)
      blackHole += fn();
    samples.push((performance.now() - start) / iterations);
  }

  samples.sort((lhs, rhs) => lhs - rhs);
  return samples[Math.floor(samples.length / 2)];
}

function iterationsFor(totalEntities) {
  if (totalEntities >= 1_000_000)
    return 1;
  if (totalEntities >= 100_000)
    return 2;
  return 5;
}

function formatMilliseconds(value) {
  if (value >= 100)
    return value.toFixed(0);
  if (value >= 10)
    return value.toFixed(2);
  return value.toFixed(3);
}

function run(workload) {
  const expanded = expandWorkload(workload);
  const iterations = iterationsFor(expanded.totalEntities);
  console.log(`\n${expanded.id}`);
  console.log(`fixture=${expanded.fixture}; calibrated scale=${expanded.calibratedScale}; source changesets=${expanded.sourceChangesets}`);
  const minClassesPerEvent = Math.min(...expanded.classesPerEvent);
  const maxClassesPerEvent = Math.max(...expanded.classesPerEvent);
  const minMetadataClassesPerEvent = Math.min(...expanded.metadataClassesPerEvent);
  const maxMetadataClassesPerEvent = Math.max(...expanded.metadataClassesPerEvent);
  console.log(`changed elements=${expanded.totalEntities}; event batches=${expanded.events.length}; max per event=${MAX_ENTITIES_PER_EVENT}; unique classes=${expanded.classNames.size}; classes/event=${minClassesPerEvent}-${maxClassesPerEvent}; metadata classes/event=${minMetadataClassesPerEvent}-${maxMetadataClassesPerEvent}; iterations=${iterations}`);
  console.log("variant                         construct ms/run  consume ms/run");

  for (const variant of VARIANTS) {
    const construction = measure(() => makeChanges(expanded, variant).length, iterations);
    const changes = makeChanges(expanded, variant);
    const consumption = measure(() => consume(changes, variant), iterations);
    console.log(`${variant.padEnd(31)} ${formatMilliseconds(construction).padStart(18)} ${formatMilliseconds(consumption).padStart(16)}`);
  }

  const sharedChanges = makeChanges(expanded, "shared-metadata");
  const subclassFilterTarget = expanded.subclassFilterTarget ?? "BisCore:Element";
  const subclassFilter = measure(() => consumeWithSubclassFilter(sharedChanges, subclassFilterTarget), iterations);
  console.log(`${`shared-metadata is(${subclassFilterTarget})`.padEnd(31)} ${"-".padStart(18)} ${formatMilliseconds(subclassFilter).padStart(16)}`);
}

console.log("TxnChangedEntities fixture-derived stress benchmark");
console.log("The calibrated workloads are taken from imodel-transformer's quick performance recipes.");
console.log("Larger scales stress event chunking; timings are local synthetic representation costs, not production measurements.");
console.log("The class-mix matrix holds changed-element volume at 100,000 and varies leaf-class breadth and inheritance depth.");

for (const workload of [
  balancedIncrementalWorkload(25),
  balancedIncrementalWorkload(250),
  balancedIncrementalWorkload(2500),
  balancedIncrementalWorkload(25000),
  updateHeavyScanWorkload(16),
  updateHeavyScanWorkload(160),
  updateHeavyScanWorkload(1600),
  ...[1, 10, 100].flatMap((breadth) =>
    [1, 3, 5].map((hierarchyDepth) => classBreadthDepthWorkload(100_000, breadth, hierarchyDepth))),
])
  run(workload);

if (blackHole === Number.MIN_VALUE)
  console.log("black hole", blackHole);
