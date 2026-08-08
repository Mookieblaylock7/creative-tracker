'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Check, LogOut, User, Upload, Filter, X, Film, Tv, FileText, Trash2, UserMinus, RotateCcw, Eye, Users, Bell, BellOff, Mail } from 'lucide-react';
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

  // Email Digest & Reminders
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [emailFrequency, setEmailFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'none'>('weekly');
  const [activeReminders, setActiveReminders] = useState<number[]>([]);

  // Details Cache (tmdbId -> { genres, topCast })
  const [detailsCache, setDetailsCache] = useState<Record<number, { genres: string[]; topCast: string[] }>>({});

  const [lastImportBatchIds, setLastImportBatchIds] = useState<number[]>([]);

  // Selected Person Dedicated Modal View
  const [selectedPersonModal, setSelectedPersonModal] = useState<Creative | null>(null);

  // Checkbox Role Filters (Left)
  const [showDirecting, setShowDirecting] = useState(true);
  const [showWriting, setShowWriting] = useState(true);
  const [showActing, setShowActing] = useState(true);
  const [showProducing, setShowProducing] = useState(false);
  const [showExecProducing, setShowExecProducing] = useState(false);

  // Media Filters (Right)
  const [includeDocs, setIncludeDocs] = useState(false);
  const [includeMovies, setIncludeMovies] = useState(true);
  const [includeTV, setIncludeTV] = useState(true);

  // Letterboxd Import Modal States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRatingThreshold, setImportRatingThreshold] = useState<number>(4.5);
  const [importDirectors, setImportDirectors] = useState(true);
  const [importWriters, setImportWriters] = useState(true);
  const [importCast, setImportCast] = useState(false);
  const [importSkipDocs, setImportSkipDocs] = useState(true);
  const [importProgress, setImportProgress] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

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
      if (session) {
        loadSavedData(session.user.id);
        loadUserPreferences(session.user.id);
      } else setLoading(false);
    });

    const savedBatch = localStorage.getItem('last_import_batch');
    if (savedBatch) {
      try { setLastImportBatchIds(JSON.parse(savedBatch)); } catch(e){}
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadSavedData(session.user.id);
        loadUserPreferences(session.user.id);
      } else {
        setFollowed([]);
        setUpdates([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserPreferences = async (userId: string) => {
    try {
      const { data: pref } = await supabase
        .from('user_email_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (pref) setEmailFrequency(pref.frequency);

      const { data: rems } = await supabase
        .from('movie_reminders')
        .select('tmdb_id')
        .eq('user_id', userId);

      if (rems) setActiveReminders(rems.map((r) => r.tmdb_id));
    } catch (e) {}
  };

  const saveEmailFrequency = async (freq: 'daily' | 'weekly' | 'monthly' | 'none') => {
    setEmailFrequency(freq);
    if (!session?.user) return;

    await supabase.from('user_email_preferences').upsert({
      user_id: session.user.id,
      email: session.user.email,
      frequency: freq,
    });
  };

  const toggleMovieReminder = async (item: GroupedProject) => {
    if (!session?.user) return;

    const isReminded = activeReminders.includes(item.tmdbId);

    if (isReminded) {
      setActiveReminders((prev) => prev.filter((id) => id !== item.tmdbId));
      await supabase
        .from('movie_reminders')
        .delete()
        .eq('user_id', session.user.id)
        .eq('tmdb_id', item.tmdbId);
    } else {
      setActiveReminders((prev) => [...prev, item.tmdbId]);
      await supabase.from('movie_reminders').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        tmdb_id: item.tmdbId,
        project_title: item.projectTitle,
        release_date: item.sortKey.startsWith('9999') ? '2026-12-31' : item.sortKey,
        reminder_type: 'both',
      });
    }
  };

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
        const loaded = savedProjects
          .filter((p) => {
            if (!p.sort_key || p.sort_key.startsWith('9999')) return true;
            return p.sort_key >= todayISO;
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
          }));

        setUpdates(loaded);
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

      for (const c of credits || []) {
        const rawDate = c.release_date || c.first_air_date;

        if (rawDate && rawDate < todayISO) continue;

        const dateInfo = parseReleaseDate(rawDate);
        const title = c.title || c.name || 'Untitled Project';
        const rawRole = c.job || (c.character ? `Cast (${c.character})` : department);

        const cleanRoleTag = rawRole.replace(/[^a-zA-Z0-9]/g, '');
        const uniqueId = `${person.id}-${c.id}-${cleanRoleTag}`;

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
        });
      }

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

  const groupedMap = new Map<number, GroupedProject>();

  updates.forEach((item) => {
    if (!groupedMap.has(item.tmdbId)) {
      groupedMap.set(item.tmdbId, {
        tmdbId: item.tmdbId,
        projectTitle: item.projectTitle,
        mediaType: item.mediaType,
        releaseDateHeader: item.releaseDateHeader,
        sortKey: item.sortKey,
        status: item.status,
        director: item.director,
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

  const filteredGroupedUpdates = Array.from(groupedMap.values()).filter((group) => {
    if (!includeMovies && group.mediaType === 'movie') return false;
    if (!includeTV && group.mediaType === 'tv') return false;

    const details = detailsCache[group.tmdbId] || { genres: [] };
    const titleLower = group.projectTitle.toLowerCase();
    const isDoc =
      details.genres.some((g) => g.toLowerCase().includes('documentary')) ||
      titleLower.includes('docu') ||
      titleLower.includes('making of') ||
      titleLower.includes('operação lorca') ||
      titleLower.includes('once upon a time in jersey');

    if (!includeDocs && isDoc) return false;

    const matchesRole = group.creatives.some((c) => {
      const creativeObj = followed.find((f) => f.name.toLowerCase() === c.name.toLowerCase());
      const primaryDept = (creativeObj?.department || '').toLowerCase();
      const r = c.role.toLowerCase();

      const isDirecting = r.includes('director') || r.includes('directing');
      const isWriting = r.includes('writer') || r.includes('writing') || r.includes('screenplay');
      const isExecProducing = r.includes('executive producer');
      const isProducing = r.includes('producer') && !isExecProducing;
      const isActing = r.startsWith('cast') || r.includes('actor') || r.includes('starring') || r.includes('self');

      if (isActing && primaryDept.includes('directing') && !isDirecting) {
        return showDirecting && showActing;
      }

      if (showDirecting && isDirecting) return true;
      if (showWriting && isWriting) return true;
      if (showActing && isActing) return true;
      if (showProducing && isProducing) return true;
      if (showExecProducing && isExecProducing) return true;

      return false;
    });

    return matchesRole;
  });

  const getLastName = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    return parts.length > 1 ? parts[parts.length - 1] : fullName;
  };

  const sortedGroupedUpdates = filteredGroupedUpdates.sort((a, b) => {
    const isUnannouncedA = a.sortKey.startsWith('9999');
    const isUnannouncedB = b.sortKey.startsWith('9999');

    if (isUnannouncedA && isUnannouncedB) {
      const nameA = a.creatives[0]?.name || '';
      const nameB = b.creatives[0]?.name || '';
      const lastNameA = getLastName(nameA);
      const lastNameB = getLastName(nameB);

      const lastNameCompare = lastNameA.localeCompare(lastNameB);
      if (lastNameCompare !== 0) return lastNameCompare;

      return a.projectTitle.localeCompare(b.projectTitle);
    }

    return a.sortKey.localeCompare(b.sortKey);
  });

  useEffect(() => {
    if (sortedGroupedUpdates.length === 0) return;

    sortedGroupedUpdates.forEach(async (item) => {
      if (detailsCache[item.tmdbId]) return;

      try {
        const res = await fetch(`/api/details?id=${item.tmdbId}&type=${item.mediaType}`);
        const data = await res.json();

        setDetailsCache((prev) => ({
          ...prev,
          [item.tmdbId]: {
            genres: data.genres || [],
            topCast: data.topCast || [],
          },
        }));
      } catch (e) {
        console.error('Failed to fetch details for', item.tmdbId, e);
      }
    });
  }, [sortedGroupedUpdates, detailsCache]);

  const formatCreditsLine = (creatives: Array<{ name: string; role: string }>) => {
    const creativeRoleMap = new Map<string, string[]>();

    creatives.forEach((c) => {
      let r = c.role.toLowerCase();
      let roleClean = c.role;

      if (r.includes('director') || r.includes('directing')) roleClean = 'Directed';
      else if (r.includes('writer') || r.includes('writing') || r.includes('screenplay')) roleClean = 'Written';
      else if (r.includes('executive producer')) roleClean = 'Executive Produced';
      else if (r.includes('producer')) roleClean = 'Produced';
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
      const order = ['Directed', 'Written', 'Executive Produced', 'Produced', 'Starring'];
      roles.sort((a, b) => order.indexOf(a) - order.indexOf(b));

      let rolePhrase = '';
      if (roles.length === 1) {
        if (roles[0] === 'Starring') rolePhrase = `Starring ${name}`;
        else rolePhrase = `${roles[0]} by ${name}`;
      } else if (roles.length === 2) {
        if (roles.includes('Starring')) {
          const nonStarring = roles.filter((r) => r !== 'Starring');
          rolePhrase = `${nonStarring[0]} by and Starring ${name}`;
        } else {
          rolePhrase = `${roles[0]} and ${roles[1]} by ${name}`;
        }
      } else if (roles.length >= 3) {
        const lastRole = roles[roles.length - 1];
        const initialRoles = roles.slice(0, roles.length - 1).join(', ');
        if (roles.includes('Starring') && lastRole === 'Starring') {
          rolePhrase = `${initialRoles}, and Starring ${name}`;
        } else {
          rolePhrase = `${initialRoles}, and ${lastRole} by ${name}`;
        }
      }

      entries.push(rolePhrase);
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

  const personRawProjects = selectedPersonModal
    ? updates.filter((u) => u.creativeName.toLowerCase() === selectedPersonModal.name.toLowerCase())
    : [];

  const personGroupedMap = new Map<number, { tmdbId: number; title: string; mediaType: string; status: string; releaseHeader: string; roles: string[] }>();
  personRawProjects.forEach((p) => {
    if (!personGroupedMap.has(p.tmdbId)) {
      personGroupedMap.set(p.tmdbId, {
        tmdbId: p.tmdbId,
        title: p.projectTitle,
        mediaType: p.mediaType,
        status: p.status,
        releaseHeader: p.releaseDateHeader,
        roles: [],
      });
    }
    const item = personGroupedMap.get(p.tmdbId)!;
    if (!item.roles.includes(p.role)) {
      item.roles.push(p.role);
    }
  });

  const personProjects = Array.from(personGroupedMap.values());

  return (
    <main className="min-h-screen bg-[#0e1117] text-[#c9d1d9] font-sans text-xs p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-[#2d3542] pb-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-white tracking-wider uppercase flex items-center gap-2">
            MY FILM PEOPLE <span className="text-[#58a6ff] text-xs font-normal">v5.1</span>
          </h1>
          <div className="flex items-center gap-3 text-[#8b949e] text-xs">
            <button
              onClick={() => setIsAlertsModalOpen(true)}
              className="bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-amber-400 px-2.5 py-1 flex items-center gap-1.5 font-bold transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Email Alerts ({emailFrequency})
            </button>
            {lastImportBatchIds.length > 0 && (
              <button
                onClick={undoLastImport}
                className="bg-amber-900/40 hover:bg-amber-800/60 border border-amber-600/50 text-amber-200 px-2.5 py-1 flex items-center gap-1.5 font-bold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                Undo Import ({lastImportBatchIds.length})
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
                  placeholder="e.g. Tom Cruise..."
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
                <div className="divide-y divide-[#30363d] max-h-64 overflow-y-auto border border-[#30363d] bg-[#0d1117]">
                  {searchResults.map((person) => {
                    const isFollowing = followed.some((f) => f.id === person.id);
                    const photoUrl = person.profile_path
                      ? `https://image.tmdb.org/t/p/w92${person.profile_path}`
                      : null;

                    return (
                      <div key={person.id} className="p-2 flex justify-between items-center hover:bg-[#161b22]">
                        <div className="flex items-center gap-2.5">
                          {photoUrl ? (
                            <img src={photoUrl} alt={person.name} className="w-7 h-9 object-cover rounded border border-[#30363d]" />
                          ) : (
                            <div className="w-7 h-9 bg-[#21262d] rounded border border-[#30363d] flex items-center justify-center text-[10px] text-[#8b949e]">
                              ?
                            </div>
                          )}
                          <div>
                            <div
                              onClick={() => setSelectedPersonModal({ id: person.id, name: person.name, department: person.known_for_department || 'Directing' })}
                              className="font-bold text-[#58a6ff] hover:underline cursor-pointer text-xs"
                            >
                              {person.name}
                            </div>
                            <div className="text-[10px] text-[#8b949e]">
                              {person.known_for_department}
                            </div>
                          </div>
                        </div>

                        {isFollowing ? (
                          <button
                            onClick={() => unfollowPerson(person.id)}
                            className="px-2 py-1 flex items-center gap-1 border border-red-900/60 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-[10px] uppercase font-bold transition-colors"
                          >
                            <UserMinus className="w-3 h-3 text-red-400" />
                            Unfollow
                          </button>
                        ) : (
                          <button
                            onClick={() => followPerson(person)}
                            className="px-2 py-1 flex items-center gap-1 border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-white text-[10px] uppercase font-bold transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Follow
                          </button>
                        )}
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

              <div className="p-3 space-y-6">
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
                    const details = detailsCache[item.tmdbId] || { genres: [], topCast: [] };
                    const isBellActive = activeReminders.includes(item.tmdbId);

                    return (
                      <div key={`${item.tmdbId}-${idx}`} className="space-y-3 group">
                        {showDateHeader && (
                          <div className="pt-4">
                            <div className="text-right text-white font-bold text-xs tracking-wide uppercase">
                              {item.releaseDateHeader}
                            </div>
                            <div className="border-b border-[#58a6ff]/40 mt-1" />
                          </div>
                        )}

                        <div className="leading-relaxed py-1 flex justify-between items-start">
                          <div>
                            {/* Unified Single Link for Credit & Movie Title */}
                            <a
                              href={`https://www.themoviedb.org/${item.mediaType}/${item.tmdbId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-[#79c0ff] hover:text-[#a5d6ff] hover:underline text-xs block"
                            >
                              {formattedCredits} - {item.projectTitle}
                            </a>

                            {/* Genres & Status Line */}
                            <div className="text-[11px] text-[#8b949e] mt-1 flex flex-wrap items-center gap-2">
                              <span className="text-amber-400/90 font-medium">{item.status}</span>
                              {details.genres.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-xs text-[#8b949e]/90 font-medium">
                                    {details.genres.join(', ')}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Top Billed Cast Display */}
                            {details.topCast.length > 0 && (
                              <div className="text-[11px] text-[#8b949e] mt-1 flex items-center gap-1.5">
                                <Users className="w-3 h-3 text-[#58a6ff]" />
                                <span>Starring <strong className="text-white/90 font-semibold">{details.topCast.join(', ')}</strong></span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Bell Reminder Toggle */}
                            <button
                              onClick={() => toggleMovieReminder(item)}
                              title={isBellActive ? "Remove Email Reminder" : "Get 1 week & 1 month Email Reminders"}
                              className={`p-1 transition-colors ${
                                isBellActive
                                  ? 'text-amber-400 hover:text-amber-300'
                                  : 'text-[#8b949e]/50 hover:text-amber-400'
                              }`}
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </button>

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
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Alerts Preferences Modal */}
      {isAlertsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-[#30363d] w-full max-w-md p-5 space-y-4 relative">
            <button
              onClick={() => setIsAlertsModalOpen(false)}
              className="absolute top-3 right-3 text-[#8b949e] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-sm font-bold text-white uppercase tracking-wide border-b border-[#30363d] pb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" /> Email Alert Preferences
            </h2>

            <div className="space-y-3">
              <p className="text-[#8b949e] text-[11px]">
                Choose how often you want email digests detailing new TMDB updates for people you follow (release dates announced, new projects added, cast updates):
              </p>

              <div className="space-y-2 pt-1">
                {(['daily', 'weekly', 'monthly', 'none'] as const).map((freq) => (
                  <label
                    key={freq}
                    className={`flex items-center justify-between p-2 border cursor-pointer font-bold capitalize text-xs ${
                      emailFrequency === freq
                        ? 'border-[#58a6ff] bg-[#1f242d] text-white'
                        : 'border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-white'
                    }`}
                  >
                    <span>{freq} Digest</span>
                    <input
                      type="radio"
                      name="email_freq"
                      checked={emailFrequency === freq}
                      onChange={() => saveEmailFrequency(freq)}
                      className="accent-[#58a6ff]"
                    />
                  </label>
                ))}
              </div>

              <div className="pt-2 border-t border-[#30363d] text-[11px] text-[#8b949e]">
                <strong className="text-white">Movie Bell Reminders:</strong> You can also click the <Bell className="w-3 h-3 inline text-amber-400 mx-0.5" /> icon next to any upcoming movie to receive instant emails 1 month and 1 week prior to its release date!
              </div>
            </div>
          </div>
        </div>
      )}

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
                personProjects.map((proj, idx) => (
                  <div key={idx} className="pt-2 leading-tight flex justify-between items-start">
                    <div>
                      <div className="font-bold text-white text-xs">
                        <a
                          href={`https://www.themoviedb.org/${proj.mediaType}/${proj.tmdbId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#a5d6ff] hover:underline"
                        >
                          {proj.title}
                        </a>
                      </div>
                      <div className="text-[11px] text-[#8b949e] mt-1 space-x-2">
                        <span className="text-[#58a6ff] font-semibold">{proj.roles.join(', ')}</span>
                        <span>·</span>
                        <span className="text-amber-400">{proj.status}</span>
                        <span>·</span>
                        <span>{proj.releaseHeader}</span>
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
                <div className="bg-[#161b22] border border-[#30363d] rounded p-3 my-2 text-[11px] text-[#8b949e] space-y-1.5">
                  <div className="font-bold text-white uppercase text-[10px] tracking-wider">How to get your ratings.csv file:</div>
                  <ol className="list-decimal list-inside space-y-1 text-[#c9d1d9] pl-1">
                    <li>Log into <strong className="text-white">Letterboxd</strong> (web or mobile) and open <strong className="text-white">Settings</strong></li>
                    <li>Go to the <strong className="text-white">Data</strong> tab and click <strong className="text-white">Export Your Data</strong></li>
                    <li>Open the downloaded zip folder, locate <strong className="text-[#58a6ff]">ratings.csv</strong>, and select it below</li>
                  </ol>
                </div>
                <label className="block text-[10px] text-[#8b949e] uppercase font-bold mb-1 mt-3">Select ratings.csv file:</label>
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
