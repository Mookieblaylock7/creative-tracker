import { NextResponse } from 'next/server';

const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western'
};

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

    const processItem = (item: any, isCast: boolean) => {
      const genres = (item.genre_ids || [])
        .map((gid: number) => GENRE_MAP[gid])
        .filter(Boolean);

      allCredits.push({
        id: item.id,
        title: item.title || item.name,
        media_type: item.media_type || 'movie',
        release_date: item.release_date || item.first_air_date || null,
        job: isCast ? (item.character ? `Cast (${item.character})` : 'Starring') : (item.job || item.department || 'Crew'),
        character: item.character,
        genre_ids: item.genre_ids || [],
        genres: genres,
      });
    };

    crew.forEach((item: any) => processItem(item, false));
    cast.forEach((item: any) => processItem(item, true));

    return NextResponse.json(allCredits);
  } catch (error) {
    console.error('Error fetching creative credits:', error);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}
