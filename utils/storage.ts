import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedRecording {
  id: string;
  title: string;
  audioUri: string;
  audioDuration: number;
  createdAt: string;
  transcription?: {
    fullText: string;
    words: any[];
    bullets: string[];
    summary: {
      bullets: string[];
    };
    topics: string[];
  };
}

const RECORDINGS_KEY = 'saved_recordings';

// Save a recording to local storage
export async function saveRecording(recording: Omit<SavedRecording, 'id' | 'createdAt'>): Promise<SavedRecording> {
  try {
    console.log('Starting to save recording:', recording);
    
    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    
    const savedRecording: SavedRecording = {
      id,
      createdAt,
      ...recording
    };

    console.log('Created saved recording object:', savedRecording);

    // Get existing recordings directly from AsyncStorage
    const recordingsJson = await AsyncStorage.getItem(RECORDINGS_KEY);
    console.log('Existing recordings JSON:', recordingsJson);
    
    let existingRecordings: SavedRecording[] = [];
    if (recordingsJson) {
      existingRecordings = JSON.parse(recordingsJson);
    }
    
    console.log('Existing recordings array:', existingRecordings);
    
    // Add new recording
    const updatedRecordings = [savedRecording, ...existingRecordings];
    console.log('Updated recordings array:', updatedRecordings);
    
    // Save to AsyncStorage
    const jsonToSave = JSON.stringify(updatedRecordings);
    console.log('JSON to save:', jsonToSave);
    
    await AsyncStorage.setItem(RECORDINGS_KEY, jsonToSave);
    
    // Verify it was saved
    const verifyJson = await AsyncStorage.getItem(RECORDINGS_KEY);
    console.log('Verification - saved JSON:', verifyJson);
    
    console.log('Recording saved successfully:', savedRecording.id);
    return savedRecording;
  } catch (error) {
    console.error('Error saving recording:', error);
    throw error;
  }
}

// Get all saved recordings
export async function getRecordings(): Promise<SavedRecording[]> {
  try {
    console.log('Getting recordings from AsyncStorage...');
    const recordingsJson = await AsyncStorage.getItem(RECORDINGS_KEY);
    console.log('Raw recordings JSON:', recordingsJson);
    
    if (!recordingsJson) {
      console.log('No recordings found in storage');
      return [];
    }
    
    const recordings = JSON.parse(recordingsJson);
    console.log('Parsed recordings:', recordings);
    
    const sortedRecordings = recordings.sort((a: SavedRecording, b: SavedRecording) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    console.log('Sorted recordings:', sortedRecordings);
    return sortedRecordings;
  } catch (error) {
    console.error('Error loading recordings:', error);
    return [];
  }
}

// Delete a recording
export async function deleteRecording(id: string): Promise<void> {
  try {
    const recordings = await getRecordings();
    const recordingToDelete = recordings.find(r => r.id === id);
    
    if (recordingToDelete) {
      // Delete the audio file
      try {
        await FileSystem.deleteAsync(recordingToDelete.audioUri, { idempotent: true });
        console.log('Audio file deleted:', recordingToDelete.audioUri);
      } catch (fileError) {
        console.warn('Could not delete audio file:', fileError);
      }
    }
    
    // Remove from storage
    const updatedRecordings = recordings.filter(r => r.id !== id);
    await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(updatedRecordings));
    
    console.log('Recording deleted successfully:', id);
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw error;
  }
}

// Get a specific recording by ID
export async function getRecording(id: string): Promise<SavedRecording | null> {
  try {
    const recordings = await getRecordings();
    return recordings.find(r => r.id === id) || null;
  } catch (error) {
    console.error('Error getting recording:', error);
    return null;
  }
}

// Check if a recording's audio file exists and migrate if needed
export async function ensureAudioFileExists(recording: SavedRecording): Promise<string> {
  try {
    console.log('Checking if audio file exists:', recording.audioUri);
    
    const fileInfo = await FileSystem.getInfoAsync(recording.audioUri);
    console.log('File info for recording:', fileInfo);
    
    if (fileInfo.exists) {
      console.log('Audio file exists, returning original URI');
      return recording.audioUri;
    }
    
    console.log('Audio file does not exist, this might be an old recording with temporary URI');
    // For now, return the original URI and let the ReviewScreen handle the error
    // In the future, we could implement a migration strategy here
    return recording.audioUri;
  } catch (error) {
    console.error('Error checking audio file:', error);
    return recording.audioUri;
  }
}
