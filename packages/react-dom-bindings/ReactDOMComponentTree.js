const internalContainerInstanceKey = '__reactContainer$' + randomKey;

export function markContainerAsRoot(hostRoot, node) {
  // $FlowFixMe[prop-missing]
  node[internalContainerInstanceKey] = hostRoot;
}