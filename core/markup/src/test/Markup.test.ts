/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BentleyError, Logger, LogLevel } from "@itwin/core-bentley";
import { BeButtonEvent, FrontendLoggerCategory, ScreenViewport } from "@itwin/core-frontend";
import { Angle, AxisIndex, Matrix3d, Point3d, Transform } from "@itwin/core-geometry";
import { Element, G, Matrix, Svg, SVG, Text } from "@svgdotjs/svg.js";
import { sanitizeSvg, sanitizeSvgContent } from "../internal/SanitizeSvg";
import { Markup, MarkupApp } from "../Markup";
import { LineTool, SymbolTool } from "../RedlineTool";
import { initSvgExt } from "../SvgJsExt";
import { EditTextTool } from "../TextEdit";

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
      if (elem instanceof Element)
        elem = [elem];

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

describe("Markup sanitizing", () => {
  const markups: Markup[] = [];

  // Markup only needs the viewport to supply the div it is drawn into.
  const createMarkup = (svg?: string) => {
    const vp = {
      addNewDiv: () => {
        const div = document.createElement("div");
        div.style.position = "absolute";
        div.style.top = div.style.left = "0px";
        div.style.width = div.style.height = "200px";
        document.body.appendChild(div);
        return div;
      },
    } as unknown as ScreenViewport;
    const markup = new Markup(vp, svg ? { rect: { width: 200, height: 200 }, svg } : undefined);
    markups.push(markup);
    return markup;
  };

  // Serialize the markup the same way MarkupApp.readMarkupSvg does.
  const saveMarkup = (markup: Markup) => {
    markup.svgDecorations!.remove();
    markup.svgDynamics!.remove();
    return markup.svgContainer!.svg();
  };

  const xssCalls: string[] = [];
  const xssPayload = (where: string) => `window.markupXss('${where}')`;
  const waitForHandlers = async () => new Promise((resolve) => setTimeout(resolve, 200));

  const assertNoScriptContent = (root: globalThis.Element) => {
    for (const el of Array.from(root.querySelectorAll("*"))) {
      assert.notInclude(["script", "foreignobject", "img", "iframe", "set", "animate"], el.localName.toLowerCase());
      for (const attr of Array.from(el.attributes)) {
        assert.isFalse(attr.name.toLowerCase().startsWith("on"), `event handler ${attr.name} on ${el.localName}`);
        assert.notInclude(attr.value.toLowerCase(), "javascript:", `${attr.name} on ${el.localName}`);
      }
    }
  };

  const warnings: Array<{ category: string, message: string, elements?: string[], attributes?: string[] }> = [];
  const removedElements = () => warnings.flatMap((warning) => warning.elements ?? []);
  const removedAttributes = () => warnings.flatMap((warning) => warning.attributes ?? []);

  before(() => (window as any).markupXss = (where: string) => xssCalls.push(where));
  beforeEach(() => {
    Logger.initialize(undefined, (category, message, metaData) => warnings.push({ category, message, ...BentleyError.getMetaData(metaData) }));
    Logger.setLevelDefault(LogLevel.Warning);
  });
  afterEach(() => {
    markups.forEach((markup) => markup.destroy());
    markups.length = 0;
    MarkupApp.markup = undefined;
    xssCalls.length = 0;
    warnings.length = 0;
    Logger.initialize();
  });
  after(() => delete (window as any).markupXss);

  it("strips script content from restored markup", async () => {
    const svg = `<img src="x:" onerror="${xssPayload("img")}">
      <svg xmlns="http://www.w3.org/2000/svg" class="markup-container" viewBox="0 0 200 200" onload="${xssPayload("svg onload")}">
        <script>${xssPayload("script")}</script>
        <g class="markup-svg">
          <rect width="10" height="10" onclick="${xssPayload("onclick")}" onmouseover="${xssPayload("onmouseover")}"></rect>
          <foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x:" onerror="${xssPayload("foreignObject")}"></div></foreignObject>
          <a href="javascript:${xssPayload("href")}"><circle r="5"></circle></a>
          <a xlink:href="javascript:${xssPayload("xlink:href")}"><circle r="6"></circle></a>
          <set attributeName="onmouseover" to="${xssPayload("set")}"></set>
        </g>
      </svg>`;

    const markup = createMarkup(svg);
    assert.isDefined(markup.svgContainer);
    assert.isDefined(markup.svgMarkup);
    assertNoScriptContent(markup.markupDiv);

    // the legitimate content is still there
    const markupG = markup.svgMarkup!.node;
    assert.isNotNull(markupG.querySelector("rect"));
    assert.equal(markupG.querySelectorAll("a > circle").length, 2);

    const removed = [...removedElements(), ...removedAttributes()];
    assert.includeMembers(removedElements(), ["img", "script", "foreignObject", "set"]);
    assert.includeMembers(removedAttributes(), ["onload", "onclick", "onmouseover", "href", "xlink:href"]);
    assert.isFalse(removed.some((item) => item.includes("markupXss")), "the log must not include removed values");
    assert.equal(warnings[0].category, `${FrontendLoggerCategory.Package}.markup`);

    await waitForHandlers();
    assert.deepEqual(xssCalls, []);
  });

  it("logs a warning when the markup is not valid", () => {
    const markup = createMarkup(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"></rect></svg>`);
    assert.notExists(markup.svgMarkup);
    assert.deepEqual(warnings.map((warning) => warning.message), ["Supplied markup svg is not a valid markup"]);
  });

  it("drops content beside the svg root", () => {
    const link = `<a href="https://example.com">link</a>`;
    const markup = createMarkup(`stray text${link}<font color="red">font</font><p>paragraph</p>
      <svg xmlns="http://www.w3.org/2000/svg" class="markup-container" viewBox="0 0 200 200">
        <g class="markup-svg"><rect width="10" height="10"></rect><p>breakout ${link}</p></g>
      </svg>${link}`);

    assert.isDefined(markup.svgMarkup);
    assert.equal(markup.markupDiv.childNodes.length, 1);
    assert.strictEqual(markup.markupDiv.firstChild, markup.svgContainer!.node);
    assert.equal(markup.markupDiv.textContent!.trim(), "");
    assert.isNotNull(markup.svgMarkup!.node.querySelector("rect"));
    assert.includeMembers(removedElements(), ["#text", "a", "font", "p"]);
  });

  it("keeps only same-document references on use elements", () => {
    const uses = [
      `<use id="sameDoc" href="#shape" x="20"></use>`,
      `<use id="sameDocXlink" xlink:href="#shape" x="40"></use>`,
      `<use id="mixed" href="#shape" xlink:href="other.svg#shape" x="60"></use>`,
      `<use id="external" href="https://example.com/other.svg#shape"></use>`,
      `<use id="protocolRelative" href="//example.com/other.svg#shape"></use>`,
      `<use id="relative" href="other.svg#shape"></use>`,
      `<use id="relativeXlink" xlink:href="other.svg#shape"></use>`,
      `<use id="dataUrl" href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=#shape"></use>`,
    ];
    const markup = createMarkup(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" class="markup-container" viewBox="0 0 200 200">
        <g class="markup-svg"><rect id="shape" width="10" height="10"></rect>${uses.join("")}</g>
      </svg>`);

    const references = Array.from(markup.svgMarkup!.node.querySelectorAll("use")).map((use) => [use.id, use.getAttribute("href"), use.getAttribute("xlink:href")]);
    assert.deepEqual(references, [
      ["sameDoc", "#shape", null],
      ["sameDocXlink", null, "#shape"],
      ["mixed", "#shape", null],
      ["external", null, null],
      ["protocolRelative", null, null],
      ["relative", null, null],
      ["relativeXlink", null, null],
      ["dataUrl", null, null],
    ]);
    assert.deepEqual(removedElements(), []);
    assert.deepEqual(removedAttributes(), ["xlink:href", "href", "href", "href", "xlink:href", "href"]);

    // the kept reference still draws the shape
    assert.equal((markup.svgMarkup!.node.querySelector("#sameDoc") as SVGGraphicsElement).getBBox().width, 10);
  });

  it("roundtrips markup created by the markup tools", () => {
    const markup = createMarkup();
    const g = markup.svgMarkup!;
    const style = MarkupApp.props.active.element;
    const tool = new LineTool();

    const marker = markup.createArrowMarker("red", 7, 6);
    const line = g.line(10, 10, 50, 50).css(style).css({ fill: "none" });
    line.marker("start", marker);
    line.marker("end", marker);
    g.rect(20, 30).move(5, 5).css(style).radius(4);
    g.polygon([0, 0, 10, 0, 10, 10]).css(style);
    g.polyline([0, 0, 10, 10, 20, 0]).css(style);
    g.path(MarkupApp.props.active.cloud.path).move(30, 30).width(40).height(20).css(style);
    g.circle(20).center(50, 50).css(style);
    g.ellipse(20, 10).move(60, 60).css(style);

    const text = new Text().plain("x");
    g.put(text);
    text.css(MarkupApp.props.active.text).addClass(MarkupApp.textClass).attr("text-anchor", "middle").translate(20, 30);
    text.createMarkup("a < b & c\n<i>second</i> line", 30);
    tool.createBoxedText(g, text);

    const group = g.group();
    group.rect(5, 5).css(style);
    group.markupStretch(0, 0, 0, 0, new Matrix().rotateO(20).translateO(3, 2));

    const saved = saveMarkup(markup);
    for (const emitted of ["<filter", "<feDropShadow", "stdDeviation=", "flood-color=", `filter="url(#${MarkupApp.dropShadowId})"`, "<marker", "markerWidth=",
      "refX=", "orient=", "overflow=", "marker-start=\"url(#", "marker-end=\"url(#", "<tspan", "dy=", "rx=", `class="${MarkupApp.boxedTextClass}"`, "transform=", "viewBox="])
      assert.include(saved, emitted, "fixture should contain what the tools emit");

    // The sanitizer trims attribute values, and svg.js writes path data with a trailing space.
    const trimmed = saved.replace(/ d="([^"]*?)\s+"/g, ' d="$1"');
    assert.notEqual(trimmed, saved);
    const sanitized = sanitizeSvg(saved);
    assert.lengthOf(sanitized.childNodes, 1);
    assert.equal(sanitized.firstElementChild?.outerHTML, trimmed);

    // Restoring a markup re-creates the drop shadow filter at the end of <defs>.
    const filter = trimmed.match(/<filter.*<\/filter>/)![0];
    const expected = trimmed.replace(filter, "").replace("</defs>", `${filter}</defs>`);
    markup.destroy(); // Markup finds its svg elements with global selectors, so only one may exist at a time.
    const restored = createMarkup(saved);
    assert.isDefined(restored.svgMarkup);
    assert.deepEqual(warnings, [], "valid markup should not log removals");
    assert.equal(saveMarkup(restored), expected);
    const restoredText = restored.svgMarkup!.findOne(`.${MarkupApp.textClass}`) as Text;
    assert.equal(restoredText.getMarkup(), "a < b & c\n<i>second</i> line");
  });

  it("strips script content from SymbolTool symbols", async () => {
    class TestSymbolTool extends SymbolTool {
      public placeSymbol(svg: G) {
        this._points.push(new Point3d(0, 0, 0));
        this.createMarkup(svg, { viewPoint: { x: 50, y: 40 }, isShiftKey: false } as unknown as BeButtonEvent, true);
        return this._symbol!;
      }
    }

    const markup = MarkupApp.markup = createMarkup();
    const symbolData = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
      <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 16 16" onload="${xssPayload("svg onload")}">
        <script>${xssPayload("script")}</script>
        <g transform="scale(2)"><path id="symbolPath" fill="#ea0000" d="M0,0 L10,10" onclick="${xssPayload("onclick")}"></path></g>
        <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x:" onerror="${xssPayload("foreignObject")}"></div></foreignObject>
        <a href="javascript:${xssPayload("href")}"><circle r="2"></circle></a>
      </svg>`;
    const symbol = new TestSymbolTool(symbolData).placeSymbol(markup.svgMarkup!);
    assertNoScriptContent(symbol.node);
    const path = symbol.node.querySelector("#symbolPath");
    assert.isNotNull(path);
    assert.equal(path!.getAttribute("fill"), "#ea0000");
    assert.isNotNull(symbol.node.querySelector("circle"));

    // symbol data without an enclosing <svg> element is also supported
    const fragmentSymbol = new TestSymbolTool(`<rect width="5" height="5"></rect><circle r="3" onclick="${xssPayload("fragment")}"></circle>`).placeSymbol(markup.svgMarkup!);
    assert.deepEqual(fragmentSymbol.children().map((child) => child.type), ["rect", "circle"]);
    assertNoScriptContent(fragmentSymbol.node);

    await waitForHandlers();
    assert.deepEqual(xssCalls, []);
  });

  it("does not log removals for valid symbols", () => {
    const symbol = `<?xml version="1.0" encoding="UTF-8"?>
      <!-- Generator: an SVG editor -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#ea0000" d="M0,0 L10,10"></path></svg>`;
    assert.include(sanitizeSvgContent(symbol), "<path");
    assert.include(sanitizeSvgContent(`<rect width="5" height="5"></rect>`), "<rect");
    assert.deepEqual(warnings, []);

    sanitizeSvgContent(`<rect width="5" height="5"></rect></svg><img src="x:">`);
    assert.include(removedElements(), "img");
  });

  it("text editor starts with the literal text", () => {
    const markup = createMarkup();
    const value = "a &amp; b <i>c</i>\nline 2";
    const text = markup.svgMarkup!.plain("");
    text.createMarkup(value, 30);

    const tool = new EditTextTool(text);
    tool.markup = markup;
    tool.startEditor();
    assert.equal(tool.editor!.value, value);
    tool.editDiv!.remove();
  });
});
