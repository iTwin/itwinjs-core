# Build & Test in a Linux Container on Windows

## Bootstrap

Ensure both Containers and Hyper-V are enabled in Windows.

- Open the Start Menu and starting typing "Turn Windows features on or off" to select it
- Ensure both 'Containers' and all of 'Hyper-V' are enabled.
  - [Hyper-V MS Docs](https://docs.microsoft.com/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v)
  - [Container MS Docs](https://docs.microsoft.com/virtualization/windowscontainers/quick-start/quick-start-windows-10-linux)
  - Hyper-V requires that virtualization is enabled in your BIOS. Every BIOS is different, so use Google or ask around if you encounter related errors.

Install [Docker CE](https://hub.docker.com/editions/community/docker-ce-desktop-windows) ([direct](https://download.docker.com/win/stable/Docker%20for%20Windows%20Installer.exe)). Keep all defaults. Tested with version 2.0.0.3 (engine 18.09.2); newer versions should likely work as well.

Customize Docker settings (in task bar notification area, right-click the Docker icon and select 'Settings').

- Shared Drives: You must share the drive(s) that contain your source code **and** your home drive.
- Advanced: Building is resource-intensive; we recommend at least 4 vCPUs and 4 GB of RAM.

Update VS Code to at least 1.35.0 (May 2019).

Install/update VS Code extension "Remote - Containers".

## How to use the container

Open your iTwin.js repo in VS Code, click the green area in the status bar, and select VS Code command 'Remote-Containers: Reopen Folder in Container'. Once connected, the green section of the status bar should say something like "Dev Container: imodeljs-linux".

The *first time* you "open" the container, you must clone the source code into the working directory, e.g. in VS Code's Terminal, `git clone URL /workspace/imodeljs`. If you use a custom NPM package source, you must also configure that (e.g. `npm config set ...`).

As with any copy of the code, you must build iTwin.js inside the container. Use VS Code's Terminal to perform normal build commands such as `rush install`, `rush rebuild`, and `rush test`. You should also have access to the same launch profiles in VS Code for debugging.

When you are done, click the green area in the status bar, and select 'Remote-Containers: Reopen Folder Locally' to switch back to a local view on your host.

### Notes

For performance reasons (e.g. 10x), we do **not** mount / share source code with the host computer and the container. The container must maintain its own unique copy of the source (and dependencies and output etc.). When VS Code is "connected" to the container, all file operations you perform in the GUI are done in the *container*, not the host. At this time, the best way to share changes with the host is to create a Git branch, and push/pull both sides to keep them in sync.

VS Code injects Git authorization tokens into the container, so you can fetch/pull/push as you would otherwise do on the host. VS Code also mounts your .gitconfig file from the host in the container, so your configured name/email/aliases etc. are available in the container.

The first time you "open" a container for a project, it will be built and persisted on your host computer. When first built, there is no source code in the container. However, after you've cloned the first time, the container should retain the source until you either tell VS Code to rebuild the container, or you tell docker to delete it. Source is expected to be cloned to /workspace/imodeljs; once you use VS Code's Terminal to clone, VS Code should automatically see the workspace.

### Terminal

- Use VS Code's Terminal window to interact directly with the container.
- The file system is **case-sensitive** (tab completion is configured to be *not* case-sensitive)
- The container is configured with zsh + oh-my-zsh + fzf for some additional niceties (e.g. case-insensitivity, git info at the prompt, and fuzzy history search).

### Common issues

- `rush test` fails with "... reporter blew up with error \\ Error: EINVAL: invalid argument, readlink ..."
  - Cause: unknown
  - Workaround: `rm -rf common/temp` and do `rush` install/rebuild/test again
  - To know earlier if you will have this problem, after a `rush rebuild`, run `find -L common/temp -type l`, and if anything other than common/temp/pnpm-store or common/temp/pnpm-local is reported, repeat the above workaround
