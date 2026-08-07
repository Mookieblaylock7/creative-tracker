export interface PersonResult {
  id: number;
  name: string;
  known_for_department: string;
  profile_path: string | null;
}

export interface Credit {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  job?: string;
  character?: string;
  release_date?: string;
  first_air_date?: string;
  status?: string;
  overview?: string;
  director?: string;
  stars?: string[];
}

const READ_TOKEN = process.env.TMDB_READ_TOKEN;

export async function searchCreatives(query: string): Promise<PersonResult[]> {
  if (!query) return [];
  const res = await fetch(
    `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
    {
      headers: {
        Authorization: `Bearer ${READ_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export async function getPersonUpcomingCredits(personId: number): Promise<Credit[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/person/${personId}/combined_credits?language=en-US`,
    {
      headers: {
        Authorization: `Bearer ${READ_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  
  const cast = data.cast || [];
  const crew = data.crew || [];
  const allCredits: Credit[] = [...cast, ...crew];

  const today = new Date().toISOString().split('T')[0];
  
  // Filter for upcoming / unreleased projects
  const upcoming = allCredits.filter((credit) => {
    const releaseDate = credit.release_date || credit.first_air_date;
    return !releaseDate || releaseDate > today;
  });

  // Deduplicate credits by ID
  const uniqueCreditsMap = new Map<number, Credit>();
  upcoming.forEach((c) => {
    if (!uniqueCreditsMap.has(c.id)) {
      uniqueCreditsMap.set(c.id, c);
    }
  });

  return Array.from(uniqueCreditsMap.values());
}

export async function getProjectDetails(mediaType: 'movie' | 'tv', id: number) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${id}?append_to_response=credits&language=en-US`,
    {
      headers: {
        Authorization: `Bearer ${READ_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
  if (!res.ok) return null;
  return await res.json();
}
