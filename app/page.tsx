'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Check, LogOut, User, Upload, Filter, X, Film, Tv, FileText, Trash2, UserMinus, RotateCcw, Eye } from 'lucide-react';
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

interface GroupedProject {
  tmdbId: number;
  projectTitle: string;
  mediaType: 'movie' | 'tv';
  releaseDateHeader: string;
  sortKey: string;
  status: string;
  director?: string;
  isDoc?: boolean;
  creatives: Array<{
    name: string;
    role: string;
    updateId: string;
  }>;
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

  // Selected Person Dedicated Modal View
  const [selectedPersonModal, setSelectedPersonModal] = useState<Creative | null>(null);

  // Checkbox Role Filters (Left)
  const [showDirecting, setShowDirecting] = useState(true);
  const [showWriting, setShowWriting] = useState(true);
  const [showActing, setShowActing] = useState(false);
  const [showProducing, setShowProducing] = useState(false);
  const [showExecProducing, setShowExecProducing] = useState(false);

  // Media Filters (Right)
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

  // Helper: Get today's ISO date string (YYYY-MM-DD)
  const getTodayISO = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  const isDocumentaryProject = (title: string, role: string, genreIds?: number[]) => {
    const t = (title || '').toLowerCase();
    const r = (role || '').toLowerCase();
    return (
      (genreIds && genreIds.includes(99)) ||
      t.includes('docu') ||
      t.includes('making of') ||
      t.includes('architecture of') ||
      t.includes('portrait of') ||
      t.includes('mad world of') ||
      t.includes('national theatre live') ||
      t.includes('behind the scenes') ||
      r.includes('self') ||
      r.includes('archive') ||
      r.includes('docu')
    );
  };

  const loadSavedData = async (userId: string) => {
    setLoading(true);
    const todayISO = getTodayISO();
    try {
      const { data: savedCreatives } = await supabase
        .from('followed_creatives')
        .select('*')
        .eq('user_id', userId);

      const { data: savedProjects } = await supabase
        .from('tracked_projects')
        .select('*')
        .eq('user_id', userId);

      if (savedCreatives) {
        const uniqueCreativesMap = new Map();
        savedCreatives.forEach((c) => uniqueCreativesMap.set(c.id, c));
        const uniqueCreatives = Array.from(uniqueCreativesMap.values());

        setFollowed(
          uniqueCreatives.map((c) => ({
            id: c.id,
            name: c.name,
            department: c.department,
          }))
        );
      }

      if (savedProjects) {
        setUpdates(
          savedProjects
            .filter((p) => {
              if (!p.sort_key || p.sort_key.startsWith('9999')) return true; // Keep unannounced
              return p.sort_key >= todayISO; // Dynamic Cutoff: Today or later
            })
            .map((p) => ({
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
              isDoc: isDocumentaryProject(p.project_title, p.role),
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

    let isAlreadyFollowed = false;
    setFollowed((prev) => {
      if (prev.some((f) => f.id === person.id)) {
        isAlreadyFollowed = true;
        return prev;
      }
      const department = person.known_for_department || person.department || 'Directing';
      return [...prev, { id: person.id, name: person.name, department }];
    });

    if (isAlreadyFollowed) return;

    const department = person.known_for_department || person.department || 'Directing';
    const newCreative = {
      id: person.id,
      user_id: session.user.id,
      name: person.name,
      department,
    };

    await supabase.from('followed_creatives').upsert([newCreative]);

    try {
      const res = await fetch(`/api/creative?id=${person.id}`);
      const credits = await res.json();

      const todayISO = getTodayISO();
      const newProjects: ProjectUpdate[] = [];

      (credits || []).forEach((c: any) => {
        const rawDate = c.release_date || c.first_air_date;

        // Dynamic Cutoff: Keep UNANNOUNCED (no date) OR released today/future
        if (rawDate && rawDate < todayISO) return;

        const dateInfo = parseReleaseDate(rawDate);
        const title = c.title || c.name || 'Untitled Project';
        const rawRole = c.job || (c.character ? `Cast (${c.character})` : department);

        const cleanRoleTag = rawRole.replace(/[^a-zA-Z0-9]/g, '');
        const uniqueId = `${person.id}-${c.id}-${cleanRoleTag}`;

        const isDoc = isDocumentaryProject(title, rawRole, c.genre_ids);

        newProjects.push({
          id: uniqueId,
          tmdbId: c.id,
          creativeName: person.name,
          projectTitle: title,
          role: rawRole,
          mediaType: c.media_type || 'movie',
          releaseDateHeader: dateInfo.header,
          sortKey: dateInfo.sortKey,
          status: rawDate ? 'Announced' : 'In Development',
          director: c.director || null,
          isDoc,
        });
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
        const newlyAddedIds = new Set<number>();

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
                newlyAddedIds.add(creator.id);
                await followPerson(creator);
              }
            }
          } catch (err) {
            console.error(`Failed to process ${title}:`, err);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const batchArray = Array.from(newlyAddedIds);
        setLastImportBatchIds(batchArray);
        localStorage.setItem('last_import_batch', JSON.stringify(batchArray));
        setImportProgress('Import complete!');
        setTimeout(() => {
          setIsImporting(false);
          setIsImportOpen(false);
          setImportProgress('');
        }, 2000);
      },
    });
  };

  const filteredUpdates = updates.filter((item) => {
    if (!includeMovies && item.mediaType === 'movie') return false;
    if (!includeTV && item.mediaType === 'tv') return false;

    if (!includeDocs && item.isDoc) return false;

    const r = item.role.toLowerCase();

    const isDirecting = r.includes('director') || r.includes('directing');
    const isWriting = r.includes('writer') || r.includes('writing') || r.includes('screenplay');
    const isExecProducing = r.includes('executive producer');
    const isProducing = r.includes('producer') && !isExecProducing;
    const isActing = r.startsWith('cast') || r.includes('actor') || r.includes('starring');

    let matchesAnyRole = false;
    if (showDirecting && isDirecting) matchesAnyRole = true;
    if (showWriting && isWriting) matchesAnyRole = true;
    if (showActing && isActing) matchesAnyRole = true;
    if (showProducing && isProducing) matchesAnyRole = true;
    if (showExecProducing && isExecProducing) matchesAnyRole = true;

    return matchesAnyRole;
  });

  const groupedMap = new Map<number, GroupedProject>();

  filteredUpdates.forEach((item) => {
    if (!groupedMap.has(item.tmdbId)) {
      groupedMap.set(item.tmdbId, {
        tmdbId: item.tmdbId,
        projectTitle: item.projectTitle,
        mediaType: item.mediaType,
        releaseDateHeader: item.releaseDateHeader,
        sortKey: item.sortKey,
        status: item.status,
        director: item.director,
        isDoc: item.isDoc,
        creatives: [],
      });
    }

    const group = groupedMap.get(item.tmdbId)!;
    if (!group.creatives.some((c) => c.name === item.creativeName && c.role === item.role)) {
      group.creatives.push({
        name: item.creativeName,
        role: item.role,
        updateId: item.id,
      });
    }
  });

  const sortedGroupedUpdates = Array.from(groupedMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Multi-Role Credit Formatter: Dir., Writer, Exec Producer, Producer, Starring
  const formatCreditsLine = (creatives: Array<{ name: string; role: string }>) => {
    const creativeRoleMap = new Map<string, string[]>();

    creatives.forEach((c) => {
      let r = c.role.toLowerCase();
      let roleClean = c.role;

      if (r.includes('director') || r.includes('directing')) roleClean = 'Dir.';
      else if (r.includes('writer') || r.includes('writing') || r.includes('screenplay')) roleClean = 'Writer';
      else if (r.includes('executive producer')) roleClean = 'Exec Producer';
      else if (r.includes('producer')) roleClean = 'Producer';
      else if (r.startsWith('cast') || r.includes('actor')) roleClean = 'Starring';

      if (!creativeRoleMap.has(c.name)) {
        creativeRoleMap.set(c.name, []);
      }
      const existing = creativeRoleMap.get(c.name)!;
      if (!existing.includes(roleClean)) {
        existing.push(roleClean);
      }
    });

    const entries: string[] = [];
    creativeRoleMap.forEach((roles, name) => {
      const order = ['Dir.', 'Writer', 'Exec Producer', 'Producer', 'Starring'];
      roles.sort((a, b) => order.indexOf(a) - order.indexOf(b));

      const roleStr = roles.join(', ');
      entries.push(`${roleStr} ${name}`);
    });

    return entries.join(' · ');
  };

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

  // Selected Person Projects for Dedicated Modal
  const personProjects = selectedPersonModal
    ? updates.filter((u) => u.creativeName.toLowerCase() === selectedPersonModal.name.toLowerCase())
    : [];

  return (
    <main className="min-h-screen bg-[#0e1117] text-[#c9d1d9] font-sans text-xs p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-[#2d3542] pb-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-white tracking-wider uppercase flex items-center gap-2">
            MY FILM PEOPLE <span className="text-[#58a6ff] text-xs font-normal">v3.8</span>
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
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="text-[10px] font-bold uppercase text-[#8b949e] flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-[#58a6ff]" /> Roles:
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={showDirecting}
                onChange={(e) => setShowDirecting(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              Directing
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={showWriting}
                onChange={(e) => setShowWriting(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              Writing
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={showActing}
                onChange={(e) => setShowActing(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              Acting
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={showProducing}
                onChange={(e) => setShowProducing(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              Producing
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[#c9d1d9]">
              <input
                type="checkbox"
                checked={showExecProducing}
                onChange={(e) => setShowExecProducing(e.target.checked)}
                className="accent-[#58a6ff]"
              />
              Exec Producing
            </label>
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
                          <div
                            onClick={() => setSelectedPersonModal({ id: person.id, name: person.name, department: person.known_for_department || 'Directing' })}
                            className="font-bold text-[#58a6ff] hover:underline cursor-pointer"
                          >
                            {person.name}
                          </div>
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
                    <div
                      onClick={() => setSelectedPersonModal(person)}
                      className="cursor-pointer group-hover:text-[#58a6ff]"
                    >
                      <div className="font-bold text-[#58a6ff] flex items-center gap-1.5">
                        {person.name}
                        <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#8b949e] transition-opacity" />
                      </div>
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
                <span className="text-xs text-[#8b949e] font-normal">{sortedGroupedUpdates.length} projects</span>
              </div>

              <div className="p-3 space-y-4">
                {loading ? (
                  <div className="py-8 text-center text-[#8b949e]">Loading timeline...</div>
                ) : sortedGroupedUpdates.length === 0 ? (
                  <div className="py-8 text-center text-[#8b949e]">
                    No upcoming projects logged for current filters.
                  </div>
                ) : (
                  sortedGroupedUpdates.map((item, idx) => {
                    const showDateHeader =
                      idx === 0 || sortedGroupedUpdates[idx - 1].releaseDateHeader !== item.releaseDateHeader;

                    const formattedCredits = formatCreditsLine(item.creatives);

                    return (
                      <div key={`${item.tmdbId}-${idx}`} className="space-y-2 group">
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
                            <div className="font-bold text-[#79c0ff]">
                              <span>{formattedCredits}</span>
                              <span className="text-white font-normal"> - </span>
                              <a
                                href={`https://www.themoviedb.org/${item.mediaType}/${item.tmdbId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#a5d6ff] font-normal hover:underline"
                              >
                                {item.projectTitle}
                              </a>
                            </div>

                            <div className="text-[11px] text-[#8b949e] mt-0.5">
                              <span className="text-amber-400/90">{item.status}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              item.creatives.forEach((c) => deleteProject(c.updateId));
                            }}
                            title="Remove project from timeline"
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

      {/* Single Person Dedicated View Modal */}
      {selectedPersonModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-[#30363d] w-full max-w-xl p-5 space-y-4 relative">
            <button
              onClick={() => setSelectedPersonModal(null)}
              className="absolute top-3 right-3 text-[#8b949e] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-[#30363d] pb-2">
              <h2 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <span className="text-[#58a6ff]">{selectedPersonModal.name}</span>
                <span className="text-xs text-[#8b949e] font-normal">({selectedPersonModal.department})</span>
              </h2>
              <p className="text-[11px] text-[#8b949e] mt-0.5">All upcoming & logged projects for this creator</p>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-[#30363d]/50 pr-1 space-y-3">
              {personProjects.length === 0 ? (
                <div className="py-8 text-center text-[#8b949e]">
                  No logged projects found for {selectedPersonModal.name}.
                </div>
              ) : (
                personProjects.map((proj) => (
                  <div key={proj.id} className="pt-2 leading-tight flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white text-xs">
                        <a
                          href={`https://www.themoviedb.org/${proj.mediaType}/${proj.tmdbId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#a5d6ff] hover:underline"
                        >
                          {proj.projectTitle}
                        </a>
                      </div>
                      <div className="text-[11px] text-[#8b949e] mt-1 space-x-2">
                        <span className="text-[#58a6ff] font-semibold">{proj.role}</span>
                        <span>·</span>
                        <span className="text-amber-400">{proj.status}</span>
                        <span>·</span>
                        <span>{proj.releaseDateHeader}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
