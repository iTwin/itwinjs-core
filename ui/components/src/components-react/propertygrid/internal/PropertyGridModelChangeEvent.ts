/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import { BeEvent } from "@itwin/core-bentley";

/**
 * A signature for property grid model change listeners
 * @beta
 */
export type PropertyGridModelChangeListener = () => void;

/**
 * An event broadcasted on property grid model changes
 * @beta
 */
export class PropertyGridModelChangeEvent extends BeEvent<PropertyGridModelChangeListener> { }
