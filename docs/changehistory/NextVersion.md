---
publish: false
---
# NextVersion

Table of contents:

- [AppUi](#appui)
  - [Setting allowed panel zones for widgets](#setting-allowed-panel-zones-for-widgets)
  
## AppUi

### Setting allowed panel zones for widgets

When defining a Widget with AbstractWidgetProperties, you can now specify on which sides of the ContentArea the it can be docked. The optional prop allowedPanelTargets is an array of any of the following: "left", "right", "top", "bottom". By default, all regions are allowed. You must specify at least one allowed target in the array.

