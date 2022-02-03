/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { AsyncMethodsOf, Id64String, PromiseReturnType } from "@itwin/core-bentley";
import { CompressedId64Set, Id64, OrderedId64Array } from "@itwin/core-bentley";
import type { Transform} from "@itwin/core-geometry";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import type { CodeProps, PhysicalElementProps } from "@itwin/core-common";
import { BisCodeSpec, Code, GeometryStreamBuilder } from "@itwin/core-common";
import type { BriefcaseConnection, IModelConnection} from "@itwin/core-frontend";
import { IpcApp } from "@itwin/core-frontend";
import { EditTools } from "@itwin/editor-frontend";
import type { BasicManipulationCommandIpc} from "@itwin/editor-common";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import type { FullStackTestIpc } from "../common/FullStackTestIpc";
import { fullstackIpcChannel } from "../common/FullStackTestIpc";

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

export async function makeCode(iModel: IModelConnection, specName: string, scope: Id64String, value: string): Promise<CodeProps> {
  const modelCodeSpec = await iModel.codeSpecs.getByName(specName);
  return { scope, spec: modelCodeSpec.id, value };
}

export async function makeModelCode(iModel: IModelConnection, scope: Id64String, value: string): Promise<CodeProps> {
  return makeCode(iModel, BisCodeSpec.informationPartitionElement, scope, value);
}

export async function callFullStackTestIpc<T extends AsyncMethodsOf<FullStackTestIpc>>(methodName: T, ...args: Parameters<FullStackTestIpc[T]>) {
  return IpcApp.callIpcChannel(fullstackIpcChannel, methodName, ...args) as PromiseReturnType<FullStackTestIpc[T]>;
}

