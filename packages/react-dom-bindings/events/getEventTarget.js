import { TEXT_NODE } from '../HTMLNodeType';

export default function getEventTarget(nativeEvent) {
    let target = nativeEvent.target || nativeEvent.srcElement || window;

    // Normalize SVG <use> element events #4963
    if (target.correspondingUseElement) {
        target = target.correspondingUseElement;
    }
    return target.nodeType === TEXT_NODE ? target.parentNode : target;
}
