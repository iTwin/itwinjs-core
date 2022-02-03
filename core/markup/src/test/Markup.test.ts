/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Angle, AxisIndex, Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import type { G, Svg} from "@svgdotjs/svg.js";
import { Element, Matrix, SVG } from "@svgdotjs/svg.js";
import { MarkupApp } from "../Markup";
import { initSvgExt } from "../SvgJsExt";

describe("Markup", () => {
  let div: HTMLDivElement;
  let svgContainer: Svg;
  let nested: G;

  before(async () => {
    initSvgExt();

    div = document.createElement("div");
    div.className = "test-div";
    div.style.pointerEvents = "none";
    div.style.overflow = "visible";
    div.style.width = "100px";
    div.style.height = "100px";
    div.style.position = "absolute";
    div.style.top = div.style.left = "0px";

    document.body.appendChild(div);
    svgContainer = SVG().addTo(div).addClass("svg-class");
    nested = svgContainer.group().addClass("svg-nested");
  });

  const makeRect = (g: G) => g.rect(10, 10).move(3, 3).css(MarkupApp.props.active.element);

  it("SVG Text", () => {
    const text = nested.plain("test"); // create a plain text element
    text.css(MarkupApp.props.active.text);
    text.translate(20, 15); // and position it relative to the cursor
    assert.equal(text.getFontSize(), 30, "font size");

    const val = "test1\ntest2\ntest3";
    text.createMarkup(val, 10);
    assert.equal(text.getFontSize(), 30, "font size of multiline");
    assert.equal(text.node.innerHTML, 'test1<tspan dy="10" x="0">test2</tspan><tspan dy="10" x="0">test3</tspan>', "innerHTML");
    assert.equal(text.getMarkup(), val, "getMarkup");

    let outline = text.getOutline(1);
    let trn = outline.attr("transform");
    assert.equal(trn, "matrix(1,0,0,1,20,15)", "transform of outline");
    const bbStr = outline.bbox().toString();

    text.markupStretch(22, 41, 37, 14, new Matrix().rotateO(20).translateO(3, 2.1));
    outline = text.getOutline(1);
    trn = outline.attr("transform");
    assert.equal(trn, "matrix(0.9396926207859084,0.3420201433256687,-0.3420201433256687,0.9396926207859084,3,2.1)", "getOutline transform");
    assert.equal(bbStr, outline.bbox().toString(), "markupStretch should not change bbox for text");

    const npcToVp = text.getNpcToVp();
    assert.isDefined(npcToVp, "npcToVp should work");

    // outline should work on empty text
    text.node.textContent = "";
    outline = text.getOutline(1);
    trn = outline.attr("transform");
    assert.equal(trn, "matrix(0.9396926207859084,0.3420201433256687,-0.3420201433256687,0.9396926207859084,3,2.1)", "empty text transform");
  });

  it("SVG Matrix", () => {
    const r = Matrix3d.createRotationAroundAxisIndex(AxisIndex.Z, Angle.createDegrees(30));
    const trans = Transform.createOriginAndMatrix(new Point3d(1, 2, 0), r);
    const m = new Matrix().fromIModelTransform(trans); // round trip transform through SVG Matrix
    const t2 = m.toIModelTransform();
    assert.isTrue(trans.isAlmostEqual(t2), "SVG matrix to/from Transform");
  });

  it("SVG groups", () => {
    nested.clear();
    const e0 = makeRect(nested);
    const g1 = nested.group();
    const e1 = makeRect(g1);
    const g2 = g1.group();
    const e2 = makeRect(g2);
    const g3 = g2.group();
    const e3 = makeRect(g3);

    assert.isTrue(e3.isChildOf(svgContainer));
    const mtx = new Matrix().rotateO(20).translateO(3, 2.1);
    g1.markupStretch(22, 41, 37, 14, mtx);
    const trn = g1.attr("transform");
    assert.equal(trn, "matrix(0.9396926207859084,0.3420201433256687,-0.3420201433256687,0.9396926207859084,3,2.1)", "G markupStretch");

    e3.markupStretch(1, 2, 3, 4, mtx);
    assert.equal(e3.bbox().toString(), "3 4 1 2", "bbox stretched rect"); // should stretch box, not transform

    const text = nested.plain("test");
    const span = text.tspan("line 2");

    assert.equal(e0.getChildOrGroupOf(nested), e0, "pick element in root");
    assert.equal(e1.getChildOrGroupOf(nested), g1, "pick element in group, should get group");
    assert.equal(e2.getChildOrGroupOf(nested), g1, "pick element in nested group, should get outer group");
    assert.equal(span.getChildOrGroupOf(nested), text, "span should pick text");
    assert.isUndefined(e0.getChildOrGroupOf(g1), "should not pick from other group");
  });

  it("Markup hiliting", () => {
    nested.clear();
    const checkColor = (elem: Element | Element[], stroke: string, fill: string, msg: string) => {
      if (elem instanceof Element) elem = [elem];
      elem.forEach((e) => {
        const css = window.getComputedStyle(e.node);
        assert.equal(css.stroke, stroke, `${msg} stroke`);
        assert.equal(css.fill, fill, `${msg} fill`);
      });
    };
    const el = makeRect(nested);
    const red = "rgb(255, 0, 0)";
    const blue = "rgb(0, 0, 255)";
    const magenta = "rgb(255, 0, 255)";
    const cyan = "rgb(0, 255, 255)";

    checkColor(el, red, blue, "new element");
    el.hilite();
    checkColor(el, magenta, magenta, "hilited");
    el.flash();
    checkColor(el, magenta, magenta, "flash while hilited should do nothing");
    el.unHilite();
    checkColor(el, red, blue, "unHilite");
    el.flash();
    checkColor(el, cyan, cyan, "flash");
    el.unFlash();
    checkColor(el, red, blue, "unFlash");

    const g1 = nested.group();
    const g2 = g1.group();
    const els = [makeRect(g1), makeRect(g1), makeRect(g2)];
    nested.hilite();
    checkColor(els, magenta, magenta, "hilite group");
    nested.unHilite();
    checkColor(els, red, blue, "unHilite group");

    const e1 = els[0];
    e1.hilite();
    const clone = e1.cloneMarkup();
    e1.replace(clone);
    checkColor(clone, red, blue, "clone should turn off hilite");
  });

});
