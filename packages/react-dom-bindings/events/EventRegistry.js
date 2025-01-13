export const allNativeEvents = new Set();

export const registrationNameDependencies = {};

export function registerTwoPhaseEvent(registrationName, dependencies) {
    registerDirectEvent(registrationName, dependencies);
    registerDirectEvent(registrationName + 'Capture', dependencies);
}

// registrationName: react事件名称，dependencies是dom事件
export function registerDirectEvent(registrationName, dependencies) {
    registrationNameDependencies[registrationName] = dependencies;
    for (let i = 0; i < dependencies.length; i++) {
        allNativeEvents.add(dependencies[i]);
    }
}
