import { Share, Linking, Alert, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

// Parse date from various formats that might come from actionable points
function parseActionablePointDate(dateString: string | undefined): Date {
  if (!dateString) {
    // Default to today if no date provided
    const today = new Date();
    today.setHours(9, 0, 0, 0); // Set to 9:00 AM today
    return today;
  }

  // Try different date formats
  const formats = [
    // ISO format: 2024-01-15T10:00:00Z
    (d: string) => new Date(d),
    // Date only: 2024-01-15
    (d: string) => new Date(d + 'T09:00:00'),
    // US format: 01/15/2024
    (d: string) => {
      const parts = d.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]), 9, 0, 0);
      }
      return null;
    },
    // European format: 15/01/2024
    (d: string) => {
      const parts = d.split('/');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 9, 0, 0);
      }
      return null;
    }
  ];

  for (const format of formats) {
    try {
      const date = format(dateString);
      if (date && !isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback to 7 days from now
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export function generateICSContent(point: any): string {
  const now = new Date();
  const dueDate = parseActionablePointDate(point.dueDate);

  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const startDate = formatICSDate(dueDate);
  const endDate = formatICSDate(new Date(dueDate.getTime() + 60 * 60 * 1000)); // 1 hour duration
  const created = formatICSDate(now);

  // Build comprehensive description
  let description = point.description || '';
  if (point.category) {
    description += `\n\nCategory: ${point.category}`;
  }
  if (point.assignee) {
    description += `\nAssignee: ${point.assignee}`;
  }
  if (point.priority) {
    description += `\nPriority: ${point.priority.toUpperCase()}`;
  }
  description += `\n\nCreated from MeetingRec App`;

  let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MeetingRec//Actionable Point//EN
BEGIN:VEVENT
UID:${point.id}@meetingrec.app
DTSTAMP:${created}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${point.title}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
STATUS:CONFIRMED
PRIORITY:${point.priority === 'urgent' ? '1' : point.priority === 'high' ? '2' : point.priority === 'medium' ? '3' : '4'}
CATEGORIES:${point.category || 'Task'}
${point.assignee ? `ATTENDEE:${point.assignee}` : ''}
LOCATION:${point.category || ''}
END:VEVENT
END:VCALENDAR`;

  return ics;
}

async function ensureCalendarPermissions() {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') throw new Error('Calendar permission denied');
}

export async function addEventNative({
  title,
  notes,
  location,
  startDate, // Date
  endDate,   // Date
}: {
  title: string;
  notes?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
}) {
  console.log('addEventNative called with:', { title, notes, location, startDate, endDate });
  
  await ensureCalendarPermissions();
  console.log('Calendar permissions granted');

  // Prefer platform default calendar per Expo docs
  let defaultCal: Calendar.Calendar | null = null as any;
  try {
    if (Platform.OS === 'ios' && typeof Calendar.getDefaultCalendarAsync === 'function') {
      defaultCal = await (Calendar as any).getDefaultCalendarAsync();
    }
  } catch (e) {
    console.log('getDefaultCalendarAsync failed, will scan calendars:', e);
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  console.log('Available calendars:', calendars.map(c => ({ id: c.id, title: c.title, allowsModifications: c.allowsModifications, source: c.source?.name })));

  if (!defaultCal) {
    defaultCal =
      calendars.find(c => c.allowsModifications) ||
      calendars.find(c => (c as any).source?.isLocalAccount) ||
      calendars[0] || null as any;
  }

  if (!defaultCal) {
    throw new Error('No calendar available to create events');
  }
  
  console.log('Selected calendar:', { id: defaultCal.id, title: defaultCal.title });

  const eventId = await Calendar.createEventAsync(defaultCal.id, {
    title,
    notes,
    location,
    startDate,
    endDate,
    // Let OS choose local timezone; setting incorrect TZ can hide events
  });
  
  console.log('Event created with ID:', eventId);

  // Verify event exists
  try {
    const created = await Calendar.getEventAsync(eventId as any);
    console.log('Created event fetched:', created);
  } catch (e) {
    console.log('Failed to fetch created event (may still exist):', e);
  }

  // Optional iOS trick: open Calendar at the event's date
  if (Platform.OS === 'ios') {
    // Opens Calendar app at the start date
    const seconds = Math.floor(startDate.getTime() / 1000);
    console.log('Opening iOS Calendar at:', seconds, 'seconds');
    // `calshow:` is handled by the built-in Calendar
    // no need to add to LSApplicationQueriesSchemes for Linking on iOS 11+
    await Linking.openURL(`calshow:${seconds}`);
  }

  return eventId;
}

export async function addToCalendar(point: any) {
  try {
    console.log('Adding to calendar (Expo Calendar flow):', point);

    const start = parseActionablePointDate(point.dueDate);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // Build notes/description
    let notes = String(point.description || '');
    if (point.category) notes += `\n\nCategory: ${point.category}`;
    if (point.assignee) notes += `\nAssignee: ${point.assignee}`;
    if (point.priority) notes += `\nPriority: ${String(point.priority).toUpperCase()}`;

    // 1) Preferred: Launch system-provided event editor with prefilled data
    //    This requires no explicit calendar permission and works on both iOS and Android.
    try {
      console.log('Opening system event editor (createEventInCalendarAsync)...');
      const dialogResult: any = await Calendar.createEventInCalendarAsync({
        title: String(point.title || 'MeetingRec Action'),
        startDate: start,
        endDate: end,
        notes,
        location: String(point.category || ''),
      });
      console.log('Dialog result from createEventInCalendarAsync:', dialogResult);

      // If available, open the saved event (SDK supports openEventInCalendarAsync)
      const eventId = dialogResult?.eventIdentifier || dialogResult?.eventId || dialogResult?.event?.id;
      if (eventId && typeof Calendar.openEventInCalendarAsync === 'function') {
        try {
          await (Calendar as any).openEventInCalendarAsync({ id: eventId });
        } catch (e) {
          console.log('openEventInCalendarAsync failed or unavailable:', e);
        }
      }

      Alert.alert('Success', 'Event created in your calendar');
      return;
    } catch (dialogErr) {
      console.log('createEventInCalendarAsync failed, falling back to direct create:', dialogErr);
    }

    // 2) Fallback: Create directly then open calendar at the time (requires permission)
    try {
      const eventId = await addEventNative({
        title: String(point.title || 'MeetingRec Action'),
        notes,
        location: String(point.category || ''),
        startDate: start,
        endDate: end,
      });

      // Attempt to open the event if API is available
      if (eventId && typeof Calendar.openEventInCalendarAsync === 'function') {
        try {
          await (Calendar as any).openEventInCalendarAsync({ id: eventId });
        } catch (e) {
          console.log('openEventInCalendarAsync after direct create failed:', e);
        }
      }

      Alert.alert('Success', 'Event added to your calendar!');
      return;
    } catch (nativeErr) {
      console.log('Direct create failed, falling back to ICS share:', nativeErr);
    }

    // 3) Last resort: Share ICS to let user import
    const icsContent = generateICSContent({ ...point, dueDate: start.toISOString() });
    await Share.share({
      message: `Add "${point.title}" to your calendar`,
      url: `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`,
      title: `Add to Calendar: ${point.title}`
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    Alert.alert('Error', 'Failed to create calendar event');
  }
}


