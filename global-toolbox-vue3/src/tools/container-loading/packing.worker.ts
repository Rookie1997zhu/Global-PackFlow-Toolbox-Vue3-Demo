import { packContainer, type PackInput, type PackResult } from './packing'

export type PackWorkerRequest = { requestId: number; input: PackInput }
export type PackWorkerResponse =
  | { requestId: number; ok: true; result: PackResult }
  | { requestId: number; ok: false; error: string }

self.onmessage = (event: MessageEvent<PackWorkerRequest>) => {
  const { requestId, input } = event.data
  try {
    const result = packContainer(input)
    const response: PackWorkerResponse = { requestId, ok: true, result }
    self.postMessage(response)
  } catch (err) {
    const response: PackWorkerResponse = {
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : 'errContainerFailed',
    }
    self.postMessage(response)
  }
}
