const reportGlobalError =
    typeof reportError === 'function'
        ? // 现代浏览器，reportError会派发一个error事件，模拟一个未捕获的Javascript错误
          reportError
        : (error) => {
              if (
                  typeof window === 'object' &&
                  typeof window.ErrorEvent === 'function'
              ) {
                  const message =
                      typeof error === 'object' &&
                      error !== null &&
                      typeof error.message === 'string'
                          ? String(error.message)
                          : String(error);
                  const event = new window.ErrorEvent('error', {
                      bubbles: true,
                      cancelable: true,
                      message: message,
                      error: error,
                  });
                  const shouldLog = window.dispatchEvent(event);
                  if (!shouldLog) {
                      return;
                  }
              } else if (
                  typeof process === 'object' &&
                  typeof process.emit === 'function'
              ) {
                  process.emit('uncaughtException', error);
                  return;
              }
              console['error'](error);
          };

export default reportGlobalError;
