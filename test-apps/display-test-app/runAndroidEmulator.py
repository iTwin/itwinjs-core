#!/usr/bin/env python3
import fileinput
import json
import os
import platform
import shutil
import subprocess
import sys
import textwrap
import threading
import time
from typing import Union

class Env:
    '''
    Class to determine where to find files.
    '''

    # Constants
    avd_name = 'api-33'
    '''The name of the avd to use.'''
    cmdline_tools_ver = '9.0'
    '''The version of the Android command line tools to use.'''

    # Calculated variables
    bin_dir: str
    ''' The directory of the Android command line tools binaries. '''
    emulator_dir: str
    ''' The directory of the Android emulator. '''
    adb: str
    ''' The full path to the adb binary. '''
    adb_cmd: str
    ''' The command line to use to run adb. '''
    script_dir = f'{os.path.dirname(os.path.abspath(__file__))}'
    ''' The directory containing this Python script. '''
    upack_dir = f'{script_dir}/upack'
    ''' The directory into which to install upacks. '''
    sdk_dir = f'{upack_dir}/androidsdk_macos'
    ''' The directory of the Android SDK. '''
    jdk_dir = f'{upack_dir}/openjdk_macos'
    ''' The directory of the JDK. '''
    avd_dir = f'{upack_dir}/androidavd_macos'
    ''' The directory of the Android emulator AVDs. '''
    test_app_dir = f'{script_dir}/android/imodeljs-test-app'
    ''' The directory containing the Android test app. '''
    apk_path = f'{script_dir}/android/imodeljs-test-app/app/build/outputs/apk/debug/app-debug.apk'
    ''' The full path to the display-test-app APK. '''
    bim_dir = f'{script_dir}/test-models'
    ''' The directory containing the sample bim file. '''
    env_json_path = f'{script_dir}/lib/mobile/env.json'
    ''' The full path to the env.json file used by display-test-app. '''

    def __init__(self):
        self.bin_dir = f'{self.sdk_dir}/cmdline-tools/{self.cmdline_tools_ver}/bin'
        self.emulator_dir = f'{self.sdk_dir}/emulator'
        self.adb = f'{self.sdk_dir}/platform-tools/adb'
        self.adb_cmd = f'{self.adb} -e'

    def verify_paths(self) -> None:
        '''
        Verify that various path variables refer to valid paths.
        '''
        if not os.path.isdir(self.bin_dir):
            raise Exception(f'Android command line tools directory ({self.bin_dir}) does not exist!')
        if not os.path.isdir(self.emulator_dir):
            raise Exception(f'Android emulator directory ({self.emulator_dir}) does not exist!')
        if not os.path.isdir(self.avd_dir):
            raise Exception(f'Android virtual device directory ({self.avd_dir}) does not exist!')
        if not os.path.exists(self.adb):
            raise Exception(f'Android debugger ({self.adb}) does not exist!')

    def __repr__(self):
        return f'''      sdk_dir: {self.sdk_dir}
      avd_dir: {self.avd_dir}
      bin_dir: {self.bin_dir}
 emulator_dir: {self.emulator_dir}
          adb: {self.adb}
      adb_cmd: {self.adb_cmd}
   script_dir: {self.script_dir}
     apk_path: {self.apk_path}
      bim_dir: {self.bim_dir}
env_json_path: {self.env_json_path}'''

env: Env

class Emulator:
    '''
    Wrapper class for launching Android emulator.
    '''

    __process: Union[subprocess.Popen, None]
    __thread: Union[threading.Thread, None]
    __launch_error: Union[Exception, None]
    __lock: threading.Lock
    __avd_name: str
    __avd_home: str
    __jdk_home: str
    __emulator_dir: str
    __debug_log = False

    def __init__(self, avd_name: str, avd_home: str, jdk_home: str, emulator_dir: str):
        self.__process = None
        self.__thread = None
        self.__launch_error = None
        self.__lock = None
        self.__avd_name = avd_name
        self.__avd_home = avd_home
        self.__jdk_home = jdk_home
        self.__emulator_dir = emulator_dir

    def fix_ini_path(self) -> None:
        ini_path = f'{self.__avd_home}/{self.__avd_name}.ini'
        for line in fileinput.input(ini_path, inplace=True):
            newline = line
            if line.startswith('path='):
                newline = f'path={self.__avd_home}/{self.__avd_name}.avd\n'
            sys.stdout.write(newline)

    def start(self) -> None:
        '''
        Start the emulator in a background thread and wait for the emulator's process to open.
        '''
        def target():
            emulator_env = os.environ.copy()
            emulator_env['ANDROID_AVD_HOME'] = self.__avd_home
            emulator_env['JAVA_HOME'] = self.__jdk_home
            try:
                self.__process = subprocess.Popen(
                    [f'./emulator', f'@{self.__avd_name}', '-no-snapshot', '-no-window'],
                    cwd=self.__emulator_dir,
                    env=emulator_env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True
                )
                self.__lock.release()
                for line in self.__process.stdout:
                    if self.__debug_log:
                        log(f'EMULATOR: {line}', end='')
                self.__process.stdout.close()
                self.__process.wait()
            except Exception as e:
                self.__launch_error = e
                self.__lock.release()

        self.__lock = threading.Lock()
        self.__lock.acquire()
        self.__thread = threading.Thread(target=target)
        self.__thread.start()
        self.__lock.acquire()
        if self.__launch_error is not None:
            raise self.__launch_error

    def stop(self) -> None:
        '''
        Stop the running emulator.
        '''
        if self.__thread.is_alive():
            self.__process.terminate()
            self.__thread.join()

def log(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def run_command(command: str, error: str) -> None:
    '''
    Call `os.system` with the specified command and throw an exception with the given error string
    if the exit code from the command is non-zero.
    '''
    if os.system(command) != 0:
        raise Exception(error)

def start_emulator() -> Emulator:
    '''
    Start the Android emulator and return an object representing it.
    '''
    emulator = Emulator(env.avd_name, env.avd_dir, env.jdk_dir, env.emulator_dir)
    log('Fixing path setting in emulator\'s ini file...')
    emulator.fix_ini_path()
    log('Starting Android emulator...')
    emulator.start()
    shell_cmd = 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done;'
    run_command(
        f'{env.adb_cmd} wait-for-device shell \'{shell_cmd}\'',
        'Error waiting for emulator to boot!'
    )
    log('Emulator started.')
    return emulator

def install_apk() -> None:
    '''
    Install the display-test-app APK onto the emulator.
    '''
    log(f'Installing apk {env.apk_path}...')
    run_command(f'{env.adb_cmd} install -r -g {env.apk_path}', 'Error installing APK!')
    log('APK installed.')

def start_app() -> None:
    '''
    Start display-test-app on the emulator and wait for it to launch.
    '''
    log('Starting display-test-app...')
    run_command(f'{env.adb_cmd} logcat -c', 'Error clearing adb logcat!')
    activity_name = 'com.bentley.imodeljs_test_app/.MainActivity'
    shell_cmd = f'am start -S -n "{activity_name}" -a android.intent.action.MAIN'
    run_command(f'{env.adb_cmd} shell {shell_cmd}', 'Error starting display-test-app!')
    log('display-test-app started.')

def wait_for_first_render(wait_minutes: float) -> bool:
    '''
    Wait for display-test-app to complete its first render of its model.

    Returns `True` on success, `False` on failure.
    '''
    log('Waiting for first render to finish...')
    start_time = time.time()
    while True:
        result = subprocess.run([env.adb, '-e', 'logcat', '-d'], capture_output=True, text=True)
        if result.stdout.find('com.bentley.display_test_app: First render finished.') != -1:
            log('Success!')
            return True
        if time.time() - start_time >= 60.0 * wait_minutes:
            log('Timed out!')
            return False

def run_app() -> bool:
    '''
    Run the app and return True on success of False on failure. Since the app often fails on the
    first run, this will run it a second time in the event of a failure on the first run.
    Note: first run waits for 1 minute; second run waits for 3 minutes.
    '''
    for i in range(2):
        start_app()
        if wait_for_first_render(i * 2.0 + 1.0):
            return True
    return False

def stop_emulator(emulator: Union[Emulator, None]) -> None:
    '''
    Stop the emulator and wait for it to exit.
    '''
    if emulator == None:
        return
    log('Stopping emulator...')
    emulator.stop()
    log('Emulator stopped.')

def stop_adb() -> None:
    '''
    Stop the adb daemon that was started when the first adb command was executed.
    '''
    log('Stopping the adb daemon')
    try:
        run_command(f'{env.adb_cmd} kill-server')
        log('adb daemon stopped.')
    except:
        log('adb daemon not running.')

def load_env_json() -> dict[str, str]:
    '''
    Load env.json into a dictionary and return it.

    If the env.json file does not exist, or does not contain an object, this will raise an
    exception.
    '''
    result = json.load(open(env.env_json_path))
    if isinstance(result, dict):
        return result
    else:
        raise Exception('env.json does not contain an object!')

def should_download(env_json: dict[str, str]) -> bool:
    '''
    Check to see if env.json contains all of the variables needed to perform an imodel download.
    '''
    return ('IMJS_OIDC_CLIENT_ID' in env_json and
        'IMJS_OIDC_SCOPE' in env_json and
        'IMJS_OIDC_CLIENT_SECRET' in env_json and
        'IMJS_ITWIN_ID' in env_json and
        'IMJS_IMODEL_ID' in env_json)

def get_bim_file(env_json: dict[str, str]) -> Union[str, None]:
    '''
    Return the bim filename from env.json if present, else `None`.
    '''
    return env_json.get('IMJS_STANDALONE_FILENAME')

def copy_imodel_to_emulator(bim_file: str) -> None:
    '''
    Copy imodel file to app sandbox on emulator.
    '''
    src = f'{env.bim_dir}/{bim_file}'
    tmp = f'/sdcard/{bim_file}'
    dst_dir = '/storage/emulated/0/Android/data/com.bentley.imodeljs_test_app/files/bim_cache'
    dst = f'{dst_dir}/{bim_file}'
    log(f'Copying {bim_file} to emulator:')
    log('Push to sdcard...')
    run_command(f'{env.adb_cmd} push \'{src}\' \'{tmp}\'', f'Error copying {bim_file} to emulator!')
    log('Move to app sandbox...')
    # Notes about the following script:
    # Trying to use adb to copy the file directly to the destination doesn't work due to a
    # permission denied error.
    # Running su in an adb shell and then running commands as root does not work purely on the
    # command line. The commands must be fed to the process's stdin.
    # Once the file is moved from the sdcard to the final destination, it is not owned by the user
    # that the app runs as, so it is updated to be readable and writable by all users.
    shell_commands = textwrap.dedent(f'''
        su
        mkdir -p {dst_dir}
        mv /sdcard/{bim_file} {dst}
        chmod 666 {dst}
        ''')
    if subprocess.run([env.adb, '-e', 'shell'], text=True, input=shell_commands).returncode != 0:
        raise Exception(f'Error moving {bim_file} to app sandbox!')
    log('Done copying.')

def make_upack_executable(upack_dir: str) -> None:
    '''
    Add executable permission to all files in upack. Azure artifacts stores the files on a Windows
    file system, which loses the executable permission. Since we don't know which files need to be
    executable, make all of them executable.
    '''
    for root, dirs, files in os.walk(upack_dir):
        for file in files:
            os.chmod(f'{root}/{file}', 0o755)

def download_upack_if_needed(name: str, version: str) -> None:
    '''
    Check if the given upack is present, and download it if not.
    '''
    dst_dir = f'{env.upack_dir}/{name}'
    if os.path.exists(dst_dir):
        log(f'upack {name} already present.')
    else:
        log(f'Downloading {name} upack...')
        command = ('az artifacts universal download '
            '--organization "https://dev.azure.com/bentleycs/" '
            '--feed "upack" '
            f'--name "{name}" '
            f'--version "{version}" '
            f'--path "{dst_dir}"')
        run_command(command, f'Error downloading {name} upack!')
        log(f'upack {name} downloaded.')
    make_upack_executable(dst_dir)

def download_upacks_if_needed() -> None:
    '''
    Check if Android SDK and AVD upacks are present, and download them if not.
    '''
    log('Downloading upacks if needed...')
    if not os.path.exists(env.upack_dir):
        os.mkdir(env.upack_dir)
    download_upack_if_needed('androidavd_macos', '33.0.0-1')
    download_upack_if_needed('androidsdk_macos', '33.5.0-0')
    # If jdk_dir includes a __MACOS subdirectory, it is openjdk 11, and we want 21, so delete the
    # existing jdk_dir.
    if os.path.exists(os.path.join(env.jdk_dir, '__MACOSX')):
        shutil.rmtree(env.jdk_dir)
    download_upack_if_needed('openjdk_macos', '21.0.1-0')
    log('upacks downloaded.')

def build_test_app() -> None:
    '''
    Build the Android test app using the Android SDK upack.
    '''
    log('Building Android test app...')
    gradle_env = os.environ.copy()
    gradle_env['ANDROID_HOME'] = env.sdk_dir
    gradle_env['JAVA_HOME'] = env.jdk_dir
    if subprocess.run(
        ['./gradlew', '--no-daemon', 'build'],
        text=True,
        env=gradle_env,
        cwd=env.test_app_dir
    ).returncode != 0:
        raise Exception(f'Error building Android test app!')
    log('Android test app Built.')

def main() -> None:
    '''
    The runAndroidEmulator main program.
    '''
    emulator: Union[Emulator, None] = None
    exit_code = 1
    try:
        if platform.system() != 'Darwin':
            raise Exception('This script only works on macOS!')
        global env
        env = Env()
        download_upacks_if_needed()
        env.verify_paths()
        build_test_app()
        env_json = load_env_json()
        emulator = start_emulator()
        bim_file = get_bim_file(env_json)
        if bim_file == None and not should_download(env_json):
            raise Exception('Environment not configured for standalone or download mode!')
        install_apk()
        if bim_file is not None:
            copy_imodel_to_emulator(bim_file)
        if run_app():
            exit_code = 0
    except Exception as e:
        log(e)
    stop_emulator(emulator)
    stop_adb()
    log('Done')
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
