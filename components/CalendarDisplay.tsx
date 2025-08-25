import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

// Define a type for the calendar event for better type safety
interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

interface CalendarDisplayProps {
  token: string;
}

const CalendarDisplay: React.FC<CalendarDisplayProps> = ({ token }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchCalendarEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/.netlify/functions/google-calendar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch calendar events');
        }

        const data = await response.json();
        setEvents(data.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCalendarEvents();
  }, [token]);

  const formatDate = (dateStr: string | undefined, isAllDay: boolean) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isAllDay) {
        // For all-day events, the date is correct, but time is midnight. Show day.
        return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    }
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  if (isLoading) {
    return (
        <div className="bg-black/20 p-4 rounded-lg mb-4 text-center text-gray-400">
            Carregando agenda...
        </div>
    );
  }

  // Do not render the component if there's an error, just log it.
  // The main app can show a generic error if needed.
  if (error) {
    console.error("Calendar Display Error:", error);
    return null;
  }

  return (
    <div className="bg-black/20 p-4 rounded-lg mb-4 max-h-60 overflow-y-auto no-scrollbar">
      <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-jarvis-blue sticky top-0 bg-black/20 py-2">
        <Calendar size={20} />
        Próximos Compromissos
      </h2>
      <ul className="space-y-2">
        {events.length > 0 ? (
          events.map(event => {
            const isAllDay = !!event.start.date;
            return (
                <li key={event.id} className="text-sm p-2 bg-white/5 rounded transition-colors hover:bg-white/10">
                <strong>{event.summary}</strong>
                <div className="text-xs text-gray-400">
                  {isAllDay
                    ? `O dia todo`
                    : `${formatDate(event.start.dateTime, false)} - ${formatDate(event.end.dateTime, false)}`
                  }
                </div>
              </li>
            );
          })
        ) : (
          <p className="text-sm text-gray-400">Nenhum compromisso futuro encontrado.</p>
        )}
      </ul>
    </div>
  );
};

export default CalendarDisplay;
