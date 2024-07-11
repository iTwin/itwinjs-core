/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AnyCurvePrimitive, Box, Path, Point3d, Range3d } from "@itwin/core-geometry";
import { GraphicAssembler } from "../render/GraphicAssembler";
import { GraphicPrimitive } from "../render/GraphicPrimitive";
import { ColorDef, Frustum, GraphicParams, LinePixels, Npc } from "@itwin/core-common";

export function addCurvePrimitive(gf: GraphicAssembler, curve: AnyCurvePrimitive): void {
  switch (curve.curvePrimitiveType) {
    case "lineString":
      gf.addLineString(curve.points);
      break;
    case "lineSegment":
      gf.addLineString([curve.startPoint(), curve.endPoint()]);
      break;
    case "arc":
      gf.addArc(curve, false, false);
      break;
    default:
      const path = new Path();
      if (path.tryAddChild(curve))
        gf.addPath(path);

      break;
  }
}

export function addGraphicPrimitive(gf: GraphicAssembler, primitive: GraphicPrimitive): void {
  switch (primitive.type) {
    case "linestring":
      gf.addLineString(primitive.points);
      break;
    case "linestring2d":
      gf.addLineString2d(primitive.points, primitive.zDepth);
      break;
    case "pointstring":
      gf.addPointString(primitive.points);
      break;
    case "pointstring2d":
      gf.addPointString2d(primitive.points, primitive.zDepth);
      break;
    case "shape":
      gf.addShape(primitive.points);
      break;
    case "shape2d":
      gf.addShape2d(primitive.points, primitive.zDepth);
      break;
    case "arc":
      gf.addArc(primitive.arc, true === primitive.isEllipse, true === primitive.filled);
      break;
    case "arc2d":
      gf.addArc2d(primitive.arc, true === primitive.isEllipse, true === primitive.filled, primitive.zDepth);
      break;
    case "path":
      gf.addPath(primitive.path);
      break;
    case "loop":
      gf.addLoop(primitive.loop);
      break;
    case "polyface":
      gf.addPolyface(primitive.polyface, true === primitive.filled);
      break;
    case "solidPrimitive":
      gf.addSolidPrimitive(primitive.solidPrimitive);
      break;
  }
}

export function addRangeBox(gf: GraphicAssembler, range: Range3d, solid = false): void {
  if (!solid) {
    gf.addFrustum(Frustum.fromRange(range));
    return;
  }

  const box = Box.createRange(range, true);
  if (box) {
    gf.addSolidPrimitive(box);
  }
}

export function addFrustum(gf: GraphicAssembler, frustum: Frustum): void {
  addRangeBoxFromCorners(gf, frustum.points);
}

export function addFrustumSides(gf: GraphicAssembler, frustum: Frustum): void {
  addRangeBoxSidesFromCorners(gf, frustum.points);
}

export function addRangeBoxFromCorners(gf: GraphicAssembler, p: Point3d[]): void {
  gf.addLineString([
    p[Npc.LeftBottomFront],
    p[Npc.LeftTopFront],
    p[Npc.RightTopFront],
    p[Npc.RightBottomFront],
    p[Npc.RightBottomRear],
    p[Npc.RightTopRear],
    p[Npc.LeftTopRear],
    p[Npc.LeftBottomRear],
    p[Npc.LeftBottomFront].clone(),
    p[Npc.RightBottomFront].clone(),
  ]);

  gf.addLineString([p[Npc.LeftTopFront].clone(), p[Npc.LeftTopRear].clone()]);
  gf.addLineString([p[Npc.RightTopFront].clone(), p[Npc.RightTopRear].clone()]);
  gf.addLineString([p[Npc.LeftBottomRear].clone(), p[Npc.RightBottomRear].clone()]);
}

export function addRangeBoxSidesFromCorners(gf: GraphicAssembler, p: Point3d[]): void {
  gf.addShape([
    p[Npc.LeftBottomFront].clone(),
    p[Npc.LeftTopFront].clone(),
    p[Npc.RightTopFront].clone(),
    p[Npc.RightBottomFront].clone(),
    p[Npc.LeftBottomFront].clone()]);
  gf.addShape([
    p[Npc.RightTopRear].clone(),
    p[Npc.LeftTopRear].clone(),
    p[Npc.LeftBottomRear].clone(),
    p[Npc.RightBottomRear].clone(),
    p[Npc.RightTopRear].clone()]);
  gf.addShape([
    p[Npc.RightTopRear].clone(),
    p[Npc.LeftTopRear].clone(),
    p[Npc.LeftTopFront].clone(),
    p[Npc.RightTopFront].clone(),
    p[Npc.RightTopRear].clone()]);
  gf.addShape([
    p[Npc.RightTopRear].clone(),
    p[Npc.RightBottomRear].clone(),
    p[Npc.RightBottomFront].clone(),
    p[Npc.RightTopFront].clone(),
    p[Npc.RightTopRear].clone()]);
  gf.addShape([
    p[Npc.LeftBottomRear].clone(),
    p[Npc.RightBottomRear].clone(),
    p[Npc.RightBottomFront].clone(),
    p[Npc.LeftBottomFront].clone(),
    p[Npc.LeftBottomRear].clone()]);
  gf.addShape([
    p[Npc.LeftBottomRear].clone(),
    p[Npc.LeftTopRear].clone(),
    p[Npc.LeftTopFront].clone(),
    p[Npc.LeftBottomFront].clone(),
    p[Npc.LeftBottomRear].clone()]);
}

export function setSymbology(gf: GraphicAssembler, lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid): void {
  gf.activateGraphicParams(GraphicParams.fromSymbology(lineColor, fillColor, lineWidth, linePixels));
}

export function setBlankingFill(gf: GraphicAssembler, fillColor: ColorDef): void {
  gf.activateGraphicParams(GraphicParams.fromBlankingFill(fillColor));
}
