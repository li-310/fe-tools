const { execSync } = require('child_process')

function copyToClipboard(text) {
  try {
    let cmd
    if (process.platform === 'darwin') cmd = 'pbcopy'
    else if (process.platform === 'win32') cmd = 'clip'
    else cmd = 'xclip -selection clipboard'

    execSync(cmd, { input: text, stdio: ['pipe', 'ignore', 'ignore'] })
    return true
  } catch {
    return false
  }
}

module.exports = { copyToClipboard }
