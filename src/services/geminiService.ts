import { GoogleGenAI } from "@google/genai";
import { Assessment } from "../types";

export const generateAssessmentInfo = async (
  topic: string,
  subject: string = "",
  grade: string = "",
  numQuestions: number = 5, 
  numSurveyOptions: number = 5,
  includePretest: boolean = true,
  includeSurvey: boolean = true
): Promise<Assessment> => {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY tidak ditemukan di environment");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const contextStr = `${subject ? `Mata Pelajaran: ${subject}` : ''} ${grade ? `Kelas: ${grade}` : ''}`.trim();
  const contextPrefix = contextStr ? `Untuk ${contextStr}, ` : '';

  let promptText = "";
  const schema: any = {};
  
  if (includePretest && includeSurvey) {
    promptText = `${contextPrefix}Buatkan ${numQuestions} soal pilihan ganda tentang materi "${topic}" bertingkat kesulitan acak untuk pretest kognitif siswa, dan ${numSurveyOptions} pilihan topik peminatan yang spesifik dengan "${topic}" untuk keperluan kelompok homogen survei minat.`;
    schema.questions = [
      {
        text: "Pertanyaan pretest",
        options: ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
        correctAnswerIndex: 0
      }
    ];
    schema.surveyOptions = ["Peminatan 1", "Peminatan 2"];
  } else if (includePretest) {
    promptText = `${contextPrefix}Buatkan ${numQuestions} soal pilihan ganda tentang materi "${topic}" bertingkat kesulitan acak untuk pretest kognitif siswa.`;
    schema.questions = [
      {
        text: "Pertanyaan pretest",
        options: ["Opsi A", "Opsi B", "Opsi C", "Opsi D"],
        correctAnswerIndex: 0
      }
    ];
    schema.surveyOptions = [];
  } else if (includeSurvey) {
    promptText = `${contextPrefix}Buatkan ${numSurveyOptions} pilihan topik peminatan yang spesifik dengan "${topic}" untuk keperluan kelompok homogen survei minat.`;
    schema.questions = [];
    schema.surveyOptions = ["Peminatan 1", "Peminatan 2"];
  } else {
    throw new Error("Pilih minimal satu tipe pengujian (Pretest atau Survei)");
  }

  const prompt = `${promptText}\n\nKeluarkan hanya dalam bentuk JSON persis seperti skema ini, tanpa block code markdown:\n${JSON.stringify(schema, null, 2)}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.7,
    }
  });

  let content = response.text;
  
  if (!content) throw new Error("Gagal generate konten dari AI");
  
  // Strip markdown codeblocks if they exist
  if (content.startsWith("```json")) {
    content = content.replace(/^```json\n/, "").replace(/```$/, "");
  } else if (content.startsWith("```")) {
     content = content.replace(/^```\n/, "").replace(/```$/, "");
  }

  const parsed = JSON.parse(content);
  
  return {
    topic: topic,
    subject: subject,
    grade: grade,
    questions: parsed.questions?.map((q: any, i: number) => ({
      id: `q-${i}`,
      text: q.text,
      options: q.options,
      correctAnswerIndex: q.correctAnswerIndex
    })) || [],
    surveyOptions: parsed.surveyOptions || [],
    includePretest,
    includeSurvey
  };
}
