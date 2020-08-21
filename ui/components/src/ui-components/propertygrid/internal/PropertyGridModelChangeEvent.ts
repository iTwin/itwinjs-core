/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import { BeEvent } from "@bentley/bentleyjs-core";

/**
 * A signature for property grid model change listeners
 * @alpha
 */
export type PropertyGridModelChangeListener = () => void;

/**
 * An event broadcasted on property grid model changes
 * @alpha
 */
export class PropertyGridModelChangeEvent extends BeEvent<PropertyGridModelChangeListener> { }
