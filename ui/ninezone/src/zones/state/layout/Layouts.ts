/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import Rectangle, { RectangleProps } from "../../../utilities/Rectangle";
import { WidgetZone } from "../Zone";
import NineZone from "../NineZone";
import Layout from "./Layout";
import Root from "./Root";

export class NineZoneRoot extends Root {
  public constructor(public readonly nineZone: NineZone) {
    super(nineZone.props.size, nineZone.getStatusZone().props.isInFooterMode);
  }
}

export class WidgetZoneLayout extends Layout {
  public constructor(public readonly zone: WidgetZone) {
    super(zone.props.bounds);
  }

  private get _columnStartFraction() {
    return this.zone.cell.col / 3;
  }

  private get _columnEndFraction() {
    return (this.zone.cell.col + 1) / 3;
  }

  private get _rowStartFraction() {
    return this.zone.cell.row / 3;
  }

  private get _rowEndFraction() {
    return (this.zone.cell.row + 1) / 3;
  }

  public getInitialBounds(): RectangleProps {
    const isInFooterMode = this.zone.nineZone.root.isInFooterMode;
    const rootBounds = this.zone.nineZone.root.bounds;
    const parentBounds = isInFooterMode ? rootBounds.inset(0, 0, 0, Root.FOOTER_HEIGHT) : rootBounds;
    const parentSize = parentBounds.getSize();

    const left = parentBounds.left + parentSize.width * this._columnStartFraction;
    const right = parentBounds.left + parentSize.width * this._columnEndFraction;
    const top = parentBounds.top + parentSize.height * this._rowStartFraction;
    const bottom = parentBounds.top + parentSize.height * this._rowEndFraction;

    return new Rectangle(left, top, right, bottom);
  }
}

export class Layout1 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root;
  }

  protected get _bottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(4).getLayout();
  }

  protected get _leftZone() {
    return this.zone.nineZone.root;
  }

  protected get _rightZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(2).getLayout();
  }
}

export class Layout2 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root;
  }

  protected get _bottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(7).getLayout();
  }

  protected get _leftZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(1).getLayout();
  }

  protected get _rightZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(3).getLayout();
  }
}

export class Layout3 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root;
  }

  protected get _bottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(6).getLayout();
  }

  protected get _leftZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(2).getLayout();
  }

  protected get _rightZone() {
    return this.zone.nineZone.root;
  }

  public get minWidth() {
    return Root.FREE_FORM_DEFAULT_MIN_WIDTH;
  }

  public get minHeight() {
    return Root.FREE_FORM_DEFAULT_MIN_HEIGHT;
  }
}

export class Layout4 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(3).getLayout();
  }

  protected get _bottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(7).getLayout();
  }

  protected get _leftZone() {
    return this.zone.nineZone.root;
  }

  protected get _rightZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(6).getLayout();
  }
}

export class Layout6 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(3).getLayout();
  }

  protected get _bottomZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(9).getLayout();
  }

  protected get _leftZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(4).getLayout();
  }

  protected get _rightZone() {
    return this.zone.nineZone.root;
  }
}

export class Layout7 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(4).getLayout();
  }

  protected get _bottomZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root.nineZone.getWidgetZone(8).getLayout();
    return this.zone.nineZone.root;
  }

  protected get _leftZone() {
    return this.zone.nineZone.root;
  }

  protected get _rightZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root.nineZone.getWidgetZone(9).getLayout();
    return this.zone.nineZone.root.nineZone.getWidgetZone(8).getLayout();
  }
}

export class Layout8 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(6).getLayout();
  }

  protected get _bottomZone() {
    return this.zone.nineZone.root;
  }

  protected get _leftZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root;
    return this.zone.nineZone.root.nineZone.getWidgetZone(7).getLayout();
  }

  protected get _rightZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root;
    return this.zone.nineZone.root.nineZone.getWidgetZone(9).getLayout();
  }

  public getInitialBounds(): RectangleProps {
    const parentBounds = this.zone.nineZone.root.bounds;
    if (this.zone.nineZone.root.isInFooterMode)
      return new Rectangle(parentBounds.left, parentBounds.bottom - Root.FOOTER_HEIGHT, parentBounds.right, parentBounds.bottom);

    return super.getInitialBounds();
  }
}

export class Layout9 extends WidgetZoneLayout {
  protected get _topZone() {
    return this.zone.nineZone.root.nineZone.getWidgetZone(6).getLayout();
  }

  protected get _bottomZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root.nineZone.getWidgetZone(8).getLayout();
    return this.zone.nineZone.root;
  }

  protected get _leftZone() {
    if (this.zone.nineZone.root.isInFooterMode)
      return this.zone.nineZone.root.nineZone.getWidgetZone(7).getLayout();
    return this.zone.nineZone.root.nineZone.getWidgetZone(8).getLayout();
  }

  protected get _rightZone() {
    return this.zone.nineZone.root;
  }
}
