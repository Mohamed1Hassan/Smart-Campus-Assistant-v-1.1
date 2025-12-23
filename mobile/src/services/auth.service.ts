import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.token) {
            await AsyncStorage.setItem('token', response.data.token);
            await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
    },

    async logout() {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
    },

    async getCurrentUser() {
        const user = await AsyncStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
};
