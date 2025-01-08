
import { disableInputAttributeSyncing } from "../shared/ReactFeatureFlags";
import getActiveElement from "./getActiveElement";
import { updateValueIfChanged } from "./inputValueTracking";
import { getFiberCurrentPropsFromNode } from "./ReactDOMComponentTree";
import { toString, getToStringValue } from "./ToStringValue";

export function setDefaultValue(
  node,
  type,
  value,
) {
  if (
    type !== 'number' ||
    getActiveElement(node.ownerDocument) !== node
  ) {
    if (node.defaultValue !== toString(value)) {
      node.defaultValue = toString(value);
    }
  }
}

export function updateInput(
  element,
  value,
  defaultValue,
  lastDefaultValue,
  checked,
  defaultChecked,
  type,
  name,
) {
  const node = element;
  node.name = '';

  if (
    type != null &&
    typeof type !== 'function' &&
    typeof type !== 'symbol' &&
    typeof type !== 'boolean'
  ) {
    node.type = type;
  } else {
    node.removeAttribute('type');
  }

  if (value != null) {
    if (type === 'number') {
      if (
        (value === 0 && node.value === '') || node.value != value
      ) {
        node.value = toString(getToStringValue(value));
      }
    } else if (node.value !== toString(getToStringValue(value))) {
      node.value = toString(getToStringValue(value));
    }
  } else if (type === 'submit' || type === 'reset') {
    node.removeAttribute('value');
  }

  if (disableInputAttributeSyncing) {
    if (defaultValue != null) {
      setDefaultValue(node, type, getToStringValue(defaultValue));
    } else if (lastDefaultValue != null) {
      node.removeAttribute('value');
    }
  } else {

    if (value != null) {
      setDefaultValue(node, type, getToStringValue(value));
    } else if (defaultValue != null) {
      setDefaultValue(node, type, getToStringValue(defaultValue));
    } else if (lastDefaultValue != null) {
      node.removeAttribute('value');
    }
  }

  if (disableInputAttributeSyncing) {
    if (defaultChecked == null) {
      node.removeAttribute('checked');
    } else {
      node.defaultChecked = !!defaultChecked;
    }
  } else {
    if (checked == null && defaultChecked != null) {
      node.defaultChecked = !!defaultChecked;
    }
  }

  if (checked != null) {
    node.checked =
      checked && typeof checked !== 'function' && typeof checked !== 'symbol';
  }

  if (
    name != null &&
    typeof name !== 'function' &&
    typeof name !== 'symbol' &&
    typeof name !== 'boolean'
  ) {
    node.name = toString(getToStringValue(name));
  } else {
    node.removeAttribute('name');
  }
}

export function restoreControlledInputState(element, props) {
  const rootNode = element;
  updateInput(
    rootNode,
    props.value,
    props.defaultValue,
    props.defaultValue,
    props.checked,
    props.defaultChecked,
    props.type,
    props.name,
  );
  const name = props.name;
  if (props.type === 'radio' && name != null) {
    let queryRoot = rootNode;

    while (queryRoot.parentNode) {
      queryRoot = queryRoot.parentNode;
    }

    const group = queryRoot.querySelectorAll(
      'input[name="' +
        escapeSelectorAttributeValueInsideDoubleQuotes('' + name) +
        '"][type="radio"]',
    );

    for (let i = 0; i < group.length; i++) {
      const otherNode = group[i];
      if (otherNode === rootNode || otherNode.form !== rootNode.form) {
        continue;
      }
      const otherProps = getFiberCurrentPropsFromNode(otherNode);

      if (!otherProps) {
        throw new Error(
          'ReactDOMInput: Mixing React and non-React radio inputs with the ' +
            'same `name` is not supported.',
        );
      }

      updateInput(
        otherNode,
        otherProps.value,
        otherProps.defaultValue,
        otherProps.defaultValue,
        otherProps.checked,
        otherProps.defaultChecked,
        otherProps.type,
        otherProps.name,
      );
    }

    for (let i = 0; i < group.length; i++) {
      const otherNode = group[i];
      if (otherNode.form !== rootNode.form) {
        continue;
      }
      updateValueIfChanged(otherNode);
    }
  }
}

const escapeSelectorAttributeValueInsideDoubleQuotesRegex = /[\n\"\\]/g;
export function escapeSelectorAttributeValueInsideDoubleQuotes(
  value
) {
  return value.replace(
    escapeSelectorAttributeValueInsideDoubleQuotesRegex,
    ch => '\\' + ch.charCodeAt(0).toString(16) + ' ',
  );
}