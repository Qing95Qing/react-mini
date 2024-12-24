

export function createRoot(container) {
    const root = createContainer(container, ConcurrentRoot);
    markContainerAsRoot(root.current, container);
}