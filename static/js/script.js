// 获取页面元素
const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('statusElement');
const fpsElement = document.getElementById('fpsElement');
const latencyElement = document.getElementById('latencyElement');
const handsCountElement = document.getElementById('handsCountElement');
const gestureElement = document.getElementById('gestureElement');
const sessionIdInput = document.getElementById('sessionId'); // 添加Session ID输入框引用

// 性能监控变量
let frameCount = 0;
let lastFpsUpdate = performance.now();
let lastFrameTime = performance.now();
let currentFps = 0;
let currentLatency = 0;

// 性能数据存储
let performanceData = {
    fps: [],
    latency: [],
    handsDetected: [],
    gestures: [],
    timestamps: []
};

// 时间处理工具函数
const TimeUtils = {
    // 获取当前ISO格式时间戳
    getISOTimestamp: () => new Date().toISOString(),

    // 获取高精度相对时间（毫秒）
    getHighResTime: () => performance.now(),

    // 格式化经过时间（毫秒转为秒保留3位小数）
    formatElapsedTime: (ms) => (ms / 1000).toFixed(3),

    // 计算时间差（毫秒）
    calculateTimeDifference: (start, end) => (end - start).toFixed(2)
};

// 实验配置
let experimentConfig = {
    sessionId: null,
    networkType: 'wifi',
    resolution: '640x480',
    startTimeAbsolute: null,
    startTimeRelative: null
};

// 手指关节索引（MediaPipe标准定义）
const fingerJoints = {
    thumb: [1, 2, 3, 4],
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20]
};

// 初始化MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(onHandsResults);

// 判断手指状态（伸直返回true，弯曲返回false）
function checkFingerState(landmarks, finger, isRightHand) {
    const fingerIndices = fingerJoints[finger];
    let tip, pip;

    // 获取关键点
    tip = landmarks[fingerIndices[3]]; // 指尖
    pip = landmarks[fingerIndices[2]]; // 第二关节

    // 特殊处理拇指（比较X坐标）
    if (finger === "thumb") {
        if (isRightHand) {
            // 右手拇指：指尖X坐标 > 第一关节X坐标 表示伸直
            return tip.x > pip.x;
        } else {
            // 左手拇指：指尖X坐标 < 第一关节X坐标 表示伸直
            return tip.x < pip.x;
        }
    }

    // 其他四指：指尖Y坐标 < 第一关节Y坐标 表示伸直（因为图像坐标系Y向下）
    return tip.y < pip.y;
}

// 判断是左手还是右手
function checkHandedness(landmarks) {
    // 简单判断：手腕(0)的X坐标与中指根部(9)的X坐标比较
    return landmarks[0].x < landmarks[9].x;
}

// 更新性能指标
function updatePerformanceMetrics() {
    const now = TimeUtils.getHighResTime();
    frameCount++;

    // 每秒更新FPS
    if (now - lastFpsUpdate >= 1000) {
        currentFps = frameCount;
        fpsElement.textContent = currentFps;

        // 记录FPS数据 - 使用绝对时间戳
        performanceData.fps.push({
            value: currentFps,
            timestamp: TimeUtils.getISOTimestamp(),
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, now)
        });

        frameCount = 0;
        lastFpsUpdate = now;
    }

    // 更新延迟（从上一帧到现在的时间）
    currentLatency = now - lastFrameTime;
    latencyElement.textContent = currentLatency.toFixed(1);

    // 记录延迟数据 - 使用绝对时间戳
    performanceData.latency.push({
        value: currentLatency,
        timestamp: TimeUtils.getISOTimestamp(),
        elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, now)
    });

    lastFrameTime = now;
}

// 处理识别结果回调函数
function onHandsResults(results) {
    updatePerformanceMetrics();

    const currentAbsoluteTime = TimeUtils.getISOTimestamp();
    const currentRelativeTime = TimeUtils.getHighResTime();

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handsCount = results.multiHandLandmarks.length;
        handsCountElement.textContent = handsCount;
        statusElement.textContent = '检测中';

        // 记录手部数量数据
        performanceData.handsDetected.push({
            value: handsCount,
            timestamp: currentAbsoluteTime,
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, currentRelativeTime)
        });

        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: '#00aeff',
                lineWidth: 2
            });
            drawLandmarks(canvasCtx, landmarks, {
                color: '#dd00ff',
                lineWidth: 1,
                radius: 4
            });

            // 进行手势识别
            const isRightHand = checkHandedness(landmarks);
            const fingerState = {
                thumb: checkFingerState(landmarks, "thumb", isRightHand),
                index: checkFingerState(landmarks, "index", isRightHand),
                middle: checkFingerState(landmarks, "middle", isRightHand),
                ring: checkFingerState(landmarks, "ring", isRightHand),
                pinky: checkFingerState(landmarks, "pinky", isRightHand)
            };

            const extendedFingers = Object.values(fingerState).filter(state => state).length;
            let gesture = "-";

            if (extendedFingers === 0) {
                gesture = "拳头/0";
            } else if (extendedFingers === 1 && fingerState.index) {
                gesture = "1";
            } else if (extendedFingers === 2 && fingerState.index && fingerState.middle) {
                gesture = "2";
            } else if (extendedFingers === 3 && fingerState.index && fingerState.middle && fingerState.ring) {
                gesture = "3";
            } else if (extendedFingers === 4 && fingerState.index && fingerState.middle && fingerState.ring && fingerState.pinky) {
                gesture = "4";
            } else if (extendedFingers === 5) {
                gesture = "5";
            }

            gestureElement.textContent = gesture;

            // 记录手势数据
            performanceData.gestures.push({
                value: gesture,
                timestamp: currentAbsoluteTime,
                elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, currentRelativeTime)
            });
        }
    } else {
        statusElement.textContent = "等待手部";
        handsCountElement.textContent = "0";
        gestureElement.textContent = "-";

        // 记录无手部状态
        performanceData.handsDetected.push({
            value: 0,
            timestamp: currentAbsoluteTime,
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, currentRelativeTime)
        });
        performanceData.gestures.push({
            value: "-",
            timestamp: currentAbsoluteTime,
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, currentRelativeTime)
        });
    }
    canvasCtx.restore();
}

// 初始化摄像头
let camera = null;

// 启动摄像头
startButton.addEventListener('click', () => {
    statusElement.textContent = "正在启动摄像头...";
    startButton.style.display = 'none';
    stopButton.style.display = 'block';

    // 设置Session ID（从输入框获取或生成默认值）
    experimentConfig.sessionId = sessionIdInput.value ||
        `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;

    // 设置开始时间
    experimentConfig.startTimeAbsolute = TimeUtils.getISOTimestamp();
    experimentConfig.startTimeRelative = TimeUtils.getHighResTime();

    console.log('实验配置:', experimentConfig);

    // 设置canvas尺寸
    canvasElement.width = videoElement.videoWidth || 640;
    canvasElement.height = videoElement.videoHeight || 480;

    // 初始化摄像头
    camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 640,
        height: 480
    });

    camera.start()
        .then(() => {
            statusElement.textContent = "摄像头已启动";
            lastFrameTime = performance.now();
        })
        .catch(error => {
            console.error("摄像头启动失败:", error);
            statusElement.textContent = "摄像头启动失败: " + error.message;
            startButton.style.display = 'block';
            stopButton.style.display = 'none';
        });
});

// 停止摄像头
stopButton.addEventListener('click', () => {
    if (camera) {
        camera.stop();
    }
    statusElement.textContent = "已停止";
    startButton.style.display = 'block';
    stopButton.style.display = 'none';

    // 清除画布
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    handsCountElement.textContent = "0";
    gestureElement.textContent = "-";
    fpsElement.textContent = "0";
    latencyElement.textContent = "0";
});

// 导出性能数据为CSV
function exportPerformanceData() {
    if (performanceData.fps.length === 0) {
        alert('没有性能数据可导出');
        return;
    }

    // 确保Session ID已设置
    if (!experimentConfig.sessionId) {
        experimentConfig.sessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    }

    // 创建CSV内容
    let csvContent = "Absolute Timestamp,Relative Time (s),FPS,Latency (ms),Hands Detected,Gesture,Session ID,Network Type,Resolution\n";

    // 创建时间索引（毫秒时间戳）
    const timeIndex = {};

    // 处理所有类型的数据
    const dataTypes = ['fps', 'latency', 'handsDetected', 'gestures'];

    dataTypes.forEach(type => {
        performanceData[type].forEach(item => {
            const timestampMs = new Date(item.timestamp).getTime();

            if (!timeIndex[timestampMs]) {
                timeIndex[timestampMs] = {
                    timestamp: item.timestamp,
                    relative: TimeUtils.formatElapsedTime(item.elapsed),
                    sessionId: experimentConfig.sessionId,
                    network: experimentConfig.networkType,
                    resolution: experimentConfig.resolution
                };
            }

            // 设置对应字段的值
            if (type === 'latency') {
                timeIndex[timestampMs].latency = item.value.toFixed(1);
            } else if (type === 'gestures') {
                timeIndex[timestampMs].gesture = item.value;
            } else {
                timeIndex[timestampMs][type] = item.value;
            }
        });
    });

    // 获取所有时间点并排序
    const allTimestamps = Object.keys(timeIndex).map(Number).sort((a, b) => a - b);
    const allDataPoints = allTimestamps.map(ts => timeIndex[ts]);

    // 构建CSV内容
    allDataPoints.forEach(point => {
        csvContent += `${point.timestamp},${point.relative},${point.fps || ''},${point.latency || ''},${point.handsDetected || ''},"${point.gesture || ''}",${point.sessionId},${point.network},${point.resolution}\n`;
    });

    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `hand_recognition_performance_${experimentConfig.sessionId}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 绑定导出按钮事件
function setupExportButton() {
    const exportButton = document.getElementById('exportData');


    exportButton.onclick = function(event) {
        event.preventDefault();
        console.log('导出按钮被点击');
        exportPerformanceData();
    };

    console.log('✅ 导出按钮事件绑定完成');
}

// 立即执行绑定
setupExportButton();