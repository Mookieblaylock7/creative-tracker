'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Check, LogOut, User, Upload, Filter, X, Film, Tv, FileText, Trash2, UserMinus, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Papa from 'papaparse';

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
  isDoc?: boolean;
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

  const [lastImportBatchIds, setLastImportBatchIds] = useState<number[]>([]);

  // Filters
  const [roleFilter, setRoleFilter] = useState<'all' | 'Directing' | 'Writing' | 'Acting'>('all');
  const [includeDocs, setIncludeDocs] = useState(false);
  const [includeMovies, setIncludeMovies] = useState(true);
  const [includeTV, setIncludeTV] = useState(true);

  // Letterboxd Import Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRatingThreshold, setImportRatingThreshold] = useState<number>(4.5);
  const [importDirectors, setImportDirectors] = useState(true);
  const [importWriters, setImportWriters] = useState(true);
  const [importCast, setImportCast] = useState(false);
  const [importSkipDocs, setImportSkipDocs] = useState(true);
  const [importProgress, setImportProgress] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadSavedData(session.user.id);
      else setLoading(false);
    });

    const savedBatch = localStorage.getItem('last_import_batch');
    if (savedBatch) {
      try { setLastImportBatchIds(JSON.parse(savedBatch)); } catch(e){}
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadSavedData(session.user.id);
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

  const loadSavedData = async (userId: string) => {
    setLoading(true);
    try {
      const { data: savedCreatives, error: err1 } = await supabase
        .from('followed_creatives')
        .select('*')
        .eq('user_id', userId);

      const { data: savedProjects, error: err2 } = await supabase
        .from('tracked_projects')
        .select('*')
        .eq('user_id', userId);

      if (err1) console.error('Supabase load creatives error:', err1);
      if (err2) console.error('Supabase load projects error:', err2);

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
          savedProjects.map((p) => {
            const titleLower = (p.project_title || '').toLowerCase();
            const roleLower = (p.role || '').toLowerCase();
            const isDocumentary = titleLower.includes('docu') || titleLower.includes('elegy') || roleLower.includes('docu');

            return {
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
              isDoc: isDocumentary,
            };
          })
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
      else setAuthMessage('Account created! Try signing in.');
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

  const followPerson = async (person: { id: number; name: string; known_for_department?: string; department?: string }) => {
    if (!session?.user) return;
    if (followed.some((f) => f.id === person.id)) return;

    const department = person.known_for_department || person.department || 'Directing';

    const newCreative = {
      id: person.id,
      user_id: session.user.id,
      name: person.name,
      department,
    };

    setFollowed((prev) => [...prev, { id: person.id, name: person.name, department }]);

    const { error: creativeErr } = await supabase.from('followed_creatives').upsert([newCreative]);
    if (creativeErr) console.error('Error saving creative to Supabase:', creativeErr);

    try {
      const res = await fetch(`/api/creative?id=${person.id}`);
      const credits = await res.json();

      const upcomingOnly = (credits || []).filter((c: any) => {
        const releaseDate = c.release_date || c.first_air_date;
        if (!releaseDate) return true;
        return releaseDate >= '2024-01-01';
      }).slice(0, 30);

      const newProjects: ProjectUpdate[] = upcomingOnly.map((c: any) => {
        const dateInfo = parseReleaseDate(c.release_date || c.first_air_date);
        const titleLower = (c.title || c.name || '').toLowerCase();
        const roleLower = (c.job || '').toLowerCase();

        const isDocumentary = 
          (c.genre_ids && c.genre_ids.includes(99)) ||
          (c.genres && c.genres.some((g: any) => g.id === 99 || g.name?.toLowerCase().includes('doc'))) ||
          titleLower.includes('docu') ||
          titleLower.includes('elegy') ||
          roleLower.includes('docu');

        return {
          id: `${person.id}-${c.id}`,
          tmdbId: c.id,
          creativeName: person.name,
          projectTitle: c.title || c.name || 'Untitled Project',
          role: c.job || (c.character ? `Cast (${c.character})` : department),
          mediaType: c.media_type,
          releaseDateHeader: dateInfo.header,
          sortKey: dateInfo.sortKey,
          status: c.release_date || c.first_air_date ? 'Announced' : 'In Development',
          director: c.director || null,
          isDoc: Boolean(isDocumentary),
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
        const { error: projErr } = await supabase.from('tracked_projects').upsert(dbRows);
        if (projErr) console.error('Error saving projects to Supabase:', projErr);
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
    }
  };

  const unfollowPerson = async (personId: number) => {
    setFollowed((prev) => prev.filter((f) => f.id !== personId));
    setUpdates((prev) => prev.filter((p) => !p.id.startsWith(`${personId}-`)));

    await supabase.from('followed_creatives').delete().eq('id', personId);
    await supabase.from('tracked_projects').delete().like('id', `${personId}-%`);
  };

  const clearAllFollowed = async () => {
    if (!confirm('Are you sure you want to unfollow everyone and clear your entire timeline?')) return;

    setFollowed([]);
    setUpdates([]);
    setLastImportBatchIds([]);
    localStorage.removeItem('last_import_batch');

    if (session?.user) {
      await supabase.from('followed_creatives').delete().eq('user_id', session.user.id);
      await supabase.from('tracked_projects').delete().eq('user_id', session.user.id);
    }
  };

  const undoLastImport = async () => {
    if (lastImportBatchIds.length === 0) return;

    if (!confirm(`Undo import of the last ${lastImportBatchIds.length} people?`)) return;

    for (const personId of lastImportBatchIds) {
      await unfollowPerson(personId);
    }

    setLastImportBatchIds([]);
    localStorage.removeItem('last_import_batch');
  };

  const deleteProject = async (id: string) => {
    setUpdates((prev) => prev.filter((p) => p.id !== id));
    await supabase.from('tracked_projects').delete().eq('id', id);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportProgress('Reading CSV file...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        const filtered = rows.filter((r) => {
          const rating = parseFloat(r.Rating || r['Rating'] || '0');
          return rating >= importRatingThreshold;
        });

        setImportProgress(`Found ${filtered.length} matching films. Processing...`);
        const newlyAddedIds: number[] = [];

        for (let i = 0; i < filtered.length; i++) {
          const movie = filtered[i];
          const title = movie.Name || movie.Title;
          const year = movie.Year;

          if (!title) continue;

          setImportProgress(`Processing (${i + 1}/${filtered.length}): ${title}...`);

          try {
            const res = await fetch(`/api/movie?title=${encodeURIComponent(title)}&year=${year || ''}`);
            const data = await res.json();

            if (data && !data.error) {
              if (importSkipDocs && data.isDoc) continue;

              const creatorsToFollow: any[] = [];

              if (importDirectors && data.directors) creatorsToFollow.push(...data.directors);
              if (importWriters && data.writers) creatorsToFollow.push(...data.writers);
              if (importCast && data.topCast) creatorsToFollow.push(...data.topCast);

              for (const creator of creatorsToFollow) {
                newlyAddedIds.push(creator.id);
                await followPerson(creator);
              }
            }
          } catch (err) {
            console.error(`Failed to process ${title}:`, err);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        setLastImportBatchIds(newlyAddedIds);
        localStorage.setItem('last_import_batch', JSON.stringify(newlyAddedIds));
        setImportProgress('Import complete!');
        setTimeout(() => {
          setIsImporting(false);
          setIsImportOpen(false);
          setImportProgress('');
        }, 2000);
      },
    });
  };

  // Filtered timeline updates
  const filteredUpdates = updates.filter((item) => {
    if (!includeMovies && item.mediaType === 'movie') return false;
    if (!includeTV && item.mediaType === 'tv') return false;

    const titleLower = item.projectTitle.toLowerCase();
    const isDocByTitle = item.isDoc || titleLower.includes('elegy') || titleLower.includes('docu');

    if (!includeDocs && isDocByTitle) return false;

    if (roleFilter === 'Directing' && !item.role.toLowerCase().includes('director') && !item.role.toLowerCase().includes('directing')) return false;
    if (roleFilter === 'Writing' && !item.role.toLowerCase().includes('writer') && !item.role.toLowerCase().includes('writing')) return false;
    if (roleFilter === 'Acting' && !item.role.toLowerCase().includes('cast') && !item.role.toLowerCase().includes('actor')) return false;

    return true;
  });

  const sortedUpdates = [...filteredUpdates].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

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
          <h1 className="text-lg font-bold text-white tracking-wider uppercase flex items-center gap-2">
            MY FILM PEOPLE <span className="text-[#58a6ff] text-xs font-normal">v2.3</span>
          </h1>
          <div className="flex items-center gap-3 text-[#8b949e] text-xs">
            {lastImportBatchIds.length > 0 && (
              <button
                onClick={undoLastImport}
                className="bg-amber-900/40 hover:bg-amber-800/60 border border-amber-600/50 text-amber-200 px-2.5 py-1 flex items-center gap-1.5 font-bold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Undo Last Import ({lastImportBatchIds.length})
              </button>
            )}
            <button
              onClick={() => setIsImportOpen(true)}
              className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white px-2.5 py-1 flex items-center gap-1.5 font-bold transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#58a6ff]" />
              Import Letterboxd
            </button>
            <span className="flex items-center gap-1 text-white">
              <User className="w-3.5 h-3.5 text-[#58a6ff]" />
              {session.user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="hover:text-white flex items-center gap-1 border border-[#30363d] px-2 py-1 bg-[#21262d]"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </header>

        {/* Filter Toolbar */}
        <div className="bg-[#161b22] border border-[#30363d] p-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-[#8b949e] flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#58a6ff]" /> Role Filter:
            </span>
            {(['all', 'Directing', 'Writing', 'Acting'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-2.5 py-0.5 border text-[11px] font-bold capitalize transition-colors ${
                  roleFilter === role
                    ? 'bg-[#1f6beb] text-white border-[#58a6ff]'
                    : 'bg-[#0d1117] text-[#8b949e] border-[#30363d] hover:text-white'
                }`}
              >
                {role === 'all' ? 'All Roles' : role}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={includeMovies}
                onChange={(e) => setIncludeMovies(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              <Film className="w-3 h-3 text-[#58a6ff]" /> Movies
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={includeTV}
                onChange={(e) => setIncludeTV(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              <Tv className="w-3 h-3 text-[#58a6ff]" /> TV Shows
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={includeDocs}
                onChange={(e) => setIncludeDocs(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              <FileText className="w-3 h-3 text-[#58a6ff]" /> Docs
            </label>
          </div>
        </div>

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
              <div className="border-b border-[#30363d] pb-1.5 flex justify-between items-center">
                <h2 className="font-bold text-white uppercase text-xs tracking-wide">
                  People You Follow <span className="text-[#8b949e]">[{followed.length}]</span>
                </h2>

                {followed.length > 0 && (
                  <button
                    onClick={clearAllFollowed}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <ul className="divide-y divide-[#30363d]/50 max-h-96 overflow-y-auto">
                {followed.map((person) => (
                  <li key={person.id} className="py-1.5 flex justify-between items-center group px-1">
                    <div>
                      <div className="font-bold text-[#58a6ff]">{person.name}</div>
                      <div className="text-[10px] text-[#8b949e]">{person.department}</div>
                    </div>
                    <button
                      onClick={() => unfollowPerson(person.id)}
                      title={`Unfollow ${person.name}`}
                      className="opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-red-400 p-1 transition-opacity"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="md:col-span-2">
            <div className="w-full bg-[#161c23] border border-[#2d3542]">
              <div className="bg-[#414853] px-3 py-2 text-white font-bold text-sm tracking-wide flex justify-between items-center">
                <span>Upcoming Projects Timeline</span>
                <span className="text-xs text-[#8b949e] font-normal">{sortedUpdates.length} projects</span>
              </div>

              <div className="p-3 space-y-4">
                {loading ? (
                  <div className="py-8 text-center text-[#8b949e]">Loading timeline...</div>
                ) : sortedUpdates.length === 0 ? (
                  <div className="py-8 text-center text-[#8b949e]">
                    No upcoming projects logged for current filters.
                  </div>
                ) : (
                  sortedUpdates.map((item, idx) => {
                    const showDateHeader =
                      idx === 0 || sortedUpdates[idx - 1].releaseDateHeader !== item.releaseDateHeader;

                    return (
                      <div key={`${item.id}-${idx}`} className="space-y-2 group">
                        {showDateHeader && (
                          <div className="pt-2">
                            <div className="text-right text-white font-bold text-xs tracking-wide uppercase">
                              {item.releaseDateHeader}
                            </div>
                            <div className="border-b border-[#58a6ff]/40 mt-0.5" />
                          </div>
                        )}

                        <div className="leading-tight py-0.5 flex justify-between items-start">
                          <div>
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

                          <button
                            onClick={() => deleteProject(item.id)}
                            title="Remove from timeline"
                            className="opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-red-400 p-1 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-[#30363d] w-full max-w-md p-5 space-y-4 relative">
            <button
              onClick={() => setIsImportOpen(false)}
              className="absolute top-3 right-3 text-[#8b949e] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-sm font-bold text-white uppercase tracking-wide border-b border-[#30363d] pb-2 flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#58a6ff]" /> Import Letterboxd Ratings
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-[#8b949e] uppercase font-bold mb-1">
                  Import Movies Rated:
                </label>
                <select
                  value={importRatingThreshold}
                  onChange={(e) => setImportRatingThreshold(parseFloat(e.target.value))}
                  className="w-full bg-[#0d1117] border border-[#30363d] text-white px-2 py-1 text-xs"
                >
                  <option value={5.0}>5 Stars Only</option>
                  <option value={4.5}>4.5 Stars & Above</option>
                  <option value={4.0}>4.0 Stars & Above</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-[#8b949e] uppercase font-bold">Auto-Follow Roles:</label>
                <label className="flex items-center gap-2 text-xs text-[#c9d1d9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importDirectors}
                    onChange={(e) => setImportDirectors(e.target.checked)}
                    className="accent-[#58a6ff]"
                  />
                  Directors
                </label>
                <label className="flex items-center gap-2 text-xs text-[#c9d1d9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importWriters}
                    onChange={(e) => setImportWriters(e.target.checked)}
                    className="accent-[#58a6ff]"
                  />
                  Writers
                </label>
                <label className="flex items-center gap-2 text-xs text-[#c9d1d9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importCast}
                    onChange={(e) => setImportCast(e.target.checked)}
                    className="accent-[#58a6ff]"
                  />
                  Lead Actors / Cast
                </label>
              </div>

              <div className="pt-2 border-t border-[#30363d]">
                <label className="flex items-center gap-2 text-xs text-[#c9d1d9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importSkipDocs}
                    onChange={(e) => setImportSkipDocs(e.target.checked)}
                    className="accent-[#58a6ff]"
                  />
                  Skip Documentaries
                </label>
              </div>

              <div className="pt-3">
                <label className="block text-[10px] text-[#8b949e] uppercase font-bold mb-1">Select ratings.csv file:</label>
                <input
                  type="file"
                  accept=".csv"
                  disabled={isImporting}
                  onChange={handleFileUpload}
                  className="w-full text-xs text-[#8b949e] file:bg-[#21262d] file:border file:border-[#30363d] file:text-white file:px-3 file:py-1 file:mr-3 file:font-bold cursor-pointer"
                />
              </div>

              {importProgress && (
                <div className="p-2 bg-[#0d1117] border border-[#30363d] text-[#58a6ff] text-[11px] font-mono">
                  {importProgress}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
