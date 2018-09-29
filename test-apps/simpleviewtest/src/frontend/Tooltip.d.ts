/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
declare module 'tooltip.js' {
  import { Boundary, Placement, PopperOptions } from 'popper.js';

  export type PlacementFunction = (tooltip: HTMLElement, reference: HTMLElement) => string;

  export type TitleFunction = () => string;

  export type Delay = Record<'show' | 'hide', number>;

  export interface Options {
    container?: HTMLElement | string;
    delay?: number | Delay;
    html?: boolean;
    placement?: Placement | PlacementFunction;
    template?: string;
    title?: string | HTMLElement | TitleFunction;
    /**
     * available options are click, hover, focus, manual
     * required to form a space delimited string
     * e.g. 'hover focus'
     */
    trigger?: string;
    boundariesElement?: Boundary | HTMLElement;
    offset?: number | string;
    popperOptions?: PopperOptions;
  }

  class Tooltip {
    constructor(reference: HTMLElement, options: Options);

    _isOpen: boolean;

    show(): void;

    hide(): void;

    dispose(): void;

    toggle(): void;

    updateTitleContent(msg: string): void;
  }

  export default Tooltip;
}