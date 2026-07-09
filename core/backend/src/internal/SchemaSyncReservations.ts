/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { Guid, GuidString, Id64, IModelStatus } from "@itwin/core-bentley";
import { Code, IModelError } from "@itwin/core-common";
import { OnElementPropsArg } from "../Element";
import { IModelDb, InsertElementOptions } from "../IModelDb";
import { ReserveDefinitionElementsArgs, SharedDefinitionReservations } from "../SharedDefinitionReservations";
import { SchemaSync } from "../SchemaSync";
import { _close, _implementationProhibited, _nativeDb, _onDefinitionElementInsert } from "./Symbols";
import { Category } from "../Category";

class SchemaSyncReservations implements SharedDefinitionReservations {
  public readonly [_implementationProhibited] = undefined;
  public get isServerBased() { return true; }
  private readonly _iModel: IModelDb;
  private readonly _schemaSync: SchemaSync.CloudAccess;

  private constructor(iModel: IModelDb, schemaSync: SchemaSync.CloudAccess) {
    this._iModel = iModel;
    this._schemaSync = schemaSync;
  }

  public static async create(iModel: IModelDb): Promise<SchemaSyncReservations> {
    const schemaSync = await SchemaSync.getCloudAccess(iModel);
    schemaSync.synchronizeWithCloud();
    return new SchemaSyncReservations(iModel, schemaSync);
  }

  public [_close](): void {
    try {
      this._schemaSync.close();
    } catch {
      // best-effort cleanup; never throw out of close hooks
    }
  }

  public needsDefinitionReservation(federationGuid: GuidString): boolean {
    if (!SchemaSync.isEnabled(this._iModel))
      return false;

    if (!Guid.isGuid(federationGuid))
      return false;

    return !this._schemaSync.reader.findReservedDefinition(federationGuid);
  }

  public async reserveDefinitionElements(args: ReserveDefinitionElementsArgs): Promise<void> {
    const validated = this.validateProposedDefinitions(args);
    await this._schemaSync.writeLocker.reserveDefinitionElements(validated);
  }

  public [_onDefinitionElementInsert](arg: OnElementPropsArg): void {
    if (!SchemaSync.isEnabled(arg.iModel) || arg.iModel.holdsSchemaLock)
      return;

    const fedGuid = arg.props.federationGuid;
    if (fedGuid !== undefined && !Guid.isGuid(fedGuid))
      throw new IModelError(IModelStatus.BadRequest, "DefinitionElement inserts require an undefined or valid federationGuid when SchemaSync is enabled");

    // It should be impossible for us to still have local changes, but check just in case,
    // since we can't trust the contents of the SchemaSyncDb until they've been successfully pushed.
    if (this._schemaSync.container.hasLocalChanges)
      throw new IModelError(IModelStatus.BadRequest, "DefinitionElement inserts are not allowed when there are local changes in the SchemaSync container");

    const code = Code.fromJSON(arg.props.code);
    if (!fedGuid && !code.value)
      throw new IModelError(IModelStatus.BadRequest, "DefinitionElement inserts require either a valid federationGuid or a non-empty code value when SchemaSync is enabled");

    const existing = this._schemaSync.reader.findReservedDefinition(fedGuid ?? code);
    if (!existing) {
      throw new IModelError(IModelStatus.NotFound,
        `No SchemaSync reservation found for DefinitionElement ${fedGuid ? `federationGuid ${fedGuid}` : `code '${code.value}'`} — include it in a SharedDefinitionReservations.reserveDefinitionElements call before inserting`);
    }

    const expectedClassId = arg.iModel[_nativeDb].classNameToId(arg.props.classFullName);
    if (existing.ecClassId !== expectedClassId) {
      throw new IModelError(IModelStatus.BadArg,
        `DefinitionElement ${existing.federationGuid} reserved as a different class than the insert (${existing.ecClassId} vs ${expectedClassId})`);
    }

    if (!existing.code.equals(code))
      throw new IModelError(IModelStatus.BadArg, `DefinitionElement ${existing.federationGuid} insert uses a different Code than was reserved`);

    // Stamp the resolved federationGuid onto props when the caller did not supply one.
    if (!fedGuid)
      arg.props.federationGuid = existing.federationGuid;

    arg.props.id = existing.elementId;
    const options = arg.options ?? (arg.options = {} as InsertElementOptions);
    options.forceUseId = true;
  }

  private validateProposedDefinitions(args: ReserveDefinitionElementsArgs): SchemaSync.ProposedDefinition[] {
    const out: SchemaSync.ProposedDefinition[] = [];
    const errors: string[] = [];
    for (const props of args.elements) {
      // Only validate federationGuid format when one is actually provided; undefined means "resolve by Code".
      if (props.federationGuid !== undefined && !Guid.isGuid(props.federationGuid)) {
        errors.push(`invalid federationGuid '${props.federationGuid}'`);
        continue;
      }

      const code = Code.fromJSON(props.code);
      if (!props.federationGuid && !code.value) {
        errors.push(`definition requires either a federationGuid or a non-empty code value (got neither)`);
        continue;
      }
      if (!Code.isValid(code)) {
        errors.push(`(${props.federationGuid ?? "<no guid>"}): invalid code '${code.toString()}'`);
        continue;
      }

      const ecClassId = this._iModel[_nativeDb].classNameToId(props.classFullName);
      if (!Id64.isValidId64(ecClassId)) {
        errors.push(`(${props.federationGuid ?? code.toString()}): unknown class '${props.classFullName}'`);
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
      throw new IModelError(IModelStatus.BadRequest, `Invalid DefinitionElement(s) for reservation:\n  ${errors.join("\n  ")}`);

    return out;
  }
}

export async function createSchemaSyncReservations(iModel: IModelDb): Promise<SharedDefinitionReservations> {
  return SchemaSyncReservations.create(iModel);
}
