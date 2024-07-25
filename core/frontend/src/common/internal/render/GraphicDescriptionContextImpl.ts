/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { TransientIdSequence, TransientIdSequenceProps } from "@itwin/core-bentley";
import { _implementationProhibited } from "../Symbols";
import { GraphicDescriptionContextProps, WorkerGraphicDescriptionContext, WorkerGraphicDescriptionContextProps } from "../../render/GraphicDescriptionContext";

/** As part of a [[WorkerGraphicDescriptionContext]], describes constraints imposed by the [[RenderSystem]] that a [[GraphicDescriptionBuilder]] needs to know about
 * when creating a [[GraphicDescription]].
 */
export interface GraphicDescriptionConstraints {
  /** @internal */
  readonly [_implementationProhibited]: unknown;
  /** The maximum dimension (width or height) permitted for a single WebGL texture. */
  readonly maxTextureSize: number;
}

export interface WorkerGraphicDescriptionContextPropsImpl extends WorkerGraphicDescriptionContextProps {
  readonly constraints: GraphicDescriptionConstraints;
  readonly transientIds: TransientIdSequenceProps;
}

export interface GraphicDescriptionContextPropsImpl extends GraphicDescriptionContextProps {
  readonly transientIds: TransientIdSequenceProps;
  /** This is set to true the first time we use RenderSystem.createGraphicDescriptionContext on it.
   * That prevents us from remapping transient Ids to different transient Ids, recreating duplicate textures+materials, etc if
   * somebody tries to resolve the same props more than once.
   * We will throw if somebody tries to re-resolve a GraphicDescriptionContextPropsImpl.
   */
  resolved?: boolean;
}

export class WorkerGraphicDescriptionContextImpl implements WorkerGraphicDescriptionContext {
  public readonly [_implementationProhibited] = undefined;
  public readonly constraints: GraphicDescriptionConstraints;
  public readonly transientIds: TransientIdSequence;

  public constructor(props: WorkerGraphicDescriptionContextProps) {
    const propsImpl = props as WorkerGraphicDescriptionContextPropsImpl;
    if (typeof propsImpl.transientIds !== "object" || typeof propsImpl.constraints !== "object") {
      throw new Error("Invalid WorkerGraphicDescriptionContextProps");
    }

    this.constraints = propsImpl.constraints;
    this.transientIds = TransientIdSequence.fromJSON(propsImpl.transientIds);
  }

  public toProps(_transferables: Set<Transferable>): GraphicDescriptionContextPropsImpl {
    // We don't yet have any transferable objects. In the future we expect to support transferring texture image data for textures created on the worker thread.
    return {
      [_implementationProhibited]: undefined,
      transientIds: this.transientIds.toJSON(),
    };
  }
}

