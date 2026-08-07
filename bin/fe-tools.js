#!/usr/bin/env node

const { tools } = require('../src/tools')
const { copyToClipboard } = require('../src/utils/clipboard')
const { selectList, confirm, input, readMultiline, closeRl } = require('../src/utils/prompt')

const EXIT = '退出'

async function runAction(action) {
  let data = ''
  if (action.needInput !== false) {
    if (action.multiline) {
      data = (await readMultiline(action.inputLabel || '请输入数据：')).trim()
    } else {
      data = (await input(action.inputLabel || '请输入数据：')).trim()
    }
    if (!data) {
      console.log('  输入为空，已跳过。')
      return
    }
  }

  try {
    const result = await action.run(data)
    console.log('\n  ── 结果 ─────────────────────────────')
    console.log(result)
    console.log('  ─────────────────────────────────────\n')

    const yes = await confirm('是否复制结果到剪贴板？', true)
    if (yes) {
      const ok = copyToClipboard(String(result))
      console.log(ok ? '  已复制到剪贴板。' : '  复制失败（未找到剪贴板工具）。')
    }
  } catch (err) {
    console.log(`\n  执行出错：${err.message}\n`)
  }
}

async function pickAction(tool) {
  if (tool.actions.length === 1) {
    return tool.actions[0]
  }
  const choices = tool.actions.map((a) => ({ name: a.name, value: a }))
  return selectList('选择操作：', choices)
}

async function main() {
  console.log('\n  ╔════════════════════════════════════╗')
  console.log('  ║        FE-Tools 数据处理工具        ║')
  console.log('  ╚════════════════════════════════════╝\n')

  while (true) {
    const choices = [
      ...tools.map((t) => ({ name: t.name, value: t })),
      { name: EXIT, value: null }
    ]
    const tool = await selectList('请选择工具：', choices)
    if (!tool) break

    const action = await pickAction(tool)
    await runAction(action)
  }

  closeRl()
  console.log('  再见！\n')
}

main().catch((err) => {
  console.error('发生意外错误：', err)
  process.exit(1)
})
