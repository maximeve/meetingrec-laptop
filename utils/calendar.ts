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

  // Get a default calendar to save into
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  console.log('Available calendars:', calendars.map(c => ({ id: c.id, title: c.title, allowsModifications: c.allowsModifications, source: c.source?.name })));
  
  const defaultCal =
    calendars.find(c => c.allowsModifications) ||
    calendars.find(c => c.source?.isLocalAccount) ||
    calendars[0];

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
    timeZone: 'UTC', // or your local TZ id
  });
  
  console.log('Event created with ID:', eventId);

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
    console.log('Adding to calendar:', point);
    
    const dueDate = parseActionablePointDate(point.dueDate);
    console.log('Parsed due date:', dueDate.toISOString());

    const formatCalendarDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const startDate = formatCalendarDate(dueDate);
    const endDate = formatCalendarDate(new Date(dueDate.getTime() + 60 * 60 * 1000));
    console.log('Formatted dates - Start:', startDate, 'End:', endDate);

    // Build comprehensive description for calendar apps
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

    const title = encodeURIComponent(point.title);
    const encodedDescription = encodeURIComponent(description);
    const location = encodeURIComponent(point.category || '');

    console.log('Calendar event details:');
    console.log('Title:', point.title);
    console.log('Description:', description);
    console.log('Location:', point.category);

    // First try native event creation via expo-calendar
    try {
      const nativeTitle = String(point.title || 'MeetingRec Action');
      let nativeNotes = String(point.description || '');
      if (point.category) nativeNotes += `\n\nCategory: ${point.category}`;
      if (point.assignee) nativeNotes += `\nAssignee: ${point.assignee}`;
      if (point.priority) nativeNotes += `\nPriority: ${String(point.priority).toUpperCase()}`;

      console.log('Attempting native calendar event creation...');
      const eventId = await addEventNative({
        title: nativeTitle,
        notes: nativeNotes,
        location: String(point.category || ''),
        startDate: dueDate,
        endDate: new Date(dueDate.getTime() + 60 * 60 * 1000),
      });
      console.log('Native calendar event created successfully with ID:', eventId);
      Alert.alert('Success', 'Event added to your calendar!');
      return;
    } catch (nativeErr) {
      console.log('Native calendar creation failed, falling back to URL/ICS:', nativeErr);
      Alert.alert('Native Calendar Failed', `Native calendar creation failed: ${nativeErr.message}. Falling back to alternative method.`);
    }

    // For iOS, we need to use a different approach since calshow: doesn't support pre-filled data
    // We'll try to open the Calendar app and then provide ICS as backup
    const calendarUrls = [
      // iOS Calendar app - just show the date (user can create event manually)
      `calshow:${startDate}`,
      // Try to use the calendar:// scheme (may not work on all iOS versions)
      `calendar://event?action=create&title=${title}&start=${startDate}&end=${endDate}&description=${encodedDescription}&location=${location}`,
      // Google Calendar (fallback)
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${encodedDescription}&location=${location}&ctz=UTC`,
      // Android Calendar app
      `content://com.android.calendar/time/${dueDate.getTime()}`,
      // Outlook Calendar
      `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${encodedDescription}&location=${location}`
    ];

    let opened = false;
    for (const url of calendarUrls) {
      try {
        console.log('Trying URL:', url);
        const canOpen = await Linking.canOpenURL(url);
        console.log('Can open URL:', canOpen);
        
        if (canOpen) {
          console.log('Opening URL:', url);
          await Linking.openURL(url);
          opened = true;
          break;
        }
      } catch (e) {
        console.log(`Failed to open ${url}:`, e);
        continue;
      }
    }

    // For iOS, always provide ICS file as it's the most reliable way to get pre-filled events
    const icsContent = generateICSContent(point);
    console.log('Generated ICS content:', icsContent);
    
    // Check if we're on iOS
    const isIOS = Platform.OS === 'ios';
    
    if (isIOS) {
      // On iOS, always use ICS file sharing for best results
      console.log('iOS detected - using ICS share for pre-filled calendar event');
      await Share.share({
        message: `Add "${point.title}" to your calendar\n\nDue: ${dueDate.toLocaleDateString()}\nPriority: ${point.priority?.toUpperCase() || 'MEDIUM'}`,
        url: `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`,
        title: `Add to Calendar: ${point.title}`
      });
    } else if (!opened) {
      // On Android, try URLs first, then fallback to ICS
      console.log('No calendar app opened, using ICS share');
      await Share.share({
        message: `Add "${point.title}" to your calendar\n\nDue: ${dueDate.toLocaleDateString()}\nPriority: ${point.priority?.toUpperCase() || 'MEDIUM'}`,
        url: `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`,
        title: `Add to Calendar: ${point.title}`
      });
    } else {
      console.log('Successfully opened calendar app');
      // Also provide ICS as backup in case the URL didn't work properly
      setTimeout(async () => {
        try {
          await Share.share({
            message: `Backup: Add "${point.title}" to your calendar\n\nDue: ${dueDate.toLocaleDateString()}\nPriority: ${point.priority?.toUpperCase() || 'MEDIUM'}`,
            url: `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`,
            title: `Add to Calendar: ${point.title}`
          });
        } catch (e) {
          console.log('Backup share failed:', e);
        }
      }, 2000);
    }
  } catch (error) {
    console.error('Error creating calendar event:', error);
    Alert.alert('Error', 'Failed to create calendar event');
  }
}


