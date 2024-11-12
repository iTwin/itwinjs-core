/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { ColorDef, ColorIndex, EmptyLocalization, FeatureIndex, FillFlags, ImageBuffer, ImageBufferFormat, MeshEdge, QParams3d, QPoint3dList, RenderTexture, TextureTransparency } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { RenderMemory } from "../../../render/RenderMemory";
import { RenderGraphic } from "../../../render/RenderGraphic";
import { MeshArgsEdges } from "../../../common/internal/render/MeshPrimitives";
import { createMeshParams } from "../../../common/internal/render/VertexTableBuilder";
import { Texture } from "../../../render/webgl/Texture";
import { createBlankConnection } from "../../createBlankConnection";
import { InstancedGraphicParams, MeshArgs } from "../../../core-frontend";
import { RenderGeometry } from "../../../internal/render/RenderGeometry";

function expectMemory(consumer: RenderMemory.Consumers, total: number, max: number, count: number) {
  expect(consumer.totalBytes).toEqual(total);
  expect(consumer.maxBytes).toEqual(max);
  expect(consumer.count).toEqual(count);
}

function createMeshGeometry(opts?: { texture?: RenderTexture, includeEdges?: boolean }): RenderGeometry {
  const colors = new ColorIndex();
  colors.initUniform(ColorDef.from(255, 0, 0));

  let textureMapping;
  if (opts?.texture) {
    textureMapping = {
      texture: opts.texture,
      uvParams: [new Point2d(0, 1), new Point2d(1, 1), new Point2d(0, 0), new Point2d(1, 0) ],
    };
  }

  const points = [ new Point3d(0, 0, 0), new Point3d(1, 0, 0), new Point3d(0, 1, 0), new Point3d(1, 1, 0) ];
  const qpoints = new QPoint3dList(QParams3d.fromRange(Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1)));
  for (const point of points)
    qpoints.add(point);

  let edges;
  if (opts?.includeEdges) {
    edges = new MeshArgsEdges();
    edges.edges.edges = [];
    for (const indexPair of [[0, 1], [1, 3], [3, 2], [2, 0]])
      edges.edges.edges.push(new MeshEdge(indexPair[0], indexPair[1]));
  }

  const args: MeshArgs = {
    points: qpoints,
    vertIndices: [0, 1, 2, 2, 1, 3],
    isPlanar: true,
    fillFlags: FillFlags.None,
    edges,
    features: new FeatureIndex(),
    colors,
    textureMapping,
  };

  const params = createMeshParams(args, IModelApp.renderSystem.maxTextureSize, "non-indexed" !== IModelApp.tileAdmin.edgeOptions.type);
  const geom = IModelApp.renderSystem.createMeshGeometry(params);
  expect(geom).toBeDefined();
  return geom!;
}

function createGraphic(geom: RenderGeometry, instances?: InstancedGraphicParams): RenderGraphic {
  const graphic = IModelApp.renderSystem.createRenderGraphic(geom, instances);
  expect(graphic).toBeDefined();
  return graphic!;
}

function createTexture(iModel: IModelConnection, persistent: boolean): RenderTexture {
  const source = ImageBuffer.create(new Uint8Array([255, 255, 255, 255]), ImageBufferFormat.Rgba, 1);
  const key = persistent ? iModel.transientIds.getNext() : undefined;
  const tex = IModelApp.renderSystem.createTexture({
    ownership: key ? { iModel, key } : undefined,
    image: { source, transparency: TextureTransparency.Translucent },
  });

  expect(tex).toBeDefined();
  return tex!;
}

function createInstanceParams(count: number): InstancedGraphicParams {
  return {
    count,
    transforms: new Float32Array(count * 12),
    transformCenter: new Point3d(),
    featureIds: new Uint8Array(count * 3),
    symbologyOverrides: new Uint8Array(count * 8),
  };
}

function getStats(consumer: RenderMemory.Consumer): RenderMemory.Statistics {
  const stats = new RenderMemory.Statistics();
  consumer.collectStatistics(stats);
  return stats;
}

function getBytesUsed(consumer: RenderMemory.Consumer | RenderTexture): number {
  if (consumer instanceof RenderTexture) {
    expect(consumer instanceof Texture);
    return (consumer as Texture).bytesUsed;
  }

  return getStats(consumer).totalBytes;
}

function expectBytesUsed(expected: number, consumer: RenderMemory.Consumer | RenderTexture): void {
  expect(getBytesUsed(consumer)).toEqual(expected);
}

describe("RenderMemory", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection();
  });

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  it("should accumulate correctly", () => {
    const stats = new RenderMemory.Statistics();

    stats.addTexture(20);
    stats.addTexture(10);
    expect(stats.totalBytes).toEqual(30);
    expectMemory(stats.textures, 30, 20, 2);

    stats.addVertexTable(10);
    stats.addVertexTable(20);
    expect(stats.totalBytes).toEqual(60);
    expectMemory(stats.vertexTables, 30, 20, 2);

    expectMemory(stats.buffers, 0, 0, 0);

    stats.addSurface(20);
    stats.addPolyline(30);
    stats.addPolyline(10);
    expect(stats.totalBytes).toEqual(120);
    expectMemory(stats.buffers, 60, 30, 3);
    expectMemory(stats.buffers.surfaces, 20, 20, 1);
    expectMemory(stats.buffers.polylines, 40, 30, 2);
    expectMemory(stats.buffers.pointStrings, 0, 0, 0);

    stats.clear();
    expect(stats.totalBytes).toEqual(0);
    expectMemory(stats.textures, 0, 0, 0);
    expectMemory(stats.vertexTables, 0, 0, 0);
    expectMemory(stats.buffers, 0, 0, 0);
    expectMemory(stats.buffers.surfaces, 0, 0, 0);
    expectMemory(stats.buffers.polylines, 0, 0, 0);
    expectMemory(stats.buffers.pointStrings, 0, 0, 0);
  });

  it("should collect memory used by a texture", () => {
    expectBytesUsed(4, createTexture(imodel, true));
    expectBytesUsed(4, createTexture(imodel, false));
  });

  it("should collect memory used by a mesh", () => {
    const mesh = createMeshGeometry();
    const numBytes = getBytesUsed(mesh);
    expect(numBytes).greaterThan(0);
    expectBytesUsed(numBytes, createGraphic(mesh));
  });

  it("should collect memory used by a mesh and its edges", () => {
    const numBytesNoEdges = getBytesUsed(createMeshGeometry());
    const mesh = createMeshGeometry({ includeEdges: true });
    const numBytes = getBytesUsed(mesh);
    expect(numBytes).greaterThan(numBytesNoEdges);
    expectBytesUsed(numBytes, createGraphic(mesh));
  });

  // The number of bytes allocated by a textured mesh, including its UV coords but not the texture itself.
  const sizeOfTexturedMesh = 82;

  it("should collect memory used by a mesh that owns its texture", () => {
    const texture = createTexture(imodel, false);
    const mesh = createMeshGeometry({ texture });
    const numBytes = getBytesUsed(texture) + sizeOfTexturedMesh;
    expectBytesUsed(numBytes, mesh);
    expectBytesUsed(numBytes, createGraphic(mesh));
  });

  it("should not count memory used by a texture not owned by the mesh", () => {
    const texture = createTexture(imodel, true);
    const mesh = createMeshGeometry({ texture });
    expectBytesUsed(sizeOfTexturedMesh, mesh);
    expectBytesUsed(sizeOfTexturedMesh, createGraphic(mesh));
  });

  it("reports zero memory after disposal", () => {
    const mesh = createGraphic(createMeshGeometry());
    expect(getBytesUsed(mesh)).greaterThan(0);
    mesh.dispose();
    expectBytesUsed(0, mesh);

    const texture = createTexture(imodel, false);
    texture.dispose();
    expectBytesUsed(0, texture);
  });

  const numBytesPerInstance = 12 * 4 + 3 + 8; // 12 floats per transform, 3 bytes per feature Id, 8 bytes per symbology override.

  it("should collect memory used by instanced mesh", () => {
    const params = createInstanceParams(5);
    const numInstanceBytes = params.count * numBytesPerInstance;

    const mesh = createMeshGeometry();
    const graphic = createGraphic(mesh, params);
    expectBytesUsed(getBytesUsed(mesh) + numInstanceBytes, graphic);

    graphic.dispose();
    expectBytesUsed(0, mesh);
    expectBytesUsed(0, graphic);
  });

  it("should collect memory used by instanced mesh and its edges", () => {
    const params = createInstanceParams(5);
    const numInstanceBytes = params.count * numBytesPerInstance;

    const mesh = createMeshGeometry({ includeEdges: true });
    const graphic = createGraphic(mesh, params);
    expectBytesUsed(getBytesUsed(mesh) + numInstanceBytes, graphic);

    graphic.dispose();
    expectBytesUsed(0, mesh);
    expectBytesUsed(0, graphic);
  });
});
