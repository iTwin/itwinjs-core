# UI 2.0

With the release of the `iTwin.js 2.0`, new UI components are available that provide a new look and feel for iTwin Apps. The new look and feel is referred to as `UI 2.0`. The two primary goals of `UI 2.0` are to limit the amount of UI components that obscure the iModel content and to ensure that Extensions can augment the UI provided by the host IModelApp.

## Frontstage shown using UI 2.0 components

Below is an example frontstage that shows the different areas/zones.

![FrontstageUi2](./FrontstageUi2.png "UI 2.0 Frontstage design")

## Defining UI 2.0 Frontstage

The definition that produces the sample frontstage is shown below.

```tsx
  <Frontstage id="Ui2Sample"
    version={2.1}
    defaultTool={CoreTools.selectElementCommand}
    defaultLayout="SingleContent"
    contentGroup={myContentGroup}
    defaultContentId="singleIModelView"
    isInFooterMode={true}
    usage={StageUsage.General}
    applicationData={{ key: "value" }}
    contentManipulationTools={
      <Zone
        widgets={[
          <Widget isFreeform={true} element={<BasicToolWidget />} />,
        ]}
      />
    }
    viewNavigationTools={
      <Zone
        widgets={[
          <Widget isFreeform={true} element={<BasicNavigationWidget />} />,
        ]}
      />
    }
    toolSettings={
      <Zone
        widgets={[
          <Widget isToolSettings={true} />,
        ]}
      />
    }
    statusBar={
      <Zone
        widgets={[
          <Widget isStatusBar={true} classId="SmallStatusBar" />,
        ]}
      />
    }

    leftPanel={
      <StagePanel
        size={300}
        defaultState={StagePanelState.Minimized}
        panelZones={{
          start: {
            widgets: [
              <Widget id="LeftStart1" label="Start1" defaultState={WidgetState.Open} element={<h2>Left Start1 widget</h2>} />,
              <Widget id="LeftStart2" label="Start2" element={<h2>Left Start2 widget</h2>} />,
            ],
          },
          middle: {
            widgets: [
              <Widget id="LeftMiddle1" label="Middle1" element={<h2>Left Middle1 widget</h2>} />,
              <Widget id="LeftMiddle2" label="Middle2" defaultState={WidgetState.Open} element={<h2>Left Middle2 widget</h2>} />,
            ],
          },
          end: {
            widgets: [
              <Widget id="LeftEnd1" label="End1" defaultState={WidgetState.Open} element={<h2>Left End1 widget</h2>} />,
              <Widget id="LeftEnd2" label="End2" element={<h2>Left End2 widget</h2>} />,
            ],
          },
        }}
      />
    }

    topPanel={
      <StagePanel
        size={90}
        defaultState={StagePanelState.Minimized}
        panelZones={{
          start: {
            widgets: [
              <Widget id="TopStart1" label="Start1" defaultState={WidgetState.Open} element={<h2>Top Start1 widget</h2>} />,
              <Widget id="TopStart2" label="Start2" element={<h2>Top Start2 widget</h2>} />,
            ],
          },
          end: {
            widgets: [
              <Widget id="TopEnd1" label="End1" element={<h2>Top End1 widget</h2>} />,
              <Widget id="TopEnd2" label="End2" defaultState={WidgetState.Open} element={<h2>Top End2 widget</h2>} />,
            ],
          },
        }}
      />
    }

    rightPanel={
      <StagePanel
        defaultState={StagePanelState.Open}
        panelZones={{
          start: {
            widgets: [
              <Widget id="RightStart1" label="Start1" element={<h2>Right Start1 widget</h2>} />,
              <Widget id="RightStart2" label="Start2" defaultState={WidgetState.Open} element={<h2>Right Start2 widget</h2>} />,
            ],
          },
          middle: {
            widgets: [
              <Widget id="RightMiddle1" label="Middle1" defaultState={WidgetState.Open} element={<h2>Right Middle1 widget</h2>} />,
              <Widget id="RightMiddle2" label="Middle2" element={<h2>Right Middle2 widget</h2>} />,
            ],
          },
          end: {
            widgets: [
              <Widget id="RightEnd1" label="End1" element={<h2>Right End1 widget</h2>} />,
              <Widget id="RightEnd2" label="End2" defaultState={WidgetState.Open} element={<h2>Right End2 widget</h2>} />,
            ],
          },
        }}
      />
    }

    bottomPanel={
      <StagePanel
        size={180}
        defaultState={StagePanelState.Minimized}
        panelZones={{
          start: {
            widgets: [
              <Widget id="BottomStart1" label="Start1" element={<h2>Bottom Start1 widget</h2>} />,
              <Widget id="BottomStart2" label="Start2" defaultState={WidgetState.Open} element={<h2>Bottom Start2 widget</h2>} />,
            ],
          },
          end: {
            widgets: [
              <Widget id="BottomEnd1" label="End1" defaultState={WidgetState.Open} element={<h2>Bottom End1 widget</h2>} />,
              <Widget id="BottomEnd2" label="End2" element={<h2>Bottom End2 widget</h2>} />,
            ],
          },
        }}
      />
    }
  />

```
