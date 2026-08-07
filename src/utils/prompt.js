const readline = require('readline')

let rl = null
let pending = []
let buffer = []

function getRl() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY === true
    })
    rl.on('line', (line) => {
      if (pending.length > 0) pending.shift()(line)
      else buffer.push(line)
    })
    rl.on('close', () => {
      while (pending.length > 0) pending.shift()(undefined)
      rl = null
    })
  }
  return rl
}

function nextLine() {
  if (buffer.length > 0) return Promise.resolve(buffer.shift())
  return new Promise((res) => pending.push(res))
}

async function ask(prompt) {
  getRl()
  process.stdout.write(prompt)
  const line = await nextLine()
  return line === undefined ? '' : line
}

function closeRl() {
  if (rl) {
    rl.close()
    rl = null
  }
}

async function selectList(message, choices) {
  console.log(`\n  ${message}`)
  choices.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`))
  const answer = await ask('  请输入序号： ')
  const i = parseInt(answer.trim(), 10) - 1
  return choices[i] ? choices[i].value : null
}

async function confirm(message, defaultValue = true) {
  const hint = defaultValue ? 'Y/n' : 'y/N'
  const answer = await ask(`  ${message} (${hint}) `)
  const a = answer.trim().toLowerCase()
  if (a === '') return defaultValue
  return a === 'y' || a === 'yes'
}

async function input(message) {
  return ask(`  ${message} `)
}

async function readMultiline(label) {
  console.log(`\n  ${label}`)
  console.log('  （多行输入，输入 ::end 结束，或按 Ctrl+D）')
  const lines = []
  while (true) {
    process.stdout.write('  > ')
    const line = await nextLine()
    if (line === undefined) break
    if (line.trim() === '::end') break
    lines.push(line)
  }
  console.log('')
  return lines.join('\n')
}

module.exports = { selectList, confirm, input, readMultiline, closeRl }
