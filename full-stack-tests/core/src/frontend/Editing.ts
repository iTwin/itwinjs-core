/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CompressedId64Set, Id64, Id64String, OrderedId64Array } from "@itwin/core-bentley";
import { BisCodeSpec, Code, CodeProps, ColorDef, GeometryParams, GeometryStreamBuilder, PhysicalElementProps } from "@itwin/core-common";
import { BriefcaseConnection, IModelConnection, IpcApp } from "@itwin/core-frontend";
import { LineSegment3d, LineString3d, Point3d, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import { basicManipulationIpc, EditTools, makeEditToolIpc } from "@itwin/editor-frontend";
import { fullstackIpcChannel, fullStackTestCommandId, FullStackTestCommandIpc, FullStackTestIpc } from "../common/FullStackTestIpc";

const fullStackTestIpc = makeEditToolIpc<FullStackTestCommandIpc>();

/** Reuse the active full-stack command only when it is still bound to the same iModel.
 * The frontend test helpers do not own the full lifecycle of the backend EditCommand: tool cleanup,
 * explicit finish calls, or another test helper starting a command for a different iModel can all
 * replace the active command between calls. `ping()` lets us verify the backend's current state
 * directly, and the `iModelKey` check prevents reusing a valid full-stack command that belongs to
 * some other connection.
 */
async function ensureFullStackCommand(key: string): Promise<void> {
  try {
    const status = await fullStackTestIpc.ping();
    if (status.commandId === fullStackTestCommandId && status.iModelKey === key)
      return;
  } catch {
    // No active full-stack command; start one below.
  }

  await EditTools.startCommand<string>({ commandId: fullStackTestCommandId, iModelKey: key });
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
  line = line ?? makeLineSegment();
  const origin = line.point0Ref;
  const angles = new YawPitchRollAngles();

  const builder = new GeometryStreamBuilder();
  builder.setLocalToWorld3d(origin, angles); // Establish world to local transform...
  if (!builder.appendGeometry(line))
    return Id64.invalid;

  const elemProps: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement: { origin, angles }, geom: builder.geometryStream };

  await ensureFullStackCommand(imodel.key);
  return basicManipulationIpc.insertGeometricElement(elemProps);
}

export async function insertLineStringElement(imodel: BriefcaseConnection, lineString: { model: Id64String, category: Id64String, points: Point3d[], color?: ColorDef }): Promise<Id64String> {
  const builder = new GeometryStreamBuilder();
  const origin = lineString.points[0] ?? new Point3d();
  const angles = new YawPitchRollAngles();
  builder.setLocalToWorld3d(origin, angles);

  if (lineString.color) {
    const params = new GeometryParams(lineString.category);
    params.lineColor = lineString.color;
    builder.appendGeometryParamsChange(params);
  }

  if (!builder.appendGeometry(LineString3d.createPoints(lineString.points)))
    return Id64.invalid;

  const elemProps: PhysicalElementProps = {
    classFullName: "Generic:PhysicalObject",
    model: lineString.model,
    category: lineString.category,
    code: Code.createEmpty(),
    placement: { origin, angles },
    geom: builder.geometryStream,
  };

  await ensureFullStackCommand(imodel.key);
  return basicManipulationIpc.insertGeometricElement(elemProps);
}

export async function transformElements(imodel: BriefcaseConnection, ids: string[], transform: Transform) {
  await ensureFullStackCommand(imodel.key);
  await basicManipulationIpc.transformPlacement(compressIds(ids), transform.toJSON());
}

export async function deleteElements(imodel: BriefcaseConnection, ids: string[]) {
  await ensureFullStackCommand(imodel.key);
  return basicManipulationIpc.deleteElements(compressIds(ids));
}

export async function addAllowedChannel(imodel: BriefcaseConnection, channelKey: string) {
  await ensureFullStackCommand(imodel.key);
  return basicManipulationIpc.addAllowedChannel(channelKey);
}

export async function removeAllowedChannel(imodel: BriefcaseConnection, channelKey: string) {
  await ensureFullStackCommand(imodel.key);
  return basicManipulationIpc.removeAllowedChannel(channelKey);
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

export const coreFullStackTestIpc = IpcApp.makeIpcProxy<FullStackTestIpc>(fullstackIpcChannel);

export const coreFullStackTestCommandIpc: FullStackTestCommandIpc = {
  ping: async () => fullStackTestIpc.ping(),
  createAndInsertPhysicalModel: async (key, newModelCode) => {
    await ensureFullStackCommand(key);
    return fullStackTestIpc.createAndInsertPhysicalModel(key, newModelCode);
  },
  createAndInsertSpatialCategory: async (key, scopeModelId, categoryName, appearance) => {
    await ensureFullStackCommand(key);
    return fullStackTestIpc.createAndInsertSpatialCategory(key, scopeModelId, categoryName, appearance);
  },
  insertElement: async (iModelKey, props) => {
    await ensureFullStackCommand(iModelKey);
    return fullStackTestIpc.insertElement(iModelKey, props);
  },
  updateElement: async (iModelKey, props) => {
    await ensureFullStackCommand(iModelKey);
    return fullStackTestIpc.updateElement(iModelKey, props);
  },
  deleteDefinitionElements: async (iModelKey, ids) => {
    await ensureFullStackCommand(iModelKey);
    return fullStackTestIpc.deleteDefinitionElements(iModelKey, ids);
  },
  saveChangesAndReturnProps: async (iModelKey, propertyName, description) => {
    await ensureFullStackCommand(iModelKey);
    return fullStackTestIpc.saveChangesAndReturnProps(iModelKey, propertyName, description);
  },
  endEditsAndReturnProps: async (iModelKey, propertyName, description) => {
    await ensureFullStackCommand(iModelKey);
    return fullStackTestIpc.endEditsAndReturnProps(iModelKey, propertyName, description);
  },
  saveChanges: async (description) => {
    await fullStackTestIpc.saveChanges(description);
  },
  abandonChanges: async () => {
    await fullStackTestIpc.abandonChanges();
  },
};

/** Save pending changes on the active EditCommand for the given iModel.
 * We revalidate the command first because the previously-active command may have been finished
 * independently of this helper.
 */
export async function saveBriefcaseChanges(_imodel: BriefcaseConnection, description?: string): Promise<void> {
  await ensureFullStackCommand(_imodel.key);
  await coreFullStackTestCommandIpc.saveChanges(description);
}

/** Abandon pending changes on the active EditCommand for the given iModel.
 * We revalidate the command first because the previously-active command may have been finished
 * independently of this helper.
 */
export async function abandonBriefcaseChanges(_imodel: BriefcaseConnection): Promise<void> {
  await ensureFullStackCommand(_imodel.key);
  await coreFullStackTestCommandIpc.abandonChanges();
}
