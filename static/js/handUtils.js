import { fingerJoints } from './constants.js';

export function checkFingerState(landmarks, finger, isRightHand) {
    const fingerIndices = fingerJoints[finger];
    let tip, pip;

    tip = landmarks[fingerIndices[3]];
    pip = landmarks[fingerIndices[2]];

    if (finger === "thumb") {
        return isRightHand ? tip.x > pip.x : tip.x < pip.x;
    }

    return tip.y < pip.y;
}

export function checkHandedness(landmarks) {
    return landmarks[0].x < landmarks[9].x;
}

export function recognizeGesture(fingerState) {
    const extendedFingers = Object.values(fingerState).filter(state => state).length;

    if (extendedFingers === 0) return "拳头/0";
    if (extendedFingers === 1 && fingerState.index) return "1";
    if (extendedFingers === 2 && fingerState.index && fingerState.middle) return "2";
    if (extendedFingers === 3 && fingerState.index && fingerState.middle && fingerState.ring) return "3";
    if (extendedFingers === 4 && fingerState.index && fingerState.middle && fingerState.ring && fingerState.pinky) return "4";
    if (extendedFingers === 5) return "5";

    return "-";
}