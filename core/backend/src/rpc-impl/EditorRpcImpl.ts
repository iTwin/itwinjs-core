/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */
import { RpcInterface, RpcManager, IModelTokenProps, Editor3dRpcInterface, BentleyError, IModelStatus, GeometricElement3dProps } from "@bentley/imodeljs-common";
import { IModelHost } from "../IModelHost";
import { GeometricElement3dEditor } from "../ElementEditor";
import { IModelDb } from "../IModelDb";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { ClientRequestContext, Id64Array, GuidString } from "@bentley/bentleyjs-core";
import { TransformProps, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";

function getEditor(editorId: GuidString): GeometricElement3dEditor {
  const ed = IModelHost.elementEditors.get(editorId);
  if (ed === undefined || !(ed instanceof GeometricElement3dEditor))
    throw new BentleyError(IModelStatus.NotFound);
  return ed;
}

/** @internal */
export class Editor3dRpcImpl extends RpcInterface implements Editor3dRpcInterface {
  public static register() { RpcManager.registerImpl(Editor3dRpcInterface, Editor3dRpcImpl); }

  public async start(tokenProps: IModelTokenProps, editorId: GuidString): Promise<void> {
    const iModelDb = IModelDb.findByKey(tokenProps.key);
    IModelHost.elementEditors.set(editorId, new GeometricElement3dEditor(iModelDb));
  }

  public async end(_tokenProps: IModelTokenProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).end();
    IModelHost.elementEditors.delete(editorId);
  }

  public async writeAllChangesToBriefcase(_tokenProps: IModelTokenProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).writeAllChangesToBriefcase();
  }

  public async startModifyingElements(_tokenProps: IModelTokenProps, editorId: GuidString, elementIds: Id64Array): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return getEditor(editorId).startModifyingElements(requestContext, elementIds);
  }

  public async createElement(_tokenProps: IModelTokenProps, editorId: GuidString, props: GeometricElement3dProps, origin?: Point3d, angles?: YawPitchRollAngles, geometry?: any): Promise<void> {
    getEditor(editorId).createElement(props, origin, angles, geometry);
  }

  public async applyTransform(_tokenProps: IModelTokenProps, editorId: GuidString, transformProps: TransformProps) {
    getEditor(editorId).applyTransform(transformProps);
  }

  public async pushState(_tokenProps: IModelTokenProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).pushState();
  }

  public async popState(_tokenProps: IModelTokenProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).popState();
  }

}
