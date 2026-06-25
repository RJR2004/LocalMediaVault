// ExternalLauncher - External application launching and directory dialogs
const { dialog, shell } = require('electron');

class ExternalLauncher {
  /**
   * Open a directory selection dialog
   * @returns {Promise<{success: boolean, path?: string, error?: string}>}
   */
  static async openDirectoryDialog() {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Library Directory'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false, error: 'No directory selected' };
  }

  /**
   * Launch an external application with a file path
   * @param {string} filePath - Path to the file or folder to open
   * @param {string} [player] - Optional path to preferred player executable
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  static async launch(filePath, player) {
    try {
      if (player) {
        const { spawn } = require('child_process');
        spawn(player, [filePath], { detached: true, stdio: 'ignore' }).unref();
      } else {
        await shell.openPath(filePath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Open a folder in the system file explorer
   * @param {string} folderPath - Path to the folder
   * @returns {Promise<void>}
   */
  static async openInExplorer(folderPath) {
    await shell.openPath(folderPath);
  }
}

module.exports = ExternalLauncher;
