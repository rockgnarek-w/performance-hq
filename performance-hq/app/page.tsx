'use client';

import { useState, useEffect } from 'react';
import { supabase, Entry, Offer } from '@/lib/supabase';
import AddEntryForm from '@/components/AddEntryForm';
import EntriesList from '@/components/EntriesList';
import MonthlyView from '@/components/MonthlyView';
import ByGeoView from '@/components/ByGeoView';

type View = 'add' | 'monthly' | 'by-geo';

export default function Home() {
  const [view, setView] = useState<View>('add');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: entriesData } = await supabase
      .from('entries')
      .select('*, offers(*)')
      .order('date', { ascending: false })
      .limit(200);

    const { data: offersData } = await supabase
      .from('offers')
      .select('*')
      .eq('active', true)
      .order('country_name');

    setEntries(entriesData || []);
    setOffers(offersData || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brand">● PERFORMANCE HQ</div>
          <h1 className="title">Media Buyer Dashboard</h1>
        </div>
        <div className="nav">
          <button
            className={`nav-btn ${view === 'add' ? 'active' : ''}`}
            onClick={() => setView('add')}
          >
            + Add
          </button>
          <button
            className={`nav-btn ${view === 'monthly' ? 'active' : ''}`}
            onClick={() => setView('monthly')}
          >
            Monthly
          </button>
          <button
            className={`nav-btn ${view === 'by-geo' ? 'active' : ''}`}
            onClick={() => setView('by-geo')}
          >
            By Geo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p className="muted">Loading data...</p>
        </div>
      ) : (
        <>
          {view === 'add' && (
            <>
              <AddEntryForm offers={offers} onAdded={loadData} />
              <EntriesList entries={entries} onChanged={loadData} />
            </>
          )}
          {view === 'monthly' && <MonthlyView entries={entries} />}
          {view === 'by-geo' && <ByGeoView entries={entries} />}
        </>
      )}
    </div>
  );
}
