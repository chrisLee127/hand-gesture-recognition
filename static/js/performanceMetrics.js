import { TimeUtils } from './timeUtils.js';

export class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastFpsUpdate = TimeUtils.getHighResTime();
        this.lastFrameTime = TimeUtils.getHighResTime();
        this.currentFps = 0;
        this.currentLatency = 0;
        this.performanceData = {
            fps: [],
            latency: [],
            handsDetected: [],
            gestures: [],
            timestamps: []
        };
    }

    updateMetrics(experimentConfig, elements) {
        const now = TimeUtils.getHighResTime();
        this.frameCount++;

        if (now - this.lastFpsUpdate >= 1000) {
            this.currentFps = this.frameCount;
            if (elements.fpsElement) {
                elements.fpsElement.textContent = this.currentFps;
            }

            this.performanceData.fps.push({
                value: this.currentFps,
                timestamp: TimeUtils.getISOTimestamp(),
                elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, now)
            });

            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }

        this.currentLatency = now - this.lastFrameTime;
        if (elements.latencyElement) {
            elements.latencyElement.textContent = this.currentLatency.toFixed(1);
        }

        this.performanceData.latency.push({
            value: this.currentLatency,
            timestamp: TimeUtils.getISOTimestamp(),
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, now)
        });

        this.lastFrameTime = now;
    }

    recordHandData(handsCount, gesture, experimentConfig) {
        const now = TimeUtils.getHighResTime();

        this.performanceData.handsDetected.push({
            value: handsCount,
            timestamp: TimeUtils.getISOTimestamp(),
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, now)
        });

        this.performanceData.gestures.push({
            value: gesture,
            timestamp: TimeUtils.getISOTimestamp(),
            elapsed: TimeUtils.calculateTimeDifference(experimentConfig.startTimeRelative, now)
        });
    }

    exportData(experimentConfig) {
        if (this.performanceData.fps.length === 0) {
            alert('没有性能数据可导出');
            return;
        }

        let csvContent = "Absolute Timestamp,Relative Time (s),FPS,Latency (ms),Hands Detected,Gesture,Session ID,Network Type,Resolution\n";

        const timeIndex = {};

        const dataTypes = ['fps', 'latency', 'handsDetected', 'gestures'];
        dataTypes.forEach(type => {
            this.performanceData[type].forEach(item => {
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

                if (type === 'latency') {
                    timeIndex[timestampMs].latency = item.value.toFixed(1);
                } else if (type === 'gestures') {
                    timeIndex[timestampMs].gesture = item.value;
                } else {
                    timeIndex[timestampMs][type] = item.value;
                }
            });
        });

        const allTimestamps = Object.keys(timeIndex).map(Number).sort((a, b) => a - b);
        const allDataPoints = allTimestamps.map(ts => timeIndex[ts]);

        allDataPoints.forEach(point => {
            csvContent += `${point.timestamp},${point.relative},${point.fps || ''},${point.latency || ''},${point.handsDetected || ''},"${point.gesture || ''}",${point.sessionId},${point.network},${point.resolution}\n`;
        });

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

    resetData() {
        this.performanceData = {
            fps: [],
            latency: [],
            handsDetected: [],
            gestures: [],
            timestamps: []
        };
        console.log('性能数据已重置');
    }
}