import { defaultExperimentConfig } from './constants.js';
import { TimeUtils } from './timeUtils.js';
import { checkFingerState, checkHandedness, recognizeGesture } from './handUtils.js';
import { PerformanceMonitor } from './performanceMetrics.js';

// 从全局对象中获取必要的MediaPipe组件
const { Camera } = window;
const { drawConnectors, drawLandmarks } = window;
const HAND_CONNECTIONS = window.HAND_CONNECTIONS;

// 获取页面元素
const elements = {
    videoElement: document.getElementById('videoElement'),
    canvasElement: document.getElementById('canvasElement'),
    startButton: document.getElementById('startButton'),
    stopButton: document.getElementById('stopButton'),
    statusElement: document.getElementById('statusElement'),
    fpsElement: document.getElementById('fpsElement'),
    latencyElement: document.getElementById('latencyElement'),
    handsCountElement: document.getElementById('handsCountElement'),
    gestureElement: document.getElementById('gestureElement'),
    sessionIdInput: document.getElementById('sessionId'),
    exportButton: document.getElementById('exportData'),
    networkTypeSelect: document.getElementById('networkType'),
    resolutionSelect: document.getElementById('resolution'),
    resetButton: document.getElementById('resetData')
};

const canvasCtx = elements.canvasElement.getContext('2d');
const performanceMonitor = new PerformanceMonitor();
let experimentConfig = { ...defaultExperimentConfig };
let camera = null;

// 初始化MediaPipe Hands
const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// 处理识别结果回调函数
function onHandsResults(results) {
    performanceMonitor.updateMetrics(experimentConfig, elements);

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, elements.canvasElement.width, elements.canvasElement.height);

    if (results.image) {
        canvasCtx.drawImage(results.image, 0, 0, elements.canvasElement.width, elements.canvasElement.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handsCount = results.multiHandLandmarks.length;
        elements.handsCountElement.textContent = handsCount;
        elements.statusElement.textContent = '检测中';

        for (const landmarks of results.multiHandLandmarks) {
            if (HAND_CONNECTIONS) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                    color: '#00aeff',
                    lineWidth: 2
                });
            }

            drawLandmarks(canvasCtx, landmarks, {
                color: '#dd00ff',
                lineWidth: 1,
                radius: 4
            });

            const isRightHand = checkHandedness(landmarks);
            const fingerState = {
                thumb: checkFingerState(landmarks, "thumb", isRightHand),
                index: checkFingerState(landmarks, "index", isRightHand),
                middle: checkFingerState(landmarks, "middle", isRightHand),
                ring: checkFingerState(landmarks, "ring", isRightHand),
                pinky: checkFingerState(landmarks, "pinky", isRightHand)
            };

            const gesture = recognizeGesture(fingerState);
            elements.gestureElement.textContent = gesture;

            performanceMonitor.recordHandData(handsCount, gesture, experimentConfig);
        }
    } else {
        elements.statusElement.textContent = "等待手部";
        elements.handsCountElement.textContent = "0";
        elements.gestureElement.textContent = "-";
        performanceMonitor.recordHandData(0, "-", experimentConfig);
    }

    canvasCtx.restore();
}

hands.onResults(onHandsResults);

// 启动摄像头
elements.startButton.addEventListener('click', () => {
    elements.statusElement.textContent = "正在启动摄像头...";
    elements.startButton.style.display = 'none';
    elements.stopButton.style.display = 'block';

    experimentConfig.sessionId = elements.sessionIdInput.value ||
        `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    experimentConfig.networkType = elements.networkTypeSelect.value;
    experimentConfig.resolution = elements.resolutionSelect.value;

    experimentConfig.startTimeAbsolute = TimeUtils.getISOTimestamp();
    experimentConfig.startTimeRelative = TimeUtils.getHighResTime();

    elements.canvasElement.width = elements.videoElement.videoWidth || 640;
    elements.canvasElement.height = elements.videoElement.videoHeight || 480;

    camera = new Camera(elements.videoElement, {
        onFrame: async () => {
            try {
                await hands.send({ image: elements.videoElement });
            } catch (error) {
                console.error("发送图像到MediaPipe失败:", error);
                elements.statusElement.textContent = "处理错误";
            }
        },
        width: 640,
        height: 480
    });

    camera.start()
        .then(() => {
            elements.statusElement.textContent = "摄像头已启动";
            performanceMonitor.lastFrameTime = performance.now();
        })
        .catch(error => {
            console.error("摄像头启动失败:", error);
            elements.statusElement.textContent = `摄像头启动失败: ${error.message}`;
            elements.startButton.style.display = 'block';
            elements.stopButton.style.display = 'none';
        });
});

// 停止摄像头
elements.stopButton.addEventListener('click', () => {
    if (camera) {
        try {
            camera.stop();
        } catch (error) {
            console.error("停止摄像头时出错:", error);
        }
    }

    elements.statusElement.textContent = "已停止";
    elements.startButton.style.display = 'block';
    elements.stopButton.style.display = 'none';

    canvasCtx.clearRect(0, 0, elements.canvasElement.width, elements.canvasElement.height);
    elements.handsCountElement.textContent = "0";
    elements.gestureElement.textContent = "-";
    elements.fpsElement.textContent = "0";
    elements.latencyElement.textContent = "0";
});

// 导出数据
elements.exportButton.addEventListener('click', (event) => {
    event.preventDefault();
    performanceMonitor.exportData(experimentConfig);
});

// 重置数据
elements.resetButton.addEventListener('click', () => {
    performanceMonitor.resetData();
    alert('性能数据已重置');
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('页面加载完成');
    if (elements.stopButton) {
        elements.stopButton.style.display = 'none';
    }
});