/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { Guid, GuidString, Id64 } from "@itwin/core-bentley";
import { Code, ElementReservationError } from "@itwin/core-common";
import { OnElementPropsArg } from "../Element";
import { IModelDb, InsertElementOptions } from "../IModelDb";
import { SynchronousChannel } from "../SynchronousChannel";
import { SchemaSync } from "../SchemaSync";
import { _close, _implementationProhibited, _nativeDb, _onReservedElementInsert } from "./Symbols";
import { Category } from "../Category";

class SchemaSyncReservations implements SynchronousChannel.Reservations {
  public readonly [_implementationProhibited] = undefined;
  public get isServerBased() { return true; }
  private readonly _iModel: IModelDb;
  private readonly _schemaSync: SchemaSync.CloudAccess;
  private _isClosed = false;

  private constructor(iModel: IModelDb, schemaSync: SchemaSync.CloudAccess) {
    this._iModel = iModel;
    this._schemaSync = schemaSync;
  }

  public static async create(iModel: IModelDb): Promise<SchemaSyncReservations> {
    const schemaSync = await SchemaSync.getCloudAccess(iModel);
    try {
      schemaSync.synchronizeWithCloud();
      return new SchemaSyncReservations(iModel, schemaSync);
    } catch (error) {
      SchemaSync.releaseCloudAccess(schemaSync);
      throw error;
    }
  }

  public [_close](): void {
    if (this._isClosed)
      return;

    this._isClosed = true;
    try {
      SchemaSync.releaseCloudAccess(this._schemaSync);
    } catch {
      // best-effort cleanup; never throw out of close hooks
    }
  }

  public needsElementReservation(federationGuid: GuidString): boolean {
    if (!SchemaSync.isEnabled(this._iModel))
      return false;

    if (!Guid.isGuid(federationGuid))
      ElementReservationError.throwError("invalid-reservation", { message: "Invalid federationGuid" });

    return !this._schemaSync.reader.findReservedElement(federationGuid);
  }

  public async reserveElements(args: SynchronousChannel.ReserveElementsArgs): Promise<void> {
    const validated = this.validateProposedReservations(args);
    await this._schemaSync.writeLocker.reserveElements(validated);
  }

  public [_onReservedElementInsert](arg: OnElementPropsArg): void {
    if (!SchemaSync.isEnabled(arg.iModel) || arg.iModel.holdsSchemaLock)
      return;

    const fedGuid = arg.props.federationGuid;
    // The hook is only invoked for elements with an explicitly-set federationGuid (gated in Element.onInsert),
    // but validate defensively.
    if (fedGuid === undefined || !Guid.isGuid(fedGuid))
      ElementReservationError.throwError("invalid-reservation", { message: "Element inserts require a valid federationGuid when SchemaSync is enabled" });

    // It should be impossible for us to still have local changes, but check just in case,
    // since we can't trust the contents of the SchemaSyncDb until they've been successfully pushed.
    if (this._schemaSync.container.hasLocalChanges)
      ElementReservationError.throwError("container-has-local-changes", { message: "Element inserts are not allowed when there are local changes in the SchemaSync container" });

    const code = Code.fromJSON(arg.props.code);

    const existing = this._schemaSync.reader.findReservedElement(fedGuid);
    if (!existing) {
      ElementReservationError.throwError("reservation-not-found", {
        message: `No SchemaSync reservation found for element with federationGuid ${fedGuid} — include it in a SynchronousChannel.Reservations.reserveElements call before inserting`,
        federationGuid: fedGuid,
      });
    }

    const expectedClassId = arg.iModel[_nativeDb].classNameToId(arg.props.classFullName);
    if (existing.ecClassId !== expectedClassId) {
      ElementReservationError.throwError("reservation-conflict", {
        message: `Element ${existing.federationGuid} reserved as a different class than the insert (${existing.ecClassId} vs ${expectedClassId})`,
        federationGuid: existing.federationGuid,
      });
    }

    if (!existing.code.equals(code))
      ElementReservationError.throwError("reservation-conflict", {
        message: `Element ${existing.federationGuid} insert uses a different Code than was reserved`,
        federationGuid: existing.federationGuid,
      });

    arg.props.id = existing.elementId;
    const options = arg.options ?? (arg.options = {} as InsertElementOptions);
    options.forceUseId = true;
  }

  private validateProposedReservations(args: SynchronousChannel.ReserveElementsArgs): SchemaSync.ProposedElementReservation[] {
    const out: SchemaSync.ProposedElementReservation[] = [];
    const errors: string[] = [];
    for (const props of args.elements) {
      if (!props.federationGuid || !Guid.isGuid(props.federationGuid)) {
        errors.push(`element reservation requires an explicit, valid federationGuid (got '${props.federationGuid ?? "<none>"}')`);
        continue;
      }

      const code = props.code ? Code.fromJSON(props.code) : Code.createEmpty();
      if (code.value && !Code.isValid(code)) {
        errors.push(`(${props.federationGuid}): invalid code '${code.toString()}'`);
        continue;
      }

      const ecClassId = this._iModel[_nativeDb].classNameToId(props.classFullName);
      if (!Id64.isValidId64(ecClassId)) {
        errors.push(`(${props.federationGuid}): unknown class '${props.classFullName}'`);
        continue;
      }

      out.push({
        federationGuid: props.federationGuid,
        ecClassId,
        code,
        isCategory: props.classFullName === Category.classFullName || this._iModel[_nativeDb].isSubClassOf(props.classFullName, Category.classFullName),
      });
    }

    if (errors.length > 0)
      ElementReservationError.throwError("invalid-reservation", { message: `Invalid element(s) for reservation:\n  ${errors.join("\n  ")}` });

    return out;
  }
}

export async function createSchemaSyncReservations(iModel: IModelDb): Promise<SynchronousChannel.Reservations> {
  return SchemaSyncReservations.create(iModel);
}
