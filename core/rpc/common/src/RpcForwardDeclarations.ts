/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/**
 * @internal
 */
export interface IModelRpcProps {
    readonly iTwinId?: string;
    readonly iModelId?: string;
    readonly changeset?: { readonly index?: number, readonly id: string };
    readonly key: string;
}
