import React from 'react';
import { Assessment, Question } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface AssessmentEditorProps {
  assessment: Assessment;
  onChange: (assessment: Assessment | null) => void;
  onFinish: () => void;
}

export default function AssessmentEditor({ assessment, onChange, onFinish }: AssessmentEditorProps) {
  const updateField = (field: keyof Assessment, value: any) => {
    onChange({ ...assessment, [field]: value });
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      text: '',
      options: ['', '', '', ''],
      correctAnswerIndex: 0,
    };
    onChange({
      ...assessment,
      questions: [...assessment.questions, newQuestion],
    });
  };

  const updateQuestion = (index: number, updatedQuestion: Question) => {
    const newQuestions = [...assessment.questions];
    newQuestions[index] = updatedQuestion;
    onChange({ ...assessment, questions: newQuestions });
  };

  const removeQuestion = (index: number) => {
    const newQuestions = assessment.questions.filter((_, i) => i !== index);
    onChange({ ...assessment, questions: newQuestions });
  };

  const addSurveyOption = () => {
    onChange({
      ...assessment,
      surveyOptions: [...assessment.surveyOptions, ''],
    });
  };

  const updateSurveyOption = (index: number, value: string) => {
    const newOptions = [...assessment.surveyOptions];
    newOptions[index] = value;
    onChange({ ...assessment, surveyOptions: newOptions });
  };

  const removeSurveyOption = (index: number) => {
    const newOptions = assessment.surveyOptions.filter((_, i) => i !== index);
    onChange({ ...assessment, surveyOptions: newOptions });
  };

  return (
    <div className="card border border-neutral-100 p-8 max-w-3xl mx-auto animate-in zoom-in-95 mt-6">
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <h3 className="text-xl font-bold text-neutral-800">Editor Ujian & Survei</h3>
        <button
          onClick={onFinish}
          className="btn-primary text-sm"
        >
          Selesai Edit
        </button>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Topik/Materi</label>
            <input
              type="text"
              value={assessment.topic}
              onChange={(e) => updateField('topic', e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="Contoh: Tata Surya"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Durasi (Menit)</label>
            <input
              type="number"
              min="1"
              value={assessment.durationMinutes ?? 30}
              onChange={(e) => updateField('durationMinutes', Number(e.target.value) || 30)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-4 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Mapel <span className="text-neutral-400 font-normal">(Opsional)</span></label>
              <input
                type="text"
                value={assessment.subject || ''}
                onChange={(e) => updateField('subject', e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 mb-1">Kelas <span className="text-neutral-400 font-normal">(Opsional)</span></label>
              <input
                type="text"
                value={assessment.grade || ''}
                onChange={(e) => updateField('grade', e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-6 pb-4 border-b">
          <label className="flex items-center text-sm font-medium text-neutral-800 cursor-pointer">
            <input
              type="checkbox"
              checked={assessment.includePretest}
              onChange={(e) => updateField('includePretest', e.target.checked)}
              className="mr-2 rounded text-indigo-600 focus:ring-indigo-500"
            />
            Gunakan Pretest (Heterogen)
          </label>
          <label className="flex items-center text-sm font-medium text-neutral-800 cursor-pointer">
            <input
              type="checkbox"
              checked={assessment.includeSurvey}
              onChange={(e) => updateField('includeSurvey', e.target.checked)}
              className="mr-2 rounded text-indigo-600 focus:ring-indigo-500"
            />
            Gunakan Survei Minat (Homogen)
          </label>
        </div>

        {assessment.includePretest && (
          <div className="bg-neutral-50 p-4 sm:p-6 rounded-xl border border-neutral-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-indigo-900">Soal Pretest ({assessment.questions.length})</h4>
              <button
                onClick={addQuestion}
                className="flex items-center text-sm text-indigo-600 font-medium hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
              >
                <Plus className="w-4 h-4 mr-1" /> Tambah Soal
              </button>
            </div>
            <div className="space-y-6">
              {assessment.questions.map((q, qIndex) => (
                <div key={q.id} className="bg-white p-4 rounded-lg shadow-sm border border-neutral-200">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold bg-neutral-100 text-neutral-500 px-2 py-1 rounded">Soal {qIndex + 1}</span>
                    <button onClick={() => removeQuestion(qIndex)} className="text-red-500 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(qIndex, { ...q, text: e.target.value })}
                    placeholder="Pertanyaan soal..."
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 mb-3 font-medium text-neutral-800"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, oIndex) => (
                      <div key={oIndex} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctAnswerIndex === oIndex}
                          onChange={() => updateQuestion(qIndex, { ...q, correctAnswerIndex: oIndex })}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[oIndex] = e.target.value;
                            updateQuestion(qIndex, { ...q, options: newOpts });
                          }}
                          placeholder={`Opsi ${String.fromCharCode(65 + oIndex)}`}
                          className="flex-1 border border-neutral-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {assessment.questions.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-4">Belum ada soal ditambahkan.</p>
              )}
            </div>
          </div>
        )}

        {assessment.includeSurvey && (
          <div className="bg-neutral-50 p-4 sm:p-6 rounded-xl border border-neutral-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-purple-900">Topik Survei Minat ({assessment.surveyOptions.length})</h4>
              <button
                onClick={addSurveyOption}
                className="flex items-center text-sm text-purple-600 font-medium hover:bg-purple-100 px-3 py-1.5 rounded-lg transition"
              >
                <Plus className="w-4 h-4 mr-1" /> Tambah Peminatan
              </button>
            </div>
            <div className="space-y-3">
              {assessment.surveyOptions.map((opt, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-neutral-200 text-neutral-600 w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                    {oIndex + 1}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateSurveyOption(oIndex, e.target.value)}
                    placeholder="Masukkan nama topik peminatan..."
                    className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500 text-sm"
                  />
                  <button onClick={() => removeSurveyOption(oIndex)} className="text-red-500 hover:text-red-600 p-2 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {assessment.surveyOptions.length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-4">Belum ada topik peminatan ditambahkan.</p>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 flex justify-between border-t border-neutral-200 pt-6">
        <button
          onClick={() => {
            if (confirm("Yakin ingin menghapus seluruh ujian ini?")) {
               onChange(null);
               onFinish();
            }
          }}
          className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Hapus Ujian
        </button>
        <button
          onClick={onFinish}
          className="btn-primary text-sm"
        >
          Simpan & Selesai
        </button>
      </div>
    </div>
  );
}
