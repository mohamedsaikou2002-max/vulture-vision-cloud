// Covers session acquisition, network work and response consumption together.
export async function withRequestDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  milliseconds: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(parent?.reason);
  if (parent?.aborted) cancel();
  else parent?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), milliseconds);
  let stop: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    stop = () => reject(controller.signal.reason);
    if (controller.signal.aborted) stop();
    else controller.signal.addEventListener('abort', stop, { once: true });
  });
  try {
    controller.signal.throwIfAborted();
    return await Promise.race([work(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', cancel);
    if (stop) controller.signal.removeEventListener('abort', stop);
  }
}