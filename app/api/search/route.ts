import { NextResponse } from 'next/server';
import levenshtein from 'fast-levenshtein';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json([]);
  }

  const readToken = process.env.TMDB_READ_TOKEN;

  try {
    // 1. Try exact/primary search first
    let res = await fetch(
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

    let data = await res.json();
    let results = data.results || [];

    // 2. If no exact match found, trigger fuzzy fallback search
    if (results.length === 0 && query.length > 2) {
      // Search with first 3-4 letters of the first name to catch typos
      const firstToken = query.split(' ')[0].substring(0, 4);
      const fallbackRes = await fetch(
        `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(
          firstToken
        )}&include_adult=false&language=en-US&page=1`,
        {
          headers: {
            Authorization: `Bearer ${readToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const fallbackData = await fallbackRes.json();
      const rawCandidates = fallbackData.results || [];

      // Sort candidate people by Levenshtein distance to user query
      results = rawCandidates.sort((a: any, b: any) => {
        const distA = levenshtein.get(query.toLowerCase(), (a.name || '').toLowerCase());
        const distB = levenshtein.get(query.toLowerCase(), (b.name || '').toLowerCase());
        return distA - distB;
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('TMDB Search Error:', error);
    return NextResponse.json({ error: 'Failed to fetch search results' }, { status: 500 });
  }
}
