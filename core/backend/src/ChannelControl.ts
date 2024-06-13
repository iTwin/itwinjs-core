/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { Id64String } from "@itwin/core-bentley";
import { _implementationProhibited, _verifyChannel } from "./internal/Symbols";

/** The key for a channel. Used for "allowed channels" in [[ChannelControl]]
 * @beta
 */
export type ChannelKey = string;

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
}

/** @beta */
export namespace ChannelControl {
  /** the name of the special "shared" channel holding information that is editable by any application. */
  export const sharedChannelName = "shared";
}

