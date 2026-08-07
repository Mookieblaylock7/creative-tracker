import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const year = searchParams.get('year');

  if (!title) {
    return NextResponse.json({ error: 'Title required' }, { status: 400 });
  }

  const readToken = process.env.TMDB_READ_TOKEN;
  const headers = {
    Authorization: `Bearer ${readToken}`,
    'Content-Type': 'application/json',
  };

  try {
    let searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&include_adult=false`;
    if (year) searchUrl += `&year=${year}`;

    const searchRes = await fetch(searchUrl, { headers });
    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({ creators: [] });
    }

    const movie = searchData.results[0];

    const creditsRes = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/credits`, { headers });
    const creditsData = await creditsRes.json();

    const crew = creditsData.crew || [];
    const cast = creditsData.cast || [];

    const directors = crew
      .filter((c: any) => c.job === 'Director')
      .map((c: any) => ({ id: c.id, name: c.name, department: 'Directing' }));

    const writers = crew
      .filter((c: any) => c.department === 'Writing' || c.job === 'Screenplay' || c.job === 'Writer')
      .map((c: any) => ({ id: c.id, name: c.name, department: 'Writing' }));

    const topCast = cast
      .slice(0, 3)
      .map((c: any) => ({ id: c.id, name: c.name, department: 'Acting' }));

    return NextResponse.json({
      directors,
      writers,
      topCast,
      isDoc: movie.genre_ids?.includes(99) || false,
    });
  } catch (error) {
    console.error('Error fetching movie:', error);
    return NextResponse.json({ error: 'Failed to fetch movie' }, { status: 500 });
  }
}
