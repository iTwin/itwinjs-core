/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RpcInterface
 */

import { ClientRequestContext, GuidString, Id64Array, IModelStatus } from "@bentley/bentleyjs-core";
import { Point3d, TransformProps, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  BentleyError, Editor3dRpcInterface, Editor3dRpcInterfaceWriteOptions, GeometricElement3dProps, IModelRpcProps, RpcInterface, RpcManager,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { GeometricElement3dEditor } from "../ElementEditor";
import { IModelDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";

/* eslint-disable deprecation/deprecation */

function getEditor(editorId: GuidString): GeometricElement3dEditor {
  const ed = IModelHost.elementEditors.get(editorId);
  if (ed === undefined || !(ed instanceof GeometricElement3dEditor))
    throw new BentleyError(IModelStatus.NotFound);
  return ed;
}

/** @internal */
export class Editor3dRpcImpl extends RpcInterface implements Editor3dRpcInterface {
  public static register() { RpcManager.registerImpl(Editor3dRpcInterface, Editor3dRpcImpl); }

  public async start(tokenProps: IModelRpcProps, editorId: GuidString): Promise<void> {
    const iModelDb = IModelDb.findByKey(tokenProps.key);
    IModelHost.elementEditors.set(editorId, new GeometricElement3dEditor(iModelDb));
  }

  public async end(_tokenProps: IModelRpcProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).end();
    IModelHost.elementEditors.delete(editorId);
  }

  public async writeAllChangesToBriefcase(_tokenProps: IModelRpcProps, editorId: GuidString, opts: Editor3dRpcInterfaceWriteOptions): Promise<GeometricElement3dProps[] | Id64Array | void> {
    return getEditor(editorId).writeAllChangesToBriefcase(opts);
  }

  public async startModifyingElements(_tokenProps: IModelRpcProps, editorId: GuidString, elementIds: Id64Array): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return getEditor(editorId).startModifyingElements(requestContext, elementIds);
  }

  public async createElement(_tokenProps: IModelRpcProps, editorId: GuidString, props: GeometricElement3dProps, origin?: Point3d, angles?: YawPitchRollAngles, geometry?: any): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return getEditor(editorId).createElement(requestContext, props, origin, angles, geometry);
  }

  public async applyTransform(_tokenProps: IModelRpcProps, editorId: GuidString, transformProps: TransformProps) {
    getEditor(editorId).applyTransform(transformProps);
  }

  public async pushState(_tokenProps: IModelRpcProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).pushState();
  }

  public async popState(_tokenProps: IModelRpcProps, editorId: GuidString): Promise<void> {
    getEditor(editorId).popState();
  }

}
