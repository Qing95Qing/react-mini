import { restoreControlledInputState } from "./ReactDOMInput";


export function restoreControlledState(domElement, tag, props) {
  switch (tag) {
    case 'input':
      restoreControlledInputState(domElement, props);
      return;
    case 'textarea':
      // TODO：省略实现
      // restoreControlledTextareaState(domElement, props);
      return;
    case 'select':
      // TODO：省略实现
      // restoreControlledSelectState(domElement, props);
      return;
  }
}