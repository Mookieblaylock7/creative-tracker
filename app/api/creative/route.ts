import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('id');

  if (!personId) {
    return NextResponse.json({ error: 'Person ID required' }, { status: 400 });
  }

  const readToken = process.env.TMDB_READ_TOKEN;
  const headers = {
    Authorization: `Bearer ${readToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(`https://api.themoviedb.org/3/person/${personId}/combined_credits`, { headers });
    const data = await res.json();

    const crew = data.crew || [];
    const cast = data.cast || [];

    const allCredits: any[] = [];

    crew.forEach((item: any) => {
      allCredits.push({
        id: item.id,
        title: item.title || item.name,
        media_type: item.media_type || 'movie',
        release_date: item.release_date || item.first_air_date || null,
        job: item.job || item.department || 'Crew',
        genre_ids: item.genre_ids || [],
      });
    });

    cast.forEach((item: any) => {
      allCredits.push({
        id: item.id,
        title: item.title || item.name,
        media_type: item.media_type || 'movie',
        release_date: item.release_date || item.first_air_date || null,
        job: item.character ? `Cast (${item.character})` : 'Starring',
        character: item.character,
        genre_ids: item.genre_ids || [],
      });
    });

    return NextResponse.json(allCredits);
  } catch (error) {
    console.error('Error fetching creative credits:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}
