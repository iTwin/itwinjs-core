# Markers

A [Marker]($frontend) is a [CanvasDecoration]($frontend), whose position follows a fixed location in world space. Markers draw on top of all scene graphics, and provide visual cues about locations of interest. The name and the concept derive from the eponymous type in the [Google Maps api](https://developers.google.com/maps/documentation/javascript/markers).

Markers are often used to show locations in physical space where records from an external data source are located. They provide a way for applications to show additional information from the external source as the cursor hovers over them, and  actions to be performed when they are clicked.

Sometimes Markers are used to show the location of elements within an iModel that are of interest. In that case the location of the Marker can be established from the origin, center, or perhaps other points derived from the element's properties.

## MarkerSets

Often there will be many Markers relevant to show a group of points of interest. When the set of Markers becomes large, or when the user zooms far away from Marker locations, they tend to overlap one another and create clutter. For this purpose, the class [MarkerSet]($frontend) provides a way to group sets of related Markers together such that overlapping sets of them form a [Cluster]($frontend). [MarkerSet]($frontend) provides techniques for you to supply the graphics to visually indicate the set of Markers it represents.

> Note: Only Markers from the same MarkerSet will be clustered. Independent Markers or Markers from different MarkerSets will not cluster.
