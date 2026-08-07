import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json([]);
  }

  const apiKey = process.env.TMDB_API_KEY;
  const readToken = process.env.TMDB_READ_TOKEN;

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(
        query
      )}&include_adult=false&language=en-US&page=1`,
      {
        headers: {
          Authorization: `Bearer ${readToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await res.json();

    // Sort results by popularity so the most famous match appears first
    const results = (data.results || []).sort(
      (a: any, b: any) => (b.popularity || 0) - (a.popularity || 0)
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('TMDB Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 500 });
  }
}
