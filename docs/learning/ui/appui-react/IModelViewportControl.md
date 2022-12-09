# IModelViewportControl

The [IModelViewportControl]($appui-react) is a component based on the [ViewportContentControl]($appui-react) that includes some convenience features for the iTwinjs app developer.

### IModelViewportControlOptions

In addition to connecting to the iModelConnection property from the AppUi Redux store, IModelViewportControl offers configuration via a set of optional props in the interface [IModelViewportControlOptions]($appui-react):

* viewState: Can point to a ViewStateProp or a function that returns a ViewStateProp.
* iModelConnection: A connection to an [IModelDb]($backend) hosted on the backend, or a function that returns the IModelConnection.
* featureOptions: A map of options to set the state of optional features in the view. For example, to enable automatic display of a timeline component for models containing a schedule script. This is the property you can use to turn on the animation timelines in the [DefaultViewOverlay]($appui-react).
* bgColor: If there is no ViewState or IModelConnection defined for the Viewport, defining this optional prop allows you to set the background color. IF a valid ScreenViewport can be created, this value is ignored.
* alwaysUseSuppliedViewState: Always use the state passed in via the viewState property above.
* supplyViewOverlay: A ReactNode or a function to supply a ReactNode to display as an overlay for the viewport.
* deferNodeInitialization:Don't initialize the ReactNode until the first ReactNode is needed.

### DefaultViewOverlay

The [DefaultViewOverlay]($appui-react) offers animation timelines for schedule simulation, analysis data, and solar shadows. If enabled on the IModelViewport, the animation timeline will show up automatically if the relevant script or data is available through the ViewState. To enable the overlay, include one or more of the options for defaultViewOverlay in the featureOptions:

```tsx
defaultViewOverlay: {
  enableScheduleAnimationViewOverlay: true,
  enableAnalysisTimelineViewOverlay: true,
  enableSolarTimelineViewOverlay: true,
}
```
