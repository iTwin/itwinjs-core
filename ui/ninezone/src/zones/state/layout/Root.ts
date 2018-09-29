/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle from "../../../utilities/Rectangle";
import Size, { SizeProps } from "../../../utilities/Size";
import Layout from "./Layout";

export default class Root extends Layout {
  public static readonly FOOTER_HEIGHT = 48;
  private _isInFooterMode: boolean;

  public constructor(size: SizeProps, isInFooterMode: boolean) {
    super(Rectangle.createFromSize(size));

    this._isInFooterMode = isInFooterMode;
  }

  protected get _topZone() {
    return this;
  }

  protected get _bottomZone() {
    return this;
  }

  protected get _leftZone() {
    return this;
  }

  protected get _rightZone() {
    return this;
  }

  public get isRoot() {
    return true;
  }

  public get isInFooterMode() {
    return this._isInFooterMode;
  }

  public set isInFooterMode(isInFooterMode: boolean) {
    this._isInFooterMode = isInFooterMode;
  }

  public setSize(size: Size) {
    this.setBounds(Rectangle.createFromSize(size));
  }

  public tryGrowTop(): number {
    return 0;
  }

  public tryShrinkTop(): number {
    return 0;
  }

  public tryGrowBottom(): number {
    return 0;
  }

  public tryShrinkBottom(): number {
    return 0;
  }

  public tryGrowLeft(): number {
    return 0;
  }

  public tryShrinkLeft(): number {
    return 0;
  }

  public tryGrowRight(): number {
    return 0;
  }

  public tryShrinkRight(): number {
    return 0;
  }
}
