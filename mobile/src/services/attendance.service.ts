import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = 'attendance_offline_queue';

export const attendanceService = {
    async markAttendance(startUrl: string, location: { latitude: number; longitude: number }) {
        const payload = { qrCode: startUrl, location };

        try {
            const response = await api.post('/attendance/mark', payload);
            return { success: true, data: response.data };
        } catch (error) {
            console.log('API Error, saving to offline queue', error);

            const currentQueue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
            currentQueue.push({ ...payload, timestamp: Date.now() });
            await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(currentQueue));

            return { success: false, offline: true };
        }
    },

    async getPendingCount() {
        const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
        return queue.length;
    },

    async syncPendingAttempts() {
        const queue = JSON.parse(await AsyncStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
        if (queue.length === 0) return { synced: 0, errors: 0 };

        let synced = 0;
        let errors = 0;
        const newQueue = [];

        for (const item of queue) {
            try {
                await api.post('/attendance/mark', { qrCode: item.qrCode, location: item.location });
                synced++;
            } catch (error) {
                console.error('Failed to sync item:', item);
                errors++;
                newQueue.push(item);
            }
        }

        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
        return { synced, errors, remaining: newQueue.length };
    },

    async getHistory() {
        return api.get('/attendance/history');
    }
};
