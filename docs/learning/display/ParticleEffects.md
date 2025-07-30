# Particle Effects

iTwin.js supports display of large quantities of similar objects - called "particles" - using [particle systems](https://en.wikipedia.org/wiki/Particle_system). Using a [ParticleCollectionBuilder]($frontend), you can define the image to be used by each particle along with its scale, position, rotation, transparency, and other properties. These properties can be updated as frequently as every frame based on your simulation logic and re-rendered efficiently using [instancing](https://en.wikipedia.org/wiki/Geometry_instancing). In addition to their typical use in simulating effects like fire and weather, particle collections can be used for simulations and IoT visualization. For example:

- [Rain and snow effects](https://www.itwinjs.org/sandboxes/iTwinPlatform/Snow%20and%20Rain%20Particle%20Effect/)
- [Fire and smoke effects](https://www.itwinjs.org/sandboxes/iTwinPlatform/Fire%20Particle%20Effect/)
- [Traffic simulation](https://www.itwinjs.org/sandboxes/iTwinPlatform/Car%20Particle%20Effect/) of tens of thousands of vehicles traversing roads anywhere in the world, using roadway information obtained from OpenStreetMaps for accurate navigation.

In the image below, snowfall is simulated using a particle effect:

![Snowfall particle effect](../../changehistory/assets/snow.jpg)
