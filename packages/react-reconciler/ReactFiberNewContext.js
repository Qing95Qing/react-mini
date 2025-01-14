let currentlyRenderingFiber = null;
let lastContextDependency = null;

export function resetContextDependencies() {
    currentlyRenderingFiber = null;
    lastContextDependency = null;
}
