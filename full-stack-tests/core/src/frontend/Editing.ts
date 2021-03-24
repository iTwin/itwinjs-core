/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, Id64, Id64String, OrderedId64Array } from "@bentley/bentleyjs-core";
import { LineSegment3d, Point3d, Transform, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, GeometryStreamBuilder, PhysicalElementProps } from "@bentley/imodeljs-common";
import { BriefcaseConnection } from "@bentley/imodeljs-frontend";
import { EditTools } from "@bentley/imodeljs-editor-frontend";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";

async function startCommand(imodel: BriefcaseConnection): Promise<string> {
  return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, imodel.key);
}

function callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
  return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
}

function orderIds(elementIds: string[]): OrderedId64Array {
  const ids = new OrderedId64Array();
  elementIds.forEach((id) => ids.insert(id));
  return ids;
}

function compressIds(elementIds: string[]): CompressedId64Set {
  const ids = orderIds(elementIds);
  return CompressedId64Set.compressIds(ids);
}

export function makeLineSegment(p1?: Point3d, p2?: Point3d): LineSegment3d {
  return LineSegment3d.create(p1 || new Point3d(0, 0, 0), p2 || new Point3d(1, 1, 0));
}

export async function insertLineElement(imodel: BriefcaseConnection, model: Id64String, category: Id64String, line?: LineSegment3d): Promise<Id64String> {
  await startCommand(imodel);

  line = line ?? makeLineSegment();
  const origin = line.point0Ref;
  const angles = new YawPitchRollAngles();

  const builder = new GeometryStreamBuilder();
  builder.setLocalToWorld3d(origin, angles); // Establish world to local transform...
  if (!builder.appendGeometry(line))
    return Id64.invalid;

  const elemProps: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement: { origin, angles }, geom: builder.geometryStream };
  return callCommand("insertGeometricElement", elemProps);
}

export async function transformElements(imodel: BriefcaseConnection, ids: string[], transform: Transform) {
  await startCommand(imodel);
  await callCommand("transformPlacement", compressIds(ids), transform.toJSON());
}

export async function deleteElements(imodel: BriefcaseConnection, ids: string[]) {
  await startCommand(imodel);
  return callCommand("deleteElements", compressIds(ids));
}

export async function initializeEditTools(): Promise<void> {
  return EditTools.initialize();
}
