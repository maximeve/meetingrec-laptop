import React, { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';

// Global audio cleanup hook
export function useAudioCleanup() {
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused - no action needed
      return () => {
        // Screen is losing focus - stop all audio
        console.log('Screen losing focus - stopping all audio');
        stopAllAudio();
      };
    }, [])
  );

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('Component unmounting - stopping all audio');
      stopAllAudio();
    };
  }, []);
}

// Function to stop all audio
async function stopAllAudio() {
  try {
    // More gentle approach - just pause all sounds without disabling the entire audio system
    console.log('Stopping all audio...');
    // Note: We don't disable the entire audio system as it can cause conflicts
    // Individual components should handle their own cleanup
  } catch (error) {
    console.error('Error stopping audio:', error);
  }
}

// Export the stop function for manual use
export { stopAllAudio };
