import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import type { KesimAlani } from "@/lib/types";
import { fetchKesimAlani, fetchKesimAlaniTrackingNotes } from "@/lib/api";
import type { TrackingNote } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/formatting";

interface HourBucket {
  hour: string;
  count: number;
}

interface TeamStat {
  name: string;
  color: string;
  total: number;
  completed: number;
}

export default function KesimRaporPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [kesim, setKesim] = useState<KesimAlani | null>(null);
  const [notes, setNotes] = useState<TrackingNote[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!params.id) return;
      const data = await fetchKesimAlani(params.id);
      if (data) {
        setKesim(data);
        try {
          const n = await fetchKesimAlaniTrackingNotes(params.id);
          setNotes(n);
        } catch {}
      } else {
        setLocation("/");
      }
    }
    loadData();
  }, [params.id, setLocation]);

  const stats = useMemo(() => {
    if (!kesim) return null;

    const groups = kesim.animalGroups;
    const totalGroups = groups.length;
    const completed = groups.filter((g) => g.kesildi).length;
    const remaining = totalGroups - completed;
    const percentage = totalGroups > 0 ? Math.round((completed / totalGroups) * 100) : 0;

    const totalDonors = groups.reduce((sum, g) => sum + g.donations.length, 0);
    const filledDonors = groups.reduce(
      (sum, g) => sum + g.donations.filter((d) => d.name.trim()).length,
      0
    );

    const kesildiTimes = groups
      .filter((g) => g.kesildi && g.kesildiAt)
      .map((g) => new Date(g.kesildiAt!))
      .sort((a, b) => a.getTime() - b.getTime());

    const firstKesildi = kesildiTimes.length > 0 ? kesildiTimes[0] : null;
    const lastKesildi = kesildiTimes.length > 0 ? kesildiTimes[kesildiTimes.length - 1] : null;

    const hourBuckets: HourBucket[] = [];
    if (kesildiTimes.length > 0) {
      const bucketMap = new Map<string, number>();
      for (const t of kesildiTimes) {
        const h = t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }).replace(/:\d{2}$/, ":00");
        const hourKey = `${String(t.getHours()).padStart(2, "0")}:00`;
        bucketMap.set(hourKey, (bucketMap.get(hourKey) || 0) + 1);
      }
      const sortedKeys = [...bucketMap.keys()].sort();
      for (const key of sortedKeys) {
        hourBuckets.push({ hour: key, count: bucketMap.get(key)! });
      }
    }

    const teamStats: TeamStat[] = [];
    if (kesim.teams && kesim.teams.length > 0) {
      for (const team of kesim.teams) {
        const teamGroups = groups.filter((g) => g.teamId === team.id);
        teamStats.push({
          name: team.name,
          color: team.color,
          total: teamGroups.length,
          completed: teamGroups.filter((g) => g.kesildi).length,
        });
      }
      const unassigned = groups.filter((g) => !g.teamId);
      if (unassigned.length > 0) {
        teamStats.push({
          name: "Atanmamış",
          color: "#9ca3af",
          total: unassigned.length,
          completed: unassigned.filter((g) => g.kesildi).length,
        });
      }
    }

    const donationTypes = new Map<string, number>();
    for (const g of groups) {
      for (const d of g.donations) {
        if (d.donationType && d.donationType.trim()) {
          const key = d.donationType.trim();
          donationTypes.set(key, (donationTypes.get(key) || 0) + 1);
        }
      }
    }

    return {
      totalGroups,
      completed,
      remaining,
      percentage,
      totalDonors,
      filledDonors,
      firstKesildi,
      lastKesildi,
      hourBuckets,
      teamStats,
      donationTypes,
    };
  }, [kesim]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => n.type === "note").slice(0, 50);
  }, [notes]);

  const editRequests = useMemo(() => {
    return notes.filter((n) => n.type === "edit_request");
  }, [notes]);

  if (!kesim || !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxBucket = Math.max(...stats.hourBuckets.map((b) => b.count), 1);

  return (
    <div className="min-h-screen bg-background">
      <div className="no-print sticky top-0 z-10 bg-background border-b px-4 py-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/kesim/${params.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Geri
        </Button>
        <span className="font-semibold flex-1">Kesim Raporu</span>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="w-4 h-4 mr-1" /> PDF İndir
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Yazdır
        </Button>
      </div>

      <div className="rapor-container">
        <div className="rapor-page">
          <div className="rapor-header">
            <h1 className="rapor-title">{kesim.name}</h1>
            <p className="rapor-subtitle">Kesim Raporu</p>
            <p className="rapor-date">{formatDate(new Date().toISOString())}</p>
          </div>

          <div className="rapor-section">
            <h2 className="rapor-section-title">Genel Özet</h2>
            <div className="rapor-stats-grid">
              <div className="rapor-stat-card">
                <div className="rapor-stat-value">{stats.totalGroups}</div>
                <div className="rapor-stat-label">Toplam Hayvan</div>
              </div>
              <div className="rapor-stat-card rapor-stat-success">
                <div className="rapor-stat-value">{stats.completed}</div>
                <div className="rapor-stat-label">Kesildi</div>
              </div>
              <div className="rapor-stat-card rapor-stat-warning">
                <div className="rapor-stat-value">{stats.remaining}</div>
                <div className="rapor-stat-label">Kalan</div>
              </div>
              <div className="rapor-stat-card rapor-stat-info">
                <div className="rapor-stat-value">%{stats.percentage}</div>
                <div className="rapor-stat-label">Tamamlanma</div>
              </div>
            </div>

            <div className="rapor-progress-bar-container">
              <div className="rapor-progress-bar">
                <div
                  className="rapor-progress-fill"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
              <span className="rapor-progress-text">
                {stats.completed} / {stats.totalGroups} hayvan kesildi
              </span>
            </div>
          </div>

          <div className="rapor-section">
            <h2 className="rapor-section-title">Bağışçı Bilgileri</h2>
            <table className="rapor-table">
              <tbody>
                <tr>
                  <td className="rapor-table-label">Toplam Hisse Yeri</td>
                  <td className="rapor-table-value">{stats.totalDonors}</td>
                </tr>
                <tr>
                  <td className="rapor-table-label">Dolu Hisse</td>
                  <td className="rapor-table-value">{stats.filledDonors}</td>
                </tr>
                <tr>
                  <td className="rapor-table-label">Boş Hisse</td>
                  <td className="rapor-table-value">{stats.totalDonors - stats.filledDonors}</td>
                </tr>
              </tbody>
            </table>

            {stats.donationTypes.size > 0 && (
              <>
                <h3 className="rapor-subsection-title">Cinslere Göre Dağılım</h3>
                <table className="rapor-table">
                  <thead>
                    <tr>
                      <th className="rapor-table-header">Cinsi</th>
                      <th className="rapor-table-header rapor-table-right">Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...stats.donationTypes.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <tr key={type}>
                          <td className="rapor-table-label">{type}</td>
                          <td className="rapor-table-value">{count}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {stats.hourBuckets.length > 0 && (
            <div className="rapor-section">
              <h2 className="rapor-section-title">Zaman Çizelgesi</h2>
              {stats.firstKesildi && stats.lastKesildi && (
                <div className="rapor-time-range">
                  <span>İlk kesim: <strong>{formatTime(stats.firstKesildi.toISOString())}</strong></span>
                  <span>Son kesim: <strong>{formatTime(stats.lastKesildi.toISOString())}</strong></span>
                </div>
              )}
              <div className="rapor-timeline">
                {stats.hourBuckets.map((bucket) => (
                  <div key={bucket.hour} className="rapor-timeline-item">
                    <div className="rapor-timeline-bar-container">
                      <div
                        className="rapor-timeline-bar"
                        style={{ height: `${(bucket.count / maxBucket) * 100}%` }}
                      />
                    </div>
                    <div className="rapor-timeline-count">{bucket.count}</div>
                    <div className="rapor-timeline-label">{bucket.hour}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.teamStats.length > 0 && (
            <div className="rapor-section">
              <h2 className="rapor-section-title">Ekip Bazlı Dağılım</h2>
              <table className="rapor-table">
                <thead>
                  <tr>
                    <th className="rapor-table-header">Ekip</th>
                    <th className="rapor-table-header rapor-table-right">Toplam</th>
                    <th className="rapor-table-header rapor-table-right">Kesildi</th>
                    <th className="rapor-table-header rapor-table-right">Kalan</th>
                    <th className="rapor-table-header rapor-table-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.teamStats.map((team) => (
                    <tr key={team.name}>
                      <td className="rapor-table-label">
                        <span className="rapor-team-dot" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </td>
                      <td className="rapor-table-value">{team.total}</td>
                      <td className="rapor-table-value">{team.completed}</td>
                      <td className="rapor-table-value">{team.total - team.completed}</td>
                      <td className="rapor-table-value">
                        %{team.total > 0 ? Math.round((team.completed / team.total) * 100) : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(filteredNotes.length > 0 || editRequests.length > 0) && (
            <div className="rapor-section rapor-section-break-before">
              <h2 className="rapor-section-title">Notlar ve Talepler</h2>

              {editRequests.length > 0 && (
                <>
                  <h3 className="rapor-subsection-title">
                    Düzenleme Talepleri ({editRequests.length})
                  </h3>
                  <table className="rapor-table rapor-table-compact">
                    <thead>
                      <tr>
                        <th className="rapor-table-header">Tarih</th>
                        <th className="rapor-table-header">Alan</th>
                        <th className="rapor-table-header">Eski</th>
                        <th className="rapor-table-header">Yeni</th>
                        <th className="rapor-table-header">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editRequests.slice(0, 30).map((note) => (
                        <tr key={note.id}>
                          <td className="rapor-table-label">{formatTime(note.createdAt)}</td>
                          <td className="rapor-table-label">{note.fieldName || ""}</td>
                          <td className="rapor-table-label rapor-text-strike">{note.oldValue || "—"}</td>
                          <td className="rapor-table-value">{note.newValue || ""}</td>
                          <td className="rapor-table-label">
                            <span className={`rapor-status rapor-status-${note.status}`}>
                              {note.status === "approved" ? "Onay" : note.status === "rejected" ? "Red" : "Bekliyor"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {filteredNotes.length > 0 && (
                <>
                  <h3 className="rapor-subsection-title">Notlar ({filteredNotes.length})</h3>
                  <div className="rapor-notes-list">
                    {filteredNotes.map((note) => (
                      <div key={note.id} className="rapor-note-item">
                        <span className="rapor-note-time">{formatTime(note.createdAt)}</span>
                        <span className="rapor-note-content">{note.content}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="rapor-footer">
            <span>{kesim.name} — Kesim Raporu</span>
            <span>{new Date().toLocaleDateString("tr-TR")} {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
