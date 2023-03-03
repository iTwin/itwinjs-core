/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { WidgetState } from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, PresentationSelectionScope, SelectionScopeField, SessionStateActionId, StatusBar,
  StatusBarWidgetControl, StatusBarWidgetControlArgs, UiFramework, WidgetDef,
} from "../../appui-react";
import TestUtils, { handleError, selectChangeValueByIndex, stubScrollIntoView } from "../TestUtils";

[true, false].map((withDeprecated) => {
  const testType = withDeprecated ? " (with deprecated isInFooterMode props)" : "";
  describe(`SelectionScopeField${testType}`, () => {
    class AppStatusBarWidgetControl extends StatusBarWidgetControl {
      constructor(info: ConfigurableCreateInfo, options: any) {
        super(info, options);
      }

      // eslint-disable-next-line deprecation/deprecation
      public getReactNode({ isInFooterMode }: StatusBarWidgetControlArgs): React.ReactNode {
        return (
          <>
            <SelectionScopeField  {...(withDeprecated ? {isInFooterMode} : {})} />
          </>
        );
      }
    }

    let widgetControl: StatusBarWidgetControl | undefined;
    describe("Bare tests", () => {
      before(async () => {
        await MockRender.App.startup();
        await TestUtils.initializeUiFramework();

        const statusBarWidgetDef = new WidgetDef({ // eslint-disable-line deprecation/deprecation
          classId: AppStatusBarWidgetControl,
          defaultState: WidgetState.Open,
          isFreeform: false,
          isStatusBar: true,
        });
        widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
      });

      after(async () => {
        TestUtils.terminateUiFramework();
        await MockRender.App.shutdown();
      });

      it("SelectionScopeField with default data", () => {
        const component = render(<Provider store={TestUtils.store}>
          <StatusBar widgetControl={widgetControl} />
        </Provider>);
        expect(component).not.to.be.undefined;
        const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
        expect(selectElement).not.to.be.null;
        expect(UiFramework.getActiveSelectionScope()).to.be.equal("element");
      });

      it("SelectionScopeField with multiple scopes", async () => {
        UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, [
          { id: "element", label: "Element" } as PresentationSelectionScope,
          { id: "assembly", label: "Assembly" } as PresentationSelectionScope,
          { id: "top-assembly", label: "Top Assembly" } as PresentationSelectionScope,
        ]);

        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "top-assembly");

        // UiFramework.frameworkState!.sessionState.availableSelectionScopes = 1;
        const component = render(<Provider store={TestUtils.store}>
          <StatusBar widgetControl={widgetControl} />
        </Provider>);
        expect(component).not.to.be.undefined;
        const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
        expect(selectElement).not.to.be.null;
        expect(UiFramework.getActiveSelectionScope()).to.be.equal("top-assembly");
        // expect(selectElement.selectedIndex).to.be.equal(2);
      });
    });

    // before we can test setting scope to a valid scope id we must make sure Presentation Manager is initialized.
    describe("Test that requires Presentation", () => {

      const shutdownIModelApp = async () => {
        if (IModelApp.initialized)
          await IModelApp.shutdown();
      };

      before(async () => {
        await shutdownIModelApp();
        Presentation.terminate();

        await initializePresentationTesting();
        await TestUtils.initializeUiFramework();

        const statusBarWidgetDef = new WidgetDef({ // eslint-disable-line deprecation/deprecation
          classId: AppStatusBarWidgetControl,
          defaultState: WidgetState.Open,
          isFreeform: false,
          isStatusBar: true,
        });
        widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
      });

      after(async () => {
        TestUtils.terminateUiFramework();
        await terminatePresentationTesting();
      });

      stubScrollIntoView();

      it("SelectionScopeField with specific scopes", async () => {
        UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, [
          { id: "element", label: "Element" } as PresentationSelectionScope,
          { id: "assembly", label: "Assembly" } as PresentationSelectionScope,
          { id: "top-assembly", label: "Top Assembly" } as PresentationSelectionScope,
        ]);

        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "top-assembly");

        // UiFramework.frameworkState!.sessionState.availableSelectionScopes = 1;
        const component = render(<Provider store={TestUtils.store}>
          <StatusBar widgetControl={widgetControl} />
        </Provider>);
        expect(component).not.to.be.undefined;
        const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
        expect(selectElement).not.to.be.null;
        selectChangeValueByIndex(selectElement, 1, handleError); // use index now that labels are localized in frontend
        await TestUtils.flushAsyncOperations();
        expect(UiFramework.getActiveSelectionScope()).to.be.equal("assembly");
        // expect(selectElement.selectedIndex).to.be.equal(1);
      });

      it("SelectionScopeField should properly handle empty override scope labels", async () => {
        UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, [
          { id: "element", label: "" } as PresentationSelectionScope,
          { id: "assembly", label: "" } as PresentationSelectionScope,
          { id: "top-assembly", label: "" } as PresentationSelectionScope,
        ]);

        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "top-assembly");

        const component = render(<Provider store={TestUtils.store}>
          <StatusBar widgetControl={widgetControl} />
        </Provider>);
        expect(component).not.to.be.undefined;
        const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
        expect(selectElement).not.to.be.null;
        expect(UiFramework.getActiveSelectionScope()).to.be.equal("top-assembly");
        component.getByText("selectionScopeLabels.top-assembly");
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "assembly");
        component.getByText("selectionScopeLabels.assembly");
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "element");
        component.getByText("selectionScopeLabels.element");
      });

      it("SelectionScopeField should properly handle override scope labels", async () => {
        UiFramework.dispatchActionToStore(SessionStateActionId.SetAvailableSelectionScopes, [
          { id: "element", label: "Functional Element" } as PresentationSelectionScope,
          { id: "assembly", label: "Functional Assembly" } as PresentationSelectionScope,
          { id: "top-assembly", label: "Functional TopAssembly" } as PresentationSelectionScope,
        ]);

        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "top-assembly");

        const component = render(<Provider store={TestUtils.store}>
          <StatusBar widgetControl={widgetControl} />
        </Provider>);
        expect(component).not.to.be.undefined;
        const selectElement = component.getByTestId("components-selectionScope-selector") as HTMLSelectElement;
        expect(selectElement).not.to.be.null;
        expect(UiFramework.getActiveSelectionScope()).to.be.equal("top-assembly");
        component.getByText("Functional TopAssembly");
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "assembly");
        component.getByText("Functional Assembly");
        UiFramework.dispatchActionToStore(SessionStateActionId.SetSelectionScope, "element");
        component.getByText("Functional Element");
      });
    });
  });
});
