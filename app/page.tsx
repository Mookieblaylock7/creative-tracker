'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Check, LogOut, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Creative {
  id: number;
  name: string;
  department: string;
}

interface ProjectUpdate {
  id: string;
  tmdbId: number;
  creativeName: string;
  projectTitle: string;
  role: string;
  mediaType: 'movie' | 'tv';
  releaseDateHeader: string;
  sortKey: string;
  status: string;
  director?: string;
}

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMessage, setAuthMessage] = useState('');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [followed, setFollowed] = useState<Creative[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadSavedData();
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadSavedData();
      else {
        setFollowed([]);
        setUpdates([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const parseReleaseDate = (rawDate?: string) => {
    if (!rawDate) {
      return { header: 'UNANNOUNCED / IN DEVELOPMENT', sortKey: '9999-12-31' };
    }
    const parts = rawDate.split('-');
    if (parts.length === 1) {
      return { header: parts[0], sortKey: `${parts[0]}-01-01` };
    } else if (parts.length === 2) {
      const dateObj = new Date(`${rawDate}-01T00:00:00`);
      const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
      return { header: `${monthName} ${parts[0]}`, sortKey: `${rawDate}-01` };
    } else {
      const dateObj = new Date(`${rawDate}T00:00:00`);
      const day = dateObj.getDate();
      const monthName = dateObj.toLocaleString('en-US', { month: 'long' });
      return { header: `${day} ${monthName} ${dateObj.getFullYear()}`, sortKey: rawDate };
    }
  };

  const loadSavedData = async () => {
    setLoading(true);
    try {
      const { data: savedCreatives } = await supabase.from('followed_creatives').select('*');
      const { data: savedProjects } = await supabase.from('tracked_projects').select('*');

      if (savedCreatives) {
        setFollowed(
          savedCreatives.map((c) => ({
            id: c.id,
            name: c.name,
            department: c.department,
          }))
        );
      }

      if (savedProjects) {
        setUpdates(
          savedProjects.map((p) => ({
            id: p.id,
            tmdbId: p.tmdb_id,
            creativeName: p.creative_name,
            projectTitle: p.project_title,
            role: p.role,
            mediaType: p.media_type,
            releaseDateHeader: p.release_date_header,
            sortKey: p.sort_key,
            status: p.status,
            director: p.director,
          }))
        );
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage('');
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      if (error) setAuthMessage(error.message);
      else setAuthMessage('Account created! Check your email or try signing in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) setAuthMessage(error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const followPerson = async (person: any) => {
    if (!session?.user) return;
    if (followed.some((f) => f.id === person.id)) return;

    const newCreative = {
      id: person.id,
      user_id: session.user.id,
      name: person.name,
      department: person.known_for_department || 'Creative',
    };

    setFollowed((prev) => [...prev, { id: person.id, name: person.name, department: newCreative.department }]);
    await supabase.from('followed_creatives').insert([newCreative]);

    try {
      const res = await fetch(`/api/creative?id=${person.id}`);
      const credits = await res.json();

      const newProjects: ProjectUpdate[] = (credits || []).map((c: any) => {
        const dateInfo = parseReleaseDate(c.release_date || c.first_air_date);
        return {
          id: `${person.id}-${c.id}`,
          tmdbId: c.id,
          creativeName: person.name,
          projectTitle: c.title || c.name || 'Untitled Project',
          role: c.job || (c.character ? `Cast (${c.character})` : 'Creative'),
          mediaType: c.media_type,
          releaseDateHeader: dateInfo.header,
          sortKey: dateInfo.sortKey,
          status: c.release_date || c.first_air_date ? 'Announced' : 'In Development',
          director: c.director || null,
        };
      });

      setUpdates((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const filteredNew = newProjects.filter((p) => !existingIds.has(p.id));
        return [...prev, ...filteredNew];
      });

      const dbRows = newProjects.map((p) => ({
        id: p.id,
        user_id: session.user.id,
        tmdb_id: p.tmdbId,
        creative_name: p.creativeName,
        project_title: p.projectTitle,
        role: p.role,
        media_type: p.mediaType,
        release_date_header: p.releaseDateHeader,
        sort_key: p.sortKey,
        status: p.status,
        director: p.director,
      }));

      if (dbRows.length > 0) {
        await supabase.from('tracked_projects').upsert(dbRows);
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
    }
  };

  const sortedUpdates = [...updates].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0e1117] text-[#c9d1d9] font-sans text-xs flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] p-6 space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-white tracking-wider uppercase">MY FILM PEOPLE</h1>
            <p className="text-[#8b949e] text-[11px]">Track upcoming projects from your favorite creators</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-3 pt-2">
            <div>
              <label className="block text-[10px] text-[#8b949e] uppercase font-bold mb-1">Email</label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-white px-2.5 py-1.5 focus:outline-none focus:border-[#58a6ff] text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#8b949e] uppercase font-bold mb-1">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-white px-2.5 py-1.5 focus:outline-none focus:border-[#58a6ff] text-xs"
              />
            </div>

            {authMessage && <div className="text-amber-400 text-[11px] font-bold">{authMessage}</div>}

            <button
              type="submit"
              className="w-full bg-[#238636] hover:bg-[#2ea043] border border-[#30363d] text-white py-1.5 font-bold uppercase transition-colors text-xs"
            >
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-[#30363d]">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-[#58a6ff] hover:underline text-[11px]"
            >
              {authMode === 'login' ? "Need an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0e1117] text-[#c9d1d9] font-sans text-xs p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-[#2d3542] pb-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-white tracking-wider uppercase">
            MY FILM PEOPLE <span className="text-[#58a6ff] text-xs font-normal">v1.0</span>
          </h1>
          <div className="flex items-center gap-4 text-[#8b949e] text-xs">
            <span className="flex items-center gap-1 text-white">
              <User className="w-3.5 h-3.5 text-[#58a6ff]" />
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="hover:text-white flex items-center gap-1 border border-[#30363d] px-2 py-0.5 bg-[#21262d]"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
            <section className="bg-[#161b22] border border-[#30363d] p-3 space-y-3">
              <h2 className="font-bold text-white uppercase text-xs tracking-wide border-b border-[#30363d] pb-1.5 flex justify-between">
                <span>Find Film People</span>
                <span className="text-[10px] text-[#8b949e]">TMDB</span>
              </h2>

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Mia Goth..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-2 py-1 focus:outline-none focus:border-[#58a6ff] text-xs placeholder:text-[#8b949e]/50"
                />
                <button
                  type="submit"
                  className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white px-3 py-1 font-bold transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="divide-y divide-[#30363d] max-h-52 overflow-y-auto border border-[#30363d] bg-[#0d1117]">
                  {searchResults.map((person) => {
                    const isFollowing = followed.some((f) => f.id === person.id);
                    return (
                      <div key={person.id} className="p-2 flex justify-between items-center hover:bg-[#161b22]">
                        <div>
                          <div className="font-bold text-[#58a6ff]">{person.name}</div>
                          <div className="text-[10px] text-[#8b949e]">{person.known_for_department}</div>
                        </div>
                        <button
                          onClick={() => followPerson(person)}
                          disabled={isFollowing}
                          className={`px-2 py-1 flex items-center gap-1 border text-[10px] uppercase font-bold ${
                            isFollowing
                              ? 'border-transparent text-green-400 cursor-default'
                              : 'border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-white'
                          }`}
                        >
                          {isFollowing ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {isFollowing ? 'Following' : 'Follow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="bg-[#161b22] border border-[#30363d] p-3 space-y-2">
              <h2 className="font-bold text-white uppercase text-xs tracking-wide border-b border-[#30363d] pb-1.5 flex justify-between">
                <span>People You Follow</span>
                <span className="text-[#8b949e]">[{followed.length}]</span>
              </h2>

              <ul className="divide-y divide-[#30363d]/50">
                {followed.map((person) => (
                  <li key={person.id} className="py-1.5 flex justify-between items-center">
                    <span className="font-bold text-[#58a6ff]">{person.name}</span>
                    <span className="text-[10px] text-[#8b949e]">{person.department}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="md:col-span-2">
            <div className="w-full bg-[#161c23] border border-[#2d3542]">
              <div className="bg-[#414853] px-3 py-2 text-white font-bold text-sm tracking-wide">
                Upcoming Projects Timeline
              </div>

              <div className="p-3 space-y-4">
                {loading ? (
                  <div className="py-8 text-center text-[#8b949e]">Loading timeline...</div>
                ) : sortedUpdates.length === 0 ? (
                  <div className="py-8 text-center text-[#8b949e]">
                    No upcoming projects logged yet. Search and follow a film person to build your feed!
                  </div>
                ) : (
                  sortedUpdates.map((item, idx) => {
                    const showDateHeader =
                      idx === 0 || sortedUpdates[idx - 1].releaseDateHeader !== item.releaseDateHeader;

                    return (
                      <div key={`${item.id}-${idx}`} className="space-y-2">
                        {showDateHeader && (
                          <div className="pt-2">
                            <div className="text-right text-white font-bold text-xs tracking-wide uppercase">
                              {item.releaseDateHeader}
                            </div>
                            <div className="border-b border-[#58a6ff]/40 mt-0.5" />
                          </div>
                        )}

                        <div className="leading-tight py-0.5">
                          <span className="font-bold text-[#79c0ff]">{item.creativeName}</span>
                          <span className="text-white font-normal"> - </span>
                          <a
                            href={`https://www.themoviedb.org/${item.mediaType}/${item.tmdbId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#a5d6ff] font-normal hover:underline"
                          >
                            {item.projectTitle}
                          </a>

                          <div className="text-[11px] text-[#8b949e] mt-0.5">
                            <span>{item.role}</span>
                            <span className="mx-1">·</span>
                            <span className="text-amber-400/90">{item.status}</span>
                            {item.director && (
                              <>
                                <span className="mx-1">·</span>
                                <span>Dir: {item.director}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
