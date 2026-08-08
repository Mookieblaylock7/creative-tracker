'use client';

import { useState, useEffect } from 'react';
import { Share2, Search, Plus, Check, LogOut, User, Upload, Filter, X, Film, Tv, FileText, Trash2, UserMinus, RotateCcw, Eye, Users, Bell, BellOff, Mail, Loader2, Monitor, Smartphone } from 'lucide-react';
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
  const [filterMonth, setFilterMonth] = useState<string>("ALL");
  const [filterYear, setFilterYear] = useState<string>("ALL");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [followed, setFollowed] = useState<Creative[]>([]);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  // Email Digest & Reminders
  const [copiedShare, setCopiedShare] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"feed" | "people">("feed");
  const [emailFrequency, setEmailFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'none'>('weekly');
  const [activeReminders, setActiveReminders] = useState<number[]>([]);

  // Details Cache
  const [detailsCache, setDetailsCache] = useState<Record<number, { genres: string[]; topCast: string[] }>>({});
  const [lastImportBatchIds, setLastImportBatchIds] = useState<number[]>([]);

  // Modal View State
  const [selectedPersonModal, setSelectedPersonModal] = useState<Creative | null>(null);
  const [modalProjects, setModalProjects] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false);

  // Role Filters (Default: Directing and Acting selected)
  const [showDirecting, setShowDirecting] = useState(true);
  const [showWriting, setShowWriting] = useState(false);
  const [showActing, setShowActing] = useState(true);
  const [showCinematography, setShowCinematography] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showProducing, setShowProducing] = useState(false);
  const [showExecProducing, setShowExecProducing] = useState(false);

  // Medium Filters (Default: Movies selected, TV and Docs off)
  const [includeDocs, setIncludeDocs] = useState(false);
  const [includeMovies, setIncludeMovies] = useState(true);
  const [includeTV, setIncludeTV] = useState(false);

  // Import Modal States (Default: Directors, Lead Actors, and Skip Docs checked)
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRatingThreshold, setImportRatingThreshold] = useState<number>(4.5);
  const [importDirectors, setImportDirectors] = useState(true);
  const [importWriters, setImportWriters] = useState(false);
  const [importCast, setImportCast] = useState(true);
  const [importCinematographers, setImportCinematographers] = useState(false);
  const [importComposers, setImportComposers] = useState(false);
  const [importSkipDocs, setImportSkipDocs] = useState(true);
  const [importProgress, setImportProgress] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importInstructionsTab, setImportInstructionsTab] = useState<'computer' | 'phone'>('computer');

  const getTodayISO = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      setImportInstructionsTab('phone');
    }

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openPersonModal = async (person: Creative) => {
    setSelectedPersonModal(person);
    setIsModalLoading(true);
    setModalProjects([]);

    try {
      const res = await fetch(`/api/creative?id=${person.id}`);
      const credits = await res.json();
      const todayISO = getTodayISO();

      const grouped = new Map<number, { tmdbId: number; title: string; mediaType: string; status: string; releaseHeader: string; roles: string[] }>();

      for (const c of credits || []) {
        const rawDate = c.release_date || c.first_air_date;
        if (rawDate && rawDate < todayISO) continue;

        const dateInfo = parseReleaseDate(rawDate);
        const title = c.title || c.name || 'Untitled Project';
        const rawRole = c.job || (c.character ? `Cast (${c.character})` : person.department || 'Creative');

        if (!grouped.has(c.id)) {
          grouped.set(c.id, {
            tmdbId: c.id,
            title,
            mediaType: c.media_type || 'movie',
            status: rawDate ? 'Announced' : 'In Development',
            releaseHeader: dateInfo.header,
            roles: [],
          });
        }

        const item = grouped.get(c.id)!;
        if (!item.roles.includes(rawRole)) {
          item.roles.push(rawRole);
        }
      }

      setModalProjects(Array.from(grouped.values()));
    } catch (err) {
      console.error('Error fetching person credits for modal:', err);
    } finally {
      setIsModalLoading(false);
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
              if (importCinematographers && data.cinematographers) creatorsToFollow.push(...data.cinematographers);
              if (importComposers && data.composers) creatorsToFollow.push(...data.composers);

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
    const dateStr = String(group.releaseDateHeader || group.sortKey || "").toLowerCase();

    const matchesYear = (() => {
      if (filterYear === "ALL") return true;
      if (filterYear === "IN_DEV") {
        const header = String(group.releaseDateHeader || "").toLowerCase();
        const sort = String(group.sortKey || "").toLowerCase();
        
        const hasYear = /\b(19|20)\d{2}\b/.test(header);
        const isExplicitTbd = 
          header.includes("tbd") || 
          header.includes("tba") || 
          header.includes("dev") || 
          header.includes("unknown") || 
          sort.includes("9999");

        return isExplicitTbd || !hasYear;
      }
      return dateStr.includes(String(filterYear).toLowerCase());
    })();

    const matchesMonth = filterMonth === "ALL" || (() => {
      if (!dateStr) return false;
      const fM = filterMonth.toLowerCase();
      const mNames = ["january","february","march","april","may","june","july","august","september","october","november","december"];
      const mShort = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

      if (dateStr.includes(fM)) return true;

      const nameIdx = mNames.indexOf(fM);
      if (nameIdx !== -1) {
        const mNum = nameIdx + 1;
        const padded = String(mNum).padStart(2, "0");
        return dateStr.includes("-" + padded + "-") || dateStr.includes("-" + mNum + "-") || dateStr.includes(mShort[nameIdx]);
      }

      const parsedNum = parseInt(filterMonth, 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
        const padded = String(parsedNum).padStart(2, "0");
        return dateStr.includes("-" + padded + "-") || dateStr.includes(mNames[parsedNum - 1]) || dateStr.includes(mShort[parsedNum - 1]);
      }

      return false;
    })();

    if (!matchesYear || !matchesMonth) return false;
    if (!includeMovies && group.mediaType === 'movie') return false;
    if (!includeTV && group.mediaType === 'tv') return false;

    const details = detailsCache[group.tmdbId] || { genres: [] };
    const titleLower = group.projectTitle.toLowerCase();
    const isDoc =
      details.genres.some((g) => g.toLowerCase().includes('documentary')) ||
      titleLower.includes('docu') ||
      titleLower.includes('making of');

    if (!includeDocs && isDoc) return false;

    const matchesRole = group.creatives.some((c) => {
      const creativeObj = followed.find((f) => f.name.toLowerCase() === c.name.toLowerCase());
      const primaryDept = (creativeObj?.department || '').toLowerCase();
      const r = c.role.toLowerCase();

      const isDirecting = r.includes('director') || r.includes('directing');
      const isWriting = r.includes('writer') || r.includes('writing') || r.includes('screenplay');
      const isCinematography = r.includes('cinematograph') || r.includes('director of photography') || r.includes('camera');
      const isMusic = r.includes('composer') || r.includes('music') || r.includes('score');
      const isExecProducing = r.includes('executive producer');
      const isProducing = r.includes('producer') && !isExecProducing;
      const isActing = r.startsWith('cast') || r.includes('actor') || r.includes('starring') || r.includes('self');

      if (isActing && primaryDept.includes('directing') && !isDirecting) {
        return showDirecting && showActing;
      }

      if (showDirecting && isDirecting) return true;
      if (showWriting && isWriting) return true;
      if (showActing && isActing) return true;
      if (showCinematography && isCinematography) return true;
      if (showMusic && isMusic) return true;
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

  const renderCreativePhrase = (name: string, roles: string[], personId: number, department: string, order: string[]) => {
    roles.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    
    const nameButton = (
      <button
        key="name"
        type="button"
        onClick={() => openPersonModal({ id: personId, name, department })}
        className="text-[#79c0ff] hover:underline font-bold inline cursor-pointer"
      >
        {name}
      </button>
    );

    if (roles.length === 1) {
      if (roles[0] === 'Starring') return <span key={name}>Starring {nameButton}</span>;
      if (roles[0] === 'Cinematography') return <span key={name}>Cinematography by {nameButton}</span>;
      if (roles[0] === 'Music / Score') return <span key={name}>Music by {nameButton}</span>;
      return <span key={name}>{roles[0]} by {nameButton}</span>;
    } else if (roles.length === 2) {
      if (roles.includes('Starring')) {
        const nonStarring = roles.filter((r) => r !== 'Starring');
        return <span key={name}>{nonStarring[0]} by and Starring {nameButton}</span>;
      } else {
        return <span key={name}>{roles[0]} and {roles[1]} by {nameButton}</span>;
      }
    } else {
      const lastRole = roles[roles.length - 1];
      const initialRoles = roles.slice(0, roles.length - 1).join(', ');
      if (roles.includes('Starring') && lastRole === 'Starring') {
        return <span key={name}>{initialRoles}, and Starring {nameButton}</span>;
      } else {
        return <span key={name}>{initialRoles}, and {lastRole} by {nameButton}</span>;
      }
    }
  };

  const renderCreditsLineJSX = (creatives: Array<{ name: string; role: string; updateId: string }>) => {
    const creativeRoleMap = new Map<string, { roles: string[]; personId: number; department: string }>();

    creatives.forEach((c) => {
      let r = c.role.toLowerCase();
      let roleClean = c.role;

      if (r.includes('director') || r.includes('directing')) roleClean = 'Directed';
      else if (r.includes('writer') || r.includes('writing') || r.includes('screenplay')) roleClean = 'Written';
      else if (r.includes('cinematograph') || r.includes('director of photography')) roleClean = 'Cinematography';
      else if (r.includes('composer') || r.includes('music') || r.includes('score')) roleClean = 'Music / Score';
      else if (r.includes('executive producer')) roleClean = 'Executive Produced';
      else if (r.includes('producer')) roleClean = 'Produced';
      else if (r.startsWith('cast') || r.includes('actor')) roleClean = 'Starring';

      const personId = parseInt(c.updateId.split('-')[0], 10) || 0;
      const matchedFollowed = followed.find(f => f.name.toLowerCase() === c.name.toLowerCase());
      const department = matchedFollowed?.department || 'Creative';
      const resolvedId = matchedFollowed?.id || personId;

      if (!creativeRoleMap.has(c.name)) {
        creativeRoleMap.set(c.name, { roles: [], personId: resolvedId, department });
      }
      const existing = creativeRoleMap.get(c.name)!;
      if (!existing.roles.includes(roleClean)) {
        existing.roles.push(roleClean);
      }
    });

    const order = ['Directed', 'Written', 'Cinematography', 'Music / Score', 'Executive Produced', 'Produced', 'Starring'];
    const elements: React.ReactNode[] = [];

    let index = 0;
    creativeRoleMap.forEach(({ roles, personId, department }, name) => {
      if (index > 0) {
        elements.push(<span key={`sep-${index}`} className="text-[#8b949e]"> · </span>);
      }
      elements.push(renderCreativePhrase(name, roles, personId, department, order));
      index++;
    });

    return elements;
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-[#0e1117] text-[#c9d1d9] font-sans text-xs flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] p-6 space-y-4 rounded-lg">
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
                className="w-full bg-[#0d1117] border border-[#30363d] text-white px-2.5 py-1.5 focus:outline-none focus:border-[#58a6ff] text-xs rounded"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#8b949e] uppercase font-bold mb-1">Password</label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] text-white px-2.5 py-1.5 focus:outline-none focus:border-[#58a6ff] text-xs rounded"
              />
            </div>

            {authMessage && <div className="text-amber-400 text-[11px] font-bold">{authMessage}</div>}

            <button
              type="submit"
              className="w-full bg-[#1f6beb] hover:bg-[#388bfd] text-white font-semibold text-xs px-4 py-2 rounded transition-colors flex items-center justify-center h-[38px]"
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
    <main className="min-h-screen bg-[#0b0e14] text-[#c9d1d9] font-sans text-xs p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto space-y-5">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">MY FILM PEOPLE</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#161b22] border border-[#30363d] text-[#58a6ff] rounded font-bold">V5.46</span>
            </div>
            <p className="text-[#8b949e] text-xs mt-0.5">Track film industry creatives & upcoming releases</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={async () => {
                if (navigator.share) {
                  try { await navigator.share({ title: "My Film People", url: "https://myfilmpeople.app" }); } catch (e) {}
                } else {
                  await navigator.clipboard.writeText("https://myfilmpeople.app");
                  alert("Link copied!");
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-[#12171f] border border-[#30363d] hover:border-[#58a6ff] text-white rounded-md transition-all text-xs font-bold"
            >
              <svg className="w-4 h-4 text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span>SHARE</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAlertsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#12171f] border border-[#30363d] hover:border-[#d29922] text-[#e3b341] rounded-md transition-all text-xs font-bold"
            >
              <Mail className="w-4 h-4 text-[#e3b341]" />
              <span>ALERTS</span>
            </button>

            {lastImportBatchIds.length > 0 && (
              <button
                type="button"
                onClick={undoLastImport}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#12171f] border border-amber-500/30 hover:border-amber-400 text-amber-400 rounded-md transition-all text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>UNDO IMPORT ({lastImportBatchIds.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#12171f] border border-[#30363d] hover:border-[#8b949e] text-white rounded-md transition-all text-xs font-bold"
            >
              <span className="flex items-center gap-0.5">
                <span className="w-2 h-2 rounded-full bg-[#ff8000]"></span>
                <span className="w-2 h-2 rounded-full bg-[#00e054]"></span>
                <span className="w-2 h-2 rounded-full bg-[#40bcf4]"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider">IMPORT FROM LETTERBOXD</span>
            </button>
          </div>
        </header>

        {/* FIND YOUR FILM PEOPLE - Search Box */}
        <section className="bg-[#12171f] border border-[#21262d] rounded-md p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-white font-extrabold uppercase tracking-wide">FIND YOUR FILM PEOPLE</span>
            <span className="text-[#8b949e] text-xs font-normal">(Click on a person to view their upcoming projects)</span>
          </div>
          
          <form onSubmit={handleSearch} className="flex w-full items-stretch rounded-md overflow-hidden border border-[#30363d] bg-[#0b0e14]">
            <div className="flex items-center pl-3 pr-1 text-[#8b949e]">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search for an actor, director, writer, cinematographer, composer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent px-2 py-3 text-xs text-white focus:outline-none placeholder-[#8b949e]"
            />
            <button
              type="submit"
              className="px-8 bg-[#1f6beb] hover:bg-[#388bfd] text-white font-bold text-xs transition-colors flex items-center justify-center"
            >
              Search
            </button>
          </form>

          <p className="text-[#8b949e] text-xs">Follow people to build your personalized upcoming-project timeline.</p>

          {/* Search Results Display List */}
          {searchResults && searchResults.length > 0 && (
            <div className="mt-3 pt-2 border-t border-[#30363d] space-y-2 max-h-64 overflow-y-auto divide-y divide-[#30363d]/50">
              {searchResults.map((person) => {
                const isFollowed = followed.some((f) => f.id === person.id);
                return (
                  <div key={person.id} className="pt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {person.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w45${person.profile_path}`}
                          alt={person.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#30363d]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-[10px] text-white font-bold">
                          {person.name?.[0]}
                        </div>
                      )}
                      <div>
                        <button 
                          type="button" 
                          onClick={() => openPersonModal({ id: person.id, name: person.name, department: person.known_for_department || "Creative" })} 
                          className="font-bold text-white hover:text-[#58a6ff] hover:underline text-left cursor-pointer"
                        >
                          {person.name}
                        </button>
                        <div className="text-[10px] text-[#8b949e]">
                          {person.known_for_department || person.department || "Creative"}
                        </div>
                      </div>
                    </div>
                    {isFollowed ? (
                      <button
                        type="button"
                        onClick={() => unfollowPerson(person.id)}
                        className="px-2 py-1 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-[10px] font-bold rounded"
                      >
                        Unfollow
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => followPerson(person)}
                        className="px-2 py-1 bg-[#21262d] border border-[#30363d] hover:bg-[#30363d] text-white text-[10px] font-bold rounded flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Follow
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex bg-[#12171f] border border-[#30363d] p-1 rounded-lg my-2">
          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === "feed" ? "bg-[#21262d] text-white border border-[#30363d]" : "text-[#8b949e] hover:text-white"}`}
          >
            Timeline Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("people")}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === "people" ? "bg-[#21262d] text-white border border-[#30363d]" : "text-[#8b949e] hover:text-white"}`}
          >
            People You Follow
          </button>
        </div>

        {/* FILTER YOUR TIMELINE - Filters Box */}
        <section className="bg-[#12171f] border border-[#21262d] rounded-md p-4 space-y-4">
          <h2 className="text-white font-extrabold uppercase tracking-wide text-xs">FILTER YOUR TIMELINE</h2>
          
          {/* ROLE Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-[#8b949e] font-extrabold text-[11px] tracking-wider uppercase min-w-[70px]">ROLE</span>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setShowDirecting(!showDirecting)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showDirecting ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showDirecting ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showDirecting && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Directing</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWriting(!showWriting)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showWriting ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showWriting ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showWriting && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Writing</span>
              </button>

              <button
                type="button"
                onClick={() => setShowActing(!showActing)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showActing ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showActing ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showActing && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Acting</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCinematography(!showCinematography)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showCinematography ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showCinematography ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showCinematography && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Cinematography</span>
              </button>

              <button
                type="button"
                onClick={() => setShowMusic(!showMusic)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showMusic ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showMusic ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showMusic && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Music / Score</span>
              </button>

              <button
                type="button"
                onClick={() => setShowProducing(!showProducing)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showProducing ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showProducing ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showProducing && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Producing</span>
              </button>

              <button
                type="button"
                onClick={() => setShowExecProducing(!showExecProducing)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  showExecProducing ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${showExecProducing ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {showExecProducing && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Exec Producing</span>
              </button>
            </div>
          </div>

          {/* MEDIUM Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <span className="text-[#8b949e] font-extrabold text-[11px] tracking-wider uppercase min-w-[70px]">MEDIUM</span>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setIncludeMovies(!includeMovies)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  includeMovies ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${includeMovies ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {includeMovies && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Movies</span>
              </button>

              <button
                type="button"
                onClick={() => setIncludeTV(!includeTV)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  includeTV ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${includeTV ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {includeTV && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>TV Shows</span>
              </button>

              <button
                type="button"
                onClick={() => setIncludeDocs(!includeDocs)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  includeDocs ? 'bg-[#0b0e14] border-[#1f6beb] text-white' : 'bg-[#0b0e14] border-[#30363d] text-[#8b949e] hover:text-white'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center ${includeDocs ? 'bg-[#1f6beb] text-white' : 'border border-[#30363d]'}`}>
                  {includeDocs && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>Docs</span>
              </button>
            </div>
          </div>
        </section>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          
          {/* LEFT SIDEBAR: People You Follow */}
          <aside className={`bg-[#12171f] border border-[#21262d] rounded-md p-3.5 space-y-2 ${activeTab === "feed" ? "hidden md:block" : "block"}`}>
            <div className="border-b border-[#21262d] pb-2 flex justify-between items-center">
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

            <ul className="divide-y divide-[#21262d]/50 max-h-[600px] overflow-y-auto">
              {followed.map((person) => (
                <li key={person.id} className="py-2 flex justify-between items-center group px-1">
                  <div
                    onClick={() => openPersonModal(person)}
                    className="cursor-pointer group-hover:text-[#58a6ff]"
                  >
                    <div className="font-bold text-[#58a6ff] flex items-center gap-1.5 text-xs">
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
          </aside>

          {/* RIGHT MAIN AREA: Upcoming Projects Timeline */}
          <main className={`md:col-span-2 ${activeTab === "people" ? "hidden md:block" : "block"}`}>
            <div className="w-full bg-[#12171f] border border-[#21262d] rounded-md">
              <div className="bg-[#1c222d] px-3.5 py-2.5 text-white font-bold text-xs tracking-wide flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#21262d]">
                <div className="flex items-center gap-2">
                  <span>Upcoming Projects Timeline</span>
                  <span className="text-xs text-[#8b949e] font-normal">({sortedGroupedUpdates.length} projects)</span>
                </div>
              
                <div className="flex items-center gap-2">
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="bg-[#0b0e14] border border-[#30363d] text-white text-[11px] rounded px-2 py-1 outline-none focus:border-[#58a6ff]"
                  >
                    <option value="ALL">All Months</option>
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="bg-[#0b0e14] border border-[#30363d] text-white text-[11px] rounded px-2 py-1 outline-none focus:border-[#58a6ff]"
                  >
                    <option value="ALL">All Years</option>
                    <option value="IN_DEV">In Development / TBD</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                  </select>
                </div>
              </div>

              <div className="p-4 space-y-6">
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

                    const formattedCreditsJSX = renderCreditsLineJSX(item.creatives);
                    const details = detailsCache[item.tmdbId] || { genres: [], topCast: [] };
                    const isBellActive = activeReminders.includes(item.tmdbId);

                    return (
                      <div key={`${item.tmdbId}-${idx}`} className="space-y-3 group">
                        {showDateHeader && (
                          <div className="pt-2">
                            <div className="text-right text-white font-bold text-xs tracking-wide uppercase">
                              {item.releaseDateHeader}
                            </div>
                            <div className="border-b border-[#1f6beb]/40 mt-1" />
                          </div>
                        )}

                        <div className="leading-relaxed py-1 flex justify-between items-start">
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                              <div>
                                <a
                                  href={`https://www.themoviedb.org/${item.mediaType}/${item.tmdbId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-extrabold text-[#79c0ff] hover:text-[#a5d6ff] hover:underline text-base sm:text-lg block leading-snug"
                                >
                                  {item.projectTitle}
                                </a>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-semibold text-white/90 bg-[#161b22] border border-[#30363d] px-2 py-0.5 rounded-md">
                                    {formattedCreditsJSX}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#8b949e]">
                                    MATCHED
                                  </span>
                                </div>
                              </div>
                            </div>

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
          </main>
        </div>
      </div>

      {/* Email Alerts Preferences Modal */}
      {isAlertsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#12171f] border border-[#30363d] w-full max-w-md p-5 space-y-4 relative rounded-lg">
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
                Choose how often you want email digests detailing new TMDB updates for people you follow:
              </p>

              <div className="space-y-2 pt-1">
                {(['daily', 'weekly', 'monthly', 'none'] as const).map((freq) => (
                  <label
                    key={freq}
                    className={`flex items-center justify-between p-2 border cursor-pointer font-bold capitalize text-xs rounded ${
                      emailFrequency === freq
                        ? 'border-[#58a6ff] bg-[#1c222d] text-white'
                        : 'border-[#30363d] bg-[#0b0e14] text-[#8b949e] hover:text-white'
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
            </div>
          </div>
        </div>
      )}

      {/* Single Person Dedicated View Modal */}
      {selectedPersonModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#12171f] border border-[#30363d] w-full max-w-xl p-5 space-y-4 relative rounded-lg">
            <button
              onClick={() => setSelectedPersonModal(null)}
              className="absolute top-3 right-3 text-[#8b949e] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-[#30363d] pb-2 flex justify-between items-center pr-6">
              <div>
                <h2 className="text-base font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <span className="text-[#58a6ff]">{selectedPersonModal.name}</span>
                  <span className="text-xs text-[#8b949e] font-normal">({selectedPersonModal.department})</span>
                </h2>
                <p className="text-[11px] text-[#8b949e] mt-0.5">All upcoming & logged projects for this creator</p>
              </div>

              {!followed.some((f) => f.id === selectedPersonModal.id) && (
                <button
                  type="button"
                  onClick={() => followPerson(selectedPersonModal)}
                  className="px-2.5 py-1 bg-[#1f6beb] hover:bg-[#388bfd] text-white text-[10px] font-bold rounded flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Follow
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-[#30363d]/50 pr-1 space-y-3 min-h-[120px] flex flex-col justify-center">
              {isModalLoading ? (
                <div className="py-8 text-center text-[#8b949e] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#58a6ff]" />
                  <span>Fetching upcoming projects...</span>
                </div>
              ) : modalProjects.length === 0 ? (
                <div className="py-8 text-center text-[#8b949e]">
                  No logged projects found for {selectedPersonModal.name}.
                </div>
              ) : (
                modalProjects.map((proj, idx) => (
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
          <div className="bg-[#12171f] border border-[#30363d] w-full max-w-md p-5 space-y-4 relative rounded-lg">
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
                  className="w-full bg-[#0b0e14] border border-[#30363d] text-white px-2 py-1 text-xs rounded"
                >
                  <option value={5.0}>5 Stars Only</option>
                  <option value={4.5}>4.5 Stars & Above</option>
                  <option value={4.0}>4.0 Stars & Above</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] text-[#8b949e] uppercase font-bold">Auto-Follow</label>
                <div className="grid grid-cols-2 gap-1.5">
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
                      checked={importCast}
                      onChange={(e) => setImportCast(e.target.checked)}
                      className="accent-[#58a6ff]"
                    />
                    Lead Actors / Cast
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
                      checked={importCinematographers}
                      onChange={(e) => setImportCinematographers(e.target.checked)}
                      className="accent-[#58a6ff]"
                    />
                    Cinematographers
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#c9d1d9] cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={importComposers}
                      onChange={(e) => setImportComposers(e.target.checked)}
                      className="accent-[#58a6ff]"
                    />
                    Composers / Music
                  </label>
                </div>
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

              {/* Instructions Box */}
              <div className="pt-2 border-t border-[#30363d]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#8b949e] uppercase font-bold">How to export your ratings.csv:</span>
                  <div className="flex bg-[#0b0e14] p-0.5 rounded border border-[#30363d]">
                    <button
                      type="button"
                      onClick={() => setImportInstructionsTab('computer')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 transition-colors ${
                        importInstructionsTab === 'computer' ? 'bg-[#1f6beb] text-white' : 'text-[#8b949e] hover:text-white'
                      }`}
                    >
                      <Monitor className="w-3 h-3" /> Computer
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportInstructionsTab('phone')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 transition-colors ${
                        importInstructionsTab === 'phone' ? 'bg-[#1f6beb] text-white' : 'text-[#8b949e] hover:text-white'
                      }`}
                    >
                      <Smartphone className="w-3 h-3" /> Phone
                    </button>
                  </div>
                </div>

                <div className="bg-[#0b0e14] border border-[#30363d] rounded p-3 text-[11px] text-[#c9d1d9]">
                  {importInstructionsTab === 'computer' ? (
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Log into <strong className="text-white">Letterboxd</strong>, click your profile name at the top right, and go to <strong className="text-white">Settings</strong>.</li>
                      <li>Click the <strong className="text-white">Data</strong> tab on the far right.</li>
                      <li>Click <strong className="text-[#58a6ff]">Export Your Data</strong> to download your zip folder.</li>
                      <li>Unzip the folder and select <strong className="text-[#58a6ff]">ratings.csv</strong> below.</li>
                    </ol>
                  ) : (
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>In your phone browser, open <a href="https://letterboxd.com/user/exportdata" target="_blank" rel="noreferrer" className="text-[#58a6ff] underline font-bold">letterboxd.com/user/exportdata</a> and log in.</li>
                      <li>Save the downloaded zip file to your phone's <strong className="text-white">Files</strong> app.</li>
                      <li>Open Files, tap the zip file to extract it, then press & hold <strong className="text-[#58a6ff]">ratings.csv</strong> and tap <strong className="text-white">Keep Downloaded</strong>.</li>
                      <li>Return here, tap <strong className="text-white">Choose File</strong> below, and select <strong className="text-[#58a6ff]">ratings.csv</strong> from Recents.</li>
                    </ol>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <input
                  type="file"
                  accept=".csv"
                  disabled={isImporting}
                  onChange={handleFileUpload}
                  className="w-full text-xs text-[#8b949e] file:bg-[#1c222d] file:border file:border-[#30363d] file:text-white file:px-3 file:py-1 file:mr-3 file:font-bold file:rounded cursor-pointer"
                />
              </div>

              {importProgress && (
                <div className="p-2 bg-[#0b0e14] border border-[#30363d] text-[#58a6ff] text-[11px] font-mono rounded">
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
