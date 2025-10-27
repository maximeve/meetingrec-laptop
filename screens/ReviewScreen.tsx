import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, Dimensions, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import WaveformComponent, { generateWaveformData } from '../components/WaveformComponent';
import { saveRecording, SavedRecording } from '../utils/storage';
import { useAudioCleanup } from '../hooks/useAudioCleanup';
import { IconSymbol } from '@/components/ui/icon-symbol';

const DEEPGRAM_API = 'https://meeting-rec-api-git-main-maximeves-projects.vercel.app';
const ACTIONABLE_API = 'https://meeting-rec-backend-git-main-maximeves-projects.vercel.app';

type ReviewScreenRouteProp = RouteProp<RootStackParamList, 'Review'>;
type ReviewScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Review'>;

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

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ReviewScreenNavigationProp>();
  const route = useRoute<ReviewScreenRouteProp>();
  
  // Global audio cleanup
  useAudioCleanup();
  
  // Get props from navigation params
  const { audioUri, audioDuration, serverResult, savedActionablePoints } = route.params || {};
  
  // Check if this is a saved recording (coming from HistoryScreen)
  const isSavedRecording = !!serverResult && serverResult.ok === true;
  
  const [sound, setSound] = React.useState<Audio.Sound | null>(null);
  const [audioProgress, setAudioProgress] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [waveformData, setWaveformData] = React.useState<number[]>([]);
  const [recordingTitle, setRecordingTitle] = React.useState('');
  const [showTitleInput, setShowTitleInput] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentServerResult, setCurrentServerResult] = React.useState(serverResult);
  const [actionablePoints, setActionablePoints] = React.useState<any[]>(savedActionablePoints || []);
  const [isLoadingActionable, setIsLoadingActionable] = React.useState(false);

  // Initialize audio and waveform when component mounts
  React.useEffect(() => {
    initializeAudio();
    return () => {
      // Cleanup audio when component unmounts
      cleanupAudio();
    };
  }, [audioUri]);

  // Handle screen focus changes
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused - no action needed
      return () => {
        // Screen is losing focus - stop audio
        if (sound && isPlaying) {
          console.log('Screen losing focus - stopping audio');
          sound.pauseAsync();
          setIsPlaying(false);
        }
      };
    }, [sound, isPlaying])
  );

  // Cleanup audio function
  async function cleanupAudio() {
    if (sound) {
      try {
        // Check if audio is still enabled before trying to stop
        const status = await sound.getStatusAsync();
        if ((status as any).isPlaying) {
          await sound.pauseAsync();
        }
        await sound.unloadAsync();
        console.log('Audio cleaned up successfully');
      } catch (error) {
        console.error('Error cleaning up audio:', error);
        // Force unload even if stop fails
        try {
          await sound.unloadAsync();
        } catch (unloadError) {
          console.error('Error unloading audio:', unloadError);
        }
      }
    }
  }

  async function initializeAudio() {
    try {
      console.log('Initializing audio with URI:', audioUri);
      
      // Configure audio mode for better volume
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        console.error('Audio file does not exist:', audioUri);
        Alert.alert('Error', 'Audio file not found. The recording may have been moved or deleted.');
        return;
      }
      
      const s = new Audio.Sound();
      await s.loadAsync({ uri: audioUri }, {}, true);
      await s.setIsMutedAsync(false);
      await s.setVolumeAsync(1.0);
      
      setSound(s);
      setAudioProgress(0);
      
      // Generate waveform data
      const waveform = generateWaveformData(audioDuration / 1000);
      setWaveformData(waveform);
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      Alert.alert('Audio Error', `Failed to load audio: ${error.message || error}`);
    }
  }

  // Progress tracking effect
  React.useEffect(() => {
    if (!sound || !isPlaying) return;

    const interval = setInterval(async () => {
      if (sound) {
        const status = await sound.getStatusAsync();
        const position = (status as any).positionMillis || 0;
        setAudioProgress(position);
        
        // Check if audio finished
        if ((status as any).didJustFinish) {
          setIsPlaying(false);
          setAudioProgress(0);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sound, isPlaying]);

  function formatTime(seconds: number | undefined) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }


  // Seek to specific position
  async function seekTo(position: number) {
    if (!sound) return;
    
    try {
      // Get current playing state
      const status = await sound.getStatusAsync();
      const wasPlaying = (status as any).isPlaying;
      
      // Set the new position
      await sound.setPositionAsync(position);
      setAudioProgress(position);
      
      // If audio was playing, continue playing from new position
      if (wasPlaying) {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  }


  async function playFrom(seconds: number) {
    if (!sound) return;
    await sound.setPositionAsync(Math.floor(seconds * 1000));
    await sound.setIsMutedAsync(false);
    await sound.setVolumeAsync(1.0);
    await sound.playAsync();
  }

  async function togglePlayPause() {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    
    if ((status as any).isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      const position = (status as any).positionMillis || 0;
      const duration = (status as any).durationMillis || 0;
      
      if ((status as any).didJustFinish || position >= duration - 100) {
        await sound.setPositionAsync(0);
        setAudioProgress(0);
      }
      
      // Ensure volume is set to maximum before playing
      await sound.setVolumeAsync(1.0);
      await sound.setIsMutedAsync(false);
      await sound.playAsync();
      setIsPlaying(true);
    }
  }

  async function upload() {
    if (!audioUri) return;
    try {
      setIsLoading(true);
      console.log('Starting upload to:', `${DEEPGRAM_API}/api/transcribe`);
      
      // Check file size before uploading
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      const fileSizeKB = Math.round((fileInfo.size || 0) / 1024);
      console.log('Audio file size:', fileSizeKB, 'KB');
      
      // Check if file is too large (limit to 10MB)
      if (fileSizeKB > 10240) {
        Alert.alert('File Too Large', `Audio file is ${fileSizeKB}KB. Please record a shorter audio or try again.`);
        setIsLoading(false);
        return;
      }
      
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
      console.log('Audio base64 size:', Math.round(audioBase64.length * 3 / 4 / 1024), 'KB');
      
      const requestBody = { audioBase64, mime: 'audio/wav', lang: 'auto', summarize: true };
      console.log('Request body size:', JSON.stringify(requestBody).length, 'chars');
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const resp = await fetch(`${DEEPGRAM_API}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('Response status:', resp.status, resp.statusText);
      console.log('Response headers:', Object.fromEntries(resp.headers.entries()));
      
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('Server error response:', text);
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }
      
      const data = await resp.json();
      console.log('Server response:', data);
      
      // Log audio file details for debugging
      console.log('=== AUDIO FILE DEBUG ===');
      console.log('Audio URI:', audioUri);
      console.log('Audio Duration:', audioDuration, 'ms');
      console.log('Audio Duration (seconds):', audioDuration / 1000);
      
      // Log Deepgram result details
      if (data?.result) {
        console.log('=== DEEPGRAM RESULT ===');
        console.log('Full Deepgram response:', JSON.stringify(data.result, null, 2));
        
        if (data.result.results?.channels) {
          console.log('Number of channels:', data.result.results.channels.length);
          data.result.results.channels.forEach((channel: any, index: number) => {
            console.log(`Channel ${index}:`, {
              alternatives: channel.alternatives?.length || 0,
              confidence: channel.alternatives?.[0]?.confidence,
              transcript: channel.alternatives?.[0]?.transcript
            });
          });
        }
        
        if (data.result.summary) {
          console.log('=== SUMMARY ===');
          console.log('Summary:', data.result.summary);
        }
        
        if (data.result.topics) {
          console.log('=== TOPICS ===');
          console.log('Topics:', data.result.topics);
        }
      } else {
        console.log('=== NO DEEPGRAM RESULT ===');
        console.log('The API response does not contain a result field');
        console.log('This might indicate an issue with the audio file or API processing');
      }
      
      // Check for empty transcription
      if (data.full_text === "" || data.words?.length === 0) {
        console.log('=== EMPTY TRANSCRIPTION WARNING ===');
        console.log('The transcription is empty. Possible causes:');
        console.log('- Audio file is too short (less than 1 second)');
        console.log('- Audio file contains only silence');
        console.log('- Audio quality is too poor for speech recognition');
        console.log('- Audio format issues');
        console.log('Audio duration:', audioDuration / 1000, 'seconds');
      }
      
      if (!data?.ok) {
        throw new Error(String(data?.error || 'Transcribe failed'));
      }
      setCurrentServerResult(data);
    } catch (e: any) {
      console.error('Upload error:', e);
      
      let errorMessage = e?.message || e;
      if (e.name === 'AbortError') {
        errorMessage = 'Request timed out after 60 seconds. The server might be overloaded.';
      } else if (e.message?.includes('Network request failed')) {
        errorMessage = 'Network error. Check your internet connection and server URL.';
      }
      
      Alert.alert('Upload Failed', `${errorMessage}\n\nCheck console for details.`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    navigation.goBack();
  }

  async function handleSave(title: string) {
    console.log('handleSave called with title:', title);
    console.log('audioUri:', audioUri);
    console.log('audioDuration:', audioDuration);
    console.log('currentServerResult:', currentServerResult);
    
    if (!audioUri || !audioDuration) {
      console.log('Missing audio data - audioUri:', audioUri, 'audioDuration:', audioDuration);
      Alert.alert('Error', 'No recording data to save');
      return;
    }

    try {
      setIsLoading(true);
      
      const recordingData = {
        title: title.trim() || `Recording ${new Date().toLocaleDateString()}`,
        audioUri,
        audioDuration,
        transcription: currentServerResult ? {
          fullText: currentServerResult.full_text || '',
          words: currentServerResult.words || [],
          bullets: currentServerResult.bullets || [],
          summary: currentServerResult.summary || { bullets: [] },
          topics: currentServerResult.topics || []
        } : undefined,
        actionablePoints: actionablePoints.length > 0 ? actionablePoints : undefined
      };

      console.log('Saving recording with data:', recordingData);
      const savedRecording = await saveRecording(recordingData);
      console.log('Recording saved successfully:', savedRecording.id);
      
      Alert.alert('Success', 'Recording saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error saving recording:', error);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleDiscard() {
    handleBack();
  }

  async function extractActionablePoints() {
    if (!currentServerResult?.full_text) {
      Alert.alert('No Transcription', 'Please transcribe the audio first before extracting actionable points.');
      return;
    }

    try {
      setIsLoadingActionable(true);
      console.log('Extracting actionable points from transcription...');
      
      const requestBody = {
        transcription: currentServerResult.full_text,
        context: recordingTitle || 'Meeting recording'
      };

      const resp = await fetch(`${ACTIONABLE_API}/api/actionable-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errorText}`);
      }

      const data = await resp.json();
      console.log('Actionable points response:', data);

      if (data.ok && data.actionablePoints) {
        setActionablePoints(data.actionablePoints);
        Alert.alert('Success', `Found ${data.actionablePoints.length} actionable points!`);
      } else {
        throw new Error(data.error || 'Failed to extract actionable points');
      }
    } catch (error) {
      console.error('Error extracting actionable points:', error);
      Alert.alert('Error', `Failed to extract actionable points: ${error.message}`);
    } finally {
      setIsLoadingActionable(false);
    }
  }

  async function handleSaveRecording() {
    console.log('handleSaveRecording called with title:', recordingTitle);
    if (!recordingTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your recording');
      return;
    }
    console.log('Calling handleSave with title:', recordingTitle);
    await handleSave(recordingTitle);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View
        style={{
          flex: 1,
          paddingTop: 0,
          paddingBottom: insets.bottom,
          paddingHorizontal: 16,
          gap: 16
        }}
      >
        {/* Waveform at the top */}
        <WaveformComponent 
          waveformData={waveformData}
          audioProgress={audioProgress}
          audioDuration={audioDuration}
          sound={sound}
          onSeek={seekTo}
        />
        
        {/* Time display */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 0 }}>
          <Text style={{ fontSize: 14, color: '#666' }}>
            {formatTime(audioProgress / 1000)}
          </Text>
          <Text style={{ fontSize: 14, color: '#666' }}>
            {formatTime(audioDuration / 1000)}
          </Text>
        </View>

        {/* Audio controls */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={togglePlayPause} style={{ padding: 12 }}>
            <IconSymbol 
              name={isPlaying ? 'pause.fill' : 'play.fill'} 
              size={24} 
              color="#333" 
            />
          </TouchableOpacity>
        </View>

        {/* Title input for saving */}
        {showTitleInput && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Recording Title</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                backgroundColor: '#f9f9f9'
              }}
              placeholder="Enter a title for your recording"
              value={recordingTitle}
              onChangeText={setRecordingTitle}
            />
          </View>
        )}

        {/* Action buttons - only show for new recordings, not saved ones */}
        {!isSavedRecording && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!showTitleInput ? (
              <>
                {!currentServerResult ? (
                  <TouchableOpacity onPress={upload} style={{ backgroundColor: '#1E88E5', padding: 12, borderRadius: 10, flex: 1 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>Upload to Deepgram</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowTitleInput(true)} style={{ backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, flex: 1 }}>
                    <Text style={{ color: 'white', textAlign: 'center' }}>Save Recording</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleDiscard} style={{ backgroundColor: '#9E9E9E', padding: 12, borderRadius: 10, flex: 1 }}>
                  <Text style={{ color: 'white', textAlign: 'center' }}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={handleSaveRecording} style={{ backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, flex: 1 }}>
                  <Text style={{ color: 'white', textAlign: 'center' }}>Save Recording</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTitleInput(false)} style={{ backgroundColor: '#9E9E9E', padding: 12, borderRadius: 10, flex: 1 }}>
                  <Text style={{ color: 'white', textAlign: 'center' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {isLoading && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text>Processing…</Text>
          </View>
        )}

        {currentServerResult && (
          <ScrollView
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Full transcription text */}
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Transcription</Text>
            <Text style={{ fontSize: 16, lineHeight: 24, marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8 }}>
              {currentServerResult.full_text || 'No transcription available'}
            </Text>

            {/* Actionable Points Button */}
            <TouchableOpacity 
              onPress={extractActionablePoints}
              disabled={isLoadingActionable}
              style={{ 
                backgroundColor: isLoadingActionable ? '#ccc' : '#FF6B35', 
                padding: 12, 
                borderRadius: 10, 
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isLoadingActionable ? (
                <>
                  <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                    Extracting Actionable Points...
                  </Text>
                </>
              ) : (
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                  Extract Actionable Points
                </Text>
              )}
            </TouchableOpacity>

            {/* Summary bullets */}
            {currentServerResult.summary && currentServerResult.summary.bullets && currentServerResult.summary.bullets.length > 0 && (
              <>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Summary</Text>
                <View style={{ backgroundColor: '#f0f8ff', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  {currentServerResult.summary.bullets.map((bullet: string, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                      <Text style={{ fontSize: 16, color: '#1976d2', marginRight: 8 }}>•</Text>
                      <Text style={{ fontSize: 16, lineHeight: 24, flex: 1 }}>
                        {bullet}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Topics with timestamps */}
            {currentServerResult.topics && currentServerResult.topics.length > 0 && (
              <>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Topics Discussed</Text>
                {currentServerResult.topics.map((topic: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => playFrom(topic.start_time)}
                    style={{ 
                      padding: 12, 
                      borderWidth: 1, 
                      borderColor: '#e0e0e0', 
                      borderRadius: 8, 
                      marginBottom: 8,
                      backgroundColor: '#f9f9f9'
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                      {formatTime(topic.start_time)} - {formatTime(topic.end_time)}
                    </Text>
                    <Text style={{ fontSize: 14, marginBottom: 6 }}>
                      {topic.text}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {topic.topics.map((t: any, j: number) => (
                        <View
                          key={j}
                          style={{
                            backgroundColor: '#e3f2fd',
                            padding: 4,
                            borderRadius: 4,
                            marginRight: 4,
                            marginBottom: 4
                          }}
                        >
                          <Text style={{ fontSize: 12, color: '#1976d2' }}>
                            {t.topic}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Actionable Points */}
            {actionablePoints.length > 0 && (
              <>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8, marginTop: 16 }}>Actionable Points</Text>
                {actionablePoints.map((point: any, i: number) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: '#fff3e0',
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: getPriorityColor(point.priority)
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 }}>
                        {point.title}
                      </Text>
                      <View style={{
                        backgroundColor: getPriorityColor(point.priority),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12
                      }}>
                        <Text style={{ fontSize: 12, color: 'white', fontWeight: '600', textTransform: 'uppercase' }}>
                          {point.priority}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={{ fontSize: 14, lineHeight: 20, marginBottom: 8, color: '#333' }}>
                      {point.description}
                    </Text>
                    
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {point.category && (
                        <View style={{ backgroundColor: '#e8f5e8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 12, color: '#2e7d32', fontWeight: '500' }}>
                            {point.category}
                          </Text>
                        </View>
                      )}
                      {point.dueDate && (
                        <View style={{ backgroundColor: '#fff8e1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 12, color: '#f57c00', fontWeight: '500' }}>
                            Due: {point.dueDate}
                          </Text>
                        </View>
                      )}
                      {point.assignee && (
                        <View style={{ backgroundColor: '#e3f2fd', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 12, color: '#1976d2', fontWeight: '500' }}>
                            {point.assignee}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}