/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render, screen } from "@testing-library/react";
import { RadialButton, RadialMenu } from "../../core-react";
import userEvent from "@testing-library/user-event";

describe("RadialMenu", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;

  let radialMenu1: React.ReactElement<any>;

  beforeEach(() => {
    radialMenu1 = <RadialMenu
      opened={true}
      left={100}
      top={100}
      innerRadius={10}
      outerRadius={100}
    />;
    theUserTo = userEvent.setup();
  });

  describe("<RadialMenu />", () => {
    it("should render", () => {
      render(radialMenu1);

      expect(screen.getByTestId("core-radial-menu")?.style).to.include({left: "100px", top: "100px"});
    });

    it("should handle props changes", () => {
      const {container, rerender} = render(radialMenu1);

      const svg = container.querySelector<SVGElement>(".core-radial-menu-container");
      expect(svg?.getAttribute("width")).to.eq("202");
      expect(svg?.getAttribute("height")).to.eq("202");

      rerender(<RadialMenu opened={true} left={100} top={100} innerRadius={20} outerRadius={120} />);
      const rerenderedSvg = container.querySelector<SVGElement>(".core-radial-menu-container");
      expect(rerenderedSvg?.getAttribute("width")).to.eq("242");
      expect(rerenderedSvg?.getAttribute("height")).to.eq("242");
    });

    it("should fix x and y if too low", () => {
      render(<RadialMenu opened={true} left={-1} top={-1} innerRadius={10} outerRadius={100} />);

      expect(screen.getByTestId("core-radial-menu")?.style).to.include({left: "0px", top: "0px"});
    });

    it("should fix x and y if too high", () => {
      const value = 10000;
      render(<RadialMenu opened={true} left={value} top={value} innerRadius={10} outerRadius={100} />);

      const containerStyle = screen.getByTestId<HTMLDivElement>("core-radial-menu")?.style;
      expect(Number.parseInt(containerStyle?.left??"", 10)).to.be.lessThan(window.innerWidth);
      expect(Number.parseInt(containerStyle?.top??"", 10)).to.be.lessThan(window.innerWidth);
    });

    it("should call onEsc", async () => {
      const spyMethod = sinon.fake();
      render(<RadialMenu opened={true} left={100} top={100} innerRadius={10} outerRadius={100} onEsc={spyMethod} />);

      await theUserTo.type(screen.getByTestId("core-radial-menu"), "[Escape]");
      spyMethod.should.have.been.called;
    });

    it("should not call onEsc on other keys", async () => {
      const spyMethod = sinon.fake();
      render(<RadialMenu opened={true} left={100} top={100} innerRadius={10} outerRadius={100} onEsc={spyMethod} />);

      await theUserTo.type(screen.getByTestId("core-radial-menu"), "[Enter]");
      spyMethod.should.not.have.been.called;
    });

    it("should call onBlur on window mouseup", async () => {
      const spyMethod = sinon.fake();
      render(<><button/><RadialMenu opened={true} left={100} top={100} innerRadius={10} outerRadius={100} onBlur={spyMethod} /></>);

      await theUserTo.click(screen.getByRole("button"));

      spyMethod.should.have.been.called;
    });

  });

  describe("<RadialButton />", () => {

    it("renders correctly", () => {
      const data = [
        { label: "Browse", icon: "icon-browse-2", transform: "rotate(90 156, 101)", x:147.58096448796803, y:85},
        { label: "Properties", icon: "icon-properties-list", transform:"rotate(-45 139.89087296526012, 139.89087296526012)" , x:131.47183745322815 , y:123.89087296526012 },
        { label: "Status", icon: "icon-status-update", transform:"rotate(0 101, 156)" , x:92.58096448796803 , y: 140},
        { label: "App 2", icon: "icon-fill", transform:"rotate(45 62.10912703473989, 139.89087296526012)" , x:53.69009152270792 , y:123.89087296526012 },
        { label: "App 1", icon: "icon-process", transform:"rotate(-90 46, 101)" , x:37.58096448796803 , y: 85},
        { label: "Tools", icon: "icon-tools", transform:"rotate(-45 62.10912703473988, 62.10912703473989)" , x:53.69009152270791 , y: 46.10912703473989},
        { label: "Settings", icon: "icon-settings", transform: "rotate(0 100.99999999999999, 46)", x:92.580964487968, y:30 },
        { label: "Navigation", icon: "icon-view-navigation", transform:"rotate(45 139.8908729652601, 62.10912703473988)" , x: 131.47183745322812, y:46.10912703473988 },
      ];
      render(<RadialMenu
        opened={true}
        innerRadius={10}
        outerRadius={100}
      >
        {data.map((obj: any, index: any) => {
          return (
            <RadialButton
              key={index}
              icon={obj.icon}
              labelRotate={true}
            >{obj.label}
            </RadialButton>
          );
        })}
      </RadialMenu>);

      const expectedSize = 16.838071024063936;
      data.map(({label, transform, x, y})=> {
        const button = screen.getByText(label, {selector: ".core-radial-menu-button-svg>.core-radial-menu-button-container>.core-radial-menu-button-content"});
        const svg: HTMLElement | undefined | null = button.parentElement?.parentElement;

        expect(svg).to.exist;
        expect(svg?.getAttribute("transform")).to.eq(transform);
        expect(Number.parseFloat(svg?.getAttribute("x")??"")).to.be.closeTo(x, 0.05);
        expect(Number.parseFloat(svg?.getAttribute("y")??"")).to.be.closeTo(y, 0.05);
        expect(Number.parseFloat(svg?.getAttribute("width")??"")).to.be.closeTo(expectedSize, 0.05);
        expect(Number.parseFloat(svg?.getAttribute("height")??"")).to.be.closeTo(expectedSize, 0.05);
      });
    });

    it("should call onSelect", async () => {
      const spyMethod = sinon.fake();
      render(<RadialMenu opened={true} innerRadius={10} outerRadius={100}>
        <RadialButton key="0" icon="icon-placeholder" onSelect={spyMethod}> Test </RadialButton>
      </RadialMenu >);

      await theUserTo.click(screen.getByText("Test"));
      spyMethod.should.have.been.called;
    });

    it("should call onSelect when button select API called", () => {
      const spyMethod = sinon.fake();
      const button = React.createRef<RadialButton>();
      render(<svg><RadialButton ref={button} key="0" icon="icon-placeholder" onSelect={spyMethod}> Test </RadialButton></svg>);

      button.current?.select();
      spyMethod.should.have.been.called;
    });

    it("should call onSelect when menu select API called", () => {
      const spyMethod = sinon.fake();

      const menu = React.createRef<RadialMenu>();
      render(<RadialMenu ref={menu} opened={true} innerRadius={10} outerRadius={100} selected={0}>
        <RadialButton key="0" icon="icon-placeholder" onSelect={spyMethod}> Test </RadialButton>
      </RadialMenu >);

      menu.current?.select();
      spyMethod.should.have.been.called;
    });

    it("should handle hover state", async () => {
      const {container} = render(<RadialMenu opened={true} innerRadius={10} outerRadius={100}>
        <RadialButton key="0" icon="icon-placeholder" labelRotate={true} > Test </RadialButton>
      </RadialMenu >);

      await theUserTo.hover(screen.getByText("Test"));

      expect(container.querySelector(".core-radial-menu-sector.selected")).to.exist;

      await theUserTo.unhover(screen.getByText("Test"));

      expect(container.querySelector(".core-radial-menu-sector.selected")).to.be.null;
    });

  });
});
