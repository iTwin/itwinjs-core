# Native Applications

A native application (aka "native app") is an application where the frontend [IModelApp]($frontend) process and the backend [IModelHost]($backend) process are **always running on the same computer**. This permits them to make assumptions about their environment, and to perform operations that may not be possible if that local-inter-process relationship weren't guaranteed.

## Installers and Permissions

Native apps are *installed* on a computer by an installer program that supplies both the frontend and backend implementations at the same time. This implies a level of guaranteed version-compatibility, since both parts are delivered together. It also implies a level of *trust* obtained by the user's consent at install time. That doesn't mean that there aren't security concerns for native apps, particularly if the frontend loads the downloaded resources. But, the backend is explicitly granted access to OS level services on the device. These permissions are specified either at install time or via consent dialogs during operation. The frontend - knowing that its backend is working exclusively on its behalf on the same computer - is free to request services of the backend that browser-based apps cannot do for security reasons.

## IPC

Since the (single) frontend process and the (single) backend process are always paired on the same computer, the IPC connection between them can be assumed to be very efficient. It is usually implemented as a named pipe. The bandwidth and latency concerns of web applications are not as relevant for native apps. Of course inter-process Ipc bandwidth is not infinite and latency is not zero, so round-trips and payloads between processes should still be minimized. But both are generally 2 orders of magnitude less limited than network-based Ipc.

## iModel Editing

Applications that modify iModels do so through a *long transaction* editing mode the requires a private local copy of the entire database (i.e. a [briefcase](../learning/Glossary.md#Backend)) synchronized through changesets. The briefcase holds all of the changes to the database for the editing session, that can span several minutes, days, even weeks. Native apps are well suited for this purpose, because a local disk on the device where the application is installed, owned by the user making the changes, is the ideal place for that file to live. In addition, editing applications can require substantial compute resources and are often very "chatty" when providing feedback during modification operations. For both of those reasons, most editing applications should be native apps.

Note that being a native app doesn't mean that the user experience should feel "disconnected". Native applications can and should often connect to servers, when the user is online, to coordinate the efforts of team members and to obtain shared resources. Remember, the frontend of a native application *is* a full featured web browser (either Chrome or Safari depending on the platform.)

## Offline Operation

An important virtue of native apps, and of iModels and iTwin.js in general, is that it permits queries, visualizations and editing of the iModel database without requiring a connection to a server. Of course native apps *can* connect to external services via HTTP (e.g. IModelHub), but may also work with no internet connection. This is especially valuable for mobile applications where network connections are often unreliable or slow.

## Automatic Updates

Native applications are installed on a computer and are granted permissions to perform local operations by the owner of that computer. One essential permission that must be granted is the ability to *continuously* refresh the application itself as and when required. In other words, native applications, by design, are installed *once* and kept up-to-date *forever*. [Visual Studio Code](https://code.visualstudio.com/) is a good example to follow.

This eliminates many issues associated with desktop applications and sometimes listed as a virtue of web/cloud-based applications; worrying about old versions continuing to create problems after issues are fixed. It also facilitates the fast paced build-measure-learn-refine software development cadence that web developers take for granted.

Users of mobile apps are already used to this app-store-auto update model, but some desktop users are accustomed to the decades old every-other-year-big-bang update model. iTwin.js presumes auto updating of native apps, and you should too.

## Platforms

Native apps run on either desktop computers or mobile devices.

On desktop computers, iTwin.js relies on [Electron](https://www.electronjs.org/) for its platform-specific layers. Electron supports Windows, Macs, and Linux. There are a few platform-specific features that native apps can avail, but generally it's a good idea to let Electron handle most platform/OS specific needs. Note that Electron delivers a custom version of Node.js that runs the backend for desktop native apps.

It is essential to test your application on multiple platforms to ensure you haven't inadvertently taken on a specific platform dependence.

For iOS and Android, native apps use Safari and Chrome respectively for the frontend, and Node.js directly for the backend. The Ipc layer uses WebSockets.
