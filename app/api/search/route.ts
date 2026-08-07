import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json([]);
  }

  const readToken = process.env.TMDB_READ_TOKEN;

  try {
    // Multi-search handles fuzzy natural language queries & typos much better
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(
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

    // Filter down to people results and sort by popularity
    const people = (data.results || [])
      .filter((item: any) => item.media_type === 'person')
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0));

    return NextResponse.json(people);
  } catch (error) {
    console.error('TMDB Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 500 });
  }
}
