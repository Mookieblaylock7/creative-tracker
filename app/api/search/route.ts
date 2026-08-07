import { NextResponse } from 'next/server';
import { searchCreatives } from '@/lib/tmdb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const results = await searchCreatives(query);
  return NextResponse.json(results);
}
