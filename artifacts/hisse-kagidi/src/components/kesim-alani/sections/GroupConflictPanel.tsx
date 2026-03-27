import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Sparkles, UserCog } from "lucide-react";
import { useKesimAlaniContext } from "../KesimAlaniContext";

export function GroupConflictPanel() {
  const {
    conflicts, openAutoResolve, scrollToAnimalGroup, setPersonEditDesc,
    setShowConflicts, showConflicts,
  } = useKesimAlaniContext();

  if (!showConflicts) return null;

  return (
    <Card className={`p-4 mb-4 ${conflicts.length > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`w-5 h-5 mt-0.5 ${conflicts.length > 0 ? "text-amber-600" : "text-green-600"}`} />
          <div>
            {conflicts.length === 0 ? (
              <p className="text-sm text-green-800 font-medium">Çakışma bulunamadı. Tüm vekaleti veren kişiler aynı hayvanda.</p>
            ) : (
              <>
                <p className="text-sm text-amber-800 font-medium mb-2">{conflicts.filter(c => !c.isExpected).length} kişi beklenmeyen şekilde farklı hayvanlara dağılmış:</p>
                <ul className="space-y-1">
                  {conflicts.filter(c => !c.isExpected).map((c, i) => (
                    <li key={i} className="text-sm text-amber-700 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.description}</span>
                      <span className="text-xs">({c.totalShares} hisse) → Hayvan No: {c.animalNos.map((no, idx) => (
                        <span key={no}>{idx > 0 && ", "}<button className="underline font-semibold hover:text-amber-900 cursor-pointer" onClick={(e) => { e.stopPropagation(); scrollToAnimalGroup(no); }}>{no}</button></span>
                      ))}</span>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPersonEditDesc(c.description)}>
                        <UserCog className="w-3 h-3 mr-1" />Düzenle
                      </Button>
                    </li>
                  ))}
                </ul>
                {conflicts.some(c => c.isExpected) && (
                  <div className="mt-3 pt-2 border-t border-amber-200">
                    <p className="text-xs text-amber-600 mb-1">7+ hisseli (normal dağılım):</p>
                    <ul className="space-y-0.5">
                      {conflicts.filter(c => c.isExpected).map((c, i) => (
                        <li key={i} className="text-xs text-amber-500 flex items-center gap-2">
                          <span>{c.description}</span>
                          <span>({c.totalShares} hisse) → Hayvan No: {c.animalNos.map((no, idx) => (
                            <span key={no}>{idx > 0 && ", "}<button className="underline font-semibold hover:text-amber-700 cursor-pointer" onClick={(e) => { e.stopPropagation(); scrollToAnimalGroup(no); }}>{no}</button></span>
                          ))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {conflicts.filter(c => !c.isExpected).length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100" onClick={openAutoResolve}>
              <Sparkles className="w-3 h-3 mr-1" />Otomatik Çöz
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowConflicts(false)}>×</Button>
        </div>
      </div>
    </Card>
  );
}
