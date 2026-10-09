/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback as registerCertaBackendCallbackImpl } from "@itwin/certa/lib/utils/CallbackUtils";

export type RegisterBackendCallback = (name: string, callback: (...args: any[]) => any) => void;

export const registerCertaBackendCallback: RegisterBackendCallback = registerCertaBackendCallbackImpl;
