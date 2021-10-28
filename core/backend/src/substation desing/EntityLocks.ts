/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthStatus, ClientRequestContext, DbOpcode } from "@bentley/bentleyjs-core";
import { ConcurrencyControl, IModelDb } from "../imodeljs-backend";
import { CodeProps, ElementProps, IModelError, ModelProps } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";

/**
 * Request locks for given elements by sending a request to iModelHub. This method will request all needed resources to perform
 * the given operation (see opcode), e.g. will request needed locks, reserve Codes, etc.
 * This method results in no-op if given iModel is not a Briefcase or has [[ConcurrencyControl.OptimisticPolicy]] concurrency policy set.
 * This method will also result in no-op if all needed resources are already acquired and cached in the current session/context.
 * @param context Current request context used to track activities, in case where a lock will be requested,
 * passed in clientRequestContext should be an instance of [[AuthorizedClientRequestContext]].
 * @param iModel Active iModel in whose context the lock will be requested.
 * @param opcode Operation that will be performed on the elements after locks are acquired.
 * @param elements List of Elements for which the lock will be requested.
 */
export async function lockElements(context: ClientRequestContext, iModel: IModelDb, opcode: DbOpcode, elements: ElementProps[]): Promise<void> {
  context.enter();

  if (iModel.isBriefcaseDb() && iModel.concurrencyControl.getPolicy() instanceof ConcurrencyControl.PessimisticPolicy
    && !iModel.concurrencyControl.isBulkMode) {
    if (!(context instanceof AuthorizedClientRequestContext))
      throw new IModelError(AuthStatus.Error, "Failed to acquire a locks for given Entities - client request context is not authorized.");

    const elementsToLock = elements.map<ConcurrencyControl.ElementAndOpcode>((element: ElementProps) => ({ element, opcode }));
    await iModel.concurrencyControl.requestResources(context, elementsToLock);
    context.enter();
  }
}

/**
 * Request locks for given models by sending a request to iModelHub. This method will request all needed resources to perform
 * the given operation (see opcode), e.g. will request needed locks, reserve Codes, etc.
 * This method results in no-op if given iModel is not a Briefcase or has [[ConcurrencyControl.OptimisticPolicy]] concurrency policy set.
 * This method will also result in no-op if all needed resources are already acquired and cached in the current session/context.
 * @param context Current request context used to track activities, in case where a lock will be requested,
 * passed in clientRequestContext should be an instance of [[AuthorizedClientRequestContext]].
 * @param iModel Active iModel in whose context the lock will be requested.
 * @param opcode Operation that will be performed on the models after locks are acquired.
 * @param models List of Models for which the lock will be requested.
 */
export async function lockModels(context: ClientRequestContext, iModel: IModelDb, opcode: DbOpcode, models: ModelProps[]): Promise<void> {
  context.enter();

  if (iModel.isBriefcaseDb() && iModel.concurrencyControl.getPolicy() instanceof ConcurrencyControl.PessimisticPolicy
    && !iModel.concurrencyControl.isBulkMode) {
    if (!(context instanceof AuthorizedClientRequestContext))
      throw new IModelError(AuthStatus.Error, "Failed to acquire a locks for given Models - client request context is not authorized.");

    const modelsToLock = models.map<ConcurrencyControl.ModelAndOpcode>((model: ModelProps) => ({ model, opcode }));
    await iModel.concurrencyControl.requestResources(context, [], modelsToLock);
  }
}

/**
 * Reserve given Codes by sending a request to iModelHub.
 * This method results in no-op if given iModel is not a Briefcase or has [[ConcurrencyControl.OptimisticPolicy]] concurrency policy set.
 * This method will also result in no-op if given codes are already reserved and cached in the current session/context.
 * @param context Current request context used to track activities, in case where a lock will be requested,
 * passed in clientRequestContext should be an instance of [[AuthorizedClientRequestContext]].
 * @param iModel Active iModel in whose context the Codes will be reserved.
 * @param codes Array of Codes to reserve.
 */
export async function reserveCodes(context: ClientRequestContext, iModel: IModelDb, codes: CodeProps[]): Promise<void> {
  context.enter();

  if (iModel.isBriefcaseDb() && iModel.concurrencyControl.getPolicy() instanceof ConcurrencyControl.PessimisticPolicy
    && !iModel.concurrencyControl.isBulkMode) {
    if (!(context instanceof AuthorizedClientRequestContext))
      throw new IModelError(AuthStatus.Error, "Failed to reserve given Codes - client request context is not authorized.");

    await iModel.concurrencyControl.codes.reserve(context, codes);
  }
}
