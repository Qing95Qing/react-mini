
export function toString(value) {
  return '' + value;
}

export function getToStringValue(value) {
  switch (typeof value) {
    case 'bigint':
    case 'boolean':
    case 'number':
    case 'string':
    case 'undefined':
      return value;
    case 'object':
      return value;
    default:
      // function, symbol are assigned as empty strings
      return '';
  }
}
