import React, { useState, useCallback } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { authService } from '../services/auth.service';
import { attendanceService } from '../services/attendance.service';

export default function HomeScreen({ navigation }: any) {
    const [pendingCount, setPendingCount] = useState(0);

    const checkPending = async () => {
        const count = await attendanceService.getPendingCount();
        setPendingCount(count);
    };

    useFocusEffect(
        useCallback(() => {
            checkPending();
        }, [])
    );

    const handleSync = async () => {
        const result = await attendanceService.syncPendingAttempts();
        Alert.alert('Sync Complete', `Synced: ${result.synced}, Failed: ${result.errors}`);
        checkPending();
    };

    const handleLogout = async () => {
        await authService.logout();
        navigation.replace('Login');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Smart Campus Home</Text>

            {pendingCount > 0 && (
                <View style={styles.alertContainer}>
                    <Text style={styles.alertText}>{pendingCount} Attendance records pending</Text>
                    <Button title="Sync Now" onPress={handleSync} color="orange" />
                </View>
            )}

            <View style={styles.buttonContainer}>
                <Button
                    title="Scan Attendance QR"
                    onPress={() => navigation.navigate('QRScanner')}
                />
            </View>

            <View style={styles.buttonContainer}>
                <Button title="Logout" onPress={handleLogout} color="red" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        marginBottom: 40,
    },
    alertContainer: {
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#fff3cd',
        width: '100%',
        alignItems: 'center',
        borderRadius: 5
    },
    alertText: {
        marginBottom: 5,
        color: '#856404'
    },
    buttonContainer: {
        marginVertical: 10,
        width: '80%',
    },
});
