export interface Student {
  id: string;
  name: string;
  score: number | null;
  interest?: string | null;
}

export interface Group {
  id: string;
  name: string;
  students: Student[];
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface Assessment {
  id?: string;
  topic: string;
  subject?: string;
  grade?: string;
  durationMinutes?: number;
  questions: Question[];
  surveyOptions: string[];
  includePretest: boolean;
  includeSurvey: boolean;
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
}

