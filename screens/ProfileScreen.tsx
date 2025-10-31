import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import { getUserRecordingStats, UserRecordingStats } from '../utils/recordingStats';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, user } = useAuth();
  const [stats, setStats] = useState<UserRecordingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const userStats = await getUserRecordingStats();
      setStats(userStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [])
  );

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileEmail}>{user?.email || 'No email'}</Text>
                <Text style={styles.profileSubtext}>User Account</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Recording Statistics</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#1E88E5" />
              </View>
            ) : (
              <View style={styles.statsContent}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Time Recorded</Text>
                  <Text style={styles.statValue}>
                    {stats ? formatTime(stats.total_time_recorded_ms) : '0s'}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Recordings</Text>
                  <Text style={styles.statValue}>
                    {stats?.recording_count || 0}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <TouchableOpacity 
            onPress={handleSignOut} 
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileSection: {
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E88E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileSubtext: {
    fontSize: 14,
    color: '#666',
  },
  statsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  statsContent: {
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E88E5',
  },
  statDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  settingsSection: {
    marginTop: 'auto',
  },
  signOutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d32f2f',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: '600',
  },
});

