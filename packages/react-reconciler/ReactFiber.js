import {
    ConcurrentMode,
    NoMode,
    StrictEffectsMode,
    StrictLegacyMode,
} from './ReactTypeOfMode';
import { HostRoot } from './ReactWorkTags';

export function createHostRootFiber(tag, isStrictMode) {
    let mode;
    if (tag === ConcurrentRoot) {
        mode = ConcurrentMode;
        if (isStrictMode === true) {
            mode |= StrictLegacyMode | StrictEffectsMode;
        }
    } else {
        mode = NoMode;
    }
    // 创建一个tag为3的fiber节点
    return createFiber(HostRoot, null, null, mode);
}

// v19创建fiber节点提供了两种方式：
// 1. 基于类的方式
// 2. 基于对象的方式（字面量）
const createFiber = enableObjectFiber
    ? createFiberImplObject
    : createFiberImplClass;

function createFiberImplObject(tag, pendingProps, key, mode) {
    const fiber = {
        // 根据传参确定的动态属性
        tag,
        key,
        mode,
        pendingProps,

        elementType: null,
        type: null,
        stateNode: null,

        // Fiber
        return: null,
        child: null,
        sibling: null,
        index: 0,

        memoizedProps: null,
        updateQueue: null,
        memoizedState: null,
        dependencies: null,

        // Effects
        flags: NoFlags,
        subtreeFlags: NoFlags,
        deletions: null,

        lanes: NoLanes,
        childLanes: NoLanes,

        alternate: null,
    };
    return fiber;
}

function createFiberImplClass(tag, pendingProps, key, mode) {
    return new FiberNode(tag, pendingProps, key, mode);
}

function FiberNode(tag, pendingProps, key, mode) {
    // Instance
    this.tag = tag;
    this.key = key;
    this.elementType = null;
    this.type = null;
    this.stateNode = null;

    // Fiber
    this.return = null;
    this.child = null;
    this.sibling = null;
    this.index = 0;

    this.ref = null;
    this.refCleanup = null;

    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;
    this.dependencies = null;

    this.mode = mode;

    // Effects
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.deletions = null;

    this.lanes = NoLanes;
    this.childLanes = NoLanes;

    this.alternate = null;
}