import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const mediaType = searchParams.get('type') || 'movie';

  if (!id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  const readToken = process.env.TMDB_READ_TOKEN;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (readToken) {
    headers['Authorization'] = `Bearer ${readToken}`;
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=15d2ea6d0dc1d476efbca3eba2b9bbf3&append_to_response=credits`,
      { headers }
    );
    const data = await res.json();

    const genres = (data.genres || []).map((g: any) => g.name);
    const topCast = (data.credits?.cast || []).slice(0, 3).map((c: any) => c.name);

    return NextResponse.json({ genres, topCast, overview: data.overview || '' });
  } catch (error) {
    return NextResponse.json({ genres: [], topCast: [], overview: '' });
  }
}
