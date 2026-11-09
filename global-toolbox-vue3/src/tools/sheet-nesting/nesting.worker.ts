import { runNesting, type NestingInput, type NestingResult } from './useNesting'

export type NestingWorkerRequest = {
  requestId: number
  input: NestingInput
}

export type NestingWorkerResponse =
  | { requestId: number; ok: true; result: NestingResult }
  | { requestId: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<NestingWorkerRequest>) => {
  const { requestId, input } = event.data
  try {
    const result = runNesting(input)
    if ('error' in result) {
      const response: NestingWorkerResponse = { requestId, ok: false, error: result.error }
      self.postMessage(response)
      return
    }
    const response: NestingWorkerResponse = { requestId, ok: true, result }
    self.postMessage(response)
  } catch (err) {
    const response: NestingWorkerResponse = {
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : 'errNestingFailed',
    }
    self.postMessage(response)
  }
}
