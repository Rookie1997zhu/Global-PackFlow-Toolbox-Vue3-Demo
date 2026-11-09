import { runNesting, type NestingInput, type NestingResult } from './useNesting'
import type { NestingWorkerResponse } from './nesting.worker'

type Runner = {
  run: (input: NestingInput) => Promise<NestingResult | { error: string }>
  cancel: () => void
  dispose: () => void
}

export function createNestingRunner(): Runner {
  let worker: Worker | null = null
  let workerFailed = false
  let requestId = 0
  let activeId = 0

  const ensureWorker = (): Worker | null => {
    if (workerFailed) return null
    if (worker) return worker
    try {
      worker = new Worker(new URL('./nesting.worker.ts', import.meta.url), { type: 'module' })
      worker.addEventListener('error', () => {
        workerFailed = true
        worker?.terminate()
        worker = null
      })
      return worker
    } catch {
      workerFailed = true
      return null
    }
  }

  const cancel = () => {
    activeId += 1
  }

  const dispose = () => {
    cancel()
    worker?.terminate()
    worker = null
  }

  const runSync = (input: NestingInput): NestingResult | { error: string } => {
    const result = runNesting(input)
    if ('error' in result) return { error: result.error }
    return result
  }

  const run = (input: NestingInput) =>
    new Promise<NestingResult | { error: string }>((resolve) => {
      const id = ++requestId
      activeId = id
      const w = ensureWorker()
      if (!w) {
        if (id !== activeId) {
          resolve({ error: 'errNestingCancelled' })
          return
        }
        resolve(runSync(input))
        return
      }

      const onMessage = (event: MessageEvent<NestingWorkerResponse>) => {
        if (event.data.requestId !== id) return
        w.removeEventListener('message', onMessage)
        w.removeEventListener('error', onError)
        if (id !== activeId) {
          resolve({ error: 'errNestingCancelled' })
          return
        }
        if (!event.data.ok) {
          resolve({ error: event.data.error })
          return
        }
        resolve(event.data.result)
      }

      const onError = () => {
        w.removeEventListener('message', onMessage)
        w.removeEventListener('error', onError)
        workerFailed = true
        worker?.terminate()
        worker = null
        if (id !== activeId) {
          resolve({ error: 'errNestingCancelled' })
          return
        }
        resolve(runSync(input))
      }

      w.addEventListener('message', onMessage)
      w.addEventListener('error', onError)
      w.postMessage({ requestId: id, input })
    })

  return { run, cancel, dispose }
}
