let unauthorizedHandler: (() => void) | null = null

export const setUnauthorizedHandler = (handler: () => void) => {
  unauthorizedHandler = handler
}

export const runUnauthorizedHandler = () => {
  if (unauthorizedHandler) {
    unauthorizedHandler()
  }
}
