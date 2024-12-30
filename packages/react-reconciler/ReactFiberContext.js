import { disableLegacyContext } from '../shared/ReactFeatureFlags';
import { HostRoot, ClassComponent } from './ReactWorkTags';

export const emptyContextObject = {};

function isContextProvider(type) {
    if (disableLegacyContext) {
        return false;
    } else {
        const childContextTypes = type.childContextTypes;
        return childContextTypes !== null && childContextTypes !== undefined;
    }
}

function findCurrentUnmaskedContext(fiber) {
    if (disableLegacyContext) {
        return emptyContextObject;
    } else {
        let node = fiber;
        do {
            switch (node.tag) {
                case HostRoot:
                    return node.stateNode.context;
                case ClassComponent: {
                    const Component = node.type;
                    if (isContextProvider(Component)) {
                        return node.stateNode
                            .__reactInternalMemoizedMergedChildContext;
                    }
                    break;
                }
            }
            node = node.return;
        } while (node !== null);
    }
}

function processChildContext(fiber, type, parentContext) {
    if (disableLegacyContext) {
        return parentContext;
    } else {
        const instance = fiber.stateNode;
        const childContextTypes = type.childContextTypes;
        if (typeof instance.getChildContext !== 'function') {
            return parentContext;
        }

        const childContext = instance.getChildContext();
        return { ...parentContext, ...childContext };
    }
}

export { findCurrentUnmaskedContext, isContextProvider, processChildContext };
