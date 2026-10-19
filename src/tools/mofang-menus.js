/**
 * 拉取魔方项目页面配置并解密导出
 *
 * 流程：
 *   1) getVersionsByEnv              -> 取 created_at 最新的 version 作为 mofangVersion
 *   2) getProjectPagesWithGroupByEnv -> 页面列表（title/page_key/page_draft_key/config）
 *   3) POST /api/avi/downloadJSON    -> 密文 -> 解密（同 @afe/mofang-sdk 的 decodePageJSON）
 *
 * 操作：
 *   - 导出全部页面 dataSource 并汇总：每页 dataSource 写入 <目录>/<title>.json，
 *     汇总 serviceId 命中 fuxi-api / meister-api 的数据源到 <目录>/mofang-fuxi-meister-datasources.json
 *   - 导出全部页面完整配置 JSON：每页完整配置写入 <目录>/<title>.json
 *   - 按 pageKey 导出单个页面配置：写入指定文件
 *
 * Cookie：优先 MOFANG_COOKIE 环境变量；其次 cookie 文件（默认 ~/.mofang-cookie，存在时确认使用）。
 *   运行时可临时粘贴 Cookie 字符串，仅本次运行有效（可选保存到文件）
 *
 * 可选环境变量：
 *   MOFANG_COOKIE      Cookie 字符串（优先）
 *   MOFANG_COOKIE_FILE Cookie 文件路径，默认 ~/.mofang-cookie
 *   MOFANG_PROJECT_ID  默认 62c2e0345b3c3d00156c2f4f（bbiz）
 *   MOFANG_ENV_ID      默认 "1"
 *   MOFANG_VERSION     指定版本号；默认取最新
 *   MOFANG_CONCURRENCY 默认 3（上限 4）
 *   MOFANG_INTERVAL_MS 默认 300（请求发起间隔）
 *   MOFANG_MAX_PAGES   单次导出页面数上限，默认 300
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const crypto = require('crypto')

const { input, confirm } = require('../utils/prompt')

const API_HOST = 'mofang-api.pdd.net'
const DEFAULT_PROJECT_ID = '62c2e0345b3c3d00156c2f4f'
const ENV_ID = process.env.MOFANG_ENV_ID || '1'
const MAX_PAGES = Number(process.env.MOFANG_MAX_PAGES) || 300
const CONCURRENCY = Math.min(Number(process.env.MOFANG_CONCURRENCY) || 3, 4)
const INTERVAL_MS = Number(process.env.MOFANG_INTERVAL_MS) || 300
const MAX_CONSECUTIVE_FAILURES = 3
const REQUEST_TIMEOUT_MS = 30000
const SUMMARY_NAME = 'mofang-fuxi-meister-datasources.json'

/** serviceId -> 服务名 */
const SERVICE_NAMES = {
  '62c4065d7a3c09001c1f0755': 'fuxi-api',
  '62c4065d7a3c09001c1f0756': 'meister-api'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function readCookieFile(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const line = raw.split('\n').find((l) => /^\s*cookie\s*:/i.test(l))
  return (line ? line.replace(/^\s*cookie\s*:/i, "") : raw).trim()
}

let cachedCookie = null

async function readCookie() {
  if (cachedCookie) return cachedCookie

  const inline = process.env.MOFANG_COOKIE
  if (inline) {
    cachedCookie = inline.trim()
    return cachedCookie
  }

  const file = process.env.MOFANG_COOKIE_FILE || path.join(os.homedir(), '.mofang-cookie')
  let cookie = ''
  if (fs.existsSync(file)) {
    cookie = readCookieFile(file)
    if (cookie) {
      console.log(`\n  已从 ${file} 读取 cookie`)
      if (await confirm('直接使用文件中的 cookie？（选 n 可临时粘贴其他 cookie）')) {
        cachedCookie = cookie
        return cachedCookie
      }
      cookie = ''
    } else {
      console.log(`\n  cookie 文件为空：${file}`)
    }
  } else {
    console.log(`\n  未找到 cookie 文件：${file}`)
    console.log('  可将登录 mofang.pdd.net 后的 Cookie 保存到该文件，或设置 MOFANG_COOKIE / MOFANG_COOKIE_FILE')
  }

  const answer = (await input('请粘贴 Cookie 字符串（仅本次运行使用），或输入 cookie 文件路径（留空则中止）：')).trim()
  if (!answer) return ''

  const expanded = expandTilde(answer)
  if (fs.existsSync(expanded) && fs.statSync(expanded).isFile()) {
    cookie = readCookieFile(expanded)
    if (!cookie) throw new Error(`cookie 文件内容为空：${expanded}`)
    console.log(`  已从 ${expanded} 读取 cookie`)
  } else if (answer.includes('=')) {
    if (await confirm(`是否将此 cookie 保存到 ${file}，下次免输入？`, false)) {
      fs.writeFileSync(file, `${answer}\n`, { mode: 0o600 })
      console.log(`  已保存到 ${file}`)
    }
    cookie = answer
  } else {
    throw new Error(`输入不是已存在的文件，也不像 Cookie 字符串（应形如 key=value; key2=value2）：${answer.slice(0, 60)}`)
  }

  cachedCookie = cookie
  return cachedCookie
}

function postJSON(pathname, payload, cookie) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload))
    const req = https.request({
      host: API_HOST,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json, text/plain, */*',
        origin: 'https://mofang.pdd.net',
        referer: 'https://mofang.pdd.net/',
        'user-agent': 'fe-tools/1.0',
        'Content-Length': body.length,
        Cookie: cookie
      },
      timeout: REQUEST_TIMEOUT_MS
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`))
        }
        try {
          resolve(JSON.parse(text))
        } catch (e) {
          reject(new Error(`响应不是 JSON: ${text.slice(0, 200)}`))
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('请求超时')))
    req.on('error', reject)
    req.end(body)
  })
}

/** 与 @afe/mofang-sdk/es/utils/decodePageJSON.js 一致：id = draft/{id1}/{id2}.json => id1+id2 */
function decryptPageJSON(ciphertext, aviUrl) {
  if (/^\s*\{/.test(ciphertext)) return ciphertext

  const m = /draft\/(.*)\/(.*)\.json/.exec(aviUrl || '')
  if (!m) throw new Error(`config url 不是 draft 地址，无法推导解密 id: ${aviUrl}`)

  const id = m[1] + m[2]
  const hash = crypto.createHash('sha256').update(id).digest('hex')
  const passphrase = Buffer.from(hash.slice(0, 32).padEnd(32, '0'), 'utf8')

  const raw = Buffer.from(ciphertext.trim(), 'base64')
  if (raw.slice(0, 8).toString() !== 'Salted__') {
    throw new Error('密文不是 CryptoJS OpenSSL(Salted__) 格式')
  }
  const salt = raw.slice(8, 16)

  let derived = Buffer.alloc(0)
  let block = Buffer.alloc(0)
  while (derived.length < 32 + 16) {
    block = crypto.createHash('md5').update(Buffer.concat([block, passphrase, salt])).digest()
    derived = Buffer.concat([derived, block])
  }
  const decipher = crypto.createDecipheriv('aes-256-cbc', derived.slice(0, 32), derived.slice(32, 48))
  return Buffer.concat([decipher.update(raw.slice(16)), decipher.final()]).toString('utf8')
}

function safeFileName(title, fallback) {
  const base = String(title || fallback).replace(/[\\/:*?"<>|\n\r\t]+/g, '_').replace(/^\.+/, '').trim()
  return base || String(fallback)
}

function parsePreviewUrl(previewUrl) {
  if (!previewUrl) return ''
  try {
    const obj = JSON.parse(previewUrl)
    return Object.values(obj).filter(Boolean).join(', ')
  } catch (e) {
    return previewUrl
  }
}

function expandTilde(p) {
  return p.replace(/^~(?=$|\/)/, os.homedir())
}

function resolveUserPath(raw, defaultAbs) {
  const trimmed = String(raw || '').trim()
  return trimmed ? expandTilde(trimmed) : defaultAbs
}

function pickFileName(page, usedNames) {
  let name = safeFileName(page.title, page.page_key)
  if (usedNames.has(name)) name = `${name}_${page.page_key}`
  usedNames.add(name)
  return name
}

async function withRetry(fn, times = 2) {
  let lastErr
  for (let i = 0; i <= times; i += 1) {
    if (i) await sleep(1000 * i)
    try {
      return await fn()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

async function resolveProject() {
  const cookie = await readCookie()
  if (!cookie) throw new Error('未提供 cookie，已中止')

  const projectId = (await input(`魔方项目 ID（默认 ${DEFAULT_PROJECT_ID}）：`)).trim() || DEFAULT_PROJECT_ID

  const verResp = await postJSON('/webGraphql', {
    operationName: null,
    query: `\n    query {\n      getVersionsByEnv (project_id:"${projectId}", env: "${ENV_ID}"){\n        version,\n        user,\n        created_at,\n      }\n    }\n  `
  }, cookie)
  const versions = (verResp.data && verResp.data.getVersionsByEnv) || []
  if (!versions.length) throw new Error('getVersionsByEnv 返回为空（cookie 可能已失效，或项目 ID / 环境有误）')
  const latest = versions.slice().sort((a, b) => Number(b.created_at) - Number(a.created_at))[0]
  const mofangVersion = process.env.MOFANG_VERSION || latest.version
  console.log(`  项目 ${projectId}：${versions.length} 个版本，mofangVersion=${mofangVersion}（user=${latest.user}）`)

  const pagesResp = await postJSON('/webGraphql', {
    operationName: null,
    query: `\n    query {\n      getProjectPagesWithGroupByEnv (del_tag: "", project_id:"${projectId}", status: "1", user: "undefined", version: "${mofangVersion}"){\n        pages {\n          project_id,\n          title,\n          page_key,\n          status,\n          page_draft_key,\n          config,\n          group_key,\n          next,\n          preview_url,\n          requirement_id,\n          requirement_desc\n        },\n        groups {\n          group_key,\n          version,\n          title,\n          next,\n        },\n        requirements {\n          requirement_id,\n          requirement_desc,\n        }\n      }\n    }\n  `
  }, cookie)
  const pages = ((pagesResp.data && pagesResp.data.getProjectPagesWithGroupByEnv) || {}).pages || []
  if (!pages.length) throw new Error('getProjectPagesWithGroupByEnv 返回为空')

  return { cookie, projectId, mofangVersion, pages }
}

function checkPageBudget(pages) {
  if (pages.length > MAX_PAGES) {
    throw new Error(`页面数 ${pages.length} 超过单次上限 ${MAX_PAGES}，如确认需要可设置 MOFANG_MAX_PAGES 后重试`)
  }
}

function confirmBulk(pages, outDir) {
  return confirm(
    `共 ${pages.length} 个页面，将发起约 ${pages.length + 2} 个请求（并发 ${CONCURRENCY}、间隔 ${INTERVAL_MS}ms、连续失败 ${MAX_CONSECUTIVE_FAILURES} 次自动中止），写入 ${outDir}。确认开始？`
  )
}

async function downloadPageConfig(page, cookie) {
  const dl = await withRetry(() => postJSON('/api/avi/downloadJSON', { url: page.config }, cookie))
  const plain = decryptPageJSON(String(dl.data || ''), page.config)
  return JSON.parse(plain)
}

async function runPages(pages, cookie, handler) {
  const failed = []
  let cursor = 0
  let consecutiveFailures = 0
  let aborted = false

  async function worker() {
    while (!aborted) {
      const i = cursor
      cursor += 1
      if (i >= pages.length) return
      const page = pages[i]

      try {
        await handler(page, i)
        consecutiveFailures = 0
      } catch (e) {
        consecutiveFailures += 1
        failed.push({ pageKey: page.page_key, title: page.title, config: page.config, error: e.message })
        console.error(`    [${i + 1}/${pages.length}] ${page.title} 失败：${e.message}`)
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES || failed.length * 2 > pages.length) {
          aborted = true
          console.error(`  已触发失败保护（连续失败 ${consecutiveFailures} 个 / 累计失败 ${failed.length} 个），中止后续请求`)
          return
        }
      }
      await sleep(INTERVAL_MS)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { failed, aborted }
}

async function exportDataSources() {
  console.log('\n  将访问 mofang-api.pdd.net：读取指定项目的页面配置，解密后导出 dataSource 到本地目录（不修改线上数据）')

  const { cookie, projectId, mofangVersion, pages } = await resolveProject()
  checkPageBudget(pages)

  const outDir = resolveUserPath(
    await input('输出目录（默认 ./mofang-export）：'),
    path.resolve(process.cwd(), 'mofang-export')
  )
  if (!(await confirmBulk(pages, outDir))) return '已取消。'
  fs.mkdirSync(outDir, { recursive: true })

  const items = []
  const usedNames = new Set()

  const { failed, aborted } = await runPages(pages, cookie, async (page, i) => {
    const parsed = await downloadPageConfig(page, cookie)
    const dataSource = parsed.dataSource || {}

    const name = pickFileName(page, usedNames)
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(dataSource, null, 2))

    const dsCount = Object.keys(dataSource).length
    for (const [dsName, ds] of Object.entries(dataSource)) {
      if (ds && SERVICE_NAMES[ds.serviceId]) {
        items.push({
          pageTitle: page.title,
          pageKey: page.page_key,
          pageDraftKey: page.page_draft_key,
          previewUrl: parsePreviewUrl(page.preview_url),
          requirementId: page.requirement_id || '',
          dataSourceName: dsName,
          serviceId: ds.serviceId,
          service: SERVICE_NAMES[ds.serviceId],
          method: ds.method || '',
          url: ds.url || ''
        })
      }
    }
    console.log(`    [${i + 1}/${pages.length}] ${page.title}：dataSource ${dsCount} 个`)
  })

  items.sort((a, b) => (a.pageTitle + a.dataSourceName).localeCompare(b.pageTitle + b.dataSourceName))
  const summary = {
    projectId,
    mofangVersion,
    generatedAt: new Date().toISOString(),
    serviceMap: SERVICE_NAMES,
    pageCount: pages.length,
    failedPages: failed,
    matchedCount: items.length,
    items
  }
  fs.writeFileSync(path.join(outDir, SUMMARY_NAME), JSON.stringify(summary, null, 2))

  const lines = []
  lines.push(`项目 ${projectId}（版本 ${mofangVersion}）共 ${pages.length} 个页面，成功导出 ${usedNames.size} 个 dataSource 文件`)
  lines.push(`导出目录：${outDir}`)
  lines.push(`命中 fuxi-api / meister-api 的数据源：${items.length} 条 -> ${path.join(outDir, SUMMARY_NAME)}`)
  if (failed.length) lines.push(`失败页面：${failed.length} 个（已记录在汇总文件的 failedPages）`)
  if (aborted) lines.push('注意：已因连续失败或失败比例过高中止，结果可能不完整')
  return lines.join('\n')
}

async function exportFullConfigs() {
  console.log('\n  将访问 mofang-api.pdd.net：读取指定项目的页面配置，解密后导出完整配置 JSON 到本地目录（不修改线上数据）')

  const { cookie, projectId, mofangVersion, pages } = await resolveProject()
  checkPageBudget(pages)

  const outDir = resolveUserPath(
    await input('输出目录（默认 ./mofang-configs）：'),
    path.resolve(process.cwd(), 'mofang-configs')
  )
  if (!(await confirmBulk(pages, outDir))) return '已取消。'
  fs.mkdirSync(outDir, { recursive: true })

  const usedNames = new Set()

  const { failed, aborted } = await runPages(pages, cookie, async (page, i) => {
    const parsed = await downloadPageConfig(page, cookie)
    const name = pickFileName(page, usedNames)
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(parsed, null, 2))
    console.log(`    [${i + 1}/${pages.length}] ${page.title}：已写入 ${name}.json`)
  })

  const failedFile = path.join(outDir, 'failed-pages.json')
  if (failed.length) fs.writeFileSync(failedFile, JSON.stringify(failed, null, 2))

  const lines = []
  lines.push(`项目 ${projectId}（版本 ${mofangVersion}）共 ${pages.length} 个页面，成功导出 ${usedNames.size} 个完整配置 JSON`)
  lines.push(`导出目录：${outDir}`)
  if (failed.length) lines.push(`失败页面：${failed.length} 个 -> ${failedFile}`)
  if (aborted) lines.push('注意：已因连续失败或失败比例过高中止，结果可能不完整')
  return lines.join('\n')
}

async function exportSinglePage() {
  console.log('\n  将访问 mofang-api.pdd.net：读取指定页面配置，解密后导出完整配置 JSON 到本地文件（不修改线上数据）')

  const { cookie, projectId, mofangVersion, pages } = await resolveProject()

  const pageKey = (await input('请输入 pageKey：')).trim()
  if (!pageKey) return '已取消。'

  const page =
    pages.find((p) => String(p.page_key) === pageKey) ||
    pages.find((p) => String(p.page_key).toLowerCase() === pageKey.toLowerCase())
  if (!page) {
    const similar = pages
      .filter((p) => String(p.page_key).toLowerCase().includes(pageKey.toLowerCase()))
      .slice(0, 5)
    const hint = similar.length ? `，是否想找：${similar.map((p) => `${p.page_key}（${p.title}）`).join('、')}` : ''
    throw new Error(`未找到 pageKey 为 ${pageKey} 的页面${hint}`)
  }

  const defaultName = safeFileName(page.title, page.page_key)
  const filePath = resolveUserPath(
    await input(`保存文件路径（默认 ./mofang-configs/${defaultName}.json）：`),
    path.resolve(process.cwd(), 'mofang-configs', `${defaultName}.json`)
  )
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  const parsed = await downloadPageConfig(page, cookie)
  const json = JSON.stringify(parsed, null, 2)
  fs.writeFileSync(filePath, json)

  const lines = []
  lines.push(`项目 ${projectId}（版本 ${mofangVersion}）`)
  lines.push(`页面：${page.title}（page_key=${page.page_key}）`)
  lines.push(`已写入：${filePath}（${Buffer.byteLength(json)} 字节）`)
  return lines.join('\n')
}

module.exports = {
  name: '拉取魔方项目配置',
  actions: [
    {
      name: '导出全部页面 dataSource 并汇总',
      needInput: false,
      resultHandling: false,
      run: () => exportDataSources()
    },
    {
      name: '导出全部页面完整配置 JSON',
      needInput: false,
      resultHandling: false,
      run: () => exportFullConfigs()
    },
    {
      name: '按 pageKey 导出单个页面配置',
      needInput: false,
      resultHandling: false,
      run: () => exportSinglePage()
    }
  ]
}
