const path = require('node:path');
const fs = require('node:fs/promises');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

/**
 * electron-builder afterPack hook that hardens the packaged Electron binary
 * by locking down dangerous runtime fuses before AppImage/.deb packaging.
 */
exports.default = async function afterPack(context) {
  const executableName =
    context.packager.executableName ||
    context.packager.appInfo.productFilename;
  const electronBinaryPath = path.join(context.appOutDir, executableName);

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  if (context.electronPlatformName === 'linux') {
    await fs.rename(electronBinaryPath, `${electronBinaryPath}.bin`);
    await fs.copyFile(path.join(context.packager.projectDir, 'build', 'launch.sh'), electronBinaryPath);
    await fs.chmod(electronBinaryPath, 0o755);
  }
};
