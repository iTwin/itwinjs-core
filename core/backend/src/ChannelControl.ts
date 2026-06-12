/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64String } from "@itwin/core-bentley";
import { _bumpChannelVersion, _findRegisteredMigration, _implementationProhibited, _recordMigration, _verifyChannel } from "./internal/Symbols";
import { IModelDb } from "./IModelDb";
import type { EditTxn } from "./EditTxn";
import type { Migration, MigrationCompatibility, MigrationDetails, MigrationRecord } from "./Migration";

/** The key for a channel. Used for "allowed channels" in [[ChannelControl]]
 * @beta
 */
export type ChannelKey = string;

/**
 * Context provided to the channel upgrade callback.
 * @beta
 */
export interface ChannelUpgradeContext<T = any> {
  iModel: IModelDb;
  channelKey: string;
  fromVersion: string;
  toVersion: string;
  /** Optional data to be used during the upgrade */
  data?: T;
}

/**
 * Options for upgrading a channel before schema import.
 * The framework will automatically populate the context with iModel and data.
 * @beta
 */
export interface ChannelUpgradeOptions<T = any> {
  channelKey: string;
  fromVersion: string;
  toVersion: string;
  callback: (context: ChannelUpgradeContext<T>) => Promise<void>;
}

/**
 * Controls which channels of an iModel are permitted for write operations. An implementation of this interface is
 * available via [[IModelDb.channels]].
 * @see [Working With Channels]($docs/learning/backend/Channel.md) for details
 * @beta
 */
export interface ChannelControl {
  /** @internal */
  readonly [_implementationProhibited]: unknown;

  /** Add a new channel to the list of allowed channels of the [[IModelDb]] for this session.
   * @param channelKey The key for the channel to become editable in this session.
   */
  addAllowedChannel(channelKey: ChannelKey): void;
  /** Remove a channel from the list of allowed channels of the [[IModelDb]] for this session.
   * @param channelKey The key of the channel that should no longer be editable in this session.
   */
  removeAllowedChannel(channelKey: ChannelKey): void;
  /** Get the channelKey of the channel for an element by ElementId.
   * @throws if the element does not exist
   */
  getChannelKey(elementId: Id64String): ChannelKey;
  /** Make an existing element a new Channel root.
   * @throws if the element is already in a channel different than the shared channel, or if
   * there is already another channelRoot element for the specified channelKey
   */
  makeChannelRoot(args: {
    elementId: Id64String;
    channelKey: ChannelKey;
    /** The transaction to use for the operation. */
    txn: EditTxn;
  }): void;
  /** Make an existing element a new Channel root.
   * @throws if the element is already in a channel different than the shared channel, or if
   * there is already another channelRoot element for the specified channelKey
   * @deprecated Use [[makeChannelRoot]] and supply `txn`.
   */
  makeChannelRoot(args: { elementId: Id64String, channelKey: ChannelKey }): void;
  /** Insert a new Subject element that is a Channel Root in this iModel.
   * @returns the ElementId of the new Subject element.
   * @note if the parentSubject element is already in a channel, this will add the Subject element and then throw an error without making it a Channel root.
   */
  insertChannelSubject(args: {
    /** The name of the new Subject element */
    subjectName: string;
    /** The channel key for the new [[Subject]]. This is the string to pass to [[addAllowedChannel]]*/
    channelKey: ChannelKey;
    /** the Id of the parent of the new Subject. Default is [[IModel.rootSubjectId]]. */
    parentSubjectId?: Id64String;
    /** Optional description for new Subject. */
    description?: string;
    /** The EditTxn to use for the operation. */
    txn: EditTxn;
  }): Id64String;
  /** Insert a new Subject element that is a Channel Root in this iModel.
   * @returns the ElementId of the new Subject element.
   * @note if the parentSubject element is already in a channel, this will add the Subject element and then throw an error without making it a Channel root.
   * @deprecated Use [[insertChannelSubject]] and supply `txn`.
   */
  insertChannelSubject(args: {
    /** The name of the new Subject element */
    subjectName: string;
    /** The channel key for the new [[Subject]]. This is the string to pass to [[addAllowedChannel]]*/
    channelKey: ChannelKey;
    /** the Id of the parent of the new Subject. Default is [[IModel.rootSubjectId]]. */
    parentSubjectId?: Id64String;
    /** Optional description for new Subject. */
    description?: string;
  }): Id64String;
  /**
   * Queries for the element Id acting as the ChannelRoot for a given channelKey, if any
   * @param channelKey The key for the channel to query for
   * @returns The element Id of the ChannelRoot element of the specified Channel key, or undefined if
   * there is no ChannelRoot for it
   */
  queryChannelRoot(channelKey: ChannelKey): Id64String | undefined;

  /** @internal */
  [_verifyChannel]: (modelId: Id64String) => void;

  /**
   * Upgrade a channel to a new version.
   * @beta
   */
  upgradeChannel(options: ChannelUpgradeOptions, iModel: IModelDb, data?: any): Promise<void>;

  /**
   * Returns the list of migrations that have already been applied to this iModel for the
   * specified channel, in the order they were applied.
   * @param channelKey The key of the channel to query.
   * @returns An array of applied migration records.
   * @beta
   */
  getAppliedMigrations(channelKey: ChannelKey): MigrationRecord[];

  /**
   * Returns the list of registered migrations for the specified channel that have not yet been applied to this iModel.
   * @param channelKey The key of the channel to query.
   * @returns An array of pending migrations, in registration order.
   * @beta
   */
  getPendingMigrations(channelKey: ChannelKey): Migration[];

  /**
   * Returns all pending migrations across all registered channels, in the order they were registered.
   * This is used at iModel open time to determine whether any migrations need to be applied.
   * @returns An array of all pending migrations across all channels.
   * @beta
   */
  getAllPendingMigrations(): Migration[];

  /**
   * Returns the version compatibility status for the specified channel, determined by comparing
   * the channel's current version in the iModel against the version implied by all registered
   * migrations for that channel.
   *
   * - `"ok"` — the channel is fully compatible; reads and writes are permitted.
   * - `"read-only"` — an unknown migration bumped the channel's minor (write-compatibility)
   *   version. The channel data is still understandable but must not be written. Attempting to
   *   write will throw a [[ChannelControlError]] with key `"version-read-only"`.
   * - `"blocked"` — an unknown migration bumped the channel's major (read-compatibility) version.
   *   The channel data may no longer make sense to this application. Writing will throw a
   *   [[ChannelControlError]] with key `"version-blocked"`. The application should also prevent
   *   users from reading or displaying data from this channel.
   *
   * When no migrations are registered for the channel, always returns `"ok"`.
   *
   * @see [Application Updates]($docs/learning/backend/ApplicationUpdates.md)
   * @beta
   */
  getChannelVersionCompatibility(channelKey: ChannelKey): "ok" | "read-only" | "blocked";

  /** @internal */
  [_recordMigration]: (txn: EditTxn, channelKey: ChannelKey, migrationId: string, details: MigrationDetails | undefined) => void;

  /** @internal */
  [_bumpChannelVersion]: (txn: EditTxn, channelKey: ChannelKey, compatibility: MigrationCompatibility) => void;

  /**
   * Looks up a registered [[Migration]] by channel and id.
   *
   * Returns an object with:
   * - `migration`: the matching [[Migration]], or `undefined` if no migration with that id was registered for the channel.
   * - `channelHasRegistrations`: `true` if any migrations were registered for the channel at all.
   *
   * When `channelHasRegistrations` is `false` the channel is unrelated to this application's
   * migration system and the caller should apply the changeset without special handling.
   * When `channelHasRegistrations` is `true` but `migration` is `undefined`, the application is
   * too old and must be updated before it can process this migration.
   * @internal
   */
  [_findRegisteredMigration](channelKey: ChannelKey, migrationId: string): { migration: Migration | undefined; channelHasRegistrations: boolean };
}

/** @beta */
export namespace ChannelControl {
  /** the name of the special "shared" channel holding information that is editable by any application. */
  export const sharedChannelName = "shared";
}

