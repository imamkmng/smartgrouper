import React, { useState } from 'react';
import { Assessment, Student } from '../types';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface StudentPortalProps {
  assessment: Assessment | null;
  existingStudents: Student[];
  onSubmit: (name: string, score: number, interest: string) => void;
  onBack: () => void;
}

export default function StudentPortal({ assessment, existingStudents, onSubmit, onBack }: StudentPortalProps) {
  const [name, setName] = useState('');
  const [step, setStep] = useState<'login' | 'pretest' | 'survey' | 'done'>('login');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [interest, setInterest] = useState<string>('');
  const [isCustomInterest, setIsCustomInterest] = useState(false);
  const [customInterestValue, setCustomInterestValue] = useState('');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Silakan masukkan nama lengkapmu!");

    const exist = existingStudents.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
    if (exist) {
      setStep('done');
      return;
    }

    if (assessment?.includePretest) {
       setStep('pretest');
    } else if (assessment?.includeSurvey) {
       setStep('survey');
    } else {
       setStep('done');
    }
  };

  const handleNextToSurvey = () => {
    if (!assessment) return;
    if (assessment.includePretest && Object.keys(answers).length < assessment.questions.length) {
      return alert("Harap jawab semua soal pretest!");
    }
    if (assessment.includeSurvey) {
      setStep('survey');
    } else {
      handleSubmitAll();
    }
  };

  const handleSubmitAll = () => {
    if (!assessment) return;
    
    if (assessment.includeSurvey && !interest) {
      return alert("Harap pilih peminatan survei!");
    }

    let score = null;
    if (assessment.includePretest && assessment.questions.length > 0) {
      let correctCount = 0;
      assessment.questions.forEach((q) => {
        if (answers[q.id] === q.correctAnswerIndex) {
          correctCount++;
        }
      });
      score = Math.round((correctCount / assessment.questions.length) * 100);
    }

    onSubmit(name.trim(), score ?? 0, interest || "-");
    setStep('done');
  };

  if (!assessment) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-neutral-200">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-neutral-800">Menunggu Guru</h2>
          <p className="text-neutral-500 mb-6">Guru belum menyiapkan soal pretest dan survei. Silakan kembali lagi nanti apabila soal sudah siap.</p>
          <button onClick={onBack} className="text-indigo-600 hover:text-indigo-700 font-medium">
            Kembali ke Halaman Awal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {step === 'login' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-neutral-200 animate-in fade-in slide-in-from-bottom-4 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center text-neutral-800 mb-2">Portal Siswa</h2>
            <p className="text-center text-neutral-500 mb-6">Materi: <strong>{assessment.topic}</strong></p>
            
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masukkan nama sesuai absen"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center"
              >
                Mulai Ujian <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </form>
            <div className="mt-6 text-center">
               <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-700">Kembali</button>
            </div>
          </div>
        )}

        {step === 'pretest' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200 flex justify-between items-center">
               <div>
                  <h2 className="text-lg font-bold text-neutral-800">Bagian 1: Pretest Kognitif</h2>
                  <p className="text-neutral-500 text-sm">
                    Siswa: {name} &bull; Materi: {assessment.topic}
                    {assessment.subject ? ` \u2022 Mapel: ${assessment.subject}` : ''}
                    {assessment.grade ? ` \u2022 Kelas: ${assessment.grade}` : ''}
                  </p>
               </div>
               <div className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                  Langkah 1 dari 2
               </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-neutral-200">
                <div className="space-y-8">
                  {assessment.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-3">
                      <p className="font-medium text-neutral-800"><span className="text-neutral-400 mr-2">{idx + 1}.</span> {q.text}</p>
                      <div className="space-y-2 pl-6">
                        {q.options.map((opt, optIdx) => (
                          <label key={optIdx} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === optIdx ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-neutral-50 border-neutral-200'}`}>
                            <input 
                              type="radio" 
                              name={q.id}
                              checked={answers[q.id] === optIdx}
                              onChange={() => setAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                              className="w-4 h-4 text-indigo-600 border-neutral-300 focus:ring-indigo-600"
                            />
                            <span className="ml-3 text-neutral-700 tracking-tight">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

              <div className="pt-8 mt-8 border-t flex justify-end">
                <button
                  onClick={handleNextToSurvey}
                  className="bg-indigo-600 text-white rounded-lg px-8 py-3 font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center"
                >
                  {assessment.includeSurvey ? (
                    <>Lanjut ke Survei Minat <ArrowRight className="w-5 h-5 ml-2" /></>
                  ) : (
                    "Kirim Jawaban"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'survey' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200 flex justify-between items-center">
               <div>
                  <h2 className="text-lg font-bold text-neutral-800">Bagian {assessment.includePretest ? "2" : "1"}: Survei Minat</h2>
                  <p className="text-neutral-500 text-sm">
                    Siswa: {name} &bull; Materi: {assessment.topic}
                    {assessment.subject ? ` \u2022 Mapel: ${assessment.subject}` : ''}
                    {assessment.grade ? ` \u2022 Kelas: ${assessment.grade}` : ''}
                  </p>
               </div>
               <div className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                  {assessment.includePretest ? "Langkah 2 dari 2" : "Survei Minat"}
               </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-neutral-200">
                <div className="space-y-3">
                  <p className="font-medium text-neutral-800">Pilih salah satu topik peminatan di bawah ini yang paling kamu minati terkait {assessment.topic}:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-6 pt-2">
                    {assessment.surveyOptions.map((opt, idx) => (
                      <label key={idx} className={`flex items-center p-4 rounded-lg border cursor-pointer transition-colors ${interest === opt && !isCustomInterest ? 'bg-purple-50 border-purple-300' : 'hover:bg-neutral-50 border-neutral-200'}`}>
                        <input 
                          type="radio" 
                          name="survey"
                          checked={interest === opt && !isCustomInterest}
                          onChange={() => {
                            setInterest(opt);
                            setIsCustomInterest(false);
                          }}
                          className="w-4 h-4 text-purple-600 border-neutral-300 focus:ring-purple-600"
                        />
                        <span className="ml-3 text-neutral-700 font-medium">{opt}</span>
                      </label>
                    ))}
                    
                    <label className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${isCustomInterest ? 'bg-purple-50 border-purple-300' : 'hover:bg-neutral-50 border-neutral-200'}`}>
                      <div className="flex items-center">
                        <input 
                          type="radio" 
                          name="survey"
                          checked={isCustomInterest}
                          onChange={() => {
                            setIsCustomInterest(true);
                            setInterest(customInterestValue);
                          }}
                          className="w-4 h-4 text-purple-600 border-neutral-300 focus:ring-purple-600"
                        />
                        <span className="ml-3 text-neutral-700 font-medium">Lainnya (Tulis Sendiri)</span>
                      </div>
                      {isCustomInterest && (
                        <input 
                          type="text"
                          placeholder="Masukkan minat kamu..."
                          value={customInterestValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomInterestValue(val);
                            setInterest(val);
                          }}
                          className="mt-3 ml-7 w-[calc(100%-1.75rem)] rounded-md border border-neutral-300 px-3 py-2 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white text-sm"
                        />
                      )}
                    </label>
                  </div>
                </div>

              <div className={`pt-8 mt-8 border-t flex ${assessment.includePretest ? 'justify-between' : 'justify-end'}`}>
                {assessment.includePretest && (
                  <button
                    onClick={() => setStep('pretest')}
                    className="bg-neutral-100 text-neutral-700 rounded-lg px-6 py-3 font-semibold hover:bg-neutral-200 transition-colors"
                  >
                    Kembali
                  </button>
                )}
                <button
                  onClick={handleSubmitAll}
                  className="bg-purple-600 text-white rounded-lg px-8 py-3 font-semibold hover:bg-purple-700 transition-colors shadow-sm"
                >
                  Kirim Jawaban
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="bg-white p-10 rounded-xl shadow-sm border border-neutral-200 text-center max-w-lg mx-auto animate-in zoom-in-95">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">Terima Kasih!</h2>
            <p className="text-neutral-600 mb-8">
              Jawaban pretest dan survei minat kamu telah berhasil disimpan. Silakan tunggu instruksi selanjutnya dari guru.
            </p>
            <button
              onClick={onBack}
              className="bg-neutral-100 text-neutral-700 rounded-lg px-6 py-2.5 font-medium hover:bg-neutral-200 transition-colors"
            >
              Kembali ke Halaman Awal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
