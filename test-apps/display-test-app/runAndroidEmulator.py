#!/usr/bin/env python3
import fileinput
import json
import os
import platform
import subprocess
import sys
import textwrap
import threading
import time

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
    sdk_dir: str
    ''' The directory of the Android SDK. '''
    avd_dir: str
    ''' The directory of the Android emulator AVDs. '''
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
    apk_path = f'{script_dir}/android/imodeljs-test-app/app/build/outputs/apk/debug/app-debug.apk'
    ''' The full path to the display-test-app APK. '''
    bim_dir = f'{script_dir}/test-models'
    ''' The directory containing the sample bim file. '''
    env_json_path = f'{script_dir}/lib/mobile/env.json'
    ''' The full path to the env.json file used by display-test-app. '''

    def __init__(self):
        android_home = os.environ.get('ANDROID_HOME')
        try:
            self.sdk_dir = android_home if android_home != None else os.environ['ANDROID_SDK_ROOT']
        except:
            raise Exception('ANDROID_HOME or ANDROID_SDK_ROOT must be set in the environment!')
        avd_dir = os.environ.get('ANDROID_AVD_HOME')
        self.avd_dir = avd_dir if avd_dir != None else self.sdk_dir.replace('/androidsdk_', '/androidavd_')
        self.bin_dir = f'{self.sdk_dir}/cmdline-tools/{self.cmdline_tools_ver}/bin'
        if not os.path.isdir(self.bin_dir):
            raise Exception(f'Android command line tools directory ({self.bin_dir}) does not exist!')
        self.emulator_dir = f'{self.sdk_dir}/emulator'
        if not os.path.isdir(self.emulator_dir):
            raise Exception(f'Android emulator directory ({self.emulator_dir}) does not exist!')
        if not os.path.isdir(self.avd_dir):
            raise Exception(f'Android virtual device directory ({self.avd_dir}) does not exist!')
        self.adb = f'{self.sdk_dir}/platform-tools/adb'
        if not os.path.exists(self.adb):
            raise Exception(f'Android debugger ({self.adb}) does not exist!')
        self.adb_cmd = f'{self.adb} -e'

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

    __process: subprocess.Popen | None
    __thread: threading.Thread | None
    __launch_error: Exception | None
    __lock: threading.Lock
    __avd_name: str
    __avd_home: str
    __emulator_dir: str

    def __init__(self, avd_name: str, avd_home: str, emulator_dir: str):
        self.__process = None
        self.__thread = None
        self.__launch_error = None
        self.__lock = None
        self.__avd_name = avd_name
        self.__avd_home = avd_home
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
            try:
                self.__process = subprocess.Popen(
                    [f'./emulator', '-no-snapshot', f'@{self.__avd_name}'],
                    cwd=self.__emulator_dir,
                    env=emulator_env,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True
                )
                self.__lock.release()
                self.__process.communicate()
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
    emulator = Emulator(env.avd_name, env.avd_dir, env.emulator_dir)
    print('Fixing path setting in emulator\'s ini file...')
    emulator.fix_ini_path()
    print('Starting Android emulator...')
    emulator.start()
    shell_cmd = 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done;'
    run_command(
        f'{env.adb_cmd} wait-for-device shell \'{shell_cmd}\'',
        'Error waiting for emulator to boot!'
    )
    print('Emulator started.')
    return emulator

def install_apk() -> None:
    '''
    Install the display-test-app APK onto the emulator.
    '''
    print(f'Installing apk {env.apk_path}...')
    run_command(f'{env.adb_cmd} install -r -g {env.apk_path}', 'Error installing APK!')
    print('APK installed.')

def start_app() -> None:
    '''
    Start display-test-app on the emulator and wait for it to launch.
    '''
    print('Starting display-test-app...')
    run_command(f'{env.adb_cmd} logcat -c', 'Error clearing adb logcat!')
    activity_name = 'com.bentley.imodeljs_test_app/.MainActivity'
    shell_cmd = f'am start -n "{activity_name}" -a android.intent.action.MAIN'
    run_command(f'{env.adb_cmd} shell {shell_cmd}', 'Error starting display-test-app!')
    print('display-test-app started.')

def wait_for_first_render() -> bool:
    '''
    Wait for display-test-app to complete its first render of its model.

    Returns `True` on success, `False` on failure.
    '''
    print('Waiting for first render to finish...')
    start_time = time.time()
    while True:
        result = subprocess.run([env.adb, '-e', 'logcat', '-d'], capture_output=True, text=True)
        if result.stdout.find('com.bentley.display_test_app: First render finished.') != -1:
            print('Success!')
            return True
        if time.time() - start_time >= 60.0 * 3.0: # 3 minutes
            print('Timed out!')
            return False

def stop_emulator(emulator: Emulator | None) -> None:
    '''
    Stop the emulator and wait for it to exit.
    '''
    if emulator == None:
        return
    print('Stopping emulator...')
    emulator.stop()
    print('Emulator stopped.')

def stop_adb() -> None:
    '''
    Stop the adb daemon that was started when the first adb command was executed.
    '''
    print('Stopping the adb daemon')
    try:
        run_command(f'{env.adb_cmd} kill-server')
        print('adb daemon stopped.')
    except:
        print('adb daemon not running.')

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
        raise Exception("env.json does not contain an object!")

def should_download(env_json: dict[str, str]) -> bool:
    '''
    Check to see if env.json contains all of the variables needed to perform an imodel download.
    '''
    return ('IMJS_OIDC_CLIENT_ID' in env_json and
        'IMJS_OIDC_SCOPE' in env_json and
        'IMJS_OIDC_CLIENT_SECRET' in env_json and
        'IMJS_ITWIN_ID' in env_json and
        'IMJS_IMODEL_ID' in env_json)

def get_bim_file(env_json: dict[str, str]) -> str | None:
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
    print(f'Copying {bim_file} to emulator:')
    print('Push to sdcard...')
    run_command(f'{env.adb_cmd} push \'{src}\' \'{tmp}\'', f'Error copying {bim_file} to emulator!')
    print('Move to app sandbox...')
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
    print('Done copying.')

def download_upacks_if_needed() -> None:
    '''
    Check if Android SDK and AVD upacks are present, and download them if not.
    '''
    match platform.system():
        case 'Darwin':
            platform_name = 'macosx'
        case 'Windows':
            platform_name = 'x64'
        case _:
            raise Exception(f'Unsupported platform: {platform.system()}!')
    if not os.path.isdir(env.sdk_dir):
        command = ('az artifacts universal download '
            '--organization "https://dev.azure.com/bentleycs/" '
            '--feed "upack" '
            f'--name "androidsdk_{platform_name}" '
            '--version "33.5.0-1" '
            f'--path {env.sdk_dir}')
        run_command(command, 'Error downloading Android SDK upack!')
    if not os.path.isdir(env.avd_dir):
        command = ('az artifacts universal download '
            '--organization "https://dev.azure.com/bentleycs/" '
            '--feed "upack" '
            f'--name "androidavd_{platform_name}" '
            '--version "33.0.0-0" '
            f'--path {env.sdk_dir}')
        run_command(command, 'Error downloading Android AVD upack!')

def main() -> None:
    '''
    The runAndroidEmulator main program.
    '''
    emulator: Emulator | None = None
    exit_code = 1
    try:
        global env
        env = Env()
        download_upacks_if_needed()
        env_json = load_env_json()
        emulator = start_emulator()
        bim_file = get_bim_file(env_json)
        if bim_file == None and not should_download(env_json):
            raise Exception("Environment not configured for standalone or download mode!")
        install_apk()
        if bim_file is not None:
            copy_imodel_to_emulator(bim_file)
        start_app()
        if wait_for_first_render():
            exit_code = 0
    except Exception as e:
        print(e)
    stop_emulator(emulator)
    stop_adb()
    print('Done')
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
