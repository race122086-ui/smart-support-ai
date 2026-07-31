import { spawn } from 'node:child_process'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Ejecuta este archivo mediante npm run dev')

const services = [
  ['API', ['run', 'dev:api']],
  ['Web', ['run', 'dev:web']],
]
const children = []
let stopping = false

function stopChildren(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal)
  }
}

for (const [name, args] of services) {
  const child = spawn(process.execPath, [npmCli, ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })
  children.push(child)

  child.on('error', (error) => {
    console.error(`[${name}] No se pudo iniciar: ${error.message}`)
    process.exitCode = 1
    stopChildren()
  })

  child.on('exit', (code, signal) => {
    if (stopping) return
    if (code !== 0) {
      console.error(`[${name}] terminó inesperadamente${signal ? ` (${signal})` : ''}`)
      process.exitCode = code || 1
      stopChildren()
    }
  })
}

process.once('SIGINT', () => stopChildren('SIGINT'))
process.once('SIGTERM', () => stopChildren('SIGTERM'))
