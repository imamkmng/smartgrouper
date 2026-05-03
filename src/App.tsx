import React, { useState, useEffect } from 'react';
import { Users, Shuffle, ClipboardList, LayoutGrid, Plus, Trash2, Award, Info, Compass, PieChart, BrainCircuit, Loader2, ArrowRight, Download, LogOut } from 'lucide-react';
import { Student, Group, Assessment } from './types';
import StudentPortal from './components/StudentPortal';
import { generateAssessmentInfo } from './services/geminiService';
import AssessmentEditor from './components/AssessmentEditor';
import { auth, db, signInWithGoogle, signInAnonymously, signOut as handleSignOut, handleFirestoreError } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbRole, setDbRole] = useState<'guru' | 'siswa' | null>(null);

  const [role, setRole] = useState<'landing' | 'guru' | 'siswa'>('landing');
  const [activeTab, setActiveTab] = useState<'students' | 'pretest' | 'survei' | 'random' | 'hetero' | 'homogen' | 'ai'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  useEffect(() => {
    if (role === 'guru' && user) {
      const q = query(collection(db, 'assessments'), where('createdBy', '==', user.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setAssessment({ id: docData.id, ...docData.data() } as Assessment);
          
          // Also listen to results for this assessment
          const resultsQ = query(
            collection(db, 'assessments', docData.id, 'results'),
            where('guruId', '==', user.uid)
          );
          const unsubResults = onSnapshot(resultsQ, (resSnapshot) => {
             const studentResults: Student[] = [];
             resSnapshot.forEach(rDoc => {
               const data = rDoc.data();
               studentResults.push({
                 id: rDoc.id,
                 name: data.studentName,
                 score: data.score,
                 interest: data.interest
               });
             });
             setStudents(studentResults);
          }, (error) => {
             handleFirestoreError(error, 'list' as any, 'results');
          });
          return () => unsubResults();
        } else {
          setAssessment(null);
          setStudents([]);
        }
      }, (error) => {
        handleFirestoreError(error, 'list' as any, 'assessments');
      });
      return () => unsub();
    }
  }, [role, user]);

  const [isEditingAssessment, setIsEditingAssessment] = useState(false);

  const [randomGroups, setRandomGroups] = useState<Group[]>([]);
  const [heteroGroups, setHeteroGroups] = useState<Group[]>([]);
  const [interestGroups, setInterestGroups] = useState<Group[]>([]);
  const [numRandomGroups, setNumRandomGroups] = useState(3);
  const [numHeteroGroups, setNumHeteroGroups] = useState(3);
  const [maxPerInterestGroup, setMaxPerInterestGroup] = useState(5);
  const [newStudentName, setNewStudentName] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  
  const [topicInput, setTopicInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [gradeInput, setGradeInput] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [numSurveyOptions, setNumSurveyOptions] = useState(5);
  const [includePretest, setIncludePretest] = useState(true);
  const [includeSurvey, setIncludeSurvey] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [availableAssessments, setAvailableAssessments] = useState<(Assessment & { guruName?: string })[]>([]);
  const [selectedAssessmentForSiswa, setSelectedAssessmentForSiswa] = useState<Assessment | null>(null);

  useEffect(() => {
    if (role === 'siswa') {
      const q = query(collection(db, 'assessments'));
      const unsub = onSnapshot(q, (snapshot) => {
        const assessments: any[] = [];
        snapshot.forEach(doc => {
          assessments.push({ id: doc.id, ...doc.data() });
        });
        setAvailableAssessments(assessments);
      }, (error) => {
        handleFirestoreError(error, 'list' as any, 'assessments');
      });
      return () => unsub();
    }
  }, [role]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const docRef = doc(db, 'users', u.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const roleStr = snap.data().role;
            setDbRole(roleStr);
            setRole(roleStr);
          } else {
            setDbRole(null);
            setRole('landing');
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setDbRole(null);
        setRole('landing');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const selectRole = async (selectedRole: 'guru'|'siswa') => {
    if (selectedRole === 'siswa') {
      try {
        let currentUser = user;
        if (!currentUser) {
          try {
            const authResult = await signInAnonymously();
            currentUser = authResult.user;
          } catch (err: any) {
            if (err.code === 'auth/admin-restricted-operation') {
              alert('Error: Login anonim belum diaktifkan di Firebase. Mohon aktifkan "Anonymous" provider di Firebase Console > Authentication > Sign-in method.');
            }
            throw err;
          }
        }
        const docRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          await setDoc(docRef, {
            role: 'siswa',
            name: 'Siswa Anonymous',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        setDbRole('siswa');
        setRole('siswa');
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (!user) {
      await signInWithGoogle();
      return;
    }
    try {
      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await setDoc(docRef, {
          role: selectedRole,
          name: user.displayName || 'Unknown',
          email: user.email,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      setDbRole(selectedRole);
      setRole(selectedRole);
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'users');
    }
  };

  const handleLogin = async () => {
    await signInWithGoogle();
  };

  const handleLogout = async () => {
    await handleSignOut();
  };

  const saveAssessmentToFirestore = async (newAssessment: Assessment | null) => {
    setAssessment(newAssessment);
    if (newAssessment && user) {
      try {
        const id = newAssessment.id || generateId();
        const docRef = doc(db, 'assessments', id);
        await setDoc(docRef, {
          ...newAssessment,
          id,
          createdBy: user.uid,
          guruName: user.displayName || 'Guru',
          createdAt: newAssessment.createdAt || Date.now(),
          updatedAt: Date.now()
        });
        if (!newAssessment.id) {
          setAssessment({ ...newAssessment, id, createdBy: user.uid });
        }
      } catch (e) {
        console.error(e);
      }
    } else if (!newAssessment && assessment?.id) {
       // Optionally delete from Firestore
       try {
         await deleteDoc(doc(db, 'assessments', assessment.id));
       } catch (e) {
         console.error(e);
       }
    }
  };

  const handleCreateManual = () => {
    saveAssessmentToFirestore({
      id: generateId(),
      topic: 'Ujian Kustom',
      subject: '',
      grade: '',
      questions: [],
      surveyOptions: [],
      includePretest: true,
      includeSurvey: true,
    });
    setIsEditingAssessment(true);
  };

  const saveStudentAssessment = async (name: string, score: number, interest: string) => {
    // update local state
    let newStudents = [...students];
    const existingIndex = students.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingIndex >= 0) {
      newStudents[existingIndex] = {
        ...newStudents[existingIndex],
        score,
        interest
      };
    } else {
      newStudents = [...students, { id: generateId(), name, score, interest }];
    }
    setStudents(newStudents);

    // save to firestore
    const targetAssessment = role === 'siswa' ? selectedAssessmentForSiswa : assessment;
    if (user && targetAssessment && targetAssessment.id) {
      try {
        const resultId = generateId();
        const docRef = doc(db, 'assessments', targetAssessment.id, 'results', resultId);
        await setDoc(docRef, {
          assessmentId: targetAssessment.id,
          studentId: user.uid,
          guruId: targetAssessment.createdBy || '',
          studentName: name,
          score,
          interest,
          answers: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } catch (e) {
        handleFirestoreError(e, 'create' as any, 'results');
      }
    }
  };

  const handleGenerateAssessment = async () => {
    if (!topicInput.trim()) return alert("Masukkan topik/materi pelajaran!");
    if (!includePretest && !includeSurvey) return alert("Pilih minimal satu (Pretest atau Survei)");
    setIsGenerating(true);
    try {
      const data = await generateAssessmentInfo(topicInput.trim(), subjectInput.trim(), gradeInput.trim(), numQuestions, numSurveyOptions, includePretest, includeSurvey);
      saveAssessmentToFirestore(data);
      alert("Soal berhasil dibuat oleh AI!");
      setTopicInput('');
      setSubjectInput('');
      setGradeInput('');
    } catch (e) {
      alert("Gagal membuat soal: " + (e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-indigo-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  if (role === 'landing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl mix-blend-multiply"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-200/40 rounded-full blur-3xl mix-blend-multiply"></div>

        <div className="text-center mb-10 relative z-10">
           <div className="bg-indigo-600 text-white p-4 rounded-2xl inline-block mb-4 shadow-lg shadow-indigo-600/20">
              <LayoutGrid className="w-10 h-10" />
           </div>
           <h1 className="text-4xl font-extrabold text-neutral-900 tracking-tight">SmartGrouper</h1>
           <p className="text-neutral-500 mt-2 text-lg font-medium">Bentuk Kelompok Cerdas berbasis Pretest & Minat</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl shadow-indigo-900/5 max-w-md w-full border border-white relative z-10">
          <h2 className="text-lg font-bold text-neutral-800 text-center mb-2">{user ? `Halo, ${user.displayName || 'Pengguna'}!` : 'Halo!'}</h2>
          <p className="text-sm text-neutral-500 text-center mb-6">Pilih peran Anda untuk melanjutkan:</p>
          <div className="space-y-4">
            <button 
              onClick={() => selectRole('guru')}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-neutral-100 hover:border-indigo-600 hover:bg-indigo-50 group transition-all"
            >
              <div className="flex items-center text-left">
                <div className="bg-indigo-100 text-indigo-600 p-3 rounded-lg mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 group-hover:text-indigo-900">Guru / Pengajar</h3>
                  <p className="text-sm text-neutral-500">Kelola kelas, buat soal, bentuk kelompok</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-indigo-600" />
            </button>
            <button 
              onClick={() => selectRole('siswa')}
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-neutral-100 hover:border-purple-600 hover:bg-purple-50 group transition-all"
            >
              <div className="flex items-center text-left">
                <div className="bg-purple-100 text-purple-600 p-3 rounded-lg mr-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 group-hover:text-purple-900">Siswa</h3>
                  <p className="text-sm text-neutral-500">Kerjakan pretest dan survei minat</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-purple-600" />
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 text-center w-full z-10 text-neutral-400 text-sm font-medium">
          Copyright @2026 - Imam Rohman, S.Kom.
        </div>
      </div>
    );
  }

  if (role === 'siswa') {
    if (!selectedAssessmentForSiswa) {
      return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-neutral-200 max-w-lg w-full">
            <h2 className="text-2xl font-bold text-center text-neutral-800 mb-6">Pilih Ujian / Guru</h2>
            {availableAssessments.length === 0 ? (
              <p className="text-center text-neutral-500 mb-6">Belum ada ujian yang tersedia saat ini.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {availableAssessments.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAssessmentForSiswa(a)}
                    className="w-full text-left p-4 rounded-xl border border-neutral-200 hover:border-indigo-600 hover:bg-indigo-50 transition-all flex flex-col"
                  >
                    <span className="font-bold text-lg text-neutral-900">{a.topic}</span>
                    <span className="text-sm text-neutral-500 mt-1">Guru: {a.guruName || 'Unknown'}</span>
                    {(a.subject || a.grade) && (
                      <span className="text-xs text-neutral-400 mt-1">
                        {a.subject ? `Mapel: ${a.subject}` : ''} {a.grade ? `Kelas: ${a.grade}` : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="text-center">
              <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-700 font-medium">
                Keluar
              </button>
            </div>
          </div>
          <div className="absolute bottom-4 left-0 w-full text-center text-neutral-400 text-sm font-medium pb-4">
            Copyright @2026 - Imam Rohman, S.Kom.
          </div>
        </div>
      );
    }

    return (
      <StudentPortal 
        assessment={selectedAssessmentForSiswa} 
        existingStudents={students}
        onSubmit={saveStudentAssessment}
        onBack={() => {
          setSelectedAssessmentForSiswa(null);
        }}
      />
    );
  }

  // --- Guru View ---

  // --- Student Management ---
  const addStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newStudentName.trim() || !assessment || !user) return;
    
    // Save to firestore
    try {
      const resultId = generateId();
      const docRef = doc(db, 'assessments', assessment.id, 'results', resultId);
      await setDoc(docRef, {
        assessmentId: assessment.id,
        studentId: `manual-${resultId}`,
        guruId: assessment.createdBy,
        studentName: newStudentName.trim(),
        score: null,
        interest: '',
        answers: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setNewStudentName('');
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'results');
    }
  };

  const addBulkStudents = async () => {
    if (!assessment || !user) return;
    const names = bulkInput.split('\n').filter(n => n.trim() !== '');
    try {
      for (const name of names) {
        const resultId = generateId();
        const docRef = doc(db, 'assessments', assessment.id, 'results', resultId);
        await setDoc(docRef, {
          assessmentId: assessment.id,
          studentId: `manual-${resultId}`,
          guruId: assessment.createdBy,
          studentName: name.trim(),
          score: null,
          interest: '',
          answers: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      setBulkInput('');
      setIsBulkMode(false);
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'results');
    }
  };

  const removeStudent = async (id: string) => {
    if (!assessment) return;
    try {
      await deleteDoc(doc(db, 'assessments', assessment.id, 'results', id));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, 'results');
    }
  };

  const clearStudents = async () => {
    if (!assessment) return;
    if (confirm('Yakin ingin menghapus semua data siswa?')) {
       try {
         for (const s of students) {
           await deleteDoc(doc(db, 'assessments', assessment.id, 'results', s.id));
         }
         setRandomGroups([]);
         setHeteroGroups([]);
         setInterestGroups([]);
       } catch (e) {
         handleFirestoreError(e, 'delete' as any, 'results');
       }
    }
  };

  const exportToCSV = () => {
    if (students.length === 0) {
      alert("Tidak ada data siswa untuk diekspor!");
      return;
    }
    
    const headers = ['Nama Siswa', 'Nilai Pretest', 'Minat'];
    const csvContent = [
      headers.join(','),
      ...students.map(student => {
        const score = student.score !== null ? student.score : '-';
        const interest = student.interest ? `"${student.interest}"` : '-';
        return `"${student.name}",${score},${interest}`;
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'data_siswa.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Pretest & Survei Management ---
  const updateScore = async (id: string, score: string) => {
    if (!assessment) return;
    const parsedScore = score === '' ? null : Number(score);
    try {
      await setDoc(doc(db, 'assessments', assessment.id, 'results', id), {
        score: parsedScore,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, 'update' as any, 'results');
    }
  };
  
  const updateInterest = async (id: string, interest: string) => {
    if (!assessment) return;
    try {
      await setDoc(doc(db, 'assessments', assessment.id, 'results', id), {
        interest: interest,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, 'update' as any, 'results');
    }
  };

  // --- Grouping Logic ---
  const generateRandomGroups = () => {
    if (students.length === 0) return alert('Data siswa kosong!');
    if (numRandomGroups < 1) return alert('Jumlah kelompok minimal 1');

    // Copy and shuffle
    const shuffled = [...students].sort(() => 0.5 - Math.random());
    
    const groups: Group[] = Array.from({ length: numRandomGroups }, (_, i) => ({
      id: `rand-${i}`,
      name: `Kelompok Asal ${i + 1}`,
      students: []
    }));

    shuffled.forEach((student, index) => {
      groups[index % numRandomGroups].students.push(student);
    });

    setRandomGroups(groups);
  };

  const generateHeteroGroups = () => {
    if (students.length === 0) return alert('Data siswa kosong!');
    if (numHeteroGroups < 1) return alert('Jumlah kelompok minimal 1');
    
    // Check if everyone has a score
    const missingScores = students.filter(s => s.score === null);
    if (missingScores.length > 0) {
      return alert(`Ada ${missingScores.length} siswa yang belum memiliki nilai pretest!`);
    }

    // Sort descending
    const sorted = [...students].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    const groups: Group[] = Array.from({ length: numHeteroGroups }, (_, i) => ({
      id: `het-${i}`,
      name: `Kelompok Heterogen ${i + 1}`,
      students: []
    }));

    // Snake draft distribution to balance scores
    sorted.forEach((student, index) => {
      const round = Math.floor(index / numHeteroGroups);
      // If round is even, go left to right (0, 1, 2)
      // If round is odd, go right to left (2, 1, 0)
      let groupIndex = index % numHeteroGroups;
      if (round % 2 !== 0) {
        groupIndex = numHeteroGroups - 1 - groupIndex;
      }
      groups[groupIndex].students.push(student);
    });

    setHeteroGroups(groups);
  };

  const generateInterestGroups = () => {
    if (students.length === 0) return alert('Data siswa kosong!');
    if (maxPerInterestGroup < 1) return alert('Kapasitas maksimal kelompok minimal 1');
    
    // Check missing interests
    const missingInterests = students.filter(s => !s.interest || s.interest.trim() === '');
    if (missingInterests.length > 0) {
      return alert(`Ada ${missingInterests.length} siswa yang belum memiliki data survei minat!`);
    }

    // Group by interest
    const interestMap = new Map<string, Student[]>();
    students.forEach(s => {
      const key = (s.interest || '').trim().toLowerCase();
      // Capitalize first letter of each word
      const displayKey = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      
      if (!interestMap.has(displayKey)) {
        interestMap.set(displayKey, []);
      }
      interestMap.get(displayKey)!.push(s);
    });

    const groups: Group[] = [];
    let groupCounter = 0;

    interestMap.forEach((studentsArray, interestName) => {
      // Shuffle students randomly in the same interest bucket
      const shuffled = [...studentsArray].sort(() => 0.5 - Math.random());
      
      const numSubGroups = Math.ceil(shuffled.length / maxPerInterestGroup);
      
      for(let i = 0; i < numSubGroups; i++) {
        const slice = shuffled.slice(i * maxPerInterestGroup, (i + 1) * maxPerInterestGroup);
        groups.push({
          id: `int-${groupCounter++}`,
          name: numSubGroups > 1 ? `Minat ${interestName} ${i + 1}` : `Minat ${interestName}`,
          students: slice
        });
      }
    });

    // Sort groups alphabetically by name
    groups.sort((a, b) => a.name.localeCompare(b.name));

    setInterestGroups(groups);
  };

  const getAverageScore = (group: Group) => {
    const sum = group.students.reduce((acc, curr) => acc + (curr.score || 0), 0);
    return group.students.length > 0 ? (sum / group.students.length).toFixed(2) : '0';
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-indigo-600">
            <LayoutGrid className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">SmartGrouper Guru</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm font-medium text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
              Siswa Terdata: <span className="text-neutral-900">{students.length}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-red-200 flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="max-w-5xl mx-auto px-4 flex overflow-x-auto hide-scrollbar border-b border-neutral-100">
          <nav className="flex space-x-1 sm:space-x-4">
            <TabButton 
              active={activeTab === 'students'} 
              onClick={() => setActiveTab('students')}
              icon={<Users className="w-4 h-4" />}
              label="Data Siswa"
            />
            <TabButton 
              active={activeTab === 'pretest'} 
              onClick={() => setActiveTab('pretest')}
              icon={<ClipboardList className="w-4 h-4" />}
              label="Input Pretest"
            />
            <TabButton 
              active={activeTab === 'survei'} 
              onClick={() => setActiveTab('survei')}
              icon={<Compass className="w-4 h-4" />}
              label="Survei Minat"
            />
            <div className="w-px bg-neutral-200 my-2 mx-2"></div>
            <TabButton 
              active={activeTab === 'ai'} 
              onClick={() => setActiveTab('ai')}
              icon={<BrainCircuit className="w-4 h-4" />}
              label="Generate Soal (AI)"
            />
            <TabButton 
              active={activeTab === 'random'} 
              onClick={() => setActiveTab('random')}
              icon={<Shuffle className="w-4 h-4" />}
              label="Acak (Asal)"
            />
            <TabButton 
              active={activeTab === 'hetero'} 
              onClick={() => setActiveTab('hetero')}
              icon={<Award className="w-4 h-4" />}
              label="Heterogen"
            />
            <TabButton 
              active={activeTab === 'homogen'} 
              onClick={() => setActiveTab('homogen')}
              icon={<PieChart className="w-4 h-4" />}
              label="Homogen (Minat)"
            />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* TAB 0: GENERATE AI SOAL */}
        {activeTab === 'ai' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {!assessment && (
               <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 text-center max-w-2xl mx-auto">
                  <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BrainCircuit className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-neutral-800 mb-2">Pintar Buat Soal dengan AI</h2>
                  <p className="text-neutral-500 mb-8">
                    Masukkan topik/materi pelajaran. AI akan membuatkan soal pretest kognitif pilihan ganda dan rekomendasi topik survei minat untuk memetakan kelompok homogen.
                  </p>

                  <div className="flex flex-col space-y-4 max-w-lg mx-auto">
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder="Topik Spesifik (Contoh: Tata Surya, Pecahan, dll)"
                      className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-center"
                      disabled={isGenerating}
                    />
                    <div className="flex gap-4">
                      <input
                        type="text"
                        value={subjectInput}
                        onChange={(e) => setSubjectInput(e.target.value)}
                        placeholder="Mata Pelajaran (Opsional)"
                        className="flex-1 w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-center"
                        disabled={isGenerating}
                      />
                      <input
                        type="text"
                        value={gradeInput}
                        onChange={(e) => setGradeInput(e.target.value)}
                        placeholder="Kelas (Opsional)"
                        className="flex-1 w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all font-medium text-center"
                        disabled={isGenerating}
                      />
                    </div>
                    <div className="flex gap-4">
                       <div className="flex flex-col flex-1">
                          <label className="flex items-center text-sm text-neutral-600 font-medium mb-1 relative left-1 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={includePretest} 
                              onChange={(e) => setIncludePretest(e.target.checked)} 
                              className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" 
                              disabled={isGenerating} 
                            />
                            Sertakan Pretest
                          </label>
                          <div className="flex items-center ml-6 mt-1">
                             <span className="text-xs text-neutral-500 mr-2">Jml:</span>
                             <input
                                type="number"
                                min="1" max="20"
                                value={numQuestions}
                                onChange={e => setNumQuestions(Number(e.target.value))}
                                className="w-16 rounded-lg border border-neutral-300 px-2 py-1 outline-none focus:border-indigo-500 transition-all text-center text-sm"
                                disabled={isGenerating || !includePretest}
                             />
                          </div>
                       </div>
                       <div className="flex flex-col flex-1">
                          <label className="flex items-center text-sm text-neutral-600 font-medium mb-1 relative left-1 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={includeSurvey} 
                              onChange={(e) => setIncludeSurvey(e.target.checked)} 
                              className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" 
                              disabled={isGenerating} 
                            />
                            Sertakan Survei Minat
                          </label>
                          <div className="flex items-center ml-6 mt-1">
                             <span className="text-xs text-neutral-500 mr-2">Jml:</span>
                             <input
                                type="number"
                                min="1" max="15"
                                value={numSurveyOptions}
                                onChange={e => setNumSurveyOptions(Number(e.target.value))}
                                className="w-16 rounded-lg border border-neutral-300 px-2 py-1 outline-none focus:border-indigo-500 transition-all text-center text-sm"
                                disabled={isGenerating || !includeSurvey}
                             />
                          </div>
                       </div>
                    </div>
                    <button
                      onClick={handleGenerateAssessment}
                      disabled={isGenerating || !topicInput.trim()}
                      className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center shadow-md shadow-indigo-600/20"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          AI Sedang Berpikir...
                        </>
                      ) : (
                        <>
                          <BrainCircuit className="w-5 h-5 mr-2" />
                          Generate Soal & Survei dengan AI
                        </>
                      )}
                    </button>
                    
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-neutral-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-neutral-500">Atau</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCreateManual}
                      disabled={isGenerating}
                      className="w-full bg-white text-indigo-600 border-2 border-indigo-100 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Buat Ujian & Survei Manual
                    </button>
                  </div>
               </div>
             )}

             {/* PREVIEW HASIL */}
             {assessment && !isEditingAssessment && (
               <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 max-w-2xl mx-auto animate-in zoom-in-95">
                 <div className="flex justify-between items-center border-b pb-4 mb-6">
                    <h3 className="text-xl font-bold text-neutral-800">Preview: {assessment.topic}</h3>
                    <div className="flex items-center gap-3">
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Aktif</span>
                      <button
                        onClick={() => setIsEditingAssessment(true)}
                        className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-indigo-200 transition-colors"
                      >
                        Edit Ujian
                      </button>
                    </div>
                 </div>
                 
                 <div className="space-y-6">
                   {assessment.includePretest && assessment.questions.length > 0 && (
                     <div>
                       <h4 className="font-bold text-indigo-900 mb-3 flex items-center"><ClipboardList className="w-4 h-4 mr-2"/> {assessment.questions.length} Soal Pretest Kelompok Heterogen</h4>
                       <ul className="space-y-4 pl-6 text-sm text-neutral-700 list-decimal">
                         {assessment.questions.map((q, idx) => (
                           <li key={q.id}>
                             <p className="font-medium text-neutral-900 mb-1">{q.text}</p>
                             <p className="text-neutral-500">Jawaban: {q.options[q.correctAnswerIndex]}</p>
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                   
                   {assessment.includeSurvey && assessment.surveyOptions.length > 0 && (
                     <div className={assessment.includePretest ? "pt-4 border-t" : ""}>
                       <h4 className="font-bold text-purple-900 mb-3 flex items-center"><Compass className="w-4 h-4 mr-2"/> {assessment.surveyOptions.length} Topik Survei Minat Kelompok Homogen</h4>
                       <div className="flex flex-wrap gap-2 pl-6">
                          {assessment.surveyOptions.map((opt, i) => (
                             <span key={i} className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-sm font-medium">
                               {opt}
                             </span>
                          ))}
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="mt-8 bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start text-sm">
                   <Info className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                   <div className="flex-1">
                     <p>Soal ini sudah aktif di <strong>Portal Siswa</strong>. Silakan arahkan siswa untuk mengakses halaman ini dan masuk sebagai siswa untuk mengerjakan pretest dan survei.</p>
                     <p className="text-xs text-blue-600 mt-2">Data nilai & peminatan siswa yang telah mengisi akan masuk ke tab Data Siswa.</p>
                   </div>
                 </div>
                 
                 <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => saveAssessmentToFirestore(null)}
                      className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors"
                    >
                      Hapus Ujian Aktif
                    </button>
                 </div>
               </div>
             )}

             {/* EDITOR HASIL */}
             {assessment && isEditingAssessment && (
               <AssessmentEditor
                 assessment={assessment}
                 onChange={(newAssessment) => saveAssessmentToFirestore(newAssessment)}
                 onFinish={() => setIsEditingAssessment(false)}
               />
             )}
          </div>
        )}

        {/* TAB 1: DATA SISWA */}
        {activeTab === 'students' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Manajemen Siswa</h2>
                {students.length > 0 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={exportToCSV}
                      className="text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center border border-green-200 hover:border-green-300"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Ekspor CSV
                    </button>
                    <button 
                      onClick={clearStudents}
                      className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center border border-transparent"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Hapus Semua
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 mb-4">
                <button 
                  onClick={() => setIsBulkMode(false)}
                  className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${!isBulkMode ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-500 hover:bg-neutral-100'}`}
                >
                  Tambah Satu
                </button>
                <button 
                  onClick={() => setIsBulkMode(true)}
                  className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${isBulkMode ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-500 hover:bg-neutral-100'}`}
                >
                  Tambah Banyak
                </button>
              </div>

              {!isBulkMode ? (
                <form onSubmit={addStudent} className="flex space-x-2">
                  <input 
                    type="text" 
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Nama lengkap siswa..."
                    className="flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!newStudentName.trim()}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center"
                  >
                    <Plus className="w-5 h-5 mr-1" />
                    Tambah
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <textarea 
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder="Paste daftar nama siswa (pisahkan dengan baris baru enter)&#10;Contoh:&#10;Budi Santoso&#10;Siti Aminah..."
                    className="w-full rounded-lg border border-neutral-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all min-h-[120px]"
                  />
                  <button 
                    onClick={addBulkStudents}
                    disabled={!bulkInput.trim()}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center w-full justify-center"
                  >
                    <Plus className="w-5 h-5 mr-1" />
                    Tambahkan Semua
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50">
                <h3 className="font-medium text-neutral-700">Daftar Siswa ({students.length})</h3>
              </div>
              {students.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 flex flex-col items-center">
                  <Users className="w-12 h-12 text-neutral-300 mb-3" />
                  <p>Belum ada data siswa.</p>
                  <p className="text-sm mt-1">Silakan tambahkan di atas.</p>
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto">
                  {students.map((student, idx) => (
                    <li key={student.id} className="px-6 py-3 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center">
                        <span className="w-6 text-sm text-neutral-400">{idx + 1}.</span>
                        <span className="font-medium text-neutral-800">{student.name}</span>
                      </div>
                      <button 
                        onClick={() => removeStudent(student.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: KELOMPOK ASAL (ACAK) */}
        {activeTab === 'random' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center">
                     Pemetaan Kelompok Asal
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">Membagi siswa secara acak tanpa mempertimbangkan nilai.</p>
                </div>
                
                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  <div className="flex items-center">
                    <label className="text-sm font-medium mr-2 text-neutral-600">Jumlah Kelompok:</label>
                    <input 
                      type="number" 
                      min="1" 
                      max={students.length || 1}
                      value={numRandomGroups}
                      onChange={(e) => setNumRandomGroups(Number(e.target.value))}
                      className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center"
                    />
                  </div>
                  <button 
                    onClick={generateRandomGroups}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Acak Sekarang
                  </button>
                </div>
              </div>
            </div>

            {randomGroups.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {randomGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NILAI PRETEST */}
        {activeTab === 'pretest' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 flex items-start space-x-4">
               <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <ClipboardList className="w-6 h-6" />
               </div>
               <div>
                 <h2 className="text-lg font-semibold text-neutral-800">Input Nilai Pretest Kognitif</h2>
                 <p className="text-sm text-neutral-600 mt-1">
                   Masukkan skor/nilai assessment awal. Data ini digunakan untuk memetakan siswa ke <strong>Kelompok Heterogen</strong> secara adil berdasarkan variasi kemampuan.
                 </p>
               </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-6 py-3 text-xs uppercase tracking-wider font-semibold text-neutral-500 w-16">No</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider font-semibold text-neutral-500">Nama Siswa</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider font-semibold text-neutral-500 w-48">Nilai Pretest (0-100)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-neutral-500">
                        Belum ada siswa.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-neutral-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-medium text-neutral-800">{student.name}</td>
                        <td className="px-6 py-4">
                          <input 
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={student.score === null ? '' : student.score}
                            onChange={(e) => updateScore(student.id, e.target.value)}
                            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
             </div>
          </div>
        )}

        {/* TAB 4: SURVEI MINAT */}
        {activeTab === 'survei' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 flex items-start space-x-4">
               <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                  <Compass className="w-6 h-6" />
               </div>
               <div>
                 <h2 className="text-lg font-semibold text-neutral-800">Input Hasil Survei Minat</h2>
                 <p className="text-sm text-neutral-600 mt-1">
                   Masukkan topik peminatan setiap siswa (contoh: <em>Sains, Seni, Coding, Olahraga</em>). Data ini digunakan untuk memetakan siswa ke <strong>Kelompok Homogen</strong> dengan peminatan serupa.
                 </p>
               </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-6 py-3 text-xs uppercase tracking-wider font-semibold text-neutral-500 w-16">No</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider font-semibold text-neutral-500">Nama Siswa</th>
                    <th className="px-6 py-3 text-xs uppercase tracking-wider font-semibold text-neutral-500 w-64">Topik Peminatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-neutral-500">
                        Belum ada siswa.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, idx) => (
                      <tr key={student.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-neutral-500">{idx + 1}</td>
                        <td className="px-6 py-4 font-medium text-neutral-800">{student.name}</td>
                        <td className="px-6 py-4">
                          <input 
                            type="text"
                            placeholder="Contoh: Coding"
                            value={student.interest || ''}
                            onChange={(e) => updateInterest(student.id, e.target.value)}
                            list="interest-suggestions"
                            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <datalist id="interest-suggestions">
                <option value="Sains" />
                <option value="Sosial" />
                <option value="Bahasa" />
                <option value="Seni" />
                <option value="Olahraga" />
                <option value="Sastra" />
                <option value="Teknologi" />
                <option value="Matematika" />
              </datalist>
             </div>
          </div>
        )}

        {/* TAB 5: KELOMPOK HETEROGEN */}
        {activeTab === 'hetero' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div>
                 <h2 className="text-lg font-semibold flex items-center">
                    Pemetaan Kelompok Heterogen
                 </h2>
                 <p className="text-sm text-neutral-500 mt-1">Membagi siswa agar setiap kelompok memiliki variasi kemampuan (tinggi, sedang, rendah).</p>
               </div>
               
               <div className="flex items-center space-x-3 w-full sm:w-auto">
                 <div className="flex items-center">
                   <label className="text-sm font-medium mr-2 text-neutral-600">Jumlah Kelompok:</label>
                   <input 
                     type="number" 
                     min="1" 
                     max={students.length || 1}
                     value={numHeteroGroups}
                     onChange={(e) => setNumHeteroGroups(Number(e.target.value))}
                     className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center"
                   />
                 </div>
                 <button 
                   onClick={generateHeteroGroups}
                   className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center shadow-sm"
                 >
                   <Award className="w-4 h-4 mr-2" />
                   Bentuk Kelompok
                 </button>
               </div>
             </div>
           </div>

           {heteroGroups.length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {heteroGroups.map((group) => (
                 <GroupCard 
                  key={group.id} 
                  group={group} 
                  showScore={true} 
                  averageScore={getAverageScore(group)} 
                 />
               ))}
             </div>
           )}
         </div>
        )}

        {/* TAB 6: KELOMPOK HOMOGEN (MINAT) */}
        {activeTab === 'homogen' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div>
                 <h2 className="text-lg font-semibold flex items-center">
                    Pemetaan Kelompok Homogen (Minat)
                 </h2>
                 <p className="text-sm text-neutral-500 mt-1">Mengelompokkan siswa yang memiliki peminatan/topik survei yang sama bersama-sama.</p>
               </div>
               
               <div className="flex items-center space-x-3 w-full sm:w-auto">
                 <div className="flex items-center">
                   <label className="text-sm font-medium ml-2 mr-2 text-neutral-600 hidden sm:block">Max Siswa/Kelompok:</label>
                   <span className="text-sm mr-2 sm:hidden">Max/Kel:</span>
                   <input 
                     type="number" 
                     min="1" 
                     max={students.length || 1}
                     value={maxPerInterestGroup}
                     onChange={(e) => setMaxPerInterestGroup(Number(e.target.value))}
                     className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-center"
                   />
                 </div>
                 <button 
                   onClick={generateInterestGroups}
                   className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center shadow-sm whitespace-nowrap"
                 >
                   <PieChart className="w-4 h-4 mr-2" />
                   Kelompokkan
                 </button>
               </div>
             </div>
           </div>

           {interestGroups.length > 0 && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {interestGroups.map((group) => (
                 <GroupCard 
                  key={group.id} 
                  group={group} 
                  showInterest={true}
                 />
               ))}
             </div>
           )}
         </div>
        )}

      </main>
      <div className="w-full text-center text-neutral-400 text-sm font-medium pb-4 mt-8">
        Copyright @2026 - Imam Rohman, S.Kom.
      </div>
    </div>
  );
}

// --- Helper Components ---

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-4 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
        active 
          ? 'border-indigo-600 text-indigo-600' 
          : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface GroupCardProps {
  group: Group;
  showScore?: boolean;
  averageScore?: string;
  showInterest?: boolean;
}

function GroupCard({ group, showScore = false, averageScore = '', showInterest = false }: GroupCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-full animate-in zoom-in-95 duration-300">
      <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50/80 flex justify-between items-center">
        <h3 className="font-semibold text-neutral-800">{group.name}</h3>
        <span className="text-xs font-semibold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">
          {group.students.length} Siswa
        </span>
      </div>
      <div className="p-5 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {group.students.map((s, i) => (
            <li key={s.id} className="flex justify-between items-center text-sm">
              <span className="text-neutral-700 flex items-center">
                <span className="w-5 text-neutral-400 font-mono text-xs">{i+1}.</span> 
                {s.name}
              </span>
              {showScore && (
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                  (s.score || 0) >= 80 ? 'bg-green-100 text-green-700' :
                  (s.score || 0) >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {s.score}
                </span>
              )}
              {showInterest && s.interest && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 truncate max-w-[100px]">
                  {s.interest}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
      {showScore && (
        <div className="px-5 py-3 border-t border-neutral-200 bg-neutral-50 mt-auto flex justify-between items-center">
          <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Rata-rata Nilai</span>
          <span className="font-bold text-sm text-neutral-800">{averageScore}</span>
        </div>
      )}
    </div>
  );
}

