import React from 'react';
import { View, TouchableOpacity, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import Svg, { Path, Circle } from 'react-native-svg';

interface WaveformComponentProps {
  waveformData: number[];
  audioProgress: number;
  audioDuration: number;
  sound: Audio.Sound | null;
  onSeek: (position: number) => void;
}

export default function WaveformComponent({
  waveformData,
  audioProgress,
  audioDuration,
  sound,
  onSeek
}: WaveformComponentProps) {
  if (waveformData.length === 0) return null;

  const screenWidth = Dimensions.get('window').width - 32;
  const barWidth = screenWidth / waveformData.length;
  const maxHeight = 60;
  const progress = audioDuration > 0 ? audioProgress / audioDuration : 0;

  // Handle waveform touch
  function handleWaveformTouch(event: any) {
    if (!sound || !audioDuration) return;
    
    const touchX = event.nativeEvent.locationX;
    const progress = Math.max(0, Math.min(1, touchX / screenWidth));
    const newPosition = progress * audioDuration;
    
    onSeek(newPosition);
  }

  return (
    <TouchableOpacity 
      style={{ height: 60, justifyContent: 'center', marginVertical: 8 }}
      onPress={handleWaveformTouch}
      activeOpacity={0.7}
    >
      <Svg height={60} width={screenWidth}>
        {waveformData.map((amplitude, index) => {
          const barHeight = amplitude * maxHeight;
          const x = index * barWidth;
          const y = (maxHeight - barHeight) / 2;
          const isPlayed = index / waveformData.length < progress;
          
          return (
            <Path
              key={index}
              d={`M${x} ${y + barHeight} L${x} ${y}`}
              stroke={isPlayed ? '#1E88E5' : '#E0E0E0'}
              strokeWidth={Math.max(1, barWidth * 0.8)}
              strokeLinecap="round"
            />
          );
        })}
        
        {/* Progress indicator */}
        <Circle
          cx={progress * screenWidth}
          cy={maxHeight / 2}
          r={4}
          fill="#1E88E5"
        />
      </Svg>
    </TouchableOpacity>
  );
}

// Generate mock waveform data
export function generateWaveformData(duration: number) {
  const dataPoints = Math.min(100, Math.floor(duration / 0.1));
  const data = [];
  for (let i = 0; i < dataPoints; i++) {
    data.push(Math.random() * 0.8 + 0.1);
  }
  return data;
}
