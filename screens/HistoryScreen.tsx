import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  FlatList, 
  Alert, 
  ActivityIndicator,
  StyleSheet 
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getRecordings, deleteRecording, SavedRecording, ensureAudioFileExists } from '../utils/storage';
import { RootStackParamList } from '../types/navigation';
import { useAudioCleanup } from '../hooks/useAudioCleanup';

type HistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;

function getPriorityColor(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return '#d32f2f';
    case 'high':
      return '#f57c00';
    case 'medium':
      return '#1976d2';
    case 'low':
      return '#388e3c';
    default:
      return '#666';
  }
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  
  // Global audio cleanup
  useAudioCleanup();
  
  const [recordings, setRecordings] = React.useState<SavedRecording[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load recordings when component mounts
  React.useEffect(() => {
    loadRecordings();
  }, []);

  // Reload recordings when screen comes into focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadRecordings();
    });
    return unsubscribe;
  }, [navigation]);

  async function loadRecordings() {
    try {
      setIsLoading(true);
      console.log('Loading recordings...');
      const savedRecordings = await getRecordings();
      console.log('Loaded recordings:', savedRecordings.length, 'recordings');
      console.log('Recordings data:', savedRecordings);
      setRecordings(savedRecordings);
    } catch (error) {
      console.error('Error loading recordings:', error);
      Alert.alert('Error', 'Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteRecording(recording: SavedRecording) {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to delete "${recording.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecording(recording.id);
              await loadRecordings(); // Reload the list
              Alert.alert('Success', 'Recording deleted successfully');
            } catch (error) {
              console.error('Error deleting recording:', error);
              Alert.alert('Error', 'Failed to delete recording');
            }
          }
        }
      ]
    );
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDuration(milliseconds: number) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async function handlePlayRecording(recording: SavedRecording) {
    console.log('Playing recording with audioUri:', recording.audioUri);
    
    try {
      // Check if audio file exists
      const validAudioUri = await ensureAudioFileExists(recording);
      console.log('Valid audio URI:', validAudioUri);
      
      // Navigate to Review screen with the saved recording data
      // Convert stored transcription back to the format expected by ReviewScreen
      const serverResult = recording.transcription ? {
        full_text: recording.transcription.fullText,
        words: recording.transcription.words,
        bullets: recording.transcription.bullets,
        summary: recording.transcription.summary,
        topics: recording.transcription.topics,
        ok: true
      } : null;

      console.log('Navigating to Review with serverResult:', serverResult);
      
      navigation.navigate('Review', {
        audioUri: validAudioUri,
        audioDuration: recording.audioDuration,
        serverResult: serverResult,
        savedActionablePoints: recording.actionablePoints
      });
    } catch (error) {
      console.error('Error handling play recording:', error);
      Alert.alert('Error', 'Could not access the recording. The audio file may have been moved or deleted.');
    }
  }

  function renderRecording({ item }: { item: SavedRecording }) {
    return (
      <TouchableOpacity 
        style={styles.recordingItem}
        onPress={() => handlePlayRecording(item)}
        activeOpacity={0.7}
      >
        <View style={styles.recordingContent}>
          <Text style={styles.recordingTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.recordingDate}>
            {formatDate(item.createdAt)}
          </Text>
          <Text style={styles.recordingDuration}>
            Duration: {formatDuration(item.audioDuration)}
          </Text>
          {item.transcription && (
            <Text style={styles.recordingTranscription} numberOfLines={2}>
              {item.transcription.fullText || 'No transcription available'}
            </Text>
          )}
          {item.actionablePoints && item.actionablePoints.length > 0 && (
            <View style={styles.actionablePointsPreview}>
              <Text style={styles.actionablePointsLabel}>
                {item.actionablePoints.length} actionable point{item.actionablePoints.length !== 1 ? 's' : ''}
              </Text>
              <View style={styles.actionablePointsTags}>
                {item.actionablePoints.slice(0, 2).map((point, index) => (
                  <View key={index} style={[styles.priorityTag, { backgroundColor: getPriorityColor(point.priority) }]}>
                    <Text style={styles.priorityTagText}>{point.priority}</Text>
                  </View>
                ))}
                {item.actionablePoints.length > 2 && (
                  <Text style={styles.morePointsText}>+{item.actionablePoints.length - 2} more</Text>
                )}
              </View>
            </View>
          )}
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteRecording(item)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading recordings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.headerTitle}>Recording History</Text>
        <Text style={styles.headerSubtitle}>
          {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {recordings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Recordings Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start recording to see your audio files here
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          renderItem={renderRecording}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  recordingItem: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  recordingContent: {
    flex: 1,
    marginRight: 12,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  recordingDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  recordingDuration: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  recordingTranscription: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  actionablePointsPreview: {
    marginTop: 8,
  },
  actionablePointsLabel: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 4,
  },
  actionablePointsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  priorityTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityTagText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  morePointsText: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 20,
  },
  deleteButtonText: {
    fontSize: 16,
  },
});
