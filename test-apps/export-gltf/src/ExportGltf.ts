/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
// import * as path from "path";
import * as yargs from "yargs";
import { BeDuration, Logger, LogLevel } from "@itwin/core-bentley";
import {
  BriefcaseDb, GeometricElement3d, IModelHost,
} from "@itwin/core-backend";
import { Point3d } from "@itwin/core-geometry";

const exportGltfArgs = yargs
  .usage("Usage: $0 --input [Snapshot iModel] --output [GLTF file]")
  .string("input")
  .alias("input", "i")
  .demandOption(["input"])
  .describe("input", "Path to the Snapshot iModel")
  /*
  .string("output")
  .alias("output", "o")
  .demandOption(["output"])
  .describe("output", "Path to the GLTF file that will be created")
  */
  .parseSync();

function processCommand(cmd: string, db: BriefcaseDb): void {
  const elem = db.elements.getElement("0x53") as GeometricElement3d;
  const o = new Point3d(0, 0, 0);
  switch (cmd) {
    case "l": o.x = -1; break;
    case "r": o.x = 1; break;
    case "d": o.z = -1; break;
    case "u": o.z = 1; break;
    case "f": o.y = -1; break;
    case "b": o.y = 1; break;
    default: console.log(`Unrecognized command "${cmd}"`); return;
  }

  elem.placement.origin = elem.placement.origin.plus(o);
  elem.update();
  db.saveChanges(cmd);
}

(async () => {
  await IModelHost.startup({ profileName: "export-gltf" });
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);

  const db = await BriefcaseDb.open({
    fileName: exportGltfArgs.input,
    readonly: false,
  });

  fs.watch(`${exportGltfArgs.input}-wal`, { persistent: false }, () => {
    console.log("wal changed");
  });

  console.log("Move element 0x53 l)eft r)ight u)p d)own f)orward or b)ackward, or q)uit.");

  let stop = false;

  process.stdin.resume();
  process.stdin.on("data", async (d) => {
    const cmd = d.toString()[0];
    if (cmd === "q")
      stop = true;
    else
      processCommand(cmd, db);
  });

  while (!stop)
    await BeDuration.wait(1);

  console.log("Bye");
  db.close();
  process.exit(0);

  /*
  GltfGlobals.initialize(exportGltfArgs.input, exportGltfArgs.output);

  const elementIdArray: Id64Array = [];
  // Get all 3D elements that aren't part of template definitions or in private models.
  const sql = "SELECT e.ECInstanceId FROM bis.GeometricElement3d e JOIN bis.Model m ON e.Model.Id=m.ECInstanceId WHERE m.isTemplate=false AND m.isPrivate=false";
  GltfGlobals.iModel.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW)
      elementIdArray.push(stmt.getValue(0).getId());
  });
  process.stdout.write(`Found ${elementIdArray.length} 3D elements...\n`);
  if (elementIdArray.length === 0)
    return;

  // Since we write Float32 into the file for points, we need to proactively recenter to avoid
  // baking in data loss due to quantization.
  const recenterTranslation: Point3d = GltfGlobals.iModel.projectExtents.center;
  recenterTranslation.scaleInPlace(-1);

  const partInstanceArray: ExportPartInstanceInfo[] = [];
  exportElements(elementIdArray, partInstanceArray, recenterTranslation);
  exportInstances(partInstanceArray, recenterTranslation);

  GltfGlobals.gltf.buffers[0].byteLength = GltfGlobals.binBytesWritten;
  fs.writeFileSync(exportGltfArgs.output, JSON.stringify(GltfGlobals.gltf, undefined, 2));
  fs.closeSync(GltfGlobals.binFile);
  process.stdout.write(`Export successful, wrote ${GltfGlobals.binBytesWritten} bytes.\n`);
  */
})().catch((error) => {
  process.stdout.write(`${error.message}\n${error.stack}\n`);
});
