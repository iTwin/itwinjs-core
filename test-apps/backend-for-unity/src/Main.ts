/*---------------------------------------------------------------------------------------------
 * Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import { ExportGraphicsInfo, IModelHost, IModelDb, ECSqlStatement, ExportGraphicsProps } from "@bentley/imodeljs-backend";
import { OpenMode, Id64Array, Id64, DbResult } from "@bentley/bentleyjs-core";
import * as ws from "ws";
import * as util from "util";
import * as Yargs from "yargs";

const serverPort = 3005;

enum BinaryMessageType {
  IModelOffset = 0,
  IModelMesh = 1,
}

const setImmediatePromise = util.promisify(setImmediate);

// IModelOffset
// * MessageType (uint32), offset 0
// * Offset (DPoint3d), offset 4
function createIModelOffsetMessage(iModel: IModelDb): Buffer {
  const buffer = Buffer.allocUnsafe(28);
  buffer.writeUInt32LE(BinaryMessageType.IModelOffset, 0);

  // Center the geometry in XY plane for better floating point behavior.
  const extents = iModel.projectExtents;
  const extentsCenter = extents.center;
  buffer.writeDoubleLE(extentsCenter.x, 4);
  buffer.writeDoubleLE(extentsCenter.y, 12);
  buffer.writeDoubleLE(extents.low.z, 20);
  return buffer;
}

// IModelMesh
// * MessageType (uint32), offset 0
// * ElementId (int64), offset 4
// * Color (uint32), offset 12
// * IndexCount (uint32), offset 16
// * VertexCount (uint32), offset 20
// * IndexArray, VertexArray, NormalArray, UVArray, offset 24
function createIModelMeshMessage(info: ExportGraphicsInfo): Buffer {
  const indices = info.mesh.indices;
  const points = info.mesh.points;
  const normals = info.mesh.normals;
  const params = info.mesh.params;
  const byteCount = 24 + indices.byteLength + points.byteLength + normals.byteLength + params.byteLength;
  const buffer: Buffer = Buffer.allocUnsafe(byteCount);

  buffer.writeUInt32LE(BinaryMessageType.IModelMesh, 0);

  const idAsPair = Id64.getUint32Pair(info.elementId);
  buffer.writeUInt32LE(idAsPair.lower, 4);
  buffer.writeUInt32LE(idAsPair.upper, 8);

  buffer.writeUInt32LE(info.color, 12);

  buffer.writeInt32LE(indices.length, 16);
  buffer.writeInt32LE(points.length / 3, 20);

  let offset = 24;
  Buffer.from(indices.buffer).copy(buffer, offset); offset += indices.byteLength;
  Buffer.from(points.buffer).copy(buffer, offset); offset += points.byteLength;
  Buffer.from(normals.buffer).copy(buffer, offset); offset += normals.byteLength;
  Buffer.from(params.buffer).copy(buffer, offset); offset += params.byteLength;

  return buffer;
}

function startServer(iModelName: string) {
  IModelHost.startup();
  const iModel: IModelDb = IModelDb.openStandalone(iModelName, OpenMode.Readonly);
  process.stdout.write(`Opened ${iModelName} successfully.\n`);

  // 3D elements in descending order of size.
  // These queries are very fast - prefer ECSql instead of iterating TypeScript objects whenever possible.
  const elementIdArray: Id64Array = [];
  const sql = "SELECT ECInstanceId FROM bis.PhysicalElement ORDER BY iModel_bbox_volume(iModel_bbox(BBoxLow.X, BBoxLow.Y, BBoxLow.Z, BBoxHigh.X, BBoxHigh.Y, BBoxHigh.Z)) DESC";
  iModel.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      elementIdArray.push(stmt.getValue(0).getId());
    }
  });

  process.stdout.write(`Selected ${elementIdArray.length} elements\n`);
  process.stdout.write("Waiting for connection...\n");

  const server = new ws.Server({ port: serverPort });

  server.on("connection", (socket) => {
    process.stdout.write("User connected\n");
    socket.send(createIModelOffsetMessage(iModel));

    // In this demo, string messages are always element IDs. Send back tooltip properties.
    socket.on("message", (data: ws.Data) => {
      if (typeof data !== "string") return;

      const element = iModel.elements.getElement(data);
      const category = iModel.elements.getElement(element.category).getDisplayLabel();
      const model = iModel.elements.getElement(element.model).getDisplayLabel();
      const elementResponse = ({ id: data, class: element.className, category, model });
      socket.send(JSON.stringify(elementResponse));
    });

    // Send the iModel's geometry when the client connects.
    async function sendDataAsync() {
      const cachedGraphics: ExportGraphicsInfo[] = [];
      const onGraphics = (info: ExportGraphicsInfo) => { cachedGraphics.push(info); return true; };
      // Set angleTol to arbitrary large value so chordTol is deciding factor.
      const exportGraphicsProps: ExportGraphicsProps = ({ onGraphics, elementIdArray: [], chordTol: 0.01, angleTol: 10 });

      // Running all elements through exportGraphics in one shot would have the best performance, but web
      // sockets are only flushed when the Node.js event loop is allowed to advance so break the elements
      // down into smaller batches.
      const ELEMENTS_PER_BATCH = 25;
      for (let i = 0; i < elementIdArray.length; i += ELEMENTS_PER_BATCH) {
        exportGraphicsProps.elementIdArray = elementIdArray.slice(i, Math.min(i + ELEMENTS_PER_BATCH, elementIdArray.length));
        iModel.exportGraphics(exportGraphicsProps);

        for (const info of cachedGraphics) { socket.send(createIModelMeshMessage(info)); }
        while (socket.bufferedAmount !== 0) { await setImmediatePromise(); }

        cachedGraphics.length = 0;
      }
      process.stdout.write(`Exported in ${new Date().getTime() - startTime}ms\n`);
    }
    const startTime = new Date().getTime();
    sendDataAsync().catch(() => { });
  });
}

interface UnityBackendArgs {
  input: string;
}

Yargs.usage("Launch an iModel.js server to stream graphics over a web socket.");
Yargs.required("input", "The input BIM");
const args = Yargs.parse() as Yargs.Arguments<UnityBackendArgs>;

startServer(args.input);
