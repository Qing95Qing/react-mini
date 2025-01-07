import { pickArbitraryLane, SyncLane } from './ReactFiberLane';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';
import { requestCurrentTransition } from './ReactFiberTransition';
import { peekEntangledActionLane } from './ReactFiberAsyncAction';
import { requestTransitionLane } from './ReactFiberRootScheduler';
import { resolveUpdatePriority } from '../react-dom-bindings/ReactDOMUpdatePriority';
import { eventPriorityToLane } from './ReactEventPriorities';
import { disableLegacyMode } from '../shared/ReactFeatureFlags'


export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
export const RenderContext = /*         */ 0b010;
export const CommitContext = /*         */ 0b100;

let executionContext = NoContext;

export function requestUpdateLane(fiber) {
    // 获取当前fiber节点的lanes
    const { mode } = fiber;
    // 1）、模式检查：不是Concurrent模式，则返回 SyncLane，标识更新需要同步执行
    if ((mode & ConcurrentMode) === NoMode) {
        return SyncLane;
    } else if (
        (executionContext & RenderContext) !== NoContext &&
        workInProgressRootRenderLanes !== NoLanes
    ) {
        // 2） 渲染上下文检查
        // 如果当前处于渲染上下文中且有正在渲染的 Lanes，则返回当前渲染优先级中的任意一个优先级
        // 这种情况通常发生在渲染阶段调用 setState 时。
        return pickArbitraryLane(workInProgressRootRenderLanes);
    }

    // 3）Transition检查
    const transition = requestCurrentTransition();
    if (transition !== null) {
        // 获取当前的 Action Scope Lane
        const actionScopeLane = peekEntangledActionLane();
        return actionScopeLane !== NoLane
            ? // 如果在异步 Action Scope 中，则重用相同的 Lane
            actionScopeLane
            : // 否则，获取一个新的 Transition Lane
            requestTransitionLane(transition);
    }
    // 4）事件优先级：根据事件优先级返回相应的 Lane
    return eventPriorityToLane(resolveUpdatePriority());
}

export function isUnsafeClassRenderPhaseUpdate(fiber) {
    // 检查是否是一个渲染阶段的update，只会被类组件调用
    // 为了UNSAFE_componentWillReceive而设置的特殊行为
    // which special (deprecated) behavior for UNSAFE_componentWillReceive props.
    return (executionContext & RenderContext) !== NoContext;
}

export function batchedUpdates(fn, a) {
    // 批处理更新现在没有多余的操作，只是调用 fn(a)，为了兼容内部react-dom的调用
    if (disableLegacyMode) {
        return fn(a);
    } else {
        // 后面省略，不走这里
    }
}

export function flushSyncWork() {
    // 不在render和commit阶段
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
        flushSyncWorkOnAllRoots();
        return false;
    }
    return true;
}
