import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { ApiKey, Project, QALog, UsageRecord, AIProvider } from './types';

// === Helpers ===
function userCol(uid: string, colName: string) {
    return collection(db, 'users', uid, colName);
}

function toDate(ts: unknown): Date {
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts instanceof Date) return ts;
    return new Date();
}

// === API Keys ===
export async function getApiKeys(uid: string): Promise<ApiKey[]> {
    const snap = await getDocs(query(userCol(uid, 'apiKeys'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: toDate(d.data().createdAt),
        updatedAt: toDate(d.data().updatedAt),
    })) as ApiKey[];
}

export async function addApiKey(uid: string, key: Omit<ApiKey, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(userCol(uid, 'apiKeys'), {
        ...key,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateApiKey(uid: string, keyId: string, data: Partial<ApiKey>): Promise<void> {
    const ref = doc(db, 'users', uid, 'apiKeys', keyId);
    await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteApiKey(uid: string, keyId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'apiKeys', keyId));
}

// === Projects ===
export async function getProjects(uid: string): Promise<Project[]> {
    const snap = await getDocs(query(userCol(uid, 'projects'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: toDate(d.data().createdAt),
        updatedAt: toDate(d.data().updatedAt),
    })) as Project[];
}

export async function addProject(uid: string, project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(userCol(uid, 'projects'), {
        ...project,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function updateProject(uid: string, projectId: string, data: Partial<Project>): Promise<void> {
    const ref = doc(db, 'users', uid, 'projects', projectId);
    await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
}

export async function deleteProject(uid: string, projectId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'projects', projectId));
}

// === QA Logs ===
export async function getQALogs(
    uid: string,
    filters?: {
        provider?: AIProvider;
        projectId?: string;
        limitCount?: number;
    }
): Promise<QALog[]> {
    let q = query(userCol(uid, 'qaLogs'), orderBy('createdAt', 'desc'));

    if (filters?.provider) {
        q = query(userCol(uid, 'qaLogs'), where('provider', '==', filters.provider), orderBy('createdAt', 'desc'));
    }
    if (filters?.projectId) {
        q = query(userCol(uid, 'qaLogs'), where('projectId', '==', filters.projectId), orderBy('createdAt', 'desc'));
    }
    if (filters?.limitCount) {
        q = query(q, limit(filters.limitCount));
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: toDate(d.data().createdAt),
    })) as QALog[];
}

export async function addQALog(uid: string, log: Omit<QALog, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(userCol(uid, 'qaLogs'), {
        ...log,
        createdAt: Timestamp.now(),
    });
    return docRef.id;
}

export async function getQALogById(uid: string, logId: string): Promise<QALog | null> {
    const ref = doc(db, 'users', uid, 'qaLogs', logId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return {
        id: snap.id,
        ...snap.data(),
        createdAt: toDate(snap.data().createdAt),
    } as QALog;
}

// === Usage Records ===
export async function getUsageRecords(
    uid: string,
    filters?: { provider?: AIProvider; date?: string; projectId?: string }
): Promise<UsageRecord[]> {
    let q = query(userCol(uid, 'usageRecords'), orderBy('date', 'desc'));

    if (filters?.provider) {
        q = query(userCol(uid, 'usageRecords'), where('provider', '==', filters.provider), orderBy('date', 'desc'));
    }
    if (filters?.date) {
        q = query(userCol(uid, 'usageRecords'), where('date', '==', filters.date), orderBy('date', 'desc'));
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
    })) as UsageRecord[];
}

export async function addUsageRecord(uid: string, record: Omit<UsageRecord, 'id'>): Promise<string> {
    const docRef = await addDoc(userCol(uid, 'usageRecords'), record);
    return docRef.id;
}

export async function getTodayUsage(uid: string): Promise<Record<AIProvider, { requests: number; tokens: number }>> {
    const today = new Date().toISOString().split('T')[0];
    const snap = await getDocs(
        query(userCol(uid, 'usageRecords'), where('date', '==', today))
    );

    const usage: Record<string, { requests: number; tokens: number }> = {
        gemini: { requests: 0, tokens: 0 },
        groq: { requests: 0, tokens: 0 },
        cerebras: { requests: 0, tokens: 0 },
        custom: { requests: 0, tokens: 0 },
    };

    snap.docs.forEach(d => {
        const data = d.data() as DocumentData;
        const provider = data.provider as string;
        if (usage[provider]) {
            usage[provider].requests += data.requestCount || 0;
            usage[provider].tokens += data.tokenCount || 0;
        }
    });

    return usage as Record<AIProvider, { requests: number; tokens: number }>;
}
