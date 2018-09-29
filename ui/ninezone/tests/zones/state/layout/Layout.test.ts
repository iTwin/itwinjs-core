/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";

import Rectangle from "../../../../src/utilities/Rectangle";
import Layout from "../../../../src/zones/state/layout/Layout";

class RootLayoutMock extends Layout {
  public set bounds(bounds: Rectangle) {
    this.setBounds(bounds);
  }

  public get bounds() {
    return super.bounds;
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
    return false;
  }

  public tryGrowTop(_px: number): number {
    return 0;
  }

  public tryShrinkTop(_px: number): number {
    return 0;
  }

  public tryGrowBottom(_px: number): number {
    return 0;
  }

  public tryShrinkBottom(_px: number): number {
    return 0;
  }

  public tryGrowRight(_px: number): number {
    return 0;
  }

  public tryShrinkRight(_px: number): number {
    return 0;
  }

  public tryGrowLeft(_px: number): number {
    return 0;
  }

  public tryShrinkLeft(_px: number): number {
    return 0;
  }
}

class LayoutMock extends Layout {
  public topZone = new RootLayoutMock(new Rectangle());
  public bottomZone = new RootLayoutMock(new Rectangle());
  public leftZone = new RootLayoutMock(new Rectangle());
  public rightZone = new RootLayoutMock(new Rectangle());
  private _minHeight: number | undefined = undefined;
  private _minWidth: number | undefined = undefined;

  protected get _topZone() {
    return this.topZone;
  }

  protected get _bottomZone() {
    return this.bottomZone;
  }

  protected get _leftZone() {
    return this.leftZone;
  }

  protected get _rightZone() {
    return this.rightZone;
  }

  public set bounds(bounds: Rectangle) {
    this.setBounds(bounds);
  }

  public get bounds() {
    return super.bounds;
  }

  public get minHeight() {
    if (this._minHeight)
      return this._minHeight;
    return super.minHeight;
  }

  public set minHeight(height: number) { this._minHeight = height; }

  public get minWidth() {
    if (this._minWidth)
      return this._minWidth;
    return super.minWidth;
  }

  public set minWidth(width: number) { this._minWidth = width; }
}

describe("Layout", () => {
  describe("#get minWidth()", () => {
    it("should return 296", () => {
      const sut = new LayoutMock(new Rectangle());
      sut.minWidth.should.eq(296);
    });
  });

  describe("#get minHeight()", () => {
    it("should return 220", () => {
      const sut = new LayoutMock(new Rectangle());
      sut.minHeight.should.eq(220);
    });
  });

  describe("#tryGrowTop()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowTop(-100); }).should.throw();
    });

    it("should grow in size", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.tryGrowTop(100);

      sut.bounds.top.should.eq(100);
      sut.bounds.bottom.should.eq(400);
    });

    it("should be contained by top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.topZone.bounds = new Rectangle(100, 100, 300, 150);
      sut.tryGrowTop(100);

      sut.bounds.top.should.eq(150);
      sut.bounds.bottom.should.eq(400);
    });

    it("should try to shrink bottom of top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.topZone.bounds = new Rectangle(100, 100, 300, 150);

      const spy = sinon.spy();
      sut.topZone.tryShrinkBottom = spy;

      sut.tryGrowTop(100);

      spy.calledOnce.should.true;
    });

    it("should fill shrunk top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.topZone.bounds = new Rectangle(100, 100, 300, 150);

      sut.topZone.tryShrinkBottom = () => 25;
      sut.tryGrowTop(100);

      sut.bounds.top.should.eq(200 - 50 - 25);
      sut.bounds.bottom.should.eq(400);
    });
  });

  describe("#tryShrinkTop()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkTop(-100); }).should.throw();
    });

    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 600));
      sut.tryShrinkTop(100);

      sut.bounds.top.should.eq(300);
      sut.bounds.bottom.should.eq(600);
    });

    it("should shrink to minHeight", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.minHeight = 150;
      sut.tryShrinkTop(300);

      sut.bounds.top.should.eq(250);
      sut.bounds.bottom.should.eq(400);
    });

    it("should try to shrink top of bottom zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));

      const spy = sinon.spy();
      sut.bottomZone.tryShrinkTop = spy;

      sut.tryShrinkTop(100);

      spy.should.have.been.called;
    });

    it("should move by bottom zone shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.bottomZone.tryShrinkTop = () => 25;
      sut.tryShrinkTop(100);

      sut.bounds.top.should.eq(225);
      sut.bounds.bottom.should.eq(425);
    });

    it("should shrunk then move", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));
      sut.bottomZone.bounds = new Rectangle(100, 425, 200, 500);
      sut.minHeight = 100;
      sut.bottomZone.tryShrinkTop = () => 0;

      const shrunk = sut.tryShrinkTop(150);

      shrunk.should.eq(125);
      sut.bounds.top.should.eq(200 + 100 + 25);
      sut.bounds.bottom.should.eq(400 + 25);
    });
  });

  describe("#tryGrowBottom()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowBottom(-100); }).should.throw();
    });

    it("should grow bottom", () => {
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone.bounds = new Rectangle(0, 500, 10, 650);
      const grown = sut.tryGrowBottom(100);

      grown.should.eq(100);
      sut.bounds.top.should.eq(50);
      sut.bounds.bottom.should.eq(250);
    });

    it("should not grow beyond bottom zone", () => {
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone.bounds = new Rectangle(0, 200, 10, 250);
      const grown = sut.tryGrowBottom(100);

      grown.should.eq(50);
      sut.bounds.top.should.eq(50);
      sut.bounds.bottom.should.eq(200);
    });

    it("should try to shrink top of bottom zone when trying to grow beyond bottom zone", () => {
      let shrinkBottomZoneBy = 0;
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone.bounds = new Rectangle(0, 225, 10, 250);
      sut.bottomZone.tryShrinkTop = (px) => {
        shrinkBottomZoneBy = px;
        return 0;
      };
      sut.tryGrowBottom(100);

      shrinkBottomZoneBy.should.eq(25);
    });

    it("should grow bottom by amount of bottom zone shrunk", () => {
      const sut = new LayoutMock(new Rectangle(0, 50, 10, 150));
      sut.bottomZone.bounds = new Rectangle(0, 225, 10, 250);
      sut.bottomZone.tryShrinkTop = (px) => {
        return px;
      };
      const grown = sut.tryGrowBottom(100);

      grown.should.eq(100);
      sut.bounds.top.should.eq(50);
      sut.bounds.bottom.should.eq(250);
    });
  });

  describe("#tryShrinkBottom()", () => {
    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 600));
      sut.tryShrinkBottom(100);

      sut.bounds.top.should.eq(200);
      sut.bounds.bottom.should.eq(500);
    });

    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkBottom(-100); }).should.throw();
    });

    it("should shrink to minHeight", () => {
      const sut = new LayoutMock(new Rectangle(100, 0, 200, 400));
      sut.minHeight = 50;
      sut.tryShrinkBottom(1000);

      sut.bounds.top.should.eq(0);
      sut.bounds.bottom.should.eq(50);
    });

    it("should try to shrink bottom of top zone", () => {
      const sut = new LayoutMock(new Rectangle(100, 200, 200, 400));

      const spy = sinon.spy();
      sut.topZone.tryShrinkBottom = spy;

      sut.tryShrinkBottom(100);

      spy.should.have.been.called;
    });

    it("should move by top zone shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(0, 150, 10, 200));
      sut.topZone.bounds = new Rectangle(0, 100, 10, 150);
      sut.topZone.tryShrinkBottom = () => 25;
      sut.tryShrinkBottom(100);

      sut.bounds.top.should.eq(150 - 25);
      sut.bounds.bottom.should.eq(200 - 25);
    });

    it("should move beside top zone", () => {
      const sut = new LayoutMock(new Rectangle(0, 170, 10, 200));
      sut.topZone.bounds = new Rectangle(0, 100, 10, 150);
      sut.tryShrinkBottom(100);

      sut.bounds.top.should.eq(150);
      sut.bounds.bottom.should.eq(180);
    });
  });

  describe("#tryGrowLeft()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowLeft(-100); }).should.throw();
    });

    it("should grow left", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      const grown = sut.tryGrowLeft(100);

      grown.should.eq(100);
      sut.bounds.left.should.eq(200);
      sut.bounds.right.should.eq(400);
    });

    it("should not grow beyond left zone", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.leftZone.bounds = new Rectangle(100, 0, 250, 10);
      const grown = sut.tryGrowLeft(100);

      grown.should.eq(50);
      sut.bounds.left.should.eq(250);
      sut.bounds.right.should.eq(400);
    });

    it("should try to shrink right of left zone when trying to grow beyond left zone", () => {
      let shrinkLeftZoneBy = 0;
      const sut = new LayoutMock(new Rectangle(325, 0, 600, 10));
      sut.leftZone.bounds = new Rectangle(100, 0, 300, 10);
      sut.leftZone.tryShrinkRight = (px) => {
        shrinkLeftZoneBy = px;
        return 0;
      };
      sut.tryGrowLeft(50);

      shrinkLeftZoneBy.should.eq(25);
    });

    it("should grow left by amount of left zone shrunk", () => {
      const sut = new LayoutMock(new Rectangle(600, 0, 900, 10));
      sut.leftZone.bounds = new Rectangle(100, 0, 500, 10);
      sut.leftZone.tryShrinkRight = (px) => px;
      const grown = sut.tryGrowLeft(150);

      grown.should.eq(150);
      sut.bounds.left.should.eq(450);
      sut.bounds.right.should.eq(900);
    });
  });

  describe("#tryShrinkLeft()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkLeft(-100); }).should.throw();
    });

    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(200, 0, 600, 10));
      sut.tryShrinkLeft(100);

      sut.bounds.left.should.eq(300);
      sut.bounds.right.should.eq(600);
    });

    it("should shrink to min width", () => {
      const sut = new LayoutMock(new Rectangle(0, 0, 600, 10));
      sut.minWidth = 50;
      sut.tryShrinkLeft(1000);

      sut.bounds.left.should.eq(550);
      sut.bounds.right.should.eq(600);
    });

    it("should shrink left of right zone", () => {
      let shrunkBy = 0;
      const sut = new LayoutMock(new Rectangle(0, 0, 200, 10));
      sut.minWidth = 100;
      sut.rightZone.tryShrinkLeft = (px: number) => {
        shrunkBy = px;
        return 0;
      };
      sut.tryShrinkLeft(150);

      shrunkBy.should.eq(50);
    });

    it("should move right by shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(600, 0, 800, 10));
      sut.rightZone.tryShrinkLeft = () => 25;
      sut.tryShrinkLeft(100);

      sut.bounds.left.should.eq(600 + 25);
      sut.bounds.right.should.eq(800 + 25);
    });

    it("should move beside right zone", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.rightZone.bounds = new Rectangle(500, 0, 600, 10);
      sut.tryShrinkLeft(1000);

      sut.bounds.left.should.eq(400);
      sut.bounds.right.should.eq(500);
    });
  });

  describe("#tryGrowRight()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryGrowRight(-100); }).should.throw();
    });

    it("should grow right", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.rightZone.bounds = new Rectangle(600, 0, 800, 10);
      const grown = sut.tryGrowRight(100);

      grown.should.eq(100);
      sut.bounds.left.should.eq(300);
      sut.bounds.right.should.eq(500);
    });

    it("should not grow beyond right zone", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.rightZone.bounds = new Rectangle(450, 0, 550, 10);
      const grown = sut.tryGrowRight(100);

      grown.should.eq(50);
      sut.bounds.left.should.eq(300);
      sut.bounds.right.should.eq(450);
    });

    it("should try to shrink left of right zone when trying to grow beyond right zone", () => {
      let shrinkRightZoneBy = 0;
      const sut = new LayoutMock(new Rectangle(100, 0, 225, 10));
      sut.rightZone.bounds = new Rectangle(250, 0, 400, 10);
      sut.rightZone.tryShrinkLeft = (px) => {
        shrinkRightZoneBy = px;
        return 0;
      };
      sut.tryGrowRight(50);

      shrinkRightZoneBy.should.eq(25);
    });

    it("should grow right by amount of right zone shrunk", () => {
      const sut = new LayoutMock(new Rectangle(100, 0, 200, 10));
      sut.rightZone.bounds = new Rectangle(200, 0, 300, 10);
      sut.rightZone.tryShrinkLeft = () => 45;

      const grown = sut.tryGrowRight(150);

      grown.should.eq(45);
      sut.bounds.left.should.eq(100);
      sut.bounds.right.should.eq(200 + 45);
    });
  });

  describe("#tryShrinkRight()", () => {
    it("should throw for negative", () => {
      const sut = new LayoutMock(new Rectangle());
      (() => { sut.tryShrinkRight(-100); }).should.throw();
    });

    it("should shrink in size", () => {
      const sut = new LayoutMock(new Rectangle(200, 0, 600, 10));
      sut.tryShrinkRight(100);

      sut.bounds.left.should.eq(200);
      sut.bounds.right.should.eq(500);
    });

    it("should shrink to min width", () => {
      const sut = new LayoutMock(new Rectangle(0, 0, 600, 10));
      sut.minWidth = 50;
      sut.tryShrinkRight(1000);

      sut.bounds.left.should.eq(0);
      sut.bounds.right.should.eq(50);
    });

    it("should shrink right of left zone", () => {
      let shrunkBy = 0;
      const sut = new LayoutMock(new Rectangle(0, 0, 200, 10));
      sut.minWidth = 100;
      sut.leftZone.tryShrinkRight = (px: number) => {
        shrunkBy = px;
        return 0;
      };
      sut.tryShrinkRight(150);

      shrunkBy.should.eq(50);
    });

    it("should move left by shrunk amount", () => {
      const sut = new LayoutMock(new Rectangle(600, 0, 800, 10));
      sut.leftZone.bounds = new Rectangle(100, 0, 600, 10);
      sut.leftZone.tryShrinkRight = () => 25;
      sut.tryShrinkRight(100);

      sut.bounds.left.should.eq(600 - 25);
      sut.bounds.right.should.eq(800 - 25);
    });

    it("should move beside left zone", () => {
      const sut = new LayoutMock(new Rectangle(300, 0, 400, 10));
      sut.leftZone.bounds = new Rectangle(100, 0, 200, 10);
      sut.tryShrinkRight(1000);

      sut.bounds.left.should.eq(200);
      sut.bounds.right.should.eq(300);
    });
  });
});
