/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// WARNING: This barrel file exports internal APIs only for use by `@itwin/presentation-backend` and `@itwin/presentation-frontend` packages.
// They should not be used outside of these packages. These APIs may be broken or removed at any time without notice.

export { PRESENTATION_IPC_CHANNEL_NAME, PresentationIpcEvents, PresentationIpcInterface } from "./presentation-common/PresentationIpcInterface.js";
export { combineDiagnosticsSeverities, compareDiagnosticsSeverities } from "./presentation-common/Diagnostics.js";
export { createElementPropertiesBuilder } from "./presentation-common/ElementProperties.js";
export { createCancellableTimeoutPromise, deepReplaceNullsToUndefined } from "./presentation-common/Utils.js";
export { LocalizationHelper } from "./presentation-common/LocalizationHelper.js";
export { isSingleElementPropertiesRequestOptions } from "./presentation-common/PresentationManagerOptions.js";
export { RpcRequestsHandler } from "./presentation-common/RpcRequestsHandler.js";
export { AsyncTasksTracker } from "./presentation-common/AsyncTasks.js";
