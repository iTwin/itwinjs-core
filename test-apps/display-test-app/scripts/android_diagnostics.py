#!/usr/bin/env python3
"""Capture and collect diagnostics from the Android display-test-app run."""

import os
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Optional, Sequence


_SECRET_ENV_VARS = (
    "IMJS_OIDC_CLIENT_ID",
    "IMJS_OIDC_CLIENT_SECRET",
    "AZURE_DEVOPS_EXT_PAT",
    "TOKEN",
    "GITHUBPAT",
    "GITHUB_TOKEN",
    "NPM_TOKEN",
    "GPR_KEY",
)


def secret_values(environment: Optional[dict[str, str]] = None) -> list[str]:
    """Return configured credential values, longest first for safe replacement."""
    values = environment if environment is not None else os.environ
    return sorted(
        {values[name] for name in _SECRET_ENV_VARS if values.get(name)},
        key=len,
        reverse=True,
    )


def redact(text: str, secrets: Optional[Iterable[str]] = None) -> str:
    """Replace known credential values before text is written to an artifact."""
    for secret in secrets if secrets is not None else secret_values():
        text = text.replace(secret, "<REDACTED>")
    return text


def diagnostics_dir() -> Optional[Path]:
    """Return and create the optional per-run diagnostics directory."""
    value = os.environ.get("ANDROID_DIAGNOSTICS_DIR")
    if not value:
        return None
    directory = Path(value)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def write_log(path: Path, contents: str) -> None:
    """Write a redacted text log."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(redact(contents), encoding="utf-8")


def capture_completed_process(directory: Path, name: str, result: subprocess.CompletedProcess) -> None:
    """Persist a command's stdout, stderr, and exit code as separate redacted files."""
    write_log(directory / f"{name}.stdout.log", result.stdout or "")
    write_log(directory / f"{name}.stderr.log", result.stderr or "")
    write_log(directory / f"{name}.exit-code", str(result.returncode))


def capture_exception(directory: Path, name: str, error: BaseException) -> None:
    """Persist a diagnostic-capture error without changing the test result."""
    write_log(directory / f"{name}.error.log", f"{type(error).__name__}: {error}\n")


def capture_stdin(path: Path) -> None:
    """Echo a command's output while writing a redacted copy for artifact publication."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as output:
        for line in sys.stdin:
            sys.stdout.write(line)
            sys.stdout.flush()
            output.write(redact(line))
            output.flush()


def _copy_text(source: Path, destination: Path) -> None:
    try:
        write_log(destination, source.read_text(encoding="utf-8", errors="replace"))
    except OSError as error:
        write_log(destination.with_suffix(destination.suffix + ".error.log"), f"{source}: {error}\n")


def _recent(path: Path, cutoff: float) -> bool:
    try:
        return path.is_file() and path.stat().st_mtime >= cutoff
    except OSError:
        return False


def _safe_name(path: Path) -> str:
    return "-".join(path.parts[-2:])


def _remove_forbidden_files(directory: Path) -> None:
    """Keep the artifact directory limited to text diagnostics, never credentials or binaries."""
    forbidden_suffixes = {".apk", ".aab", ".env", ".p12", ".pem", ".key"}
    for path in directory.rglob("*"):
        if not path.is_file():
            continue
        if path.name == "env.json" or path.suffix.lower() in forbidden_suffixes:
            path.unlink(missing_ok=True)
            continue
        try:
            contents = path.read_bytes()
        except OSError:
            continue
        if b"\0" in contents:
            path.unlink(missing_ok=True)
            continue
        write_log(path, contents.decode("utf-8", errors="replace"))


def _capture_host_command(directory: Path, name: str, command: Sequence[str]) -> None:
    try:
        result = subprocess.run(command, capture_output=True, text=True, errors="replace", timeout=30)
        capture_completed_process(directory, name, result)
    except (OSError, subprocess.TimeoutExpired) as error:
        capture_exception(directory, name, error)


def collect_diagnostics(
    output: Path,
    project: Path,
    gradle_user_home: Path,
    started_at: float,
) -> None:
    """Collect bounded Android/JVM evidence into one publication directory."""
    output.mkdir(parents=True, exist_ok=True)
    cutoff = started_at - 2.0
    collected: list[str] = []
    daemon_dir = gradle_user_home / "daemon"

    for report in sorted(project.rglob("hs_err_pid*.log")):
        if not _recent(report, cutoff):
            continue
        destination = output / f"jvm-{report.name}"
        _copy_text(report, destination)
        collected.append(destination.name)
        pid = report.stem.removeprefix("hs_err_pid")
        for daemon in daemon_dir.glob(f"*/daemon-{pid}.out.log"):
            destination = output / f"gradle-{_safe_name(daemon)}"
            _copy_text(daemon, destination)
            collected.append(destination.name)

    for daemon in sorted(daemon_dir.glob("*/*.out.log")):
        if not _recent(daemon, cutoff):
            continue
        destination = output / f"gradle-{_safe_name(daemon)}"
        if destination.name not in collected:
            _copy_text(daemon, destination)
            collected.append(destination.name)

    _capture_host_command(output, "host-disk", ["df", "-h", "/"])
    _capture_host_command(output, "workspace-disk", ["df", "-h", str(project)])
    summary = [
        "Android diagnostics collected.",
        f"Run start time: {started_at}",
        f"Project: {project}",
        f"Gradle user home: {gradle_user_home}",
        "Collected JVM/Gradle files:",
        *(f"- {name}" for name in sorted(set(collected))),
        "The Android command output, emulator output, logcat snapshots, and adb state are stored in this same folder.",
    ]
    write_log(output / "summary.txt", "\n".join(summary) + "\n")
    _remove_forbidden_files(output)


def collect_from_environment() -> None:
    output_value = os.environ.get("ANDROID_DIAGNOSTICS_DIR")
    started_value = os.environ.get("ANDROID_BUILD_STARTED_AT")
    if not output_value or not started_value:
        raise RuntimeError("ANDROID_DIAGNOSTICS_DIR and ANDROID_BUILD_STARTED_AT are required")
    project = Path(os.environ.get("ANDROID_PROJECT_DIR", "android/imodeljs-test-app"))
    gradle_user_home = Path(os.environ.get("GRADLE_USER_HOME", str(Path.home() / ".gradle")))
    collect_diagnostics(Path(output_value), project, gradle_user_home, float(started_value))


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "capture":
        if len(sys.argv) != 3:
            raise SystemExit("usage: android_diagnostics.py capture <output-file>")
        capture_stdin(Path(sys.argv[2]))
        return
    if len(sys.argv) == 2 and sys.argv[1] == "collect":
        collect_from_environment()
        return
    raise SystemExit("usage: android_diagnostics.py capture <output-file> | collect")


if __name__ == "__main__":
    main()
