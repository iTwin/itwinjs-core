/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle from "../../../utilities/Rectangle";
import Size from "../../../utilities/Size";
import NineZone from "../NineZone";

import Layout from "./Layout";

export default class Root extends Layout {
  public static readonly FOOTER_HEIGHT = 48;
  private _isInFooterMode: boolean;

  public constructor(public readonly nineZone: NineZone) {
    super();

    this._isInFooterMode = nineZone.getStatusZone().props.isInFooterMode;
    this.setSize(nineZone.props.size);
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

  public get bounds() {
    return this._bounds;
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
    this._bounds = Rectangle.createFromSize(size);
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
