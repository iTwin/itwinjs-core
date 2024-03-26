/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { IndexedPolyface } from "../../polyface/Polyface";
import { PolyfaceBuilder } from "../../polyface/PolyfaceBuilder";
import { PolyfaceQuery } from "../../polyface/PolyfaceQuery";
import { Sample } from "../../serialization/GeometrySamples";
import { HalfEdge, HalfEdgeGraph, HalfEdgeMask } from "../../topology/Graph";
import { HalfEdgeGraphSearch, HalfEdgeMaskTester } from "../../topology/HalfEdgeGraphSearch";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { ImportedSample } from "../testInputs/ImportedSamples";

// cspell:word internaldocs

describe("HalfEdgeGraphSearch", () => {
  it("collectConnectedComponentsWithExteriorParityMasks", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(1, 1, 0, 0);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(0, 0, 2, 0);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(2, 0, 1, 1);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    const node6 = graph.addEdgeXY(2, 0, 3, 1);
    const node7 = node6.faceSuccessor;
    const node8 = graph.addEdgeXY(3, 1, 1, 1);
    const node9 = node8.faceSuccessor;
    HalfEdge.pinch(node3, node6);
    HalfEdge.pinch(node7, node8);
    HalfEdge.pinch(node5, node9);
    graph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node4.clearMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE);

    const node10 = graph.addEdgeXY(6, 1, 5, 0);
    const node11 = node10.faceSuccessor;
    const node12 = graph.addEdgeXY(5, 0, 7, 0);
    const node13 = node12.faceSuccessor;
    const node14 = graph.addEdgeXY(7, 0, 6, 1);
    const node15 = node14.faceSuccessor;
    HalfEdge.pinch(node11, node12);
    HalfEdge.pinch(node13, node14);
    HalfEdge.pinch(node15, node10);
    node10.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE);
    node11.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE);

    const connectedComponents = HalfEdgeGraphSearch.collectConnectedComponentsWithExteriorParityMasks(
      graph, new HalfEdgeMaskTester(HalfEdgeMask.BOUNDARY_EDGE), HalfEdgeMask.EXTERIOR,
    );
    ck.testExactNumber(connectedComponents.length, 2);
    ck.testExactNumber(connectedComponents[0].length, 3);
    ck.testExactNumber(connectedComponents[0][0].id, 0);
    ck.testExactNumber(connectedComponents[0][1].id, 5);
    ck.testExactNumber(connectedComponents[0][2].id, 9);
    ck.testExactNumber(connectedComponents[1].length, 2);
    ck.testExactNumber(connectedComponents[1][0].id, 10);
    ck.testExactNumber(connectedComponents[1][1].id, 15);
    expect(ck.getNumErrors()).equals(0);
  });
  it("collectConnectedComponentsSimpleMesh", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(1, 1, 0, 0);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(0, 0, 2, 0);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(2, 0, 1, 1);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    const node6 = graph.addEdgeXY(2, 0, 3, 1);
    const node7 = node6.faceSuccessor;
    const node8 = graph.addEdgeXY(3, 1, 1, 1);
    const node9 = node8.faceSuccessor;
    HalfEdge.pinch(node3, node6);
    HalfEdge.pinch(node7, node8);
    HalfEdge.pinch(node5, node9);
    graph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node4.clearMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE);
    node1.setMaskAroundFace(HalfEdgeMask.EXTERIOR);

    const node10 = graph.addEdgeXY(6, 1, 5, 0);
    const node11 = node10.faceSuccessor;
    const node12 = graph.addEdgeXY(5, 0, 7, 0);
    const node13 = node12.faceSuccessor;
    const node14 = graph.addEdgeXY(7, 0, 6, 1);
    const node15 = node14.faceSuccessor;
    HalfEdge.pinch(node11, node12);
    HalfEdge.pinch(node13, node14);
    HalfEdge.pinch(node15, node10);
    node10.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE);
    node11.setMaskAroundFace(HalfEdgeMask.BOUNDARY_EDGE);
    node11.setMaskAroundFace(HalfEdgeMask.EXTERIOR);

    const connectedComponents = HalfEdgeGraphSearch.collectConnectedComponents(graph);
    // note that all exterior nodes are ignored
    ck.testExactNumber(connectedComponents.length, 2);
    ck.testExactNumber(connectedComponents[0].length, 2);
    ck.testExactNumber(connectedComponents[0][0].id, 0);
    ck.testExactNumber(connectedComponents[0][1].id, 5);
    ck.testExactNumber(connectedComponents[1].length, 1);
    ck.testExactNumber(connectedComponents[1][0].id, 10);
    expect(ck.getNumErrors()).equals(0);
  });
  function getSampleMesh(): IndexedPolyface {
    const strokeOptions = new StrokeOptions();
    strokeOptions.maxEdgeLength = 0.1;
    const sampleMesh = Sample.createMeshFromFrankeSurface(100, strokeOptions)!;
    sampleMesh.tryTransformInPlace(Transform.createScaleAboutPoint(Point3d.create(0, 0, 0), 50));
    return sampleMesh;
  }
  it("collectConnectedComponentsComplexMesh", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const meshes: IndexedPolyface[] = [];
    meshes.push(getSampleMesh());
    meshes.push(ImportedSample.createIndexedPolyface("./src/test/testInputs/polyface/mesh7K.imjs")!);
    meshes.push(ImportedSample.createIndexedPolyface("./src/test/testInputs/polyface/mesh10K-2components.imjs")!);
    let xShift = 0;
    let yShift = 0;
    for (const mesh of meshes) {
      if (mesh === undefined)
        ck.testTrue(false, "cannot load the imjs file");
      mesh.data.compress(); // remove degenerate facets that increase collected component fragmentation
      const range = mesh.range();
      yShift = 2 * range.yLength();
      mesh.tryTransformInPlace(Transform.createTranslationXYZ(-range.low.x, -range.low.y, -range.low.z));
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh, xShift, yShift);
      const graph = PolyfaceQuery.convertToHalfEdgeGraph(mesh);
      const maxFaceCount = 1000;
      const components = HalfEdgeGraphSearch.collectConnectedComponents(graph, maxFaceCount);
      for (const component of components) {
        const subMesh = PolyfaceBuilder.graphFacesToPolyface(component);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, subMesh, xShift);
      }
      xShift += 2 * range.xLength();

      GeometryCoreTestIO.saveGeometry(allGeometry, "HalfEdgeGraphSearch", "collectConnectedComponentsComplexMesh");
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("pointInOrOnFaceXY.FaceIsAnEdgePointOn", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(2, 2, 4, 2);
    const position = HalfEdgeGraphSearch.pointInOrOnFaceXY(node0, 3, 2)!;
    ck.testExactNumber(position, 0); // point is on
    expect(ck.getNumErrors()).equals(0);
  });
  it("pointInOrOnFaceXY.FaceIsAnEdgePointOut", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(2, 2, 4, 2);
    const position = HalfEdgeGraphSearch.pointInOrOnFaceXY(node0, 1, 2)!;
    ck.testExactNumber(position, -1); // point is out
    expect(ck.getNumErrors()).equals(0);
  });
  it("pointInOrOnFaceXY.AllPositions", () => {
    const ck = new Checker();
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(1, 4, -1, 3);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(-1, 3, 0, 0);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(0, 0, 3, 0);
    const node5 = node4.faceSuccessor;
    const node6 = graph.addEdgeXY(3, 0, 1, 4);
    const node7 = node6.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node6);
    HalfEdge.pinch(node7, node0);

    let position = HalfEdgeGraphSearch.pointInOrOnFaceXY(node0, 1, 1)!;
    ck.testExactNumber(position, 1); // point is in
    position = HalfEdgeGraphSearch.pointInOrOnFaceXY(node0, 1, 0)!;
    ck.testExactNumber(position, 0); // point is on an edge
    position = HalfEdgeGraphSearch.pointInOrOnFaceXY(node0, 6, 0)!;
    ck.testExactNumber(position, -1); // point is out
    expect(ck.getNumErrors()).equals(0);
  });
  it("collectExtendedBoundaryLoopsInGraph.BoundaryEdge", () => {
    const ck = new Checker();
    // see graph visual at geometry/internaldocs/Graph.md under "Collect Boundary Loops" section.
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(1, 1, 0, 0);
    const node1 = node0.faceSuccessor;
    node1.setMask(HalfEdgeMask.EXTERIOR);
    const node2 = graph.addEdgeXY(0, 0, 2, 0);
    const node3 = node2.faceSuccessor;
    node3.setMask(HalfEdgeMask.EXTERIOR);
    const node4 = graph.addEdgeXY(2, 0, 1, 1);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    const node6 = graph.addEdgeXY(2, 0, 3, 1);
    const node7 = node6.faceSuccessor;
    /**
     * Intentionally commented out the following line to make boundary edges inconsistent
     * (boundary edge should have exterior mask on its outer half edge). This will cover
     * the last break in function HalfEdgeGraphSearch.collectExtendedBoundaryLoopFromSeed.
     * Without that break code would trap in an infinite loop.
    */
    // node7.setMask(HalfEdgeMask.EXTERIOR);
    const node8 = graph.addEdgeXY(3, 1, 1, 1);
    const node9 = node8.faceSuccessor;
    node9.setMask(HalfEdgeMask.EXTERIOR);
    HalfEdge.pinch(node3, node6);
    HalfEdge.pinch(node7, node8);
    HalfEdge.pinch(node5, node9);
    graph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node4.clearMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE);

    let boundaryLoops = HalfEdgeGraphSearch.collectExtendedBoundaryLoopsInGraph(graph, HalfEdgeMask.EXTERIOR);
    ck.testExactNumber(boundaryLoops.length, 2);
    ck.testExactNumber(boundaryLoops[0].length, 2);
    ck.testExactNumber(boundaryLoops[0][0].id, 0);
    ck.testExactNumber(boundaryLoops[0][1].id, 2);
    ck.testExactNumber(boundaryLoops[1].length, 1);
    ck.testExactNumber(boundaryLoops[1][0].id, 8);

    // now set the mask on node7 to make boundary edges consistent
    node7.setMask(HalfEdgeMask.EXTERIOR);
    boundaryLoops = HalfEdgeGraphSearch.collectExtendedBoundaryLoopsInGraph(graph, HalfEdgeMask.EXTERIOR);
    ck.testExactNumber(boundaryLoops.length, 1);
    ck.testExactNumber(boundaryLoops[0].length, 4);
    ck.testExactNumber(boundaryLoops[0][0].id, 0);
    ck.testExactNumber(boundaryLoops[0][1].id, 2);
    ck.testExactNumber(boundaryLoops[0][2].id, 6);
    ck.testExactNumber(boundaryLoops[0][3].id, 8);
    expect(ck.getNumErrors()).equals(0);
  });
  it("HalfEdgeGraphSearch.graphToPolyface", () => {
    const ck = new Checker(true, true);
    const allGeometry: GeometryQuery[] = [];
    const graph = new HalfEdgeGraph();
    const node0 = graph.addEdgeXY(1, 1, 0, 0);
    const node1 = node0.faceSuccessor;
    const node2 = graph.addEdgeXY(0, 0, 2, 0);
    const node3 = node2.faceSuccessor;
    const node4 = graph.addEdgeXY(2, 0, 1, 1);
    const node5 = node4.faceSuccessor;
    HalfEdge.pinch(node1, node2);
    HalfEdge.pinch(node3, node4);
    HalfEdge.pinch(node5, node0);
    const node6 = graph.addEdgeXY(2, 0, 4, 0);
    const node7 = node6.faceSuccessor;
    const node8 = graph.addEdgeXY(4, 0, 3, 1);
    const node9 = node8.faceSuccessor;
    const node10 = graph.addEdgeXY(3, 1, 1, 1);
    const node11 = node10.faceSuccessor;
    HalfEdge.pinch(node3, node6);
    HalfEdge.pinch(node7, node8);
    HalfEdge.pinch(node9, node10);
    HalfEdge.pinch(node5, node11);
    graph.setMask(HalfEdgeMask.BOUNDARY_EDGE);
    node4.clearMaskAroundEdge(HalfEdgeMask.BOUNDARY_EDGE);
    node1.setMaskAroundFace(HalfEdgeMask.EXTERIOR);

    const options = StrokeOptions.createForCurves();
    options.needParams = true;
    options.needColors = false;
    options.needNormals = true;
    const mesh = PolyfaceBuilder.graphToPolyface(graph, options);
    const numGraphPoints = 5;
    ck.testExactNumber(mesh.pointCount, numGraphPoints);
    let numEdgeInFacets = 0;
    for (let i = 0; i < mesh.facetCount; i++)
      numEdgeInFacets += mesh.numEdgeInFacet(i);
    ck.testExactNumber(numEdgeInFacets, mesh.data.normalIndex!.length);
    ck.testExactNumber(numEdgeInFacets, mesh.data.paramIndex!.length);
    ck.testExactNumber(numEdgeInFacets, mesh.data.pointIndex.length);

    GeometryCoreTestIO.captureCloneGeometry(allGeometry, mesh);
    GeometryCoreTestIO.saveGeometry(allGeometry, "HalfEdgeGraphSearch", "graphToPolyface");

    expect(ck.getNumErrors()).equals(0);
  });
});
