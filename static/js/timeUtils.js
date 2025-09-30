export const TimeUtils = {
    getISOTimestamp: () => new Date().toISOString(),
    getHighResTime: () => performance.now(),
    formatElapsedTime: (ms) => (ms / 1000).toFixed(3),
    calculateTimeDifference: (start, end) => (end - start).toFixed(2)
};