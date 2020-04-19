/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelConnection */

import { IModelError, Editor3dRpcInterface, GeometricElement3dProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { OpenMode, IModelStatus, Logger, Id64Array, GuidString, Guid } from "@bentley/bentleyjs-core";
import { Point3d, YawPitchRollAngles, TransformProps } from "@bentley/geometry-core";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";

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
    this._rpc.pushState(this.iModelConnection.getRpcProps(), this._guid);
  }

  /**
   * Restore the back-up copy (in memory) of all elements that were previously backed up by calling pushState.
   * @alpha
   */
  public async popState(): Promise<void> {
    this._mustBeOpen();
    this._rpc.popState(this.iModelConnection.getRpcProps(), this._guid);
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
   * Write all modifications and inserts to the local briefcase.
   * @alpha
   */
  public async write(): Promise<void> {
    this._mustBeOpen();
    return this._rpc.writeAllChangesToBriefcase(this.iModelConnection.getRpcProps(), this._guid);
  }
}
