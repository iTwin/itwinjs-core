/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  IModelHost, IModelDb, ECSqlStatement, ExportGraphicsInfo, ExportGraphicsMesh, ExportPartInstanceProps,
  ExportPartInfo, ExportGraphics, ExportLinesInfo, ExportGraphicsLines, ExportPartLinesInfo,
} from "@bentley/imodeljs-backend";
import { DbResult, Id64Array, Logger, LogLevel, Id64String } from "@bentley/bentleyjs-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { Matrix3d, Angle, Geometry } from "@bentley/geometry-core";
import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";

const CHORD_TOL = 0.001;
const ANGLE_TOL = Angle.degreesToRadians(45);

class GltfGlobals {
  public static iModel: IModelDb;
  public static gltf: Gltf;
  public static binFile: number;
  public static binBytesWritten: number;
  public static colorToMaterialMap: Map<number, number>;

  public static initialize(iModelName: string, gltfName: string) {
    GltfGlobals.iModel = IModelDb.openSnapshot(iModelName);
    process.stdout.write(`Opened ${iModelName} successfully...\n`);

    const gltfPathParts = path.parse(gltfName);
    const binName = gltfPathParts.name + ".bin";
    GltfGlobals.binFile = fs.openSync(path.join(gltfPathParts.dir, binName), "w");
    process.stdout.write(`Writing to ${gltfName} and ${binName}...\n`);

    GltfGlobals.gltf = {
      accessors: [],
      asset: {
        generator: "iModel.js export-gltf",
        version: "2.0",
      },
      buffers: [{ uri: binName, byteLength: 0 }],
      bufferViews: [],
      materials: [],
      meshes: [],
      nodes: [],
      scenes: [{ nodes: [] }],
    };
    GltfGlobals.binBytesWritten = 0;
    GltfGlobals.colorToMaterialMap = new Map<number, number>();
  }
}

function findOrAddMaterialIndex(color: number): number {
  let result = GltfGlobals.colorToMaterialMap.get(color);
  if (result !== undefined) return result;

  const rgb = new ColorDef(color).colors;
  const baseColorFactor = [rgb.r / 255, rgb.g / 255, rgb.b / 255, (255 - rgb.t) / 255];
  const pbrMetallicRoughness = { baseColorFactor, metallicFactor: 0, roughnessFactor: 1 };
  const material: GltfMaterial = ({ pbrMetallicRoughness, doubleSided: true });
  if (rgb.t > 10) material.alphaMode = "BLEND";

  result = GltfGlobals.gltf.materials.length;
  GltfGlobals.gltf.materials.push(material);
  GltfGlobals.colorToMaterialMap.set(color, result);
  return result;
}

function addMeshIndices(indices: Int32Array) {
  GltfGlobals.gltf.accessors.push({
    bufferView: GltfGlobals.gltf.bufferViews.length,
    byteOffset: 0,
    componentType: AccessorComponentType.UInt32,
    count: indices.length,
    type: "SCALAR",
  });
  GltfGlobals.gltf.bufferViews.push({
    buffer: 0,
    target: BufferViewTarget.ElementArrayBuffer,
    byteOffset: GltfGlobals.binBytesWritten,
    byteLength: indices.byteLength,
  });
  GltfGlobals.binBytesWritten += indices.byteLength;
  fs.writeSync(GltfGlobals.binFile, indices);
}

function addMeshPointsAndNormals(points: Float64Array, normals: Float32Array) {
  // GLTF is RHS with Y-up, iModel.js is RHS with Z-up
  const convertPoint = (outArray: Float32Array, outIndex: number, x: number, y: number, z: number) => {
    outArray[outIndex] = x;
    outArray[outIndex + 1] = z;
    outArray[outIndex + 2] = -y;
  };
  const outPoints = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3)
    convertPoint(outPoints, i, points[i], points[i + 1], points[i + 2]);

  const outNormals = new Float32Array(normals.length);
  for (let i = 0; i < normals.length; i += 3)
    convertPoint(outNormals, i, normals[i], normals[i + 1], normals[i + 2]);

  GltfGlobals.gltf.bufferViews.push({
    buffer: 0,
    target: BufferViewTarget.ArrayBuffer,
    byteOffset: GltfGlobals.binBytesWritten,
    byteLength: outPoints.byteLength + outNormals.byteLength,
    byteStride: 12,
  });
  fs.writeSync(GltfGlobals.binFile, outPoints);
  fs.writeSync(GltfGlobals.binFile, outNormals);
  GltfGlobals.binBytesWritten += outPoints.byteLength + outNormals.byteLength;

  const minPos = [outPoints[0], outPoints[1], outPoints[2]];
  const maxPos = Array.from(minPos);
  for (let i = 0; i < outPoints.length; i += 3) {
    for (let j = 0; j < 3; ++j) {
      minPos[j] = Math.min(minPos[j], outPoints[i + j]);
      maxPos[j] = Math.max(maxPos[j], outPoints[i + j]);
    }
  }
  GltfGlobals.gltf.accessors.push({
    bufferView: GltfGlobals.gltf.bufferViews.length - 1,
    byteOffset: 0,
    componentType: AccessorComponentType.Float,
    count: outPoints.length / 3,
    type: "VEC3",
    max: maxPos,
    min: minPos,
  });
  GltfGlobals.gltf.accessors.push({
    bufferView: GltfGlobals.gltf.bufferViews.length - 1,
    byteOffset: outPoints.byteLength,
    componentType: AccessorComponentType.Float,
    count: outNormals.length / 3,
    type: "VEC3",
  });
}

function addMesh(mesh: ExportGraphicsMesh, color: number) {
  const primitive: GltfMeshPrimitive = {
    mode: MeshPrimitiveMode.GlTriangles,
    material: findOrAddMaterialIndex(color),
    indices: GltfGlobals.gltf.accessors.length,
    attributes: {
      POSITION: GltfGlobals.gltf.accessors.length + 1,
      NORMAL: GltfGlobals.gltf.accessors.length + 2,
    },
  };
  GltfGlobals.gltf.meshes.push({ primitives: [primitive] });
  addMeshIndices(mesh.indices);
  addMeshPointsAndNormals(mesh.points, mesh.normals);
}

function addMeshNode(name: string) {
  GltfGlobals.gltf.scenes[0].nodes.push(GltfGlobals.gltf.nodes.length);
  GltfGlobals.gltf.nodes.push({ name, mesh: GltfGlobals.gltf.meshes.length });
}

function addLines(lines: ExportGraphicsLines, color: number) {
  const primitive: GltfMeshPrimitive = {
    mode: MeshPrimitiveMode.GlLines,
    material: findOrAddMaterialIndex(color),
    indices: GltfGlobals.gltf.accessors.length,
    attributes: {
      POSITION: GltfGlobals.gltf.accessors.length + 1,
    },
  };
  GltfGlobals.gltf.meshes.push({ primitives: [primitive] });
  addMeshIndices(lines.indices);

  // GLTF is RHS with Y-up, iModel.js is RHS with Z-up
  const convertPoint = (outArray: Float32Array, outIndex: number, x: number, y: number, z: number) => {
    outArray[outIndex] = x;
    outArray[outIndex + 1] = z;
    outArray[outIndex + 2] = -y;
  };
  const outPoints = new Float32Array(lines.points.length);
  for (let i = 0; i < outPoints.length; i += 3)
    convertPoint(outPoints, i, lines.points[i], lines.points[i + 1], lines.points[i + 2]);

  GltfGlobals.gltf.bufferViews.push({
    buffer: 0,
    target: BufferViewTarget.ArrayBuffer,
    byteOffset: GltfGlobals.binBytesWritten,
    byteLength: outPoints.byteLength,
    byteStride: 12,
  });
  fs.writeSync(GltfGlobals.binFile, outPoints);
  GltfGlobals.binBytesWritten += outPoints.byteLength;

  const minPos = [outPoints[0], outPoints[1], outPoints[2]];
  const maxPos = Array.from(minPos);
  for (let i = 0; i < outPoints.length; i += 3) {
    for (let j = 0; j < 3; ++j) {
      minPos[j] = Math.min(minPos[j], outPoints[i + j]);
      maxPos[j] = Math.max(maxPos[j], outPoints[i + j]);
    }
  }
  GltfGlobals.gltf.accessors.push({
    bufferView: GltfGlobals.gltf.bufferViews.length - 1,
    byteOffset: 0,
    componentType: AccessorComponentType.Float,
    count: outPoints.length / 3,
    type: "VEC3",
    max: maxPos,
    min: minPos,
  });
}

function exportElements(elementIdArray: Id64Array, partInstanceArray: ExportPartInstanceProps[]) {
  const onGraphics = (info: ExportGraphicsInfo) => {
    addMeshNode(info.elementId);
    addMesh(info.mesh, info.color);
  };
  const onLineGraphics = (info: ExportLinesInfo) => {
    addMeshNode(info.elementId);
    addLines(info.lines, info.color);
  };
  GltfGlobals.iModel.exportGraphics({
    chordTol: CHORD_TOL, angleTol: ANGLE_TOL, onGraphics, onLineGraphics, elementIdArray, partInstanceArray,
  });
}

function getInstancesByPart(instances: ExportPartInstanceProps[]): Map<Id64String, ExportPartInstanceProps[]> {
  const partMap = new Map<Id64String, ExportPartInstanceProps[]>();
  for (const instance of instances) {
    const instancesForThisPart = partMap.get(instance.partId);
    if (instancesForThisPart !== undefined) instancesForThisPart.push(instance);
    else partMap.set(instance.partId, [instance]);
  }
  return partMap;
}

function almostEqual(testValue: number, ...arrayValues: number[]): boolean {
  for (const val of arrayValues) {
    if (!Geometry.isAlmostEqualNumber(testValue, val)) return false;
  }
  return true;
}

// translation, rotation, scale only defined if different from GLTF default transforms
class TranslationRotationScale {
  public readonly translation?: number[];
  public readonly rotation?: number[];
  public readonly scale?: number[];
  constructor(xform?: Float64Array) {
    if (xform === undefined) return;
    if (!almostEqual(0, xform[3], xform[7], xform[11]))
      this.translation = [xform[3], xform[11], -xform[7]]; // GLTF = RHS Y-up, iModel.js = RHS Z-up

    // Uniform and positive scale guaranteed by exportGraphics
    const xColumnMagnitude = Math.hypot(xform[0], xform[4], xform[8]);
    if (!almostEqual(1, xColumnMagnitude))
      this.scale = [xColumnMagnitude, xColumnMagnitude, xColumnMagnitude];

    const invScale = 1.0 / xColumnMagnitude;
    const matrix = Matrix3d.createRowValues(
      xform[0] * invScale, xform[1] * invScale, xform[2] * invScale,
      xform[4] * invScale, xform[5] * invScale, xform[6] * invScale,
      xform[8] * invScale, xform[9] * invScale, xform[10] * invScale);
    if (!matrix.isIdentity) {
      const q = matrix.toQuaternion();
      this.rotation = [q.x, q.z, -q.y, -q.w]; // GLTF = RHS Y-up, iModel.js = RHS Z-up
    }
  }
}

function exportInstances(partInstanceArray: ExportPartInstanceProps[]) {
  const partMap: Map<Id64String, ExportPartInstanceProps[]> = getInstancesByPart(partInstanceArray);
  process.stdout.write(`Found ${partInstanceArray.length} instances for ${partMap.size} parts...\n`);

  const onPartLineGraphics = (meshIndices: number[]) => (info: ExportPartLinesInfo) => {
    meshIndices.push(GltfGlobals.gltf.meshes.length);
    addLines(info.lines, info.color);
  };
  const onPartGraphics = (meshIndices: number[]) => (info: ExportPartInfo) => {
    meshIndices.push(GltfGlobals.gltf.meshes.length);
    addMesh(info.mesh, info.color);
  };
  const nodes: GltfNode[] = GltfGlobals.gltf.nodes;
  const nodeIndices: number[] = GltfGlobals.gltf.scenes[0].nodes;

  for (const instanceList of partMap.values()) {
    const meshIndices: number[] = [];
    const baseDisplayProps = instanceList[0].displayProps;
    GltfGlobals.iModel.exportPartGraphics({
      elementId: instanceList[0].partId,
      displayProps: instanceList[0].displayProps,
      onPartGraphics: onPartGraphics(meshIndices),
      onPartLineGraphics: onPartLineGraphics(meshIndices),
      chordTol: CHORD_TOL,
      angleTol: ANGLE_TOL,
    });
    for (const instance of instanceList) {
      // It is legal for different GeometryPartInstances of the same GeometryPart to have different
      // display properties. This can lead to different colors, materials or textures so an exporter
      // that is concerned about matching the appearance of the original iModel should not reuse a
      // GeometryPart exported with different display properties.
      if (!ExportGraphics.areDisplayPropsEqual(baseDisplayProps, instance.displayProps))
        process.stdout.write("Warning: GeometryPartInstances found using different display properties.\n");

      const trs = new TranslationRotationScale(instance.transform);
      for (const meshIndex of meshIndices) {
        nodeIndices.push(nodes.length);
        nodes.push({
          mesh: meshIndex,
          name: instance.partInstanceId,
          rotation: trs.rotation,
          scale: trs.scale,
          translation: trs.translation,
        });
      }
    }
  }
}

function doExport(iModelName: string, gltfName: string) {
  IModelHost.startup();
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  GltfGlobals.initialize(iModelName, gltfName);

  const elementIdArray: Id64Array = [];
  const sql = "SELECT ECInstanceId FROM bis.GeometricElement3d";
  GltfGlobals.iModel.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW)
      elementIdArray.push(stmt.getValue(0).getId());
  });
  process.stdout.write(`Found ${elementIdArray.length} 3D elements...\n`);
  if (elementIdArray.length === 0) return;

  const partInstanceArray: ExportPartInstanceProps[] = [];
  exportElements(elementIdArray, partInstanceArray);
  exportInstances(partInstanceArray);

  GltfGlobals.gltf.buffers[0].byteLength = GltfGlobals.binBytesWritten;
  fs.writeFileSync(gltfName, JSON.stringify(GltfGlobals.gltf));
  fs.closeSync(GltfGlobals.binFile);
  process.stdout.write(`Export successful, wrote ${GltfGlobals.binBytesWritten} bytes.\n`);
}

interface ExportGltfArgs { input: string; output: string; }
try {
  yargs.usage("Export a GLTF from an existing BIM file.");
  yargs.required("input", "The input BIM");
  yargs.required("output", "The output GLTF file");
  const args = yargs.parse() as yargs.Arguments<ExportGltfArgs>;
  doExport(args.input, args.output);
} catch (error) {
  process.stdout.write(error.message + "\n" + error.stack);
}
