import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ReviewScreen from '../../screens/ReviewScreen'
import { RootStackParamList } from '../../types/navigation';
import { useAudioCleanup } from '../../hooks/useAudioCleanup';

const API_BASE = 'https://meeting-rec-api-git-main-maximeves-projects.vercel.app'; // ⬅️ your Vercel API base

type RecordScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Record'>;

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RecordScreenNavigationProp>();
  
  // Global audio cleanup
  useAudioCleanup();
  // Removed user and signOut - now handled in ProfileScreen

  const [recording, setRecording] = React.useState<Audio.Recording | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showReview, setShowReview] = React.useState(false);
  const [audioUri, setAudioUri] = React.useState<string | null>(null);
  const [audioDuration, setAudioDuration] = React.useState(0);
  const [serverResult, setServerResult] = React.useState<any>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = React.useState(0);
  const [recordingStartTimeMs, setRecordingStartTimeMs] = React.useState<number | null>(null);

  // Timer effect for recording duration (milliseconds precision)
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (recording && recordingStartTimeMs != null) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - recordingStartTimeMs;
        setRecordingElapsedMs(elapsed);
      }, 50); // update ~20 times per second
    } else {
      setRecordingElapsedMs(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording, recordingStartTimeMs]);

  // Format time helper (mm:ss:ss) where last 'ss' = centiseconds
  function formatTimeMs(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10); // 0..99
    return `${mins}:${secs.toString().padStart(2, '0')}:${centis.toString().padStart(2, '0')}`;
  }

  // START: begin opname
  async function start() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Microphone Required', 'Please allow microphone access.');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 48000  // 48kbps compression
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 48000,  // 48kbps compression
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC
        },
        web: {
          mimeType: 'audio/mp4',
          bitsPerSecond: 48000  // 48kbps compression
        }
      });

      await rec.startAsync();
      setRecording(rec);
      setRecordingStartTimeMs(Date.now());
      setRecordingElapsedMs(0);
      setServerResult(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Start Failed', String(e?.message || e));
    }
  }

  // STOP: stop opname en ga naar review (geen automatische upload)
  async function stop() {
    if (!recording) return;
    try {
      console.log('Stopping recording...');
      setIsLoading(true);

      await recording.stopAndUnloadAsync();
      const tempUri = recording.getURI()!;
      console.log('Recording stopped, temp URI:', tempUri);
      setRecording(null);
      setRecordingStartTimeMs(null);
      setRecordingElapsedMs(0);

      // Copy to permanent storage
      let permanentUri = `${FileSystem.documentDirectory}recording_${Date.now()}.m4a`;
      try {
        await FileSystem.copyAsync({
          from: tempUri,
          to: permanentUri
        });
        console.log('Recording copied to permanent storage:', permanentUri);
        
        // Clean up temporary file
        await FileSystem.deleteAsync(tempUri, { idempotent: true });
        console.log('Temporary file cleaned up');
      } catch (copyError) {
        console.error('Error copying recording:', copyError);
        // Fallback to temp URI if copy fails
        permanentUri = tempUri;
      }

      // Get duration for the review screen
      const s = new Audio.Sound();
      await s.loadAsync({ uri: permanentUri }, {}, true);
      const status = await s.getStatusAsync();
      const duration = (status as any).durationMillis || 0;
      console.log('Audio duration:', duration);
      await s.unloadAsync(); // Clean up immediately
      
      setAudioDuration(duration);
      setAudioUri(permanentUri);
      console.log('Navigating to ReviewScreen...');
      navigation.navigate('Review', {
        audioUri: permanentUri,
        audioDuration: duration,
        serverResult: null
      });
    } catch (e: any) {
      console.error('Error in stop function:', e);
      Alert.alert('Stop Failed', String(e?.message || e));
    } finally {
      setIsLoading(false);
    }
  }

  async function upload() {
    if (!audioUri) return;
    try {
      setIsLoading(true);
      console.log('Starting upload to:', `${API_BASE}/api/transcribe`);
      
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
      console.log('Audio size:', Math.round(audioBase64.length * 3 / 4 / 1024), 'KB');
      
      // Detect audio format from file extension
      const mimeType = audioUri.toLowerCase().endsWith('.m4a') ? 'audio/mp4' : 'audio/wav';
      console.log('Detected audio format:', mimeType);
      
      const requestBody = { audioBase64, mime: mimeType, lang: 'auto', summarize: true };
      console.log('Request body size:', JSON.stringify(requestBody).length, 'chars');
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const resp = await fetch(`${API_BASE}/api/transcribe`, {
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
      
      if (!data?.ok) {
        throw new Error(String(data?.error || 'Transcribe failed'));
      }
      setServerResult(data);
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
    setShowReview(false);
    setAudioUri(null);
    setServerResult(null);
    setAudioDuration(0);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 16,
          gap: 16
        }}
      >

        <TouchableOpacity
          onPress={recording ? stop : start}
          style={{ backgroundColor: recording ? '#E53935' : '#1E88E5', padding: 16, borderRadius: 12 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 18 }}>
            {recording ? 'Stop Recording' : '🎙️ Start Recording'}
          </Text>
        </TouchableOpacity>
        {recording && (
          <Text style={{ 
            alignSelf: 'center',
            fontSize: 12,
            color: '#E53935',
            marginTop: 4
          }}>
            • {formatTimeMs(recordingElapsedMs)}
          </Text>
        )}
        {isLoading && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text>Processing…</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
