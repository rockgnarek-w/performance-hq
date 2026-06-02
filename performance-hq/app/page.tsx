'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Entry, Offer, DailyResult } from '@/lib/supabase';
import AddEntryForm from '@/components/AddEntryForm';
import EntriesList from '@/components/EntriesList';
import MonthlyView from '@/components/MonthlyView';
import ByGeoView from '@/components/ByGeoView';
import DailyView from '@/components/DailyView';
import AccountsView from '@/components/AccountsView';
import OffersView from '@/components/OffersView';
import CreativesView from '@/components/CreativesView';

type View = 'add' | 'daily' | 'monthly' | 'by-geo' | 'accounts' | 'offers' | 'creatives';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>('daily');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dailyResults, setDailyResults] = useState<DailyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || null);
      setAuthChecking(false);
      loadData();
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const loadData = async () => {
    setLoading(true);
    const { data: entriesData } = await supabase
      .from('entries')
      .select('*, offers(*)')
      .order('date', { ascending: false })
      .limit(2000);

    const { data: offersData } = await supabase
      .from('offers')
      .select('*')
      .eq('active', true)
      .order('country_name');

    const { data: resultsData } = await supabase
      .from('daily_results')
      .select('*, offers(*)')
      .order('date', { ascending: false })
      .limit(2000);

    setEntries(entriesData || []);
    setOffers(offersData || []);
    setDailyResults(resultsData || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    if (!confirm('Sign out?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted">Authenticating...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brand">● PERFORMANCE HQ</div>
          <h1 className="title">Media Buyer Dashboard</h1>
          {userEmail && (
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
              {userEmail} · <a onClick={handleLogout} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Sign out</a>
            </div>
          )}
        </div>
        <div className="nav">
          <button className={`nav-btn ${view === 'daily' ? 'active' : ''}`} onClick={() => setView('daily')}>Daily</button>
          <button className={`nav-btn ${view === 'monthly' ? 'active' : ''}`} onClick={() => setView('monthly')}>Monthly</button>
          <button className={`nav-btn ${view === 'by-geo' ? 'active' : ''}`} onClick={() => setView('by-geo')}>By Geo</button>
          <button className={`nav-btn ${view === 'creatives' ? 'active' : ''}`} onClick={() => setView('creatives')}>Creatives</button>
          <button className={`nav-btn ${view === 'accounts' ? 'active' : ''}`} onClick={() => setView('accounts')}>Accounts</button>
          <button className={`nav-btn ${view === 'offers' ? 'active' : ''}`} onClick={() => setView('offers')}>Offers</button>
          <button className={`nav-btn ${view === 'add' ? 'active' : ''}`} onClick={() => setView('add')}>+ Add</button>
        </div>
      </div>

      {loading && view !== 'accounts' && view !== 'offers' && view !== 'creatives' ? (
        <div className="card">
          <p className="muted">Loading data...</p>
        </div>
      ) : (
        <>
        {view === 'daily' && <DailyView entries={entries} offers={offers} />}
{view === 'monthly' && <MonthlyView entries={entries} offers={offers} dailyResults={dailyResults} />}
{view === 'by-geo' && <ByGeoView entries={entries} offers={offers} dailyResults={dailyResults} />}
{view === 'creatives' && <CreativesView offers={offers} entries={entries} />}
{view === 'accounts' && <AccountsView />}
{view === 'offers' && <OffersView />}
{view === 'add' && (
            <>
              <AddEntryForm offers={offers} onAdded={loadData} />
              <EntriesList entries={entries} onChanged={loadData} />
            </>
          )}
        </>
      )}
    </div>
  );
}
