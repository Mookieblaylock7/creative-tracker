import { NextResponse } from 'next/server';
import { getPersonUpcomingCredits, getProjectDetails } from '@/lib/tmdb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json([]);

  const credits = await getPersonUpcomingCredits(parseInt(id, 10));

  // Enrich top 10 upcoming projects with Director & Co-stars
  const enrichedCredits = await Promise.all(
    credits.slice(0, 10).map(async (credit) => {
      try {
        const details = await getProjectDetails(credit.media_type, credit.id);
        if (!details || !details.credits) return credit;

        const directorObj = details.credits.crew?.find((c: any) => c.job === 'Director');
        const director = directorObj ? directorObj.name : undefined;

        const stars = details.credits.cast
          ?.filter((c: any) => c.id !== parseInt(id, 10))
          .slice(0, 3)
          .map((c: any) => c.name);

        return {
          ...credit,
          director,
          stars
        };
      } catch {
        return credit;
      }
    })
  );

  return NextResponse.json(enrichedCredits);
}
