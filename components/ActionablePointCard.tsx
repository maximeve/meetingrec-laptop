import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  point: any;
  onDelete: (id: string) => void;
  onShare: (point: any) => void;
  onCalendar: (point: any) => void;
  getPriorityColor: (priority: string) => string;
};

export default function ActionablePointCard({ point, onDelete, onShare, onCalendar, getPriorityColor }: Props) {
  const swipePosition = React.useRef(new Animated.Value(0)).current;

  function onSwipeGesture(event: any) {
    const { translationX, translationY, state } = event.nativeEvent;

    if (Math.abs(translationY) > Math.abs(translationX)) {
      return;
    }

    if (state === State.ACTIVE) {
      if (Math.abs(translationY) < 30) {
        const clampedValue = Math.max(translationX, -160);
        swipePosition.setValue(clampedValue);
      }
    } else if (state === State.END) {
      if (Math.abs(translationY) < 30) {
        if (translationX < -60) {
          Animated.spring(swipePosition, {
            toValue: -160,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        } else {
          Animated.spring(swipePosition, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      } else {
        Animated.spring(swipePosition, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }).start();
      }
    }
  }

  return (
    <View style={{ marginBottom: 8, position: 'relative' }}>
      <View style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 160,
        flexDirection: 'row',
        zIndex: 1
      }}>
        <TouchableOpacity
          onPress={() => onDelete(point.id)}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <IconSymbol name="trash.fill" size={24} color="#d32f2f" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onShare(point)}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <IconSymbol name="square.and.arrow.up" size={24} color="#1E88E5" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onCalendar(point)}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <IconSymbol name="calendar" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <PanGestureHandler
        onGestureEvent={(event) => onSwipeGesture(event)}
        onHandlerStateChange={(event) => onSwipeGesture(event)}
        activeOffsetX={[-5, 5]}
        failOffsetY={[-10, 10]}
        shouldCancelWhenOutside={false}
        minPointers={1}
        maxPointers={1}
      >
        <Animated.View
          style={{
            transform: [{ translateX: swipePosition }],
            zIndex: 2
          }}
        >
          <View
            style={{
              backgroundColor: '#fff3e0',
              padding: 12,
              borderRadius: 8,
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
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}


