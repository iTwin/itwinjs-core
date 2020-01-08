/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Signature for number onCommit function.
 * @beta
 */
export type OnNumberCommitFunc = (value: number) => void;

/** Signature for onCancel function.
 * @beta
 */
export type OnCancelFunc = () => void;

/** Signature for onItemExecuted function.
 * @beta
 */
export type OnItemExecutedFunc = (item: any) => void;
