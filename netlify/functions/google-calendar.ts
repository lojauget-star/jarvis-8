interface CalendarRequestBody {
    token: string;
}

export default async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { token } = await req.json() as CalendarRequestBody;
        if (!token) {
            return new Response(JSON.stringify({ error: 'Access token not provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const calendarApiUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        calendarApiUrl.searchParams.set('timeMin', new Date().toISOString());
        calendarApiUrl.searchParams.set('maxResults', '10');
        calendarApiUrl.searchParams.set('singleEvents', 'true');
        calendarApiUrl.searchParams.set('orderBy', 'startTime');

        const response = await fetch(calendarApiUrl.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('Google Calendar API Error:', responseData);
            return new Response(JSON.stringify({
                error: 'Failed to fetch calendar events.',
                details: responseData
            }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(responseData), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Error in google-calendar function:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({ error: 'An internal error occurred.', details: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
