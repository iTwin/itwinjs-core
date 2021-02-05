/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { Guid, GuidString, Id64Array, IModelStatus, Logger, OpenMode } from "@bentley/bentleyjs-core";
import { Point3d, TransformProps, YawPitchRollAngles } from "@bentley/geometry-core";
import { Editor3dRpcInterface, Editor3dRpcInterfaceWriteOptions, Editor3dRpcInterfaceWriteReturnType, GeometricElement3dProps, IModelError } from "@bentley/imodeljs-common";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelConnection } from "./IModelConnection";

/* eslint-disable deprecation/deprecation */

const LOGGING_CATEGORY = FrontendLoggerCategory.EditorConnection;

/**
 * Helps with creating and modifying 3D elements.
 * @alpha
 */
export class ElementEditor3d {
  public readonly iModelConnection: IModelConnection;
  private _isOpen: boolean;
  private _rpc: Editor3dRpcInterface;
  private _guid: GuidString;

  private constructor(c: IModelConnection) {
    this.iModelConnection = c;
    this._isOpen = true;
    this._rpc = Editor3dRpcInterface.getClient();
    this._guid = Guid.createValue().toString();
  }

  /**
   * Begin editing models and elements in the specified iModel.
   * @param iModelConnection The iModel to edit.
   * @throws IModelError if the iModel is not open for reading and writing.
   * @alpha
   */
  public static async start(iModelConnection: IModelConnection): Promise<ElementEditor3d> {
    if (!iModelConnection.isOpen || iModelConnection.openMode !== OpenMode.ReadWrite) {
      throw new IModelError(IModelStatus.NotOpenForWrite, "", Logger.logError, LOGGING_CATEGORY);
    }
    const c = new ElementEditor3d(iModelConnection);
    await Editor3dRpcInterface.getClient().start(c.iModelConnection.getRpcProps(), c._guid);
    return c;
  }

  private _mustBeOpen() {
    if (!this._isOpen)
      throw new IModelError(IModelStatus.NotOpen, "", Logger.logError, LOGGING_CATEGORY);
  }

  /**
   * May be called after close to re-start an editing session.
   * @alpha
   */
  public async restart(): Promise<void> {
    if (this._isOpen)
      throw new IModelError(IModelStatus.AlreadyOpen, "", Logger.logError, LOGGING_CATEGORY);
    await Editor3dRpcInterface.getClient().start(this.iModelConnection.getRpcProps(), this._guid);
    this._isOpen = true;
  }

  /**
   * Stop editing an iModel.
   * @alpha
   */
  public async end(): Promise<void> {
    this._mustBeOpen();
    return Editor3dRpcInterface.getClient().end(this.iModelConnection.getRpcProps(), this._guid);
  }

  /**
   * Make a back-up copy (in memory) of all elements in the queue.
   * @alpha
   */
  public async pushState(): Promise<void> {
    this._mustBeOpen();
    await this._rpc.pushState(this.iModelConnection.getRpcProps(), this._guid);
  }

  /**
   * Restore the back-up copy (in memory) of all elements that were previously backed up by calling pushState.
   * @alpha
   */
  public async popState(): Promise<void> {
    this._mustBeOpen();
    await this._rpc.popState(this.iModelConnection.getRpcProps(), this._guid);
  }

  /**
   * Add the specified elements to the queue. Call this once before modifying the specified elements.
   * @alpha
   */
  public async startModifyingElements(elementIds: Id64Array): Promise<void> {
    this._mustBeOpen();
    return this._rpc.startModifyingElements(this.iModelConnection.getRpcProps(), this._guid, elementIds);
  }

  /**
   * Transform all elements in the queue.
   * @alpha
   */
  public async applyTransform(tprops: TransformProps) {
    this._mustBeOpen();
    return this._rpc.applyTransform(this.iModelConnection.getRpcProps(), this._guid, tprops);
  }

  /**
   * Add a new 3D element to the queue.
   * @alpha
   */
  public async createElement(props: GeometricElement3dProps, origin?: Point3d, angles?: YawPitchRollAngles, geometry?: any): Promise<void> {
    this._mustBeOpen();
    return this._rpc.createElement(this.iModelConnection.getRpcProps(), this._guid, props, origin, angles, geometry);
  }

  /**
   * Write all queued modifications and inserts to the local briefcase.
   * @param opts  Optional. Allows you to specified what information, if any, about the elements as written you want to get back in the return value. The default is nothing (void).
   * @alpha
   */
  public async write(opts?: Editor3dRpcInterfaceWriteOptions): Promise<GeometricElement3dProps[] | Id64Array | void> {
    this._mustBeOpen();
    return this._rpc.writeAllChangesToBriefcase(this.iModelConnection.getRpcProps(), this._guid, opts || {});
  }

  /**
   * Write all queued modifications and inserts to the local briefcase and return the GeometricElement3dProps for the written elements.
   * @param wantGeom   Optional. Do you want to returned props to include the elements' geometry? The default is to omit the geometry (which can require a lot of memory).
   * @alpha
   */
  public async writeReturningProps(wantGeom?: boolean): Promise<GeometricElement3dProps[]> {
    this._mustBeOpen();
    const opts: Editor3dRpcInterfaceWriteOptions = { returnType: Editor3dRpcInterfaceWriteReturnType.Props, returnPropsOptions: { geometry: wantGeom } };
    return this.write(opts) as Promise<GeometricElement3dProps[]>;
  }

  /**
   * Write all queued modifications and inserts to the local briefcase and return the ElementIds for the written elements.
   * @alpha
   */
  public async writeReturningIds(): Promise<Id64Array> {
    this._mustBeOpen();
    const opts: Editor3dRpcInterfaceWriteOptions = { returnType: Editor3dRpcInterfaceWriteReturnType.Ids };
    return this.write(opts) as Promise<Id64Array>;
  }
}
