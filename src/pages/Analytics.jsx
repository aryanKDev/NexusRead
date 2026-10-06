import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { motion } from 'framer-motion';
import { BookOpen, Clock, TrendingUp, Star, Zap, Target, Calendar, Award } from 'lucide-react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const GENRE_COLORS = ['#7c3aed','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1','#14b8a6'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 rounded-xl border border-white/10 shadow-2xl text-sm">
      {label && <p className="text-slate-400 text-xs mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color || '#a78bfa' }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor = 'text-violet-400', iconBg = 'bg-violet-500/20', children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// Hour × Day of week heatmap
function TimeHeatmap({ data = [] }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const maxVal = Math.max(...data.map(d => d.count || 0), 1);

  const getCell = (day, hour) => {
    const item = data.find(d => d.day === day && d.hour === hour);
    return item?.count || 0;
  };

  const opacity = (val) => Math.max(0.05, val / maxVal);

  return (
    <div>
      <div className="flex gap-0.5 mb-1 ml-8">
        {hours.filter(h => h % 4 === 0).map(h => (
          <div key={h} className="flex-1 text-center text-xs text-slate-600">
            {h === 0 ? '12a' : h === 12 ? '12p' : h > 12 ? `${h-12}p` : `${h}a`}
          </div>
        ))}
      </div>
      {days.map(day => (
        <div key={day} className="flex items-center gap-0.5 mb-0.5">
          <span className="text-xs text-slate-600 w-8">{day}</span>
          <div className="flex flex-1 gap-0.5">
            {hours.map(h => {
              const val = getCell(day, h);
              return (
                <div
                  key={h}
                  title={val ? `${val} pages at ${h}:00 on ${day}` : ''}
                  className="flex-1 h-4 rounded-sm transition-all hover:scale-110 cursor-default"
                  style={{
                    background: val > 0
                      ? `rgba(124,58,237,${opacity(val)})`
                      : 'rgba(255,255,255,0.03)',
                    border: val > 0 ? `1px solid rgba(124,58,237,${opacity(val) * 0.5})` : '1px solid rgba(255,255,255,0.03)',
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2 ml-8">
        <span className="text-xs text-slate-600">Less</span>
        {[0.05, 0.2, 0.4, 0.6, 0.9].map(o => (
          <div key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(124,58,237,${o})` }} />
        ))}
        <span className="text-xs text-slate-600">More</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(null);
  const [activity, setActivity] = useState({ monthlyActivity: [], dailyActivity: [], hourlyActivity: [] });
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reader/dashboard/stats'),
      api.get('/reader/dashboard/streak'),
      api.get('/reader/dashboard/activity'),
      api.get('/books'),
    ]).then(([statsRes, streakRes, actRes, booksRes]) => {
      setStats(statsRes.data?.data || {});
      setStreak(streakRes.data?.data || {});
      setActivity(actRes.data?.data || { monthlyActivity: [], dailyActivity: [], hourlyActivity: [] });
      setBooks(booksRes.data?.data?.books || booksRes.data?.data || []);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  // Reading DNA radar data — uses correct field names from backend
  const dnaData = useMemo(() => {
    const bookList = Array.isArray(books) ? books : [];
    const completed = bookList.filter(b => b.status === 'completed').length;
    const wishlist  = bookList.filter(b => b.status === 'wishlist').length;
    const avgRating = stats?.averageRating || 4.0;
    const currentStreak = streak?.current || 0;
    return [
      { subject: 'Consistency', A: Math.min(100, (currentStreak / 30) * 100) },
      { subject: 'Variety',    A: Math.min(100, (new Set(bookList.flatMap(b => b.genre || [])).size / 8) * 100) },
      { subject: 'Completion', A: bookList.length > 0 ? Math.round((completed / bookList.length) * 100) : 0 },
      { subject: 'Ambition',   A: Math.min(100, (wishlist / 5) * 100) },
      { subject: 'Rating',     A: Math.round((avgRating / 5) * 100) },
    ];
  }, [books, stats, streak]);

  // Genre distribution
  const genreData = useMemo(() => {
    const bookList = Array.isArray(books) ? books : [];
    const map = {};
    bookList.forEach(b => (b.genre || []).forEach(g => { map[g] = (map[g] || 0) + 1; }));
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,value]) => ({ name, value }));
  }, [books]);

  // Monthly pages — backend uses pagesRead field inside monthlyActivity
  const monthlyData = useMemo(() => {
    if (!Array.isArray(activity.monthlyActivity)) return [];
    return activity.monthlyActivity.map(item => ({
      month: MONTH_ABBR[((item.month ?? item._id?.month ?? 1) - 1)],
      pages: item.pagesRead || item.pages || 0,
    }));
  }, [activity]);

  // Time-of-day heatmap — uses REAL hourlyActivity from the backend.
  // Backend: getActivity() aggregates ReadingSession + UploadedBookReadingSession
  // using MongoDB $dayOfWeek and $hour operators on the stored session date timestamps.
  // count = cumulative minutes read in that day×hour bucket over the past year (UTC timezone).
  // Empty array → empty heatmap (correct for new users with no sessions).
  // No synthetic or fabricated data.
  const timeData = useMemo(() => {
    const hourly = Array.isArray(activity.hourlyActivity) ? activity.hourlyActivity : [];
    return hourly.filter(d => d.count > 0);
  }, [activity]);

  if (loading) return (
    <div className="min-h-screen bg-nx-gradient flex items-center justify-center">
      <div className="animate-spin w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-nx-gradient">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-500/20">
              <TrendingUp className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-extrabold gradient-text">Reading Analytics</h1>
          </div>
          <p className="text-slate-500 text-sm ml-10">Your deep reading intelligence dashboard</p>
        </motion.div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Books Read',    value: stats?.totalBooksRead || 0,         icon: BookOpen,   color: '#7c3aed', sub: 'all time' },
            { label: 'Pages Read',    value: stats?.pagesRead || 0,              icon: TrendingUp, color: '#06b6d4', sub: 'all time' },
            { label: 'Reading Streak',value: `${streak?.current || 0}d`,          icon: Zap,        color: '#f59e0b', sub: 'current', noN: true },
            { label: 'Avg Rating',    value: `${(stats?.averageRating||0).toFixed(1)}★`, icon: Star, color: '#10b981', sub: 'your books', noN: true },
          ].map(({ label, value, icon: Icon, color, sub, noN }) => (
            <motion.div key={label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-4 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-15 blur-xl" style={{ background: color }} />
              <div className="p-2 rounded-xl w-fit mb-3" style={{ background: `${color}20` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div className="text-2xl font-extrabold text-white">{value}</div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">{label}</div>
              <div className="text-xs text-slate-600">{sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Reading DNA radar */}
          <SectionCard title="Reading DNA" icon={Zap} iconBg="bg-violet-500/20">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={dnaData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <defs>
                  <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <Radar name="Score" dataKey="A" stroke="#7c3aed" fill="url(#radarGrad)" strokeWidth={2} dot={{ fill: '#a78bfa', strokeWidth: 0, r: 4 }} />
              </RadarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Genre distribution */}
          <SectionCard title="Genre Mix" icon={BookOpen} iconBg="bg-cyan-500/20" iconColor="text-cyan-400">
            {genreData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Add books to see your genre mix</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={genreData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90} paddingAngle={3}
                    label={({ name, percent }) => percent > 0.08 ? `${name} ${(percent*100).toFixed(0)}%` : ''}
                    labelLine={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                  >
                    {genreData.map((_, i) => (
                      <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Monthly pages trend */}
          <SectionCard title="Monthly Trend" icon={Calendar} iconBg="bg-amber-500/20" iconColor="text-amber-400">
            {monthlyData.length === 0 || monthlyData.every(d => d.pages === 0) ? (
              <div className="h-48 flex items-center justify-center text-slate-600 text-sm">No monthly data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="pages" stroke="#f59e0b" strokeWidth={2.5}
                    fill="url(#amberGrad)" dot={false}
                    activeDot={{ r: 5, fill: '#fbbf24', stroke: '#f59e0b', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        {/* Time-of-day heatmap (full width) */}
        <SectionCard title="Reading Time Patterns" icon={Clock} iconBg="bg-emerald-500/20" iconColor="text-emerald-400">
          <p className="text-xs text-slate-500 mb-4">When you read throughout the week (darker = more pages)</p>
          <TimeHeatmap data={timeData} />
        </SectionCard>
      </div>
    </div>
  );
}
